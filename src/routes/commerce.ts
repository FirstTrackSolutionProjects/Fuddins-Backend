import { Router } from 'express';
import { authenticateToken, type AuthenticatedRequest, requireAdmin } from '../middleware/auth.js';
import Invoice from '../models/Invoice.js';
import Order from '../models/Order.js';
import RewardTransaction from '../models/RewardTransaction.js';
import User from '../models/User.js';
import Vendor from '../models/Vendor.js';
import VendorSettlement from '../models/VendorSettlement.js';
import WalletTransaction from '../models/WalletTransaction.js';
import { generateInvoicePdf } from '../services/invoice.js';
import { addRewardTransaction, addWalletTransaction, rewardBalance, walletBalance } from '../services/loyalty.js';

const router = Router();

function requestedUserId(req: AuthenticatedRequest) {
  const user = req.user;
  const id = Number(req.params.userId || req.query.userId || user?.id);
  if (!user || !Number.isInteger(id)) return null;
  if (user.role !== 'admin' && user.id !== id) return null;
  return id;
}

router.get('/wallet', authenticateToken, requireAdmin, async (_req, res) => {
  const transactions = await WalletTransaction.findAll({
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
    order: [['createdAt', 'DESC']],
  });
  res.json(transactions);
});

router.get('/wallet/users/:userId', authenticateToken, async (req, res) => {
  const userId = requestedUserId(req as AuthenticatedRequest);
  if (!userId) return res.status(403).json({ error: 'Access denied' });
  const transactions = await WalletTransaction.findAll({ where: { userId }, order: [['createdAt', 'DESC']] });
  res.json({ balance: await walletBalance(userId), transactions });
});

router.post('/wallet/transactions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.body.userId);
    const amount = Number(req.body.amount);
    if (!Number.isInteger(userId) || Number.isNaN(amount) || amount === 0) return res.status(400).json({ error: 'User and amount are required' });
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const transaction = await addWalletTransaction({
      userId,
      legacyUserId: user.legacyUserId,
      type: amount >= 0 ? 'credit' : 'debit',
      amount,
      description: typeof req.body.description === 'string' ? req.body.description : 'Admin wallet adjustment',
    });
    res.status(201).json(transaction);
  } catch {
    res.status(400).json({ error: 'Unable to create wallet transaction' });
  }
});

router.get('/rewards', authenticateToken, requireAdmin, async (_req, res) => {
  const transactions = await RewardTransaction.findAll({
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
    order: [['createdAt', 'DESC']],
  });
  res.json(transactions);
});

router.get('/rewards/users/:userId', authenticateToken, async (req, res) => {
  const userId = requestedUserId(req as AuthenticatedRequest);
  if (!userId) return res.status(403).json({ error: 'Access denied' });
  const transactions = await RewardTransaction.findAll({ where: { userId }, order: [['createdAt', 'DESC']] });
  res.json({ balance: await rewardBalance(userId), transactions });
});

router.post('/rewards/transactions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.body.userId);
    const points = Number(req.body.points);
    if (!Number.isInteger(userId) || !Number.isInteger(points) || points === 0) return res.status(400).json({ error: 'User and points are required' });
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const transaction = await addRewardTransaction({
      userId,
      legacyUserId: user.legacyUserId,
      type: points >= 0 ? 'earn' : 'redeem',
      points,
      description: typeof req.body.description === 'string' ? req.body.description : 'Admin reward adjustment',
    });
    res.status(201).json(transaction);
  } catch {
    res.status(400).json({ error: 'Unable to create reward transaction' });
  }
});

router.get('/vendors', authenticateToken, requireAdmin, async (_req, res) => {
  const vendors = await Vendor.findAll({
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
    order: [['storeName', 'ASC']],
  });
  res.json(vendors);
});

router.post('/vendors', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const storeName = String(req.body.storeName || '').trim();
    if (!storeName) return res.status(400).json({ error: 'Store name is required' });
    const vendor = await Vendor.create({
      userId: req.body.userId ? Number(req.body.userId) : null,
      storeName,
      email: typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : null,
      phone: typeof req.body.phone === 'string' ? req.body.phone : null,
      address: typeof req.body.address === 'string' ? req.body.address : null,
      status: typeof req.body.status === 'string' ? req.body.status : 'active',
      profile: typeof req.body.profile === 'string' ? req.body.profile : null,
    });
    res.status(201).json(vendor);
  } catch {
    res.status(400).json({ error: 'Unable to create vendor' });
  }
});

router.put('/vendors/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const vendor = await Vendor.findByPk(Number(req.params.id));
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    await vendor.update({
      storeName: String(req.body.storeName || vendor.storeName).trim(),
      email: typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : vendor.email,
      phone: typeof req.body.phone === 'string' ? req.body.phone : vendor.phone,
      address: typeof req.body.address === 'string' ? req.body.address : vendor.address,
      status: typeof req.body.status === 'string' ? req.body.status : vendor.status,
      profile: typeof req.body.profile === 'string' ? req.body.profile : vendor.profile,
    });
    res.json(vendor);
  } catch {
    res.status(400).json({ error: 'Unable to update vendor' });
  }
});

router.get('/vendor-settlements', authenticateToken, requireAdmin, async (_req, res) => {
  const settlements = await VendorSettlement.findAll({
    include: [
      { model: Vendor, as: 'vendor' },
      { model: Order, as: 'order' },
    ],
    order: [['createdAt', 'DESC']],
  });
  res.json(settlements);
});

router.post('/vendor-settlements', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const vendorId = Number(req.body.vendorId);
    const netAmount = Number(req.body.netAmount || 0);
    if (!Number.isInteger(vendorId)) return res.status(400).json({ error: 'Vendor is required' });
    const settlement = await VendorSettlement.create({
      vendorId,
      orderId: req.body.orderId ? Number(req.body.orderId) : null,
      transactionType: typeof req.body.transactionType === 'string' ? req.body.transactionType : 'manual',
      grossAmount: Number(req.body.grossAmount || netAmount),
      commissionAmount: Number(req.body.commissionAmount || 0),
      netAmount,
      paidAmount: Number(req.body.paidAmount || 0),
      status: typeof req.body.status === 'string' ? req.body.status : 'pending',
      notes: typeof req.body.notes === 'string' ? req.body.notes : null,
      settledAt: req.body.status === 'paid' ? new Date() : null,
    });
    res.status(201).json(settlement);
  } catch {
    res.status(400).json({ error: 'Unable to create vendor settlement' });
  }
});

router.put('/vendor-settlements/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settlement = await VendorSettlement.findByPk(Number(req.params.id));
    if (!settlement) return res.status(404).json({ error: 'Settlement not found' });
    const status = String(req.body.status || '').trim();
    if (!status) return res.status(400).json({ error: 'Status is required' });
    await settlement.update({
      status,
      paidAmount: status === 'paid' ? Number(req.body.paidAmount || settlement.netAmount) : settlement.paidAmount,
      settledAt: status === 'paid' ? new Date() : settlement.settledAt,
    });
    res.json(settlement);
  } catch {
    res.status(400).json({ error: 'Unable to update settlement' });
  }
});

router.get('/invoices', authenticateToken, requireAdmin, async (_req, res) => {
  const invoices = await Invoice.findAll({ include: [{ model: Order, as: 'order' }], order: [['createdAt', 'DESC']] });
  res.json(invoices);
});

router.get('/orders/:orderId/invoice.pdf', authenticateToken, requireAdmin, async (req, res) => {
  const order = await Order.findByPk(Number(req.params.orderId));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const { invoice, pdf } = await generateInvoicePdf(order);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);
  res.send(pdf);
});

export default router;
