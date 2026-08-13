import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Coupon from '../models/Coupon.js';
import { hashPassword } from '../utils/password.js';
const router = Router();
function productPayload(body) {
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
function couponPayload(body) {
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
router.get('/users', authenticateToken, requireAdmin, async (_req, res) => {
    const users = await User.findAll({ attributes: ['id', 'name', 'email', 'role'] });
    res.json(users);
});
router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
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
    }
    catch (error) {
        res.status(400).json({ error: 'Unable to create user' });
    }
});
router.get('/products', async (_req, res) => {
    const products = await Product.findAll({
        include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
        order: [['createdAt', 'DESC']],
    });
    res.json(products);
});
router.post('/products', authenticateToken, requireAdmin, async (req, res) => {
    try {
        if (!req.body.name || Number.isNaN(Number(req.body.price))) {
            return res.status(400).json({ error: 'Product name and price are required' });
        }
        const product = await Product.create(productPayload(req.body));
        res.status(201).json(product);
    }
    catch (error) {
        res.status(400).json({ error: 'Unable to create product' });
    }
});
router.put('/products/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        if (!req.body.name || Number.isNaN(Number(req.body.price))) {
            return res.status(400).json({ error: 'Product name and price are required' });
        }
        const product = await Product.findByPk(Number(req.params.id));
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        await product.update(productPayload(req.body));
        res.json(product);
    }
    catch (error) {
        res.status(400).json({ error: 'Unable to update product' });
    }
});
router.delete('/products/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const product = await Product.findByPk(Number(req.params.id));
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        await product.destroy();
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: 'Unable to delete product' });
    }
});
router.get('/coupons', authenticateToken, requireAdmin, async (_req, res) => {
    const coupons = await Coupon.findAll({ order: [['createdAt', 'DESC']] });
    res.json(coupons);
});
router.post('/coupons/validate', async (req, res) => {
    const code = String(req.body.code || '').trim().toUpperCase();
    const subtotal = Number(req.body.subtotal || 0);
    const coupon = code ? await Coupon.findOne({ where: { code, active: true } }) : null;
    if (!coupon || (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) || (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)) {
        return res.status(404).json({ error: 'Coupon is not valid' });
    }
    const discount = coupon.discountType === 'percent' ? subtotal * (coupon.amount / 100) : coupon.amount;
    res.json({ code: coupon.code, discountType: coupon.discountType, amount: coupon.amount, discount: Math.min(Math.max(discount, 0), subtotal) });
});
router.post('/coupons', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const payload = couponPayload(req.body);
        if (!payload.code || Number.isNaN(payload.amount))
            return res.status(400).json({ error: 'Coupon code and amount are required' });
        const coupon = await Coupon.create(payload);
        res.status(201).json(coupon);
    }
    catch {
        res.status(400).json({ error: 'Unable to create coupon' });
    }
});
router.put('/coupons/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const coupon = await Coupon.findByPk(Number(req.params.id));
        if (!coupon)
            return res.status(404).json({ error: 'Coupon not found' });
        const payload = couponPayload(req.body);
        if (!payload.code || Number.isNaN(payload.amount))
            return res.status(400).json({ error: 'Coupon code and amount are required' });
        await coupon.update(payload);
        res.json(coupon);
    }
    catch {
        res.status(400).json({ error: 'Unable to update coupon' });
    }
});
router.delete('/coupons/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const coupon = await Coupon.findByPk(Number(req.params.id));
        if (!coupon)
            return res.status(404).json({ error: 'Coupon not found' });
        await coupon.destroy();
        res.json({ success: true });
    }
    catch {
        res.status(400).json({ error: 'Unable to delete coupon' });
    }
});
export default router;
