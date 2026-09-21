import type { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken, type AuthenticatedRequest, requireAdmin } from '../middleware/auth.js';
import Invoice from '../models/Invoice.js';
import Order from '../models/Order.js';
import RewardTransaction from '../models/RewardTransaction.js';
import User from '../models/User.js';
import Vendor from '../models/Vendor.js';
import VendorSettlement from '../models/VendorSettlement.js';
import VendorPayoutRequest from '../models/VendorPayoutRequest.js';
import WalletTransaction from '../models/WalletTransaction.js';
import { generateInvoicePdf } from '../services/invoice.js';
import { addRewardTransaction, addWalletTransaction, rewardBalance, walletBalance } from '../services/loyalty.js';
import { hashPassword } from '../utils/password.js';
import jwt from 'jsonwebtoken';
import { razorpayConfig } from './paymentsController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const vendorDocumentDir = path.join(__dirname, '../../uploads/vendor-documents');
fs.mkdirSync(vendorDocumentDir, { recursive: true });
const acceptedVendorDocumentTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

function onboardingSecret() {
  return process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-secret');
}

function onboardingVendor(req: Request) {
  const token = String(req.header('x-vendor-onboarding-token') || '');
  if (!token || !onboardingSecret()) throw new Error('Your onboarding session has expired. Please register again.');
  const payload = jwt.verify(token, onboardingSecret()) as { vendorId?: number; email?: string; purpose?: string };
  if (payload.purpose !== 'vendor-onboarding' || !Number.isInteger(payload.vendorId)) throw new Error('Invalid onboarding session');
  return payload;
}

export const vendorRegistrationUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, vendorDocumentDir),
    filename: (_req, file, callback) => callback(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-')}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => acceptedVendorDocumentTypes.has(file.mimetype) ? callback(null, true) : callback(new Error('Documents must be PDF, JPG, PNG, DOC, or DOCX')),
});

function requestedUserId(req: AuthenticatedRequest) {
  const user = req.user;
  const id = Number(req.params.userId || req.query.userId || user?.id);
  if (!user || !Number.isInteger(id)) return null;
  if (user.role !== 'admin' && user.id !== id) return null;
  return id;
}

export async function get__wallet(_req: Request, res: Response) {
  const transactions = await WalletTransaction.findAll({
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
    order: [['createdAt', 'DESC']],
  });
  res.json(transactions);

}

export async function get__wallet_users_userId_1(req: Request, res: Response) {
  const userId = requestedUserId(req as AuthenticatedRequest);
  if (!userId) return res.status(403).json({ error: 'Access denied' });
  const transactions = await WalletTransaction.findAll({ where: { userId }, order: [['createdAt', 'DESC']] });
  res.json({ balance: await walletBalance(userId), transactions });

}

export async function post__wallet_transactions_2(req: Request, res: Response) {
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

}

export async function get__rewards_3(_req: Request, res: Response) {
  const transactions = await RewardTransaction.findAll({
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
    order: [['createdAt', 'DESC']],
  });
  res.json(transactions);

}

export async function get__rewards_users_userId_4(req: Request, res: Response) {
  const userId = requestedUserId(req as AuthenticatedRequest);
  if (!userId) return res.status(403).json({ error: 'Access denied' });
  const transactions = await RewardTransaction.findAll({ where: { userId }, order: [['createdAt', 'DESC']] });
  res.json({ balance: await rewardBalance(userId), transactions });

}

export async function post__rewards_transactions_5(req: Request, res: Response) {
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

}

export async function get__vendors_6(_req: Request, res: Response) {
  const vendors = await Vendor.findAll({
    attributes: { exclude: ['passwordHash'] },
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
    order: [['storeName', 'ASC']],
  });
  res.json(vendors);

}

export async function post__vendors_register_7(req: Request, res: Response) {
  try {
    const storeName = String(req.body.storeName || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : null;
    const address = typeof req.body.address === 'string' ? req.body.address.trim() : null;
    const plan = String(req.body.plan || 'Free Plan').trim();
    const fees: Record<string, number> = { 'Free Plan': 0, 'Silver Insta': 799, 'Gold Insta': 999, 'Diamond Insta': 1499, 'Platinum Insta': 1999, 'Bronze Insta': 499 };
    if (!Object.prototype.hasOwnProperty.call(fees, plan)) return res.status(400).json({ error: 'Choose a valid membership plan' });
    const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
    const documentUrl = (field: string) => files[field]?.[0] ? `/uploads/vendor-documents/${files[field][0].filename}` : null;
    const profile = JSON.stringify({
      plan,
      firstName: String(req.body.firstName || '').trim() || null,
      lastName: String(req.body.lastName || '').trim() || null,
      country: String(req.body.country || '').trim() || null,
      city: String(req.body.city || '').trim() || null,
      state: String(req.body.state || '').trim() || null,
      postcode: String(req.body.postcode || '').trim() || null,
      gst: String(req.body.gst || '').trim() || null,
      fssai: String(req.body.fssai || '').trim() || null,
      executiveName: String(req.body.executiveName || '').trim() || null,
      executivePhone: String(req.body.mobile || '').trim() || null,
      documents: { gstCertificate: documentUrl('gstCertificate'), fssaiCertificate: documentUrl('fssaiCertificate'), bankPassbook: documentUrl('bankPassbook'), otherLicence: documentUrl('otherLicence') },
    });
    if (!storeName || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Store name and valid email are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await Vendor.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Vendor request already exists for this email' });
    }

    const vendor = await Vendor.create({ storeName, email, phone, address, profile, status: 'pending', passwordHash: hashPassword(password), membershipPlan: plan, membershipFee: fees[plan], membershipStatus: 'pending', membershipPaymentStatus: fees[plan] === 0 ? 'paid' : 'unpaid' });
    const onboardingToken = jwt.sign({ vendorId: vendor.id, email, purpose: 'vendor-onboarding' }, onboardingSecret(), { expiresIn: '2h' });
    res.status(201).json({ id: vendor.id, onboardingToken, membershipFee: vendor.membershipFee, message: 'Registration saved. Continue to secure payment.' });
  } catch {
    res.status(400).json({ error: 'Unable to submit vendor registration' });
  }

}

export async function post__vendors_membership_payment_link_21(req: Request, res: Response) {
  try {
    const session = onboardingVendor(req);
    const vendor = await Vendor.findByPk(session.vendorId);
    if (!vendor || vendor.email !== session.email) return res.status(404).json({ error: 'Vendor registration not found' });
    if (vendor.membershipFee <= 0) {
      await vendor.update({ membershipPaymentStatus: 'paid', membershipStatus: 'active', membershipStartedAt: new Date(), membershipExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) });
      return res.json({ paymentStatus: 'paid', membershipStatus: 'active' });
    }
    if (vendor.membershipPaymentLinkId && vendor.membershipPaymentStatus === 'pending') {
      return res.json({ paymentStatus: 'pending', paymentUrl: null, message: 'A payment link has already been created. Request a new link after it expires.' });
    }
    const { keyId, keySecret } = razorpayConfig();
    const response = await fetch('https://api.razorpay.com/v1/payment_links', { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Math.round(vendor.membershipFee * 100), currency: 'INR', reference_id: `vendor_membership_${vendor.id}_${Date.now()}`, description: `Foodiens ${vendor.membershipPlan} membership`, customer: { name: vendor.storeName, email: vendor.email }, notify: { sms: false, email: false }, reminder_enable: false, expire_by: Math.floor(Date.now() + 24 * 60 * 60 * 1000), notes: { vendor_id: String(vendor.id), membership_plan: vendor.membershipPlan } }) });
    const link = await response.json() as { id?: string; short_url?: string; error?: { description?: string } };
    if (!response.ok || !link.id || !link.short_url) return res.status(502).json({ error: link.error?.description || 'Unable to create Razorpay payment link' });
    await vendor.update({ membershipPaymentLinkId: link.id, membershipPaymentStatus: 'pending', membershipStatus: 'pending' });
    res.json({ paymentStatus: 'pending', paymentUrl: link.short_url });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to start payment' });
  }
}

export async function get__vendors_membership_status_22(req: Request, res: Response) {
  try {
    const session = onboardingVendor(req);
    const vendor = await Vendor.findByPk(session.vendorId);
    if (!vendor || vendor.email !== session.email) return res.status(404).json({ error: 'Vendor registration not found' });
    res.json({ paymentStatus: vendor.membershipPaymentStatus, membershipStatus: vendor.membershipStatus, plan: vendor.membershipPlan, fee: vendor.membershipFee });
  } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to check payment status' }); }
}

export async function post__vendors_8(req: Request, res: Response) {
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

}

export async function post__vendors_id_approve_9(req: Request, res: Response) {
  try {
    const vendor = await Vendor.findByPk(Number(req.params.id));
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    if (!vendor.email) return res.status(400).json({ error: 'Vendor email is required before approval' });

    // The vendor's own password (set at registration time) is what gets activated here.
    // Older pending vendors created before passwordHash existed can still be approved by
    // passing a password in the request body as a one-time fallback.
    let passwordHash = vendor.passwordHash;
    if (!passwordHash) {
      const fallbackPassword = String(req.body.password || '');
      if (fallbackPassword.length < 8) {
        return res.status(400).json({ error: 'This vendor registered before passwords were collected at signup. Provide a password (8+ characters) to approve it.' });
      }
      passwordHash = hashPassword(fallbackPassword);
    }

    let user = await User.findOne({ where: { email: vendor.email } });
    if (user) {
      await user.update({ name: vendor.storeName, password: passwordHash, role: 'vendor' });
    } else {
      user = await User.create({ name: vendor.storeName, email: vendor.email, password: passwordHash, role: 'vendor', phone: vendor.phone, billingAddress: vendor.address, shippingAddress: vendor.address });
    }
    await vendor.update({ userId: user.id, status: 'active', passwordHash: null });
    const { passwordHash: _omit, ...vendorPayload } = vendor.get({ plain: true }) as Record<string, unknown>;
    res.json({ vendor: vendorPayload, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch {
    res.status(400).json({ error: 'Unable to approve vendor' });
  }

}

export async function put__vendors_id_10(req: Request, res: Response) {
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
      membershipPlan: typeof req.body.membershipPlan === 'string' ? req.body.membershipPlan : vendor.membershipPlan,
      membershipStatus: typeof req.body.membershipStatus === 'string' ? req.body.membershipStatus : vendor.membershipStatus,
      membershipPaymentStatus: typeof req.body.membershipPaymentStatus === 'string' ? req.body.membershipPaymentStatus : vendor.membershipPaymentStatus,
      membershipFee: Number.isFinite(Number(req.body.membershipFee)) ? Math.max(0, Number(req.body.membershipFee)) : vendor.membershipFee,
      membershipStartedAt: req.body.membershipStatus === 'active' && !vendor.membershipStartedAt ? new Date() : vendor.membershipStartedAt,
    });
    res.json(vendor);
  } catch {
    res.status(400).json({ error: 'Unable to update vendor' });
  }

}

export async function get__vendor_settlements_11(_req: Request, res: Response) {
  const settlements = await VendorSettlement.findAll({
    include: [
      { model: Vendor, as: 'vendor' },
      { model: Order, as: 'order' },
    ],
    order: [['createdAt', 'DESC']],
  });
  res.json(settlements);

}

export async function post__vendor_settlements_12(req: Request, res: Response) {
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

}

export async function put__vendor_settlements_id_status_13(req: Request, res: Response) {
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

}

export async function get__vendor_payout_requests_14(_req: Request, res: Response) {
  const requests = await VendorPayoutRequest.findAll({ include: [{ model: Vendor, as: 'vendor', attributes: ['id', 'storeName', 'email', 'payoutMethod', 'payoutUpi', 'payoutAccountName', 'payoutAccountNumber', 'payoutIfsc'] }], order: [['createdAt', 'DESC']], limit: 200 });
  res.json(requests);

}

export async function put__vendor_payout_requests_id_status_15(req: Request, res: Response) {
  try {
    const request = await VendorPayoutRequest.findByPk(Number(req.params.id));
    if (!request) return res.status(404).json({ error: 'Payout request not found' });
    const status = String(req.body.status || '').trim();
    if (!['requested', 'processing', 'paid', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid payout status' });
    await request.update({ status, notes: typeof req.body.notes === 'string' ? req.body.notes : request.notes, processedAt: ['paid', 'rejected'].includes(status) ? new Date() : request.processedAt });
    res.json(request);
  } catch {
    res.status(400).json({ error: 'Unable to update payout request' });
  }

}

export async function get__invoices_16(_req: Request, res: Response) {
  const invoices = await Invoice.findAll({ include: [{ model: Order, as: 'order' }], order: [['createdAt', 'DESC']] });
  res.json(invoices);

}

export async function get__orders_orderId_invoice_pdf_17(req: Request, res: Response) {
  const order = await Order.findByPk(Number(req.params.orderId));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const { invoice, pdf } = await generateInvoicePdf(order);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);
  res.send(pdf);

}


export async function post__vendors_id_reject_18(req: Request, res: Response) {
  try {
    const vendor = await Vendor.findByPk(Number(req.params.id));
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    await vendor.update({ status: 'rejected' });
    res.json({ success: true, vendor });
  } catch { res.status(400).json({ error: 'Unable to reject vendor' }); }
}

export async function post__vendors_id_suspend_19(req: Request, res: Response) {
  try {
    const vendor = await Vendor.findByPk(Number(req.params.id));
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    await vendor.update({ status: 'suspended' });
    res.json({ success: true, vendor });
  } catch { res.status(400).json({ error: 'Unable to suspend vendor' }); }
}

export async function post__vendors_id_reactivate_20(req: Request, res: Response) {
  try {
    const vendor = await Vendor.findByPk(Number(req.params.id));
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    await vendor.update({ status: 'active' });
    res.json({ success: true, vendor });
  } catch { res.status(400).json({ error: 'Unable to reactivate vendor' }); }
}
