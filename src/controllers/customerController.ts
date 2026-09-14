import type { Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import Order from '../models/Order.js';
import WalletTransaction from '../models/WalletTransaction.js';
import RewardTransaction from '../models/RewardTransaction.js';
import WishlistItem from '../models/WishlistItem.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { rewardBalance, walletBalance } from '../services/loyalty.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { buildOrderTracking } from '../services/orderTracking.js';

export async function get__orders(req: Request, res: Response) {
  const user = (req as AuthenticatedRequest).user;
  if (!user) return res.status(401).json({ error: 'Access token missing' });
  const customer = await User.findByPk(user.id, { attributes: ['email'] });
  const orders = await Order.findAll({
    where: { email: customer?.email || user.email },
    order: [['createdAt', 'DESC']],
    limit: 50,
  });
  res.json(orders.map((order) => {
    let items: unknown[] = [];
    try { items = JSON.parse(order.items); } catch { /* keep an empty list for legacy malformed rows */ }
    return { ...order.toJSON(), items };
  }));

}

export async function get__orders_id_tracking_1(req: Request, res: Response) {
  const user = (req as AuthenticatedRequest).user;
  if (!user) return res.status(401).json({ error: 'Access token missing' });
  const customer = await User.findByPk(user.id, { attributes: ['email'] });
  const order = await Order.findOne({ where: { id: Number(req.params.id), email: customer?.email || user.email } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ ...buildOrderTracking(order), shippingAddress: order.shippingAddress, deliveryNote: order.deliveryNote });

}

export async function get__wallet_2(req: Request, res: Response) {
  const user = (req as AuthenticatedRequest).user;
  if (!user) return res.status(401).json({ error: 'Access token missing' });
  const transactions = await WalletTransaction.findAll({ where: { userId: user.id }, order: [['createdAt', 'DESC']], limit: 100 });
  res.json({ balance: await walletBalance(user.id), transactions });

}

export async function get__rewards_3(req: Request, res: Response) {
  const user = (req as AuthenticatedRequest).user;
  if (!user) return res.status(401).json({ error: 'Access token missing' });
  const transactions = await RewardTransaction.findAll({ where: { userId: user.id }, order: [['createdAt', 'DESC']], limit: 100 });
  res.json({ points: await rewardBalance(user.id), transactions });

}

export async function get__wishlist_4(req: Request, res: Response) {
  const user = (req as AuthenticatedRequest).user;
  if (!user) return res.status(401).json({ error: 'Access token missing' });
  const entries = await WishlistItem.findAll({ where: { userId: user.id }, include: [{ model: Product, as: 'product' }], order: [['createdAt', 'DESC']] });
  res.json(entries.map((entry) => entry.product));

}

export async function post__wishlist_productId_5(req: Request, res: Response) {
  const user = (req as AuthenticatedRequest).user;
  if (!user) return res.status(401).json({ error: 'Access token missing' });
  const productId = Number(req.params.productId);
  if (!Number.isInteger(productId)) return res.status(400).json({ error: 'Product id is invalid' });
  const product = await Product.findByPk(productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  await WishlistItem.findOrCreate({ where: { userId: user.id, productId } });
  res.status(201).json(product);

}

export async function delete__wishlist_productId_6(req: Request, res: Response) {
  const user = (req as AuthenticatedRequest).user;
  if (!user) return res.status(401).json({ error: 'Access token missing' });
  await WishlistItem.destroy({ where: { userId: user.id, productId: Number(req.params.productId) } });
  res.status(204).send();

}

export async function get__downloads_7(req: Request, res: Response) {
  const user = (req as AuthenticatedRequest).user;
  if (!user) return res.status(401).json({ error: 'Access token missing' });
  const customer = await User.findByPk(user.id, { attributes: ['email'] });
  const orders = await Order.findAll({ where: { email: customer?.email || user.email }, order: [['createdAt', 'DESC']], limit: 50 });
  const downloads: unknown[] = [];
  for (const order of orders) {
    try {
      const items = JSON.parse(order.items) as Array<Record<string, unknown>>;
      for (const item of items) if (item.downloadUrl) downloads.push({ orderId: order.id, name: item.name, downloadUrl: item.downloadUrl, createdAt: order.createdAt });
    } catch { /* ignore malformed legacy item JSON */ }
  }
  res.json(downloads);

}

export async function get__profile_8(req: Request, res: Response) {
  const authUser = (req as AuthenticatedRequest).user;
  if (!authUser) return res.status(401).json({ error: 'Access token missing' });
  const user = await User.findByPk(authUser.id, { attributes: ['id', 'name', 'email', 'phone', 'profileImageUrl', 'notificationPreferences', 'referralCode', 'billingAddress', 'shippingAddress'] });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);

}

export async function put__profile_image_11(req: Request, res: Response) {
  const authUser = (req as AuthenticatedRequest).user;
  if (!authUser) return res.status(401).json({ error: 'Access token missing' });
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) return res.status(400).json({ error: 'Profile image is required' });
  const user = await User.findByPk(authUser.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const profileImageUrl = `/uploads/${file.filename}`;
  await user.update({ profileImageUrl });
  res.json({ profileImageUrl });
}

export async function patch__profile_9(req: Request, res: Response) {
  const authUser = (req as AuthenticatedRequest).user;
  if (!authUser) return res.status(401).json({ error: 'Access token missing' });
  const user = await User.findByPk(authUser.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : user.name;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : user.email;
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
  if (email !== user.email) {
    if (!verifyPassword(String(req.body.currentPassword || ''), user.password)) return res.status(401).json({ error: 'Current password is required to change email' });
    const existing = await User.findOne({ where: { email } });
    if (existing && existing.id !== user.id) return res.status(409).json({ error: 'Email address is already in use' });
  }
  const notificationPreferences = typeof req.body.notificationPreferences === 'string' ? req.body.notificationPreferences : user.notificationPreferences;
  await user.update({ name, email, phone: typeof req.body.phone === 'string' ? req.body.phone.trim() : user.phone, billingAddress: typeof req.body.billingAddress === 'string' ? req.body.billingAddress.trim() : user.billingAddress, shippingAddress: typeof req.body.shippingAddress === 'string' ? req.body.shippingAddress.trim() : user.shippingAddress, notificationPreferences });
  res.json({ id: user.id, name: user.name, email: user.email, phone: user.phone, profileImageUrl: user.profileImageUrl, notificationPreferences: user.notificationPreferences, billingAddress: user.billingAddress, shippingAddress: user.shippingAddress });

}

export async function patch__password_10(req: Request, res: Response) {
  const authUser = (req as AuthenticatedRequest).user;
  if (!authUser) return res.status(401).json({ error: 'Access token missing' });
  const user = await User.findByPk(authUser.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  if (!currentPassword || newPassword.length < 8) return res.status(400).json({ error: 'Current password and a new password of at least 8 characters are required' });
  if (newPassword !== String(req.body.confirmPassword || '')) return res.status(400).json({ error: 'New passwords do not match' });
  if (!verifyPassword(currentPassword, user.password)) return res.status(401).json({ error: 'Current password is incorrect' });
  await user.update({ password: hashPassword(newPassword) });
  res.json({ message: 'Password updated successfully' });

}
