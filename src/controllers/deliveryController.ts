import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import VendorOrder from '../models/VendorOrder.js';
import Order from '../models/Order.js';
import Vendor from '../models/Vendor.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import DeliveryPayoutRequest from '../models/DeliveryPayoutRequest.js';
import { createRazorpayXPayout } from '../services/razorpayx.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { attachOrderItems } from './marketplaceController.js';
import { awardOrderRewards } from '../services/loyalty.js';

function actor(req: Request) {
  return (req as AuthenticatedRequest).user!;
}

const INCLUDE = [
  { model: Order, as: 'order' },
  { model: Vendor, as: 'vendor', attributes: ['id', 'storeName', 'phone', 'address', 'userId'] },
];

export async function listAssignedOrders(req: Request, res: Response) {
  const user = actor(req);
  const rows = await VendorOrder.findAll({
    where: { deliveryUserId: user.id, status: { [Op.in]: ['assigned', 'picked_up'] } },
    include: INCLUDE,
    order: [['createdAt', 'DESC']],
  });
  res.json(await attachOrderItems(rows));
}

export async function getAssignedOrder(req: Request, res: Response) {
  const user = actor(req);
  const vo = await VendorOrder.findOne({ where: { id: Number(req.params.id), deliveryUserId: user.id }, include: INCLUDE });
  if (!vo) return res.status(404).json({ error: 'Assigned order not found' });
  const [withItems] = await attachOrderItems([vo]);
  res.json(withItems);
}

const DELIVERY_TRANSITIONS: Record<string, string[]> = { assigned: ['picked_up'], picked_up: ['delivered'] };

export async function updateDeliveryOrderStatus(req: Request, res: Response) {
  const user = actor(req);
  const vo = await VendorOrder.findOne({
    where: { id: Number(req.params.id), deliveryUserId: user.id },
    include: [{ model: Vendor, as: 'vendor', attributes: ['id', 'storeName', 'userId'] }],
  });
  if (!vo) return res.status(404).json({ error: 'Assigned order not found' });

  const status = String(req.body.status || '').trim();
  if (!(DELIVERY_TRANSITIONS[vo.status] || []).includes(status)) {
    return res.status(400).json({ error: `Cannot move delivery from ${vo.status} to ${status}` });
  }

  const now = new Date();
  const patch: Record<string, unknown> = { status };
  if (status === 'picked_up') patch.pickedUpAt = now;
  if (status === 'delivered') patch.deliveredAt = now;
  await vo.update(patch);

  // The customer app reads the parent Order, while the delivery app updates a
  // vendor-specific order. Keep the parent in sync once every vendor portion
  // of an order has been delivered (important for multi-vendor carts too).
  if (status === 'delivered') {
    const remainingVendorOrders = await VendorOrder.count({
      where: { orderId: vo.orderId, status: { [Op.ne]: 'delivered' } },
    });
    if (remainingVendorOrders === 0) {
      const parentOrder = await Order.findByPk(vo.orderId);
      if (parentOrder) {
        await parentOrder.update({
          status: 'completed',
          deliveryStatus: 'delivered',
          deliveredAt: now,
          ...(parentOrder.paymentMethod === 'cod' ? { paymentStatus: 'paid', paymentProvider: 'cod' } : {}),
        });
        if (parentOrder.paymentStatus === 'paid') void awardOrderRewards(parentOrder).catch((error) => console.error('Could not award order/referral rewards:', error));
      }
    }
  }

  const vendorUserId = (vo as any).vendor?.userId;
  if (vendorUserId) {
    await Notification.create({
      userId: vendorUserId,
      type: status === 'delivered' ? 'vendor_order_delivered' : 'vendor_order_picked_up',
      title: status === 'delivered' ? 'Order delivered' : 'Order picked up',
      message: status === 'delivered' ? `Order #${vo.orderId} has been delivered.` : `Order #${vo.orderId} has been picked up for delivery.`,
      data: JSON.stringify({ vendorOrderId: vo.id }),
    });
  }

  res.json({ success: true, data: vo });
}

export async function deliveryDashboard(req: Request, res: Response) {
  const user = actor(req);
  const [assigned, pickedUp, delivered] = await Promise.all([
    VendorOrder.count({ where: { deliveryUserId: user.id, status: 'assigned' } }),
    VendorOrder.count({ where: { deliveryUserId: user.id, status: 'picked_up' } }),
    VendorOrder.count({ where: { deliveryUserId: user.id, status: 'delivered' } }),
  ]);
  const totalEarnings = delivered * 40;
  const withdrawn = Number(await DeliveryPayoutRequest.sum('amount', { where: { deliveryUserId: user.id, status: ['pending', 'processing', 'paid'] } }) || 0);
  const walletBalance = Math.max(totalEarnings - withdrawn, 0);
  res.json({ assigned, pickedUp, delivered, pendingTasks: assigned + pickedUp, earningPerDelivery: 40, totalEarnings, withdrawn, walletBalance });
}

export async function deliveryHistory(req: Request, res: Response) {
  const user = actor(req);
  const rows = await VendorOrder.findAll({
    where: { deliveryUserId: user.id, status: { [Op.in]: ['delivered', 'cancelled'] } },
    include: INCLUDE,
    order: [['updatedAt', 'DESC']],
    limit: 200,
  });
  res.json(await attachOrderItems(rows));
}

function payoutDestination(user: User) {
  if (user.payoutMethod === 'upi' && user.payoutUpiId) return { method: 'upi' as const, upiId: user.payoutUpiId, accountHolderName: user.payoutAccountHolderName || user.name };
  if (user.payoutMethod === 'bank' && user.payoutAccountNumber && user.payoutIfsc && user.payoutAccountHolderName) return { method: 'bank_account' as const, accountNumber: user.payoutAccountNumber, ifsc: user.payoutIfsc, accountHolderName: user.payoutAccountHolderName };
  return null;
}

export async function getDeliveryPayoutProfile(req: Request, res: Response) {
  const user = await User.findByPk(actor(req).id);
  if (!user) return res.status(404).json({ error: 'Delivery partner not found' });
  res.json({ payoutMethod: user.payoutMethod, payoutUpiId: user.payoutUpiId, payoutAccountNumber: user.payoutAccountNumber, payoutIfsc: user.payoutIfsc, payoutAccountHolderName: user.payoutAccountHolderName });
}

export async function updateDeliveryPayoutProfile(req: Request, res: Response) {
  const user = await User.findByPk(actor(req).id);
  if (!user) return res.status(404).json({ error: 'Delivery partner not found' });
  const method = String(req.body.payoutMethod || '');
  const upi = String(req.body.payoutUpiId || '').trim().toLowerCase();
  const accountNumber = String(req.body.payoutAccountNumber || '').trim();
  const ifsc = String(req.body.payoutIfsc || '').trim().toUpperCase();
  const holder = String(req.body.payoutAccountHolderName || '').trim();
  if (method === 'upi' && !/^[\w.-]+@[\w.-]+$/.test(upi)) return res.status(400).json({ error: 'Enter a valid UPI ID' });
  if (method === 'bank' && (!/^\d{9,18}$/.test(accountNumber) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc) || !holder)) return res.status(400).json({ error: 'Enter valid bank account, IFSC and account holder name' });
  if (!['upi', 'bank'].includes(method)) return res.status(400).json({ error: 'Choose UPI or bank account' });
  await user.update({ payoutMethod: method, payoutUpiId: method === 'upi' ? upi : null, payoutAccountNumber: method === 'bank' ? accountNumber : null, payoutIfsc: method === 'bank' ? ifsc : null, payoutAccountHolderName: holder || user.name });
  return getDeliveryPayoutProfile(req, res);
}

export async function getDeliveryWallet(req: Request, res: Response) {
  const userId = actor(req).id;
  const delivered = await VendorOrder.count({ where: { deliveryUserId: userId, status: 'delivered' } });
  const totalEarnings = delivered * 40;
  const requests = await DeliveryPayoutRequest.findAll({ where: { deliveryUserId: userId }, order: [['createdAt', 'DESC']] });
  const reserved = requests.filter((x) => ['pending', 'processing', 'paid'].includes(x.status)).reduce((sum, x) => sum + Number(x.amount), 0);
  const earnings = await VendorOrder.findAll({ where: { deliveryUserId: userId, status: 'delivered' }, attributes: ['id', 'orderId', 'deliveredAt'], order: [['deliveredAt', 'DESC']], limit: 200 });
  res.json({ balance: Math.max(totalEarnings - reserved, 0), totalEarnings, transactions: [...earnings.map((x) => ({ id: `earning-${x.id}`, type: 'earning', amount: 40, status: 'paid', description: `Delivered order #${x.orderId}`, createdAt: x.get('deliveredAt') || x.get('updatedAt') })), ...requests.map((x) => ({ id: `withdrawal-${x.id}`, type: 'withdrawal', amount: Number(x.amount), status: x.status, description: `Withdrawal via ${x.method === 'upi' ? 'UPI' : 'bank account'}`, createdAt: x.get('createdAt'), failureReason: x.failureReason }))] });
}

export async function createDeliveryWithdrawal(req: Request, res: Response) {
  const user = await User.findByPk(actor(req).id);
  if (!user) return res.status(404).json({ error: 'Delivery partner not found' });
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount < 1) return res.status(400).json({ error: 'Enter a valid withdrawal amount' });
  const destination = payoutDestination(user);
  if (!destination) return res.status(400).json({ error: 'Save your UPI or bank details first' });
  const delivered = await VendorOrder.count({ where: { deliveryUserId: user.id, status: 'delivered' } });
  const reserved = Number(await DeliveryPayoutRequest.sum('amount', { where: { deliveryUserId: user.id, status: ['pending', 'processing', 'paid'] } }) || 0);
  if (amount > delivered * 40 - reserved) return res.status(400).json({ error: 'Withdrawal amount exceeds available wallet balance' });
  const request = await DeliveryPayoutRequest.create({ deliveryUserId: user.id, amount, method: destination.method === 'upi' ? 'upi' : 'bank', accountSnapshot: JSON.stringify(destination), status: 'pending' });
  res.status(201).json(request);
}

export async function listDeliveryPayoutRequests(_req: Request, res: Response) {
  const requests = await DeliveryPayoutRequest.findAll({ include: [{ model: User, as: 'deliveryUser', attributes: ['id', 'name', 'phone', 'email'] }], order: [['createdAt', 'DESC']] });
  res.json(requests);
}

export async function processDeliveryPayout(req: Request, res: Response) {
  const request = await DeliveryPayoutRequest.findByPk(Number(req.params.id));
  if (!request) return res.status(404).json({ error: 'Withdrawal request not found' });
  const action = String(req.body.action || '');
  if (request.status !== 'pending') return res.status(409).json({ error: 'This request has already been processed' });
  if (action === 'reject') { await request.update({ status: 'rejected', failureReason: String(req.body.reason || 'Rejected by admin'), processedAt: new Date() }); return res.json(request); }
  if (action !== 'approve') return res.status(400).json({ error: 'Action must be approve or reject' });
  await request.update({ status: 'processing' });
  try {
    const payout = await createRazorpayXPayout(JSON.parse(request.accountSnapshot), Number(request.amount), `delivery_withdrawal_${request.id}`);
    const failed = ['failed', 'reversed', 'cancelled'].includes(payout.status);
    await request.update({ status: failed ? 'failed' : payout.status === 'processed' ? 'paid' : 'processing', razorpayPayoutId: payout.id, failureReason: failed ? (payout.status_details?.description || 'RazorpayX payout failed') : null, processedAt: new Date() });
  } catch (error) { await request.update({ status: 'failed', failureReason: error instanceof Error ? error.message : 'Payout failed', processedAt: new Date() }); }
  res.json(request);
}
