import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Coupon from '../models/Coupon.js';
import { hashPassword } from '../utils/password.js';

function productPayload(body: Record<string, unknown>) {
  return {
    name: String(body.name || '').trim(),
    price: Number(body.price),
    regularPrice: body.regularPrice === null || body.regularPrice === '' || typeof body.regularPrice === 'undefined' ? null : Number(body.regularPrice),
    salePrice: body.salePrice === null || body.salePrice === '' || typeof body.salePrice === 'undefined' ? null : Number(body.salePrice),
    sku: typeof body.sku === 'string' && body.sku.trim() ? body.sku.trim() : null,
    description: typeof body.description === 'string' ? body.description : '',
    fullDescription: typeof body.fullDescription === 'string' ? body.fullDescription : null,
    imageUrl: typeof body.imageUrl === 'string' && body.imageUrl.trim() ? body.imageUrl.trim() : null,
    galleryImages: typeof body.galleryImages === 'string' && body.galleryImages.trim() ? body.galleryImages.trim() : null,
    brand: typeof body.brand === 'string' && body.brand.trim() ? body.brand.trim() : null,
    stockQuantity: body.stockQuantity === null || body.stockQuantity === '' || typeof body.stockQuantity === 'undefined' ? null : Number(body.stockQuantity),
    stockStatus: typeof body.stockStatus === 'string' && body.stockStatus.trim() ? body.stockStatus.trim() : 'instock',
    attributes: typeof body.attributes === 'string' && body.attributes.trim() ? body.attributes.trim() : null,
    variations: typeof body.variations === 'string' && body.variations.trim() ? body.variations.trim() : null,
    categoryId: body.categoryId || null,
  };
}

function couponPayload(body: Record<string, unknown>) {
  return {
    code: String(body.code || '').trim().toUpperCase(),
    discountType: typeof body.discountType === 'string' && body.discountType.trim() ? body.discountType.trim() : 'fixed_cart',
    amount: Number(body.amount || 0),
    usageLimit: body.usageLimit === null || body.usageLimit === '' || typeof body.usageLimit === 'undefined' ? null : Number(body.usageLimit),
    usedCount: body.usedCount === null || body.usedCount === '' || typeof body.usedCount === 'undefined' ? 0 : Number(body.usedCount),
    expiresAt: typeof body.expiresAt === 'string' && body.expiresAt ? new Date(body.expiresAt) : null,
    active: typeof body.active === 'boolean' ? body.active : true,
  };
}

export async function listUsers(_req: Request, res: Response) {
  const users = await User.findAll({ attributes: ['id', 'name', 'email', 'role'] });
  res.json(users);
}

export async function createUser(req: Request, res: Response) {
  try {
    if (!req.body.name || !req.body.email || !req.body.password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    const user = await User.create({
      name: req.body.name,
      email: req.body.email,
      password: hashPassword(req.body.password),
      role: req.body.role || 'user',
      phone: req.body.phone || null,
      billingAddress: req.body.billingAddress || null,
      shippingAddress: req.body.shippingAddress || null,
    });
    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone });
  } catch {
    res.status(400).json({ error: 'Unable to create user' });
  }
}

export async function listProducts(req: Request, res: Response) {
  const hasPagination = typeof req.query.page !== 'undefined' || typeof req.query.limit !== 'undefined' || typeof req.query.search !== 'undefined' || typeof req.query.categoryId !== 'undefined';
  const search = String(req.query.search || req.query.q || '').trim();
  const categoryId = Number(req.query.categoryId);
  const where: any = {};
  if (search) {
    const pattern = `%${search}%`;
    where[Op.or] = [
      { name: { [Op.like]: pattern } },
      { sku: { [Op.like]: pattern } },
      { brand: { [Op.like]: pattern } },
      { description: { [Op.like]: pattern } },
      { fullDescription: { [Op.like]: pattern } },
    ];
  }
  if (Number.isInteger(categoryId) && categoryId > 0) where.categoryId = categoryId;
  const include = [{ model: Category, as: 'category', attributes: ['id', 'name'] }];
  const order: [string, string][] = [['createdAt', 'DESC']];
  if (!hasPagination) {
    const products = await Product.findAll({ where, include, order });
    return res.json(products);
  }
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 24));
  const { rows, count } = await Product.findAndCountAll({ where, include, order, limit, offset: (page - 1) * limit, distinct: true });
  return res.json({ items: rows, page, limit, total: count, totalPages: Math.ceil(count / limit) });
}

export async function createProduct(req: Request, res: Response) {
  try {
    if (!req.body.name || Number.isNaN(Number(req.body.price))) {
      return res.status(400).json({ error: 'Product name and price are required' });
    }
    const product = await Product.create(productPayload(req.body));
    res.status(201).json(product);
  } catch {
    res.status(400).json({ error: 'Unable to create product' });
  }
}

export async function updateProduct(req: Request, res: Response) {
  try {
    if (!req.body.name || Number.isNaN(Number(req.body.price))) {
      return res.status(400).json({ error: 'Product name and price are required' });
    }
    const product = await Product.findByPk(Number(req.params.id));
    if (!product) return res.status(404).json({ error: 'Product not found' });
    await product.update(productPayload(req.body));
    res.json(product);
  } catch {
    res.status(400).json({ error: 'Unable to update product' });
  }
}

export async function deleteProduct(req: Request, res: Response) {
  try {
    const product = await Product.findByPk(Number(req.params.id));
    if (!product) return res.status(404).json({ error: 'Product not found' });
    await product.destroy();
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: 'Unable to delete product' });
  }
}

export async function listCoupons(_req: Request, res: Response) {
  const coupons = await Coupon.findAll({ order: [['createdAt', 'DESC']] });
  res.json(coupons);
}

export async function validateCoupon(req: Request, res: Response) {
  const code = String(req.body.code || '').trim().toUpperCase();
  const subtotal = Number(req.body.subtotal || 0);
  const coupon = code ? await Coupon.findOne({ where: { code, active: true } }) : null;
  if (!coupon || (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) || (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)) {
    return res.status(404).json({ error: 'Coupon is not valid' });
  }
  const discount = coupon.discountType === 'percent' ? subtotal * (coupon.amount / 100) : coupon.amount;
  res.json({ code: coupon.code, discountType: coupon.discountType, amount: coupon.amount, discount: Math.min(Math.max(discount, 0), subtotal) });
}

export async function createCoupon(req: Request, res: Response) {
  try {
    const payload = couponPayload(req.body);
    if (!payload.code || Number.isNaN(payload.amount)) return res.status(400).json({ error: 'Coupon code and amount are required' });
    const coupon = await Coupon.create(payload);
    res.status(201).json(coupon);
  } catch {
    res.status(400).json({ error: 'Unable to create coupon' });
  }
}

export async function updateCoupon(req: Request, res: Response) {
  try {
    const coupon = await Coupon.findByPk(Number(req.params.id));
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    const payload = couponPayload(req.body);
    if (!payload.code || Number.isNaN(payload.amount)) return res.status(400).json({ error: 'Coupon code and amount are required' });
    await coupon.update(payload);
    res.json(coupon);
  } catch {
    res.status(400).json({ error: 'Unable to update coupon' });
  }
}

export async function deleteCoupon(req: Request, res: Response) {
  try {
    const coupon = await Coupon.findByPk(Number(req.params.id));
    if (!coupon) return res.status(404).json({ error: 'Coupon not found' });
    await coupon.destroy();
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: 'Unable to delete coupon' });
  }
}
