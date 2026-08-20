import nodemailer from 'nodemailer';
import type Order from '../models/Order.js';

type OrderLine = { name: string; price: number; quantity: number };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

function getMailConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT || 465);
  return {
    transport: nodemailer.createTransport({ host, port, secure: process.env.SMTP_SECURE !== 'false', auth: { user, pass } }),
    from: process.env.EMAIL_FROM || user,
    notificationEmail: process.env.ORDER_NOTIFICATION_EMAIL || user,
  };
}

function getOrderLines(order: Order) {
  try {
    return JSON.parse(order.items) as OrderLine[];
  } catch {
    return [];
  }
}

function orderSummary(order: Order) {
  const items = getOrderLines(order)
    .map((item) => `<li>${escapeHtml(item.name)} × ${item.quantity} — Rs. ${item.price * item.quantity}</li>`)
    .join('');
  return `<p><strong>Order #${order.id}</strong></p><ul>${items}</ul><p><strong>Total: Rs. ${order.total}</strong></p>`;
}

async function sendMail(to: string, subject: string, html: string) {
  const config = getMailConfig();
  if (!config) return false;
  try {
    await config.transport.sendMail({ from: config.from, to, subject, html });
    return true;
  } catch (error) {
    console.error('Email delivery failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

export async function sendLoginOtp(email: string, code: string) {
  return sendMail(
    email,
    'Your Fuddins login code',
    `<h2>Your Fuddins login code</h2><p>Use <strong style="font-size:24px;letter-spacing:4px">${escapeHtml(code)}</strong> to sign in.</p><p>This code expires in 10 minutes. Do not share it with anyone.</p>`
  );
}

export async function sendOrderCreatedEmails(order: Order, paymentUrl?: string) {
  const config = getMailConfig();
  if (!config) return;
  const paymentSection = paymentUrl
    ? `<p>To complete your payment securely, open this link: <a href="${escapeHtml(paymentUrl)}">Pay securely with Razorpay</a></p>`
    : '<p>Your order has been received. Payment will be collected on delivery.</p>';
  const summary = orderSummary(order);
  await Promise.all([
    sendMail(order.email, `Fuddins order #${order.id} received`, `<h2>Thank you, ${escapeHtml(order.customerName)}!</h2>${summary}${paymentSection}`),
    sendMail(config.notificationEmail, `New Fuddins order #${order.id}`, `<h2>New order received</h2><p>Customer: ${escapeHtml(order.customerName)} (${escapeHtml(order.email)})</p>${summary}<p>Payment: ${escapeHtml(order.paymentMethod)} / ${escapeHtml(order.paymentStatus)}</p>`),
  ]);
}

export async function sendPaymentReceipt(order: Order) {
  const config = getMailConfig();
  if (!config) return;
  const summary = orderSummary(order);
  await Promise.all([
    sendMail(order.email, `Payment received for Fuddins order #${order.id}`, `<h2>Payment successful</h2><p>Thank you, ${escapeHtml(order.customerName)}. Your payment has been received.</p>${summary}<p>Payment ID: ${escapeHtml(order.paymentId || 'Confirmed')}</p>`),
    sendMail(config.notificationEmail, `Payment received: Fuddins order #${order.id}`, `<h2>Payment received</h2><p>Customer: ${escapeHtml(order.customerName)} (${escapeHtml(order.email)})</p>${summary}<p>Payment ID: ${escapeHtml(order.paymentId || 'Confirmed')}</p>`),
  ]);
}

export async function sendContactNotification(payload: { name: string; email: string; phone?: string | null; subject?: string | null; message: string }) {
  const config = getMailConfig();
  if (!config) return;
  await sendMail(
    config.notificationEmail,
    `Fuddins enquiry: ${payload.subject || 'Website enquiry'}`,
    `<h2>New website enquiry</h2><p><strong>Name:</strong> ${escapeHtml(payload.name)}</p><p><strong>Email:</strong> ${escapeHtml(payload.email)}</p><p><strong>Phone:</strong> ${escapeHtml(payload.phone || '')}</p><p><strong>Subject:</strong> ${escapeHtml(payload.subject || 'Website enquiry')}</p><p>${escapeHtml(payload.message)}</p>`
  );
}
