import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import { Op } from 'sequelize';
import { sendOrderCreatedEmails } from '../services/email.js';
import { ensureInvoice } from '../services/invoice.js';
import { awardOrderRewards } from '../services/loyalty.js';

const router = Router();

router.get('/', authenticateToken, requireAdmin, async (_req, res) => {
  const orders = await Order.findAll({ order: [['createdAt', 'DESC']] });
  res.json(orders);
});

router.put('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const status = String(req.body.status || '').trim();
    if (!status) return res.status(400).json({ error: 'Order status is required' });
    const order = await Order.findByPk(Number(req.params.id));
    if (!order) return res.status(404).json({ error: 'Order not found' });
    await order.update({ status });
    if (status === 'completed') void awardOrderRewards(order);
    res.json(order);
  } catch {
    res.status(400).json({ error: 'Unable to update order status' });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!req.body.customerName || !req.body.email || !Array.isArray(req.body.items) || req.body.items.length === 0) {
      return res.status(400).json({ error: 'Customer name, email, and cart items are required' });
    }

    const quantities = new Map<number, number>();
    for (const item of req.body.items) {
      const productId = Number(item.productId);
      const quantity = Number(item.quantity);
      if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ error: 'Cart contains an invalid item' });
      quantities.set(productId, (quantities.get(productId) || 0) + quantity);
    }
    const products = await Product.findAll({ where: { id: { [Op.in]: [...quantities.keys()] } } });
    if (products.length !== quantities.size) return res.status(400).json({ error: 'One or more products are no longer available' });
    const items = products.map((product) => {
      const quantity = quantities.get(product.id) || 0;
      if (product.stockStatus === 'outofstock' || (product.stockQuantity !== null && product.stockQuantity < quantity)) throw new Error(`${product.name} is out of stock`);
      return { productId: product.id, name: product.name, price: Number(product.salePrice || product.price), quantity, sku: product.sku || null };
    });
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const couponCode = typeof req.body.couponCode === 'string' ? req.body.couponCode.trim().toUpperCase() : '';
    let discountTotal = 0;
    let coupon: Coupon | null = null;
    if (couponCode) {
      coupon = await Coupon.findOne({ where: { code: couponCode, active: true } });
      if (!coupon || (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) || (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)) return res.status(400).json({ error: 'Coupon is not valid' });
      discountTotal = coupon.discountType === 'percent' ? subtotal * (coupon.amount / 100) : coupon.amount;
      discountTotal = Math.min(Math.max(discountTotal, 0), subtotal);
    }
    const shippingTotal = Number(req.body.shippingTotal || 0);
    const taxTotal = Number(req.body.taxTotal || 0);
    const total = Math.max(subtotal - discountTotal + shippingTotal + taxTotal, 0);

    const order = await Order.create({
      customerName: req.body.customerName,
      email: req.body.email,
      total,
      subtotal,
      discountTotal,
      shippingTotal,
      taxTotal,
      items: JSON.stringify(items),
      status: 'pending',
      couponCode: coupon?.code || null,
      billingAddress: typeof req.body.billingAddress === 'string' ? req.body.billingAddress : null,
      shippingAddress: typeof req.body.shippingAddress === 'string' ? req.body.shippingAddress : null,
      phone: typeof req.body.phone === 'string' ? req.body.phone : null,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
    });

    for (const product of products) {
      const quantity = quantities.get(product.id) || 0;
      if (product.stockQuantity !== null) await product.update({ stockQuantity: Math.max(product.stockQuantity - quantity, 0) });
    }
    if (coupon) await coupon.increment('usedCount');
    void ensureInvoice(order);
    void awardOrderRewards(order);

    void sendOrderCreatedEmails(order);

    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create order' });
  }
});

export default router;
