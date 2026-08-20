import crypto from 'crypto';
import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import Vendor from '../models/Vendor.js';
import { sendOrderCreatedEmails, sendPaymentReceipt } from '../services/email.js';
import { ensureInvoice } from '../services/invoice.js';
import { awardOrderRewards, redeemOrderBalances, refundOrderBalances, validateOrderRedemption } from '../services/loyalty.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

type CartLine = { productId: number; variationId?: number | null; quantity: number };
type ProductVariation = {
  id: number;
  title?: string | null;
  price?: number | null;
  salePrice?: number | null;
  sku?: string | null;
  stockQuantity?: number | null;
  stockStatus?: string;
  attributes?: Record<string, string>;
};

export function razorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error('Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env.');
  return { keyId, keySecret };
}

async function calculateItems(items: CartLine[]) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('Cart items are required');
  const quantities = new Map<string, { productId: number; variationId: number | null; quantity: number }>();
  for (const item of items) {
    const productId = Number(item.productId);
    const variationId = item.variationId ? Number(item.variationId) : null;
    const quantity = Number(item.quantity);
    if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1) throw new Error('Cart contains an invalid item');
    const key = `${productId}:${variationId || 'default'}`;
    const current = quantities.get(key);
    quantities.set(key, { productId, variationId, quantity: (current?.quantity || 0) + quantity });
  }

  const productIds = Array.from(new Set(Array.from(quantities.values()).map((item) => item.productId)));
  const products = await Product.findAll({ where: { id: { [Op.in]: productIds } } });
  const productById = new Map(products.map((product) => [product.id, product]));
  if (products.length !== productIds.length) throw new Error('One or more products are no longer available');

  const normalizedItems = Array.from(quantities.values()).map((cartItem) => {
    const product = productById.get(cartItem.productId);
    if (!product) throw new Error('One or more products are no longer available');
    const variation = cartItem.variationId ? parseVariations(product).find((item) => item.id === cartItem.variationId) : null;
    if (cartItem.variationId && !variation) throw new Error(`${product.name} option is no longer available`);
    const stockStatus = variation?.stockStatus || product.stockStatus;
    const stockQuantity = variation?.stockQuantity ?? product.stockQuantity;
    if (stockStatus === 'outofstock' || (stockQuantity !== null && stockQuantity < cartItem.quantity)) throw new Error(`${product.name} is out of stock`);
    return {
      productId: product.id,
      variationId: variation?.id || null,
      name: variation ? `${product.name} - ${variationLabel(variation)}` : product.name,
      price: Number(variation?.salePrice || variation?.price || product.salePrice || product.price),
      quantity: cartItem.quantity,
      sku: variation?.sku || product.sku || null,
    };
  });
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return { normalizedItems, products, quantities, subtotal };
}

function parseVariations(product: Product) {
  if (!product.variations) return [] as ProductVariation[];
  try {
    const variations = JSON.parse(product.variations) as ProductVariation[];
    return Array.isArray(variations) ? variations : [];
  } catch {
    return [] as ProductVariation[];
  }
}

function variationLabel(variation: ProductVariation) {
  const values = Object.values(variation.attributes || {}).filter(Boolean);
  return values.length ? values.join(' / ') : variation.title || `Option #${variation.id}`;
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
    const orderTotalBeforeRedemption = Math.max(subtotal - discountTotal + shippingTotal + taxTotal, 0);
    const requestedWallet = Number(req.body.walletAmount || 0);
    const requestedPoints = Number(req.body.rewardPoints || 0);
    const authUser = (req as AuthenticatedRequest).user;
    let redemption = { walletAmount: 0, rewardPoints: 0 };
    if (requestedWallet > 0 || requestedPoints > 0) {
      if (!authUser) return res.status(401).json({ error: 'Please login to use wallet or reward points' });
      if (authUser.email.toLowerCase() !== String(req.body.email).trim().toLowerCase()) return res.status(403).json({ error: 'Checkout email must match your account' });
      redemption = await validateOrderRedemption(authUser.id, orderTotalBeforeRedemption, requestedWallet, requestedPoints);
    }
    const total = Math.max(orderTotalBeforeRedemption - redemption.walletAmount - redemption.rewardPoints, 0);
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
    if (authUser && (redemption.walletAmount > 0 || redemption.rewardPoints > 0)) {
      await redeemOrderBalances(authUser.id, order.id, orderTotalBeforeRedemption, redemption.walletAmount, redemption.rewardPoints);
    }
    for (const product of products) {
      const productCartItems = Array.from(quantities.values()).filter((item) => item.productId === product.id);
      const parentQuantity = productCartItems.filter((item) => !item.variationId).reduce((sum, item) => sum + item.quantity, 0);
      const updatePayload: { stockQuantity?: number; variations?: string } = {};
      if (product.stockQuantity !== null && parentQuantity > 0) updatePayload.stockQuantity = Math.max(product.stockQuantity - parentQuantity, 0);

      const variationItems = productCartItems.filter((item) => item.variationId);
      if (variationItems.length) {
        const variations = parseVariations(product).map((variation) => {
          const quantity = variationItems.filter((item) => item.variationId === variation.id).reduce((sum, item) => sum + item.quantity, 0);
          if (!quantity || variation.stockQuantity === null || typeof variation.stockQuantity === 'undefined') return variation;
          return { ...variation, stockQuantity: Math.max(variation.stockQuantity - quantity, 0) };
        });
        updatePayload.variations = JSON.stringify(variations);
      }

      if (Object.keys(updatePayload).length) await product.update(updatePayload);
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
        await refundOrderBalances(order.id);
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
        if (status === 'failed') await refundOrderBalances(order.id);
      }
      const vendor = await Vendor.findOne({ where: { membershipPaymentLinkId: paymentLink.id } });
      if (vendor) {
        await vendor.update({ membershipPaymentStatus: status === 'paid' ? 'paid' : status === 'failed' ? 'failed' : 'pending', membershipStatus: status === 'paid' ? 'active' : vendor.membershipStatus, membershipPaymentId: event.payload?.payment?.entity?.id || vendor.membershipPaymentId, membershipStartedAt: status === 'paid' && !vendor.membershipStartedAt ? new Date() : vendor.membershipStartedAt, membershipExpiresAt: status === 'paid' && !vendor.membershipExpiresAt ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : vendor.membershipExpiresAt });
      }
    }
    res.status(200).json({ received: true });
  } catch {
    res.status(400).json({ error: 'Invalid webhook payload' });
  }
}
