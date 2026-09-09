import Invoice from '../models/Invoice.js';
import Order from '../models/Order.js';

function escapePdfText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/\r?\n/g, ' ');
}

function parseItems(items: string) {
  try {
    const parsed = JSON.parse(items);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function invoiceNumber(orderId: number) {
  return `FUD-${String(orderId).padStart(6, '0')}`;
}

export async function ensureInvoice(order: Order) {
  const [invoice] = await Invoice.findOrCreate({
    where: { orderId: order.id },
    defaults: { orderId: order.id, invoiceNumber: invoiceNumber(order.id), status: 'issued' },
  });
  return invoice;
}

export async function generateInvoicePdf(order: Order) {
  const invoice = await ensureInvoice(order);
  const items = parseItems(order.items);
  const lines = [
    'FUDDINS',
    'Your Comfort Partner',
    `Invoice: ${invoice.invoiceNumber}`,
    `Order: #${order.id}`,
    `Date: ${new Date(invoice.issuedAt || order.createdAt).toLocaleDateString('en-IN')}`,
    '',
    `Customer: ${order.customerName}`,
    `Email: ${order.email}`,
    order.phone ? `Phone: ${order.phone}` : '',
    order.billingAddress ? `Billing: ${order.billingAddress}` : '',
    order.shippingAddress ? `Shipping: ${order.shippingAddress}` : '',
    '',
    'Items:',
    ...items.map((item: { name?: string; quantity?: number; price?: number }) => `- ${item.name || 'Item'} x ${item.quantity || 1} @ Rs. ${Number(item.price || 0).toFixed(2)}`),
    '',
    `Subtotal: Rs. ${Number(order.subtotal ?? order.total).toFixed(2)}`,
    `Discount: Rs. ${Number(order.discountTotal || 0).toFixed(2)}`,
    `Shipping: Rs. ${Number(order.shippingTotal || 0).toFixed(2)}`,
    `Tax: Rs. ${Number(order.taxTotal || 0).toFixed(2)}`,
    `Total: Rs. ${Number(order.total).toFixed(2)}`,
    `Payment: ${order.paymentMethod} / ${order.paymentStatus}`,
    `Status: ${order.status}`,
  ].filter(Boolean);

  const content = [
    'BT',
    '/F1 12 Tf',
    '50 790 Td',
    ...lines.flatMap((line, index) => [
      index === 0 ? '/F1 20 Tf' : index === 1 ? '/F1 11 Tf' : '/F1 12 Tf',
      `(${escapePdfText(line)}) Tj`,
      '0 -18 Td',
    ]),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return { invoice, pdf: Buffer.from(pdf, 'utf8') };
}
