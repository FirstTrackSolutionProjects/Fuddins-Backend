import { Router } from 'express';
import { authenticateToken, optionalAuthenticateToken, requireAdmin } from '../middleware/auth.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import { Op } from 'sequelize';
import { sendOrderCreatedEmails } from '../services/email.js';
import { ensureInvoice } from '../services/invoice.js';
import { awardOrderRewards, redeemOrderBalances, refundOrderBalances, validateOrderRedemption } from '../services/loyalty.js';
const router = Router();
function parseVariations(product) {
    if (!product.variations) {
        return [];
    }
    try {
        const variations = JSON.parse(product.variations);
        return Array.isArray(variations) ? variations : [];
    }
    catch {
        return [];
    }
}
function variationLabel(variation) {
    const values = Object.values(variation.attributes || {}).filter(Boolean);
    return values.length ? values.join(' / ') : variation.title || `Option #${variation.id}`;
}
router.get('/', authenticateToken, requireAdmin, async (_req, res) => {
    const orders = await Order.findAll({ order: [['createdAt', 'DESC']] });
    res.json(orders);
});
router.put('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const status = String(req.body.status || '').trim();
        if (!status)
            return res.status(400).json({ error: 'Order status is required' });
        const order = await Order.findByPk(Number(req.params.id));
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        const paymentUpdate = status === 'completed' && order.paymentMethod === 'cod' && order.paymentStatus !== 'paid'
            ? { paymentStatus: 'paid', paymentProvider: 'cod' }
            : {};
        await order.update({ status, ...paymentUpdate });
        if (status === 'cancelled' || status === 'canceled')
            void refundOrderBalances(order.id);
        if (status === 'completed')
            void awardOrderRewards(order);
        res.json(order);
    }
    catch {
        res.status(400).json({ error: 'Unable to update order status' });
    }
});
router.post('/', optionalAuthenticateToken, async (req, res) => {
    try {
        const customerName = String(req.body.customerName || '').trim();
        const email = String(req.body.email || '').trim().toLowerCase();
        const paymentMethod = String(req.body.paymentMethod || 'cod').trim().toLowerCase();
        if (!customerName || !email || !/^\S+@\S+\.\S+$/.test(email) || !Array.isArray(req.body.items) || req.body.items.length === 0) {
            return res.status(400).json({ error: 'Customer name, email, and cart items are required' });
        }
        if (paymentMethod !== 'cod')
            return res.status(400).json({ error: 'Use the online payment flow for online orders' });
        const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
        const shippingAddress = typeof req.body.shippingAddress === 'string' ? req.body.shippingAddress.trim() : '';
        if (phone.replace(/\D/g, '').length < 8)
            return res.status(400).json({ error: 'A valid phone number is required for cash on delivery' });
        if (shippingAddress.length < 8)
            return res.status(400).json({ error: 'A complete delivery address is required for cash on delivery' });
        const quantities = new Map();
        for (const item of req.body.items) {
            const productId = Number(item.productId);
            const variationId = item.variationId ? Number(item.variationId) : null;
            const quantity = Number(item.quantity);
            if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99)
                return res.status(400).json({ error: 'Cart contains an invalid item' });
            const key = `${productId}:${variationId || 'default'}`;
            const current = quantities.get(key);
            quantities.set(key, { productId, variationId, quantity: (current?.quantity || 0) + quantity });
        }
        const productIds = Array.from(new Set(Array.from(quantities.values()).map((item) => item.productId)));
        const products = await Product.findAll({ where: { id: { [Op.in]: productIds } } });
        const productById = new Map(products.map((product) => [product.id, product]));
        if (products.length !== productIds.length)
            return res.status(400).json({ error: 'One or more products are no longer available' });
        const items = Array.from(quantities.values()).map((cartItem) => {
            const product = productById.get(cartItem.productId);
            if (!product)
                throw new Error('One or more products are no longer available');
            const variation = cartItem.variationId ? parseVariations(product).find((item) => item.id === cartItem.variationId) : null;
            if (cartItem.variationId && !variation)
                throw new Error(`${product.name} option is no longer available`);
            const stockStatus = variation?.stockStatus || product.stockStatus;
            const stockQuantity = variation?.stockQuantity ?? product.stockQuantity;
            if (stockStatus === 'outofstock' || (stockQuantity !== null && stockQuantity < cartItem.quantity))
                throw new Error(`${product.name} is out of stock`);
            const price = Number(variation?.salePrice || variation?.price || product.salePrice || product.price);
            return {
                productId: product.id,
                variationId: variation?.id || null,
                name: variation ? `${product.name} - ${variationLabel(variation)}` : product.name,
                price,
                quantity: cartItem.quantity,
                sku: variation?.sku || product.sku || null,
            };
        });
        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const couponCode = typeof req.body.couponCode === 'string' ? req.body.couponCode.trim().toUpperCase() : '';
        let discountTotal = 0;
        let coupon = null;
        if (couponCode) {
            coupon = await Coupon.findOne({ where: { code: couponCode, active: true } });
            if (!coupon || (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) || (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit))
                return res.status(400).json({ error: 'Coupon is not valid' });
            discountTotal = coupon.discountType === 'percent' ? subtotal * (coupon.amount / 100) : coupon.amount;
            discountTotal = Math.min(Math.max(discountTotal, 0), subtotal);
        }
        const shippingTotal = Number(req.body.shippingTotal || 0);
        const taxTotal = Number(req.body.taxTotal || 0);
        if (!Number.isFinite(shippingTotal) || shippingTotal < 0 || !Number.isFinite(taxTotal) || taxTotal < 0)
            return res.status(400).json({ error: 'Shipping and tax totals must be valid' });
        const orderTotalBeforeRedemption = Math.max(subtotal - discountTotal + shippingTotal + taxTotal, 0);
        const requestedWallet = Number(req.body.walletAmount || 0);
        const requestedPoints = Number(req.body.rewardPoints || 0);
        const authUser = req.user;
        let redemption = { walletAmount: 0, rewardPoints: 0 };
        if (requestedWallet > 0 || requestedPoints > 0) {
            if (!authUser)
                return res.status(401).json({ error: 'Please login to use wallet or reward points' });
            if (authUser.email.toLowerCase() !== email)
                return res.status(403).json({ error: 'Checkout email must match your account' });
            redemption = await validateOrderRedemption(authUser.id, orderTotalBeforeRedemption, requestedWallet, requestedPoints);
        }
        const total = Math.max(orderTotalBeforeRedemption - redemption.walletAmount - redemption.rewardPoints, 0);
        const order = await Order.create({
            customerName,
            email,
            total,
            subtotal,
            discountTotal,
            shippingTotal,
            taxTotal,
            items: JSON.stringify(items),
            status: 'pending',
            couponCode: coupon?.code || null,
            billingAddress: typeof req.body.billingAddress === 'string' ? req.body.billingAddress.trim() : null,
            shippingAddress,
            phone,
            paymentMethod,
            paymentStatus: 'pending',
        });
        if (authUser && (redemption.walletAmount > 0 || redemption.rewardPoints > 0)) {
            await redeemOrderBalances(authUser.id, order.id, orderTotalBeforeRedemption, redemption.walletAmount, redemption.rewardPoints);
        }
        for (const product of products) {
            const productCartItems = Array.from(quantities.values()).filter((item) => item.productId === product.id);
            const parentQuantity = productCartItems.filter((item) => !item.variationId).reduce((sum, item) => sum + item.quantity, 0);
            const updatePayload = {};
            if (product.stockQuantity !== null && parentQuantity > 0)
                updatePayload.stockQuantity = Math.max(product.stockQuantity - parentQuantity, 0);
            const variationItems = productCartItems.filter((item) => item.variationId);
            if (variationItems.length) {
                const variations = parseVariations(product).map((variation) => {
                    const quantity = variationItems.filter((item) => item.variationId === variation.id).reduce((sum, item) => sum + item.quantity, 0);
                    if (!quantity || variation.stockQuantity === null || typeof variation.stockQuantity === 'undefined')
                        return variation;
                    return { ...variation, stockQuantity: Math.max(variation.stockQuantity - quantity, 0) };
                });
                updatePayload.variations = JSON.stringify(variations);
            }
            if (Object.keys(updatePayload).length)
                await product.update(updatePayload);
        }
        if (coupon)
            await coupon.increment('usedCount');
        void ensureInvoice(order);
        void sendOrderCreatedEmails(order);
        res.status(201).json(order);
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create order' });
    }
});
export default router;
