import type { Request, Response } from 'express';
import { type AuthenticatedRequest } from '../middleware/auth.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import ProductReview from '../models/ProductReview.js';
import User from '../models/User.js';

export async function listProductReviews(req: Request, res: Response) {
  const productId = Number(req.params.productId);
  if (!Number.isInteger(productId) || productId < 1) return res.status(400).json({ error: 'Invalid product ID' });
  const reviews = await ProductReview.findAll({
    where: { productId, status: 'approved' },
    attributes: ['id', 'reviewerName', 'rating', 'review', 'createdAt'],
    order: [['createdAt', 'DESC']],
  });
  const total = reviews.length;
  const averageRating = total ? Number((reviews.reduce((sum, item) => sum + item.rating, 0) / total).toFixed(1)) : 0;
  res.json({ reviews, total, averageRating });
}

export async function submitProductReview(req: Request, res: Response) {
  const authUser = (req as AuthenticatedRequest).user;
  if (!authUser || authUser.role !== 'user') return res.status(403).json({ error: 'Sign in with a customer account to review this product' });
  const productId = Number(req.params.productId);
  const rating = Number(req.body.rating);
  const review = typeof req.body.review === 'string' ? req.body.review.trim() : '';
  if (!Number.isInteger(productId) || productId < 1 || !Number.isInteger(rating) || rating < 1 || rating > 5 || review.length < 5 || review.length > 4000) {
    return res.status(400).json({ error: 'Choose a rating and enter a review between 5 and 4000 characters' });
  }
  const [product, user] = await Promise.all([Product.findByPk(productId), User.findByPk(authUser.id)]);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (!user || user.role !== 'user') return res.status(403).json({ error: 'Customer account required' });

  const paidOrders = await Order.findAll({ where: { email: user.email, paymentStatus: 'paid' }, attributes: ['items'] });
  const verifiedPurchase = paidOrders.some((order) => {
    try {
      const items = JSON.parse(order.items || '[]') as Array<{ productId?: number | string }>;
      return Array.isArray(items) && items.some((item) => Number(item.productId) === productId);
    } catch { return false; }
  });
  if (!verifiedPurchase) return res.status(403).json({ error: 'Only customers with a paid order for this product can review it' });

  const [entry] = await ProductReview.findOrCreate({
    where: { productId, userId: user.id },
    defaults: { productId, userId: user.id, reviewerName: user.name, rating, review, status: 'pending' },
  });
  if (!entry.isNewRecord) await entry.update({ reviewerName: user.name, rating, review, status: 'pending' });
  res.status(201).json({ message: 'Review submitted for approval', status: 'pending' });
}

export async function listAdminProductReviews(_req: Request, res: Response) {
  const reviews = await ProductReview.findAll({
    include: [
      { model: Product, as: 'product', attributes: ['id', 'name'], required: false },
      { model: User, as: 'user', attributes: ['id', 'name', 'email'], required: false },
    ],
    order: [['createdAt', 'DESC']],
  });
  res.json(reviews);
}

export async function updateAdminProductReview(req: Request, res: Response) {
  const status = req.body.status;
  if (typeof status !== 'string' || !['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'Choose a valid review status' });
  const review = await ProductReview.findByPk(Number(req.params.id));
  if (!review) return res.status(404).json({ error: 'Review not found' });
  await review.update({ status: status as 'approved' | 'rejected' | 'pending' });
  res.json(review);
}

export async function deleteAdminProductReview(req: Request, res: Response) {
  const review = await ProductReview.findByPk(Number(req.params.id));
  if (!review) return res.status(404).json({ error: 'Review not found' });
  await review.destroy();
  res.json({ message: 'Review deleted' });
}
