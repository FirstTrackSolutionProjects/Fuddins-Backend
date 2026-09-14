import type { Request, Response } from 'express';
import ShoppingCardApplication from '../models/ShoppingCardApplication.js';
import { razorpayConfig } from './paymentsController.js';

const CARD_FEE = 999;
const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const phoneNumber = (value: unknown) => clean(value).replace(/[\s().-]/g, '');

export async function createPaymentLink(req: Request, res: Response) {
  try {
    const email = clean(req.body.email).toLowerCase();
    const phone = phoneNumber(req.body.phone);
    if (!/^\S+@\S+\.\S+$/.test(email) || !/^\+?\d{10,15}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid email and phone number' });

    const application = await ShoppingCardApplication.create({ email, phone, amount: CARD_FEE });
    const { keyId, keySecret } = razorpayConfig();
    const response = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: CARD_FEE * 100, currency: 'INR', reference_id: `shopping_card_${application.id}`,
        description: 'Fuddins Shopping Card application', customer: { email, contact: phone },
        notify: { sms: false, email: false }, reminder_enable: false, expire_by: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
        notes: { shopping_card_application_id: String(application.id) },
      }),
    });
    const link = await response.json() as { id?: string; short_url?: string; error?: { description?: string } };
    if (!response.ok || !link.id || !link.short_url) {
      await application.update({ paymentStatus: 'failed' });
      return res.status(502).json({ error: link.error?.description || 'Unable to create Razorpay payment link' });
    }
    await application.update({ paymentLinkId: link.id });
    res.status(201).json({ applicationId: application.id, amount: CARD_FEE, paymentUrl: link.short_url });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to start Shopping Card payment' });
  }
}

export async function createCheckoutOrder(req: Request, res: Response) {
  try {
    const email = clean(req.body.email).toLowerCase();
    const phone = phoneNumber(req.body.phone);
    if (!/^\S+@\S+\.\S+$/.test(email) || !/^\+?\d{10,15}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid email and phone number' });
    const application = await ShoppingCardApplication.create({ email, phone, amount: CARD_FEE });
    const { keyId, keySecret } = razorpayConfig();
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: CARD_FEE * 100, currency: 'INR', receipt: `shopping_card_${application.id}`, notes: { shopping_card_application_id: String(application.id) } }),
    });
    const order = await response.json() as { id?: string; amount?: number; currency?: string; error?: { description?: string } };
    if (!response.ok || !order.id) return res.status(502).json({ error: order.error?.description || 'Unable to create Razorpay order' });
    await application.update({ razorpayOrderId: order.id });
    res.status(201).json({ applicationId: application.id, keyId, orderId: order.id, amount: order.amount, currency: order.currency || 'INR', email, phone });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unable to start Shopping Card payment' });
  }
}

export async function verifyCheckoutPayment(req: Request, res: Response) {
  try {
    const orderId = clean(req.body.razorpay_order_id);
    const paymentId = clean(req.body.razorpay_payment_id);
    const signature = clean(req.body.razorpay_signature);
    const { keySecret } = razorpayConfig();
    const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
    if (!orderId || !paymentId || !signature || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return res.status(400).json({ error: 'Payment verification failed' });
    const application = await ShoppingCardApplication.findOne({ where: { razorpayOrderId: orderId } });
    if (!application) return res.status(404).json({ error: 'Shopping Card application not found' });
    await application.update({ paymentStatus: 'paid', status: 'paid', paymentId });
    res.json({ message: 'Payment verified', applicationId: application.id });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Payment verification failed' });
  }
}

export async function getApplications(_req: Request, res: Response) {
  res.json(await ShoppingCardApplication.findAll({ order: [['createdAt', 'DESC']] }));
}
import crypto from 'crypto';
