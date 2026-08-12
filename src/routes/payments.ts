import crypto from 'crypto';
import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import { sendOrderCreatedEmails, sendPaymentReceipt } from '../services/email.js';
import { ensureInvoice } from '../services/invoice.js';
import { awardOrderRewards } from '../services/loyalty.js';

type CartLine = { productId: number; quantity: number };

function razorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error('Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env.');
  return { keyId, keySecret };
}

async function calculateItems(items: CartLine[]) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('Cart items are required');
  const quantities = new Map<number, number>();
  for (const item of items) {
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1) throw new Error('Cart contains an invalid item');
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }

  const products = await Product.findAll({ where: { id: { [Op.in]: [...quantities.keys()] } } });
  if (products.length !== quantities.size) throw new Error('One or more products are no longer available');

  const normalizedItems = products.map((product) => {
    const quantity = quantities.get(product.id) || 0;
    if (product.stockStatus === 'outofstock' || (product.stockQuantity !== null && product.stockQuantity < quantity)) throw new Error(`${product.name} is out of stock`);
    return {
      productId: product.id,
      name: product.name,
      price: Number(product.salePrice || product.price),
      quantity,
      sku: product.sku || null,
    };
  });
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return { normalizedItems, products, quantities, subtotal };
}

async function applyCoupon(code: unknown, subtotal: number) {
  const couponCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
  if (!couponCode) return { coupon: null as Coupon | null, discountTotal: 0 };
  const coupon = await Coupon.findOne({ where: { code: couponCode, active: true } });
  if (!coupon || (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) || (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)) throw new Error('Coupon is not valid');
  const rawDiscount = coupon.discountType === 'percent' ? subtotal * (coupon.amount / 100) : coupon.amount;
  return { coupon, discountTotal: Math.min(Math.max(rawDiscount, 0), subtotal) };
}

export async function createRazorpayPaymentLink(req: Request, res: Response) {
  try {
    if (!req.body.customerName?.trim() || !req.body.email?.trim()) return res.status(400).json({ error: 'Customer name and email are required' });
    const { keyId, keySecret } = razorpayConfig();
    const { normalizedItems, products, quantities, subtotal } = await calculateItems(req.body.items);
    const { coupon, discountTotal } = await applyCoupon(req.body.couponCode, subtotal);
    const shippingTotal = Number(req.body.shippingTotal || 0);
    const taxTotal = Number(req.body.taxTotal || 0);
    const total = Math.max(subtotal - discountTotal + shippingTotal + taxTotal, 0);
    const order = await Order.create({
      customerName: req.body.customerName.trim(),
      email: req.body.email.trim().toLowerCase(),
      total,
      subtotal,
      discountTotal,
      shippingTotal,
      taxTotal,
      items: JSON.stringify(normalizedItems),
      status: 'pending',
      couponCode: coupon?.code || null,
      billingAddress: typeof req.body.billingAddress === 'string' ? req.body.billingAddress : null,
      shippingAddress: typeof req.body.shippingAddress === 'string' ? req.body.shippingAddress : null,
      phone: typeof req.body.phone === 'string' ? req.body.phone : null,
      paymentMethod: 'online',
      paymentStatus: 'pending',
      paymentProvider: 'razorpay',
    });

    const response = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(total * 100),
        currency: 'INR',
        reference_id: `order_${order.id}`,
        description: `Fuddins order #${order.id}`,
        customer: { name: order.customerName, email: order.email },
        notify: { sms: false, email: false },
        reminder_enable: false,
        expire_by: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
        notes: { order_id: String(order.id) },
      }),
    });
    const link = await response.json() as { id?: string; short_url?: string; error?: { description?: string } };
    if (!response.ok || !link.id || !link.short_url) {
      await order.update({ paymentStatus: 'failed' });
      return res.status(502).json({ error: link.error?.description || 'Unable to create Razorpay payment link' });
    }

    await order.update({ paymentLinkId: link.id });
    for (const product of products) {
      const quantity = quantities.get(product.id) || 0;
      if (product.stockQuantity !== null) await product.update({ stockQuantity: Math.max(product.stockQuantity - quantity, 0) });
    }
    if (coupon) await coupon.increment('usedCount');
    void ensureInvoice(order);
    void sendOrderCreatedEmails(order, link.short_url);
    res.status(201).json({ orderId: order.id, paymentStatus: 'pending', paymentUrl: link.short_url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start payment';
    res.status(message.includes('required') || message.includes('invalid') ? 400 : 500).json({ error: message });
  }
}

export async function getPaymentStatus(req: Request, res: Response) {
  const order = await Order.findOne({ where: { id: Number(req.params.id), email: String(req.query.email || '').trim().toLowerCase() } });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (order.paymentMethod === 'online' && order.paymentLinkId && order.paymentStatus === 'pending') {
    try {
      const { keyId, keySecret } = razorpayConfig();
      const response = await fetch(`https://api.razorpay.com/v1/payment_links/${order.paymentLinkId}`, {
        headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}` },
      });
      const link = await response.json() as { status?: string; payments?: Array<{ id?: string }> };
      if (response.ok && link.status === 'paid') {
        await order.update({ paymentStatus: 'paid', paymentId: link.payments?.[0]?.id || order.paymentId });
        void awardOrderRewards(order);
        void sendPaymentReceipt(order);
      } else if (response.ok && (link.status === 'cancelled' || link.status === 'expired')) {
        await order.update({ paymentStatus: 'failed' });
      }
    } catch (error) {
      console.error('Razorpay payment status refresh failed:', error instanceof Error ? error.message : error);
    }
  }

  res.json({ orderId: order.id, paymentMethod: order.paymentMethod, paymentStatus: order.paymentStatus, paymentId: order.paymentId });
}

export async function razorpayWebhook(req: Request, res: Response) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.header('x-razorpay-signature');
  const rawBody = req.body as Buffer;
  if (!webhookSecret || !signature || !Buffer.isBuffer(rawBody)) return res.status(400).json({ error: 'Invalid webhook request' });

  const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const receivedSignature = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  if (receivedSignature.length !== expectedSignatureBuffer.length || !crypto.timingSafeEqual(receivedSignature, expectedSignatureBuffer)) return res.status(400).json({ error: 'Invalid webhook signature' });

  try {
    const event = JSON.parse(rawBody.toString()) as { event?: string; payload?: { payment_link?: { entity?: { id?: string; status?: string } }; payment?: { entity?: { id?: string } } } };
    const paymentLink = event.payload?.payment_link?.entity;
    if (paymentLink?.id) {
      const status = event.event === 'payment_link.paid' || paymentLink.status === 'paid' ? 'paid' : paymentLink.status === 'cancelled' || paymentLink.status === 'expired' ? 'failed' : 'pending';
      const order = await Order.findOne({ where: { paymentLinkId: paymentLink.id } });
      if (order) {
        const wasPaid = order.paymentStatus === 'paid';
        await order.update({ paymentStatus: status, paymentId: event.payload?.payment?.entity?.id || order.paymentId });
        if (status === 'paid' && !wasPaid) {
          void awardOrderRewards(order);
          void sendPaymentReceipt(order);
        }
      }
    }
    res.status(200).json({ received: true });
  } catch {
    res.status(400).json({ error: 'Invalid webhook payload' });
  }
}
