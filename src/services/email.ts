import nodemailer from 'nodemailer';
import dns from 'node:dns';
import net from 'node:net';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import type Order from '../models/Order.js';

type OrderLine = { name: string; price: number; quantity: number };

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
}

type MailConfig = {
  transport: nodemailer.Transporter;
  from: string;
  notificationEmail: string;
  port: number;
  secure: boolean;
};

function getNotificationEmail() {
  return process.env.ORDER_NOTIFICATION_EMAIL || process.env.SMTP_USER || process.env.EMAIL_FROM?.match(/<([^>]+)>/)?.[1] || process.env.EMAIL_FROM;
}

function getMailConfigs(): MailConfig[] {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return [];

  const port = Number(process.env.SMTP_PORT || 465);
  const secureSetting = String(process.env.SMTP_SECURE || '').trim().toLowerCase();
  const secure = secureSetting ? secureSetting === 'true' : port === 465;
  const candidates = [{ port, secure }];
  // Some hosted platforms throttle/block implicit TLS on port 465. Hostinger
  // also supports STARTTLS on 587, so retry that transport automatically.
  if (port === 465) candidates.push({ port: 587, secure: false });
  if (port === 587) candidates.push({ port: 465, secure: true });

  return candidates.map((candidate) => ({
    transport: nodemailer.createTransport({
      host,
      port: candidate.port,
      secure: candidate.secure,
      requireTLS: !candidate.secure,
      // Resolve an IPv4 address explicitly. Railway may otherwise pick the
      // IPv6 address for smtp.hostinger.com, which is unreachable there.
      getSocket: (_options: SMTPTransport.Options, callback: (error: Error | null, socketOptions: any) => void) => {
  // dns.lookup uses the OS resolver (same as nslookup/Test-NetConnection),
  // unlike dns.resolve4 which does a raw DNS query that some routers block.
  dns.lookup(host, { family: 4 }, (error, address) => {
    if (error || !address) {
      callback(error || new Error(`No IPv4 address found for ${host}`), false);
      return;
    }
    callback(null, { connection: net.connect({ host: address, port: candidate.port }) });
  });
},
      auth: { user, pass },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 20_000,
    }),
    from: process.env.EMAIL_FROM || user,
    notificationEmail: process.env.ORDER_NOTIFICATION_EMAIL || user,
    port: candidate.port,
    secure: candidate.secure,
  }));
}

function getMailConfig() {
  return getMailConfigs()[0] || null;
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
  const configs = getMailConfigs();
  if (!configs.length) {
    console.error('Email delivery is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD.');
    return false;
  }
  for (const config of configs) {
    try {
      await config.transport.sendMail({ from: config.from, to, subject, html });
      return true;
    } catch (error) {
      const details = error as Error & { code?: string; response?: string };
      console.error(`Email delivery failed on SMTP port ${config.port}:`, details.message || error, details.code || '', details.response || '');
    }
  }
  return false;
}

export async function verifyMailTransport() {
  const configs = getMailConfigs();
  for (const config of configs) {
    try {
      await config.transport.verify();
      console.log(`SMTP connection verified on port ${config.port}`);
      return true;
    } catch (error) {
      const details = error as Error & { code?: string; response?: string };
      console.error(`SMTP connection verification failed on port ${config.port}:`, details.message || error, details.code || '', details.response || '');
    }
  }
  return false;
}

export async function sendLoginOtp(email: string, code: string) {
  return sendMail(
    email,
    'Your Fuddins login code',
    `<h2>Your Fuddins login code</h2><p>Use <strong style="font-size:24px;letter-spacing:4px">${escapeHtml(code)}</strong> to sign in.</p><p>This code expires in 10 minutes. Do not share it with anyone.</p>`
  );
}

export async function sendPasswordResetOtp(email: string, code: string) {
  return sendMail(
    email,
    'Reset your Fuddins password',
    `<h2>Reset your Fuddins password</h2><p>Use <strong style="font-size:24px;letter-spacing:4px">${escapeHtml(code)}</strong> to choose a new password.</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`
  );
}

export async function sendOrderCreatedEmails(order: Order, paymentUrl?: string) {
  const notificationEmail = getNotificationEmail();
  if (!notificationEmail) return;
  const paymentSection = paymentUrl
    ? `<p>To complete your payment securely, open this link: <a href="${escapeHtml(paymentUrl)}">Pay securely with Razorpay</a></p>`
    : '<p>Your order has been received. Payment will be collected on delivery.</p>';
  const summary = orderSummary(order);
  await Promise.all([
    sendMail(order.email, `Fuddins order #${order.id} received`, `<h2>Thank you, ${escapeHtml(order.customerName)}!</h2>${summary}${paymentSection}`),
    sendMail(notificationEmail, `New Fuddins order #${order.id}`, `<h2>New order received</h2><p>Customer: ${escapeHtml(order.customerName)} (${escapeHtml(order.email)})</p>${summary}<p>Payment: ${escapeHtml(order.paymentMethod)} / ${escapeHtml(order.paymentStatus)}</p>`),
  ]);
}

export async function sendPaymentReceipt(order: Order) {
  const notificationEmail = getNotificationEmail();
  if (!notificationEmail) return;
  const summary = orderSummary(order);
  await Promise.all([
    sendMail(order.email, `Payment received for Fuddins order #${order.id}`, `<h2>Payment successful</h2><p>Thank you, ${escapeHtml(order.customerName)}. Your payment has been received.</p>${summary}<p>Payment ID: ${escapeHtml(order.paymentId || 'Confirmed')}</p>`),
    sendMail(notificationEmail, `Payment received: Fuddins order #${order.id}`, `<h2>Payment received</h2><p>Customer: ${escapeHtml(order.customerName)} (${escapeHtml(order.email)})</p>${summary}<p>Payment ID: ${escapeHtml(order.paymentId || 'Confirmed')}</p>`),
  ]);
}

export async function sendContactNotification(payload: { name: string; email: string; phone?: string | null; subject?: string | null; message: string }) {
  const notificationEmail = getNotificationEmail();
  if (!notificationEmail) return;
  await sendMail(
    notificationEmail,
    `Fuddins enquiry: ${payload.subject || 'Website enquiry'}`,
    `<h2>New website enquiry</h2><p><strong>Name:</strong> ${escapeHtml(payload.name)}</p><p><strong>Email:</strong> ${escapeHtml(payload.email)}</p><p><strong>Phone:</strong> ${escapeHtml(payload.phone || '')}</p><p><strong>Subject:</strong> ${escapeHtml(payload.subject || 'Website enquiry')}</p><p>${escapeHtml(payload.message)}</p>`
  );
}
