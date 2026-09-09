import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import type { NextFunction } from 'express';
import { authenticateToken, requireAdmin, requirePartner, type AuthenticatedRequest } from '../middleware/auth.js';
import Order from '../models/Order.js';
import Vendor from '../models/Vendor.js';
import VendorSettlement from '../models/VendorSettlement.js';
import VendorPayoutRequest from '../models/VendorPayoutRequest.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import User from '../models/User.js';
import VendorNotice from '../models/VendorNotice.js';
import { razorpayConfig } from './paymentsController.js';

function partnerUser(req: AuthenticatedRequest) {
  return req.user!;
}

async function currentVendor(req: AuthenticatedRequest) {
  return Vendor.findOne({ where: { userId: partnerUser(req).id } });
}

export function requireVendor(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (partnerUser(req).role !== 'vendor') {
    return res.status(403).json({ error: 'Vendor access required' });
  }
  next();
}

export function requireDelivery(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (partnerUser(req).role !== 'delivery') return res.status(403).json({ error: 'Delivery access required' });
  next();
}

function vendorProductPayload(body: Record<string, unknown>) {
  return {
    name: String(body.name || '').trim(),
    price: Number(body.price || 0),
    regularPrice: body.regularPrice === '' || body.regularPrice === null ? null : Number(body.regularPrice),
    salePrice: body.salePrice === '' || body.salePrice === null ? null : Number(body.salePrice),
    sku: typeof body.sku === 'string' && body.sku.trim() ? body.sku.trim() : null,
    description: typeof body.description === 'string' ? body.description : '',
    fullDescription: typeof body.fullDescription === 'string' ? body.fullDescription : null,
    imageUrl: typeof body.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim() : null,
    stockQuantity: body.stockQuantity === '' || body.stockQuantity === null ? null : Number(body.stockQuantity),
    stockStatus: typeof body.stockStatus === 'string' && body.stockStatus.trim() ? body.stockStatus.trim() : 'instock',
    categoryId: body.categoryId ? Number(body.categoryId) : null,
    brand: typeof body.brand === 'string' ? body.brand.trim() : null,
    galleryImages: typeof body.galleryImages === 'string' ? body.galleryImages : (Array.isArray(body.galleryImages) ? JSON.stringify(body.galleryImages) : null),
    attributes: typeof body.attributes === 'string' ? body.attributes : (body.attributes ? JSON.stringify(body.attributes) : null),
    variations: typeof body.variations === 'string' ? body.variations : (Array.isArray(body.variations) ? JSON.stringify(body.variations) : null),
    lowStockThreshold: Number.isInteger(Number(body.lowStockThreshold)) ? Math.max(0, Number(body.lowStockThreshold)) : 5,
  };
}

function roleLabel(role: string) {
  return ({ admin: 'Administrator', admin_team: 'Admin Team', vendor: 'Vendor Partner', delivery: 'Delivery Partner' } as Record<string, string>)[role] || 'Partner';
}

export async function get__overview(req: Request, res: Response) {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const base = { role: user.role, roleLabel: roleLabel(user.role), tasks: [] as { title: string; detail: string; icon: string }[] };

    if (user.role === 'admin' || user.role === 'admin_team') {
      const [totalOrders, pendingOrders, activeVendors, pendingSettlements] = await Promise.all([
        Order.count(),
        Order.count({ where: { status: 'pending' } }),
        Vendor.count({ where: { status: 'active' } }),
        VendorSettlement.count({ where: { status: 'pending' } }),
      ]);
      return res.json({
        ...base,
        metrics: [
          { label: 'Total orders', value: totalOrders, icon: 'receipt-outline' },
          { label: 'Pending orders', value: pendingOrders, icon: 'time-outline' },
          { label: 'Active vendors', value: activeVendors, icon: 'storefront-outline' },
          { label: 'Pending payouts', value: pendingSettlements, icon: 'wallet-outline' },
        ],
        tasks: [{ title: 'Review pending orders', detail: `${pendingOrders} orders need attention`, icon: 'receipt-outline' }, { title: 'Review vendor payouts', detail: `${pendingSettlements} settlements are pending`, icon: 'cash-outline' }],
      });
    }

    if (user.role === 'vendor') {
      const vendor = await Vendor.findOne({ where: { userId: user.id } });
      const pendingPayouts = vendor ? await VendorSettlement.count({ where: { vendorId: vendor.id, status: 'pending' } }) : 0;
      const catalogCount = vendor ? await Product.count({ where: { vendorId: vendor.id } }) : 0;
      return res.json({
        ...base,
        vendor: vendor ? { id: vendor.id, storeName: vendor.storeName, status: vendor.status } : null,
        metrics: [
          { label: 'Store status', value: vendor?.status === 'active' ? 'Active' : 'Setup needed', icon: 'storefront-outline' },
          { label: 'Pending payouts', value: pendingPayouts, icon: 'wallet-outline' },
          { label: 'Catalog items', value: catalogCount, icon: 'cube-outline' },
        ],
        tasks: vendor ? [{ title: 'Keep your catalog updated', detail: 'Update availability and product details with the admin team.', icon: 'cube-outline' }] : [{ title: 'Complete store setup', detail: 'Ask an administrator to link your vendor profile to this account.', icon: 'person-add-outline' }],
      });
    }

    if (user.role === 'delivery') {
      const assigned = await Order.count({ where: { deliveryUserId: user.id, deliveryStatus: { [Op.ne]: 'delivered' } } });
      return res.json({
        ...base,
        metrics: [{ label: 'Assigned deliveries', value: assigned, icon: 'bicycle-outline' }, { label: 'Delivery status', value: assigned ? 'In progress' : 'Ready', icon: 'checkmark-circle-outline' }],
        tasks: [{ title: assigned ? 'Complete assigned deliveries' : 'No deliveries assigned', detail: assigned ? `${assigned} delivery orders are waiting for action.` : 'New assignments will appear here.', icon: 'bicycle-outline' }],
      });
    }

    return res.json({
      ...base,
      metrics: [{ label: 'Assigned deliveries', value: 0, icon: 'bicycle-outline' }, { label: 'Delivery status', value: 'Ready', icon: 'checkmark-circle-outline' }],
      tasks: [{ title: 'No deliveries assigned', detail: 'Assigned deliveries will appear here once dispatch assignment is enabled.', icon: 'bicycle-outline' }],
    });
  } catch (error) {
    console.error('Partner overview failed:', error);
    res.status(500).json({ error: 'Unable to load partner overview' });
  }

}

export async function get__vendor_profile_1(req: Request, res: Response) {
  const vendor = await currentVendor(req as AuthenticatedRequest);
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not found' });
  const { passwordHash: _omit, ...vendorPayload } = vendor.get({ plain: true }) as Record<string, unknown>;
  res.json(vendorPayload);

}

export async function put__vendor_profile_2(req: Request, res: Response) {
  const vendor = await currentVendor(req as AuthenticatedRequest);
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not found' });
  await vendor.update({
    storeName: typeof req.body.storeName === 'string' && req.body.storeName.trim() ? req.body.storeName.trim() : vendor.storeName,
    phone: typeof req.body.phone === 'string' ? req.body.phone.trim() : vendor.phone,
    address: typeof req.body.address === 'string' ? req.body.address.trim() : vendor.address,
    profile: typeof req.body.profile === 'string' ? req.body.profile : vendor.profile,
    businessHours: typeof req.body.businessHours === 'string' ? req.body.businessHours.trim() : vendor.businessHours,
    acceptingOrders: typeof req.body.acceptingOrders === 'boolean' ? req.body.acceptingOrders : vendor.acceptingOrders,
    minimumOrderAmount: Number.isFinite(Number(req.body.minimumOrderAmount)) ? Math.max(0, Number(req.body.minimumOrderAmount)) : vendor.minimumOrderAmount,
    deliveryRadius: req.body.deliveryRadius === '' || req.body.deliveryRadius === null ? null : (Number.isFinite(Number(req.body.deliveryRadius)) ? Math.max(0, Number(req.body.deliveryRadius)) : vendor.deliveryRadius),
  });
  res.json(vendor);

}

export async function get__vendor_membership_3(req: Request, res: Response) {
  const vendor = await currentVendor(req as AuthenticatedRequest);
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not found' });
  if (vendor.membershipPaymentLinkId && vendor.membershipPaymentStatus === 'pending') {
    try {
      const { keyId, keySecret } = razorpayConfig();
      const response = await fetch(`https://api.razorpay.com/v1/payment_links/${vendor.membershipPaymentLinkId}`, { headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}` } });
      const link = await response.json() as { status?: string; payments?: Array<{ id?: string }> };
      const status = link.status === 'paid' ? 'paid' : ['cancelled', 'expired'].includes(String(link.status)) ? 'failed' : 'pending';
      if (status !== vendor.membershipPaymentStatus) await vendor.update({ membershipPaymentStatus: status, membershipStatus: status === 'paid' ? 'active' : vendor.membershipStatus, membershipPaymentId: link.payments?.[0]?.id || vendor.membershipPaymentId, membershipStartedAt: status === 'paid' && !vendor.membershipStartedAt ? new Date() : vendor.membershipStartedAt, membershipExpiresAt: status === 'paid' && !vendor.membershipExpiresAt ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : vendor.membershipExpiresAt });
    } catch {
      // Payment status will be updated by the Razorpay webhook when configured.
    }
  }
  res.json({ membershipPlan: vendor.membershipPlan, membershipStatus: vendor.membershipStatus, membershipFee: vendor.membershipFee, paymentStatus: vendor.membershipPaymentStatus, startedAt: vendor.membershipStartedAt, expiresAt: vendor.membershipExpiresAt, plans: [{ name: 'Starter', fee: 0, durationDays: 365 }, { name: 'Standard', fee: 999, durationDays: 365 }, { name: 'Premium', fee: 2499, durationDays: 365 }] });

}

export async function post__vendor_membership_request_4(req: Request, res: Response) {
  const vendor = await currentVendor(req as AuthenticatedRequest);
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not found' });
  const plan = String(req.body.plan || '').trim();
  const plans: Record<string, number> = { Starter: 0, Standard: 999, Premium: 2499 };
  if (!Object.prototype.hasOwnProperty.call(plans, plan)) return res.status(400).json({ error: 'Choose a valid membership plan' });
  await vendor.update({ membershipPlan: plan, membershipFee: plans[plan], membershipStatus: 'pending', membershipPaymentStatus: plans[plan] === 0 ? 'paid' : 'unpaid' });
  res.json(vendor);

}

export async function post__vendor_membership_payment_link_5(req: Request, res: Response) {
  try {
    const vendor = await currentVendor(req as AuthenticatedRequest);
    if (!vendor) return res.status(404).json({ error: 'Vendor profile not found' });
    const plan = String(req.body.plan || '').trim();
    const fees: Record<string, number> = { Standard: 999, Premium: 2499 };
    if (!Object.prototype.hasOwnProperty.call(fees, plan)) return res.status(400).json({ error: 'Choose a paid membership plan' });
    if (!vendor.email) return res.status(400).json({ error: 'Vendor email is required for membership payment' });
    const { keyId, keySecret } = razorpayConfig();
    const response = await fetch('https://api.razorpay.com/v1/payment_links', { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: fees[plan] * 100, currency: 'INR', reference_id: `vendor_membership_${vendor.id}`, description: `Foodiens ${plan} vendor membership`, customer: { name: vendor.storeName, email: vendor.email }, notify: { sms: false, email: false }, reminder_enable: false, expire_by: Math.floor(Date.now() / 1000) + 24 * 60 * 60, notes: { vendor_id: String(vendor.id), membership_plan: plan } }) });
    const link = await response.json() as { id?: string; short_url?: string; error?: { description?: string } };
    if (!response.ok || !link.id || !link.short_url) return res.status(502).json({ error: link.error?.description || 'Unable to create membership payment link' });
    await vendor.update({ membershipPlan: plan, membershipFee: fees[plan], membershipStatus: 'pending', membershipPaymentStatus: 'pending', membershipPaymentLinkId: link.id });
    res.status(201).json({ paymentUrl: link.short_url, paymentStatus: 'pending' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start membership payment';
    res.status(message.includes('Razorpay') || message.includes('required') ? 400 : 500).json({ error: message });
  }

}

export async function get__vendor_payments_6(req: Request, res: Response) {
  const vendor = await currentVendor(req as AuthenticatedRequest);
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not found' });
  const settlements = await VendorSettlement.findAll({ where: { vendorId: vendor.id, status: 'pending' } });
  const requests = await VendorPayoutRequest.findAll({ where: { vendorId: vendor.id }, order: [['createdAt', 'DESC']], limit: 100 });
  const reserved = requests.filter((item) => ['requested', 'processing', 'paid'].includes(item.status)).reduce((sum, item) => sum + Number(item.amount), 0);
  const earned = settlements.reduce((sum, item) => sum + Number(item.netAmount || 0), 0);
  res.json({ availableAmount: Math.max(0, Number((earned - reserved).toFixed(2))), earnedAmount: Number(earned.toFixed(2)), payoutProfile: { method: vendor.payoutMethod, accountName: vendor.payoutAccountName, accountNumber: vendor.payoutAccountNumber, ifsc: vendor.payoutIfsc, upi: vendor.payoutUpi }, requests });

}

export async function put__vendor_payment_profile_7(req: Request, res: Response) {
  const vendor = await currentVendor(req as AuthenticatedRequest);
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not found' });
  const method = ['upi', 'bank'].includes(String(req.body.method)) ? String(req.body.method) : vendor.payoutMethod;
  await vendor.update({ payoutMethod: method, payoutAccountName: typeof req.body.accountName === 'string' ? req.body.accountName.trim() : vendor.payoutAccountName, payoutAccountNumber: typeof req.body.accountNumber === 'string' ? req.body.accountNumber.trim() : vendor.payoutAccountNumber, payoutIfsc: typeof req.body.ifsc === 'string' ? req.body.ifsc.trim().toUpperCase() : vendor.payoutIfsc, payoutUpi: typeof req.body.upi === 'string' ? req.body.upi.trim() : vendor.payoutUpi });
  res.json({ method: vendor.payoutMethod, accountName: vendor.payoutAccountName, accountNumber: vendor.payoutAccountNumber, ifsc: vendor.payoutIfsc, upi: vendor.payoutUpi });

}

export async function post__vendor_payout_requests_8(req: Request, res: Response) {
  const vendor = await currentVendor(req as AuthenticatedRequest);
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not found' });
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'A valid payout amount is required' });
  if (vendor.payoutMethod === 'upi' && !vendor.payoutUpi) return res.status(400).json({ error: 'Add your UPI ID before requesting a payout' });
  if (vendor.payoutMethod === 'bank' && (!vendor.payoutAccountName || !vendor.payoutAccountNumber || !vendor.payoutIfsc)) return res.status(400).json({ error: 'Complete bank payout details before requesting a payout' });
  const pendingSettlements = await VendorSettlement.findAll({ where: { vendorId: vendor.id, status: 'pending' } });
  const requests = await VendorPayoutRequest.findAll({ where: { vendorId: vendor.id, status: { [Op.in]: ['requested', 'processing', 'paid'] } } });
  const available = pendingSettlements.reduce((sum, item) => sum + Number(item.netAmount || 0), 0) - requests.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  if (amount > available + 0.01) return res.status(400).json({ error: `Payout exceeds available amount Rs. ${Math.max(0, available).toFixed(2)}` });
  const accountSnapshot = JSON.stringify({ method: vendor.payoutMethod, accountName: vendor.payoutAccountName, accountNumber: vendor.payoutAccountNumber, ifsc: vendor.payoutIfsc, upi: vendor.payoutUpi });
  const request = await VendorPayoutRequest.create({ vendorId: vendor.id, amount, method: vendor.payoutMethod, accountSnapshot, status: 'requested' });
  res.status(201).json(request);

}

export async function get__vendor_payout_requests_9(req: Request, res: Response) {
  const vendor = await currentVendor(req as AuthenticatedRequest);
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not found' });
  res.json(await VendorPayoutRequest.findAll({ where: { vendorId: vendor.id }, order: [['createdAt', 'DESC']], limit: 100 }));

}

export async function get__vendor_products_10(req: Request, res: Response) {
  const vendor = await currentVendor(req as AuthenticatedRequest);
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not found' });
  const products = await Product.findAll({
    where: { vendorId: vendor.id },
    include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
    order: [['createdAt', 'DESC']],
  });
  res.json(products);

}

export async function post__vendor_products_11(req: Request, res: Response) {
  const vendor = await currentVendor(req as AuthenticatedRequest);
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not found' });
  const payload = vendorProductPayload(req.body);
  if (!payload.name || !Number.isFinite(payload.price)) return res.status(400).json({ error: 'Product name and price are required' });
  const product = await Product.create({ ...payload, vendorId: vendor.id, approvalStatus: 'pending_review', submittedAt: new Date(), approvedAt: null, approvedBy: null });
  res.status(201).json(product);

}

export async function put__vendor_products_id_12(req: Request, res: Response) {
  const vendor = await currentVendor(req as AuthenticatedRequest);
  const product = vendor ? await Product.findOne({ where: { id: Number(req.params.id), vendorId: vendor.id } }) : null;
  if (!product) return res.status(404).json({ error: 'Product not found' });
  await product.update({ ...vendorProductPayload(req.body), approvalStatus: 'pending_review', submittedAt: new Date(), approvedAt: null, approvedBy: null, rejectionReason: null });
  res.json(product);

}

export async function delete__vendor_products_id_13(req: Request, res: Response) {
  const vendor = await currentVendor(req as AuthenticatedRequest);
  const product = vendor ? await Product.findOne({ where: { id: Number(req.params.id), vendorId: vendor.id } }) : null;
  if (!product) return res.status(404).json({ error: 'Product not found' });
  await product.destroy();
  res.json({ success: true });

}

export async function get__vendor_orders_14(req: Request, res: Response) {
  const vendor = await currentVendor(req as AuthenticatedRequest);
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not found' });
  const vendorProducts = await Product.findAll({ where: { vendorId: vendor.id }, attributes: ['id'] });
  const productIds = new Set(vendorProducts.map((product) => product.id));
  const orders = await Order.findAll({ order: [['createdAt', 'DESC']], limit: 200 });
  const result = orders.filter((order) => {
    try {
      const items = JSON.parse(order.items) as Array<{ productId?: number }>;
      return items.some((item) => productIds.has(Number(item.productId)));
    } catch {
      return false;
    }
  });
  res.json(result);

}

export async function put__vendor_orders_id_status_15(req: Request, res: Response) {
  const vendor = await currentVendor(req as AuthenticatedRequest);
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not found' });
  const order = await Order.findByPk(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const vendorProducts = await Product.findAll({ where: { vendorId: vendor.id }, attributes: ['id'] });
  const productIds = new Set(vendorProducts.map((product) => product.id));
  let belongsToVendor = false;
  try {
    const items = JSON.parse(order.items) as Array<{ productId?: number }>;
    belongsToVendor = items.some((item) => productIds.has(Number(item.productId)));
  } catch {
    belongsToVendor = false;
  }
  if (!belongsToVendor) return res.status(403).json({ error: 'This order is not assigned to your store' });
  const status = String(req.body.status || '').trim();
  if (!['pending', 'processing', 'completed', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid order status' });
  const paymentUpdate = status === 'completed' && order.paymentMethod === 'cod' ? { paymentStatus: 'paid', paymentProvider: 'cod' } : {};
  await order.update({ status, ...paymentUpdate });
  res.json(order);

}

export async function put__vendor_orders_id_tracking_16(req: Request, res: Response) {
  const vendor = await currentVendor(req as AuthenticatedRequest);
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not found' });
  const order = await Order.findByPk(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const vendorProducts = await Product.findAll({ where: { vendorId: vendor.id }, attributes: ['id'] });
  const productIds = new Set(vendorProducts.map((product) => product.id));
  let belongsToVendor = false;
  try {
    const items = JSON.parse(order.items) as Array<{ productId?: number }>;
    belongsToVendor = items.some((item) => productIds.has(Number(item.productId)));
  } catch { belongsToVendor = false; }
  if (!belongsToVendor) return res.status(403).json({ error: 'This order is not assigned to your store' });
  const trackingCode = typeof req.body.trackingCode === 'string' ? req.body.trackingCode.trim() : '';
  const trackingUrl = typeof req.body.trackingUrl === 'string' ? req.body.trackingUrl.trim() : '';
  if (trackingUrl && !/^https?:\/\//i.test(trackingUrl)) return res.status(400).json({ error: 'Tracking URL must start with http:// or https://' });
  await order.update({ trackingCode: trackingCode || null, trackingUrl: trackingUrl || null });
  res.json(order);

}

export async function get__vendor_settlements_17(req: Request, res: Response) {
  const vendor = await currentVendor(req as AuthenticatedRequest);
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not found' });
  const settlements = await VendorSettlement.findAll({ where: { vendorId: vendor.id }, order: [['createdAt', 'DESC']] });
  res.json(settlements);

}

export async function get__vendor_reports_18(req: Request, res: Response) {
  const vendor = await currentVendor(req as AuthenticatedRequest);
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not found' });
  const products = await Product.findAll({ where: { vendorId: vendor.id }, order: [['name', 'ASC']] });
  const productMap = new Map(products.map((product) => [product.id, product]));
  const orders = await Order.findAll({ order: [['createdAt', 'DESC']], limit: 500 });
  const salesByDate = new Map<string, number>();
  let vendorSales = 0; let vendorItems = 0; let vendorOrders = 0;
  for (const order of orders) {
    try {
      const items = JSON.parse(order.items) as Array<{ productId?: number; price?: number; quantity?: number }>;
      const matching = items.filter((item) => productMap.has(Number(item.productId)));
      if (!matching.length) continue;
      vendorOrders += 1;
      const orderSales = matching.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
      vendorSales += orderSales;
      vendorItems += matching.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const date = order.createdAt.toISOString().slice(0, 10);
      salesByDate.set(date, (salesByDate.get(date) || 0) + orderSales);
    } catch {
      // Ignore legacy orders with malformed item data.
    }
  }
  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return { date: key, sales: Number((salesByDate.get(key) || 0).toFixed(2)) };
  });
  res.json({ summary: { vendorOrders, vendorItems, vendorSales: Number(vendorSales.toFixed(2)), catalogItems: products.length }, lastSevenDays, outOfStock: products.filter((product) => product.stockStatus === 'outofstock' || (product.stockQuantity !== null && product.stockQuantity <= 0)).map((product) => ({ id: product.id, name: product.name, stockQuantity: product.stockQuantity, stockStatus: product.stockStatus })) });

}

export async function get__vendor_notices_19(req: Request, res: Response) {
  const vendor = await currentVendor(req as AuthenticatedRequest);
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not found' });
  const notices = await VendorNotice.findAll({ where: { [Op.or]: [{ vendorId: vendor.id }, { vendorId: null }] }, order: [['createdAt', 'DESC']], limit: 100 });
  res.json(notices);

}

export async function put__vendor_notices_id_read_20(req: Request, res: Response) {
  const vendor = await currentVendor(req as AuthenticatedRequest);
  const notice = vendor ? await VendorNotice.findOne({ where: { id: Number(req.params.id), [Op.or]: [{ vendorId: vendor.id }, { vendorId: null }] } }) : null;
  if (!notice) return res.status(404).json({ error: 'Notice not found' });
  await notice.update({ readAt: new Date() });
  res.json(notice);

}

export async function get__notices_21(_req: Request, res: Response) {
  const notices = await VendorNotice.findAll({ include: [{ model: Vendor, as: 'vendor', attributes: ['id', 'storeName'] }], order: [['createdAt', 'DESC']], limit: 200 });
  res.json(notices);

}

export async function post__notices_22(req: Request, res: Response) {
  const title = String(req.body.title || '').trim();
  const message = String(req.body.message || '').trim();
  const type = String(req.body.type || 'notice').trim();
  const vendorId = req.body.vendorId === '' || req.body.vendorId === null || typeof req.body.vendorId === 'undefined' ? null : Number(req.body.vendorId);
  if (!title || !message) return res.status(400).json({ error: 'Title and message are required' });
  if (vendorId !== null && (!Number.isInteger(vendorId) || !(await Vendor.findByPk(vendorId)))) return res.status(400).json({ error: 'Vendor not found' });
  const notice = await VendorNotice.create({ title, message, type, vendorId });
  res.status(201).json(notice);

}

export async function get__delivery_orders_23(req: Request, res: Response) {
  const user = partnerUser(req as AuthenticatedRequest);
  const orders = await Order.findAll({ where: { deliveryUserId: user.id }, order: [['createdAt', 'DESC']], limit: 200 });
  res.json(orders);

}

export async function get__delivery_profile_24(req: Request, res: Response) {
  const user = await User.findByPk(partnerUser(req as AuthenticatedRequest).id, { attributes: ['id', 'name', 'email', 'phone', 'deliveryVehicleType', 'deliveryVehicleNumber', 'deliveryStatus', 'deliveryLastSeenAt'] });
  if (!user) return res.status(404).json({ error: 'Delivery partner not found' });
  res.json(user);

}

export async function put__delivery_profile_25(req: Request, res: Response) {
  const user = await User.findByPk(partnerUser(req as AuthenticatedRequest).id);
  if (!user) return res.status(404).json({ error: 'Delivery partner not found' });
  const deliveryStatus = ['online', 'offline', 'on_delivery'].includes(String(req.body.deliveryStatus)) ? String(req.body.deliveryStatus) : user.deliveryStatus;
  await user.update({ name: typeof req.body.name === 'string' && req.body.name.trim() ? req.body.name.trim() : user.name, phone: typeof req.body.phone === 'string' ? req.body.phone.trim() : user.phone, deliveryVehicleType: typeof req.body.vehicleType === 'string' ? req.body.vehicleType.trim() : user.deliveryVehicleType, deliveryVehicleNumber: typeof req.body.vehicleNumber === 'string' ? req.body.vehicleNumber.trim().toUpperCase() : user.deliveryVehicleNumber, deliveryStatus, deliveryLastSeenAt: new Date() });
  res.json(user);

}

export async function get__delivery_summary_26(req: Request, res: Response) {
  const user = partnerUser(req as AuthenticatedRequest);
  const orders = await Order.findAll({ where: { deliveryUserId: user.id }, order: [['createdAt', 'DESC']], limit: 500 });
  const active = orders.filter((order) => !['delivered', 'failed'].includes(order.deliveryStatus));
  const delivered = orders.filter((order) => order.deliveryStatus === 'delivered');
  const codToCollect = active.filter((order) => order.paymentMethod === 'cod' && order.paymentStatus !== 'paid').reduce((sum, order) => sum + Number(order.total || 0), 0);
  res.json({ total: orders.length, active: active.length, delivered: delivered.length, failed: orders.filter((order) => order.deliveryStatus === 'failed').length, codToCollect: Number(codToCollect.toFixed(2)), todayDelivered: delivered.filter((order) => order.deliveredAt && order.deliveredAt.toDateString() === new Date().toDateString()).length });

}

export async function put__delivery_orders_id_status_27(req: Request, res: Response) {
  const user = partnerUser(req as AuthenticatedRequest);
  const order = await Order.findOne({ where: { id: Number(req.params.id), deliveryUserId: user.id } });
  if (!order) return res.status(404).json({ error: 'Assigned delivery not found' });
  const status = String(req.body.status || '').trim();
  if (!['picked_up', 'out_for_delivery', 'delivered', 'failed'].includes(status)) return res.status(400).json({ error: 'Invalid delivery status' });
  const transitions: Record<string, string[]> = { assigned: ['picked_up', 'failed'], picked_up: ['out_for_delivery', 'failed'], out_for_delivery: ['delivered', 'failed'], delivered: [], failed: [] };
  if (!(transitions[order.deliveryStatus] || []).includes(status)) return res.status(400).json({ error: `Cannot move delivery from ${order.deliveryStatus} to ${status}` });
  if (status === 'failed' && !String(req.body.note || '').trim()) return res.status(400).json({ error: 'Add a reason for a failed delivery' });
  const paymentUpdate = status === 'delivered' && order.paymentMethod === 'cod' ? { paymentStatus: 'paid', paymentProvider: 'cod' } : {};
  await order.update({ deliveryStatus: status, status: status === 'delivered' ? 'completed' : order.status, deliveredAt: status === 'delivered' ? new Date() : order.deliveredAt, deliveryNote: typeof req.body.note === 'string' ? req.body.note.trim() : order.deliveryNote, ...paymentUpdate });
  await User.update({ deliveryStatus: status === 'delivered' || status === 'failed' ? 'online' : 'on_delivery', deliveryLastSeenAt: new Date() }, { where: { id: user.id } });
  res.json(order);

}

export async function get__delivery_assignments_28(req: Request, res: Response) {
  if (partnerUser(req as AuthenticatedRequest).role !== 'admin' && partnerUser(req as AuthenticatedRequest).role !== 'admin_team') return res.status(403).json({ error: 'Admin access required' });
  const orders = await Order.findAll({ order: [['createdAt', 'DESC']], limit: 200 });
  const deliveryUsers = await User.findAll({ where: { role: 'delivery' }, attributes: ['id', 'name', 'email', 'phone', 'deliveryVehicleType', 'deliveryVehicleNumber', 'deliveryStatus'] });
  res.json({ orders, deliveryUsers });

}

export async function put__delivery_assignments_orderId_29(req: Request, res: Response) {
  const role = partnerUser(req as AuthenticatedRequest).role;
  if (role !== 'admin' && role !== 'admin_team') return res.status(403).json({ error: 'Admin access required' });
  const order = await Order.findByPk(Number(req.params.orderId));
  const deliveryUserId = Number(req.body.deliveryUserId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const deliveryUser = await User.findOne({ where: { id: deliveryUserId, role: 'delivery' } });
  if (!deliveryUser) return res.status(404).json({ error: 'Delivery partner not found' });
  await order.update({ deliveryUserId, deliveryStatus: 'assigned' });
  res.json(order);

}