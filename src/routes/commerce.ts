import { Router } from 'express';
import { authenticateToken, type AuthenticatedRequest, requireAdmin } from '../middleware/auth.js';
import { get__wallet, get__wallet_users_userId_1, post__wallet_transactions_2, get__rewards_3, get__rewards_users_userId_4, post__rewards_transactions_5, get__vendors_6, post__vendors_register_7, post__vendors_8, post__vendors_id_approve_9, post__vendors_id_reject_18, post__vendors_id_suspend_19, post__vendors_id_reactivate_20, put__vendors_id_10, get__vendor_settlements_11, post__vendor_settlements_12, put__vendor_settlements_id_status_13, get__vendor_payout_requests_14, put__vendor_payout_requests_id_status_15, get__invoices_16, get__orders_orderId_invoice_pdf_17 } from '../controllers/commerceController.js';

const router = Router();

router.get('/wallet', authenticateToken, requireAdmin, get__wallet);
router.get('/wallet/users/:userId', authenticateToken, get__wallet_users_userId_1);
router.post('/wallet/transactions', authenticateToken, requireAdmin, post__wallet_transactions_2);
router.get('/rewards', authenticateToken, requireAdmin, get__rewards_3);
router.get('/rewards/users/:userId', authenticateToken, get__rewards_users_userId_4);
router.post('/rewards/transactions', authenticateToken, requireAdmin, post__rewards_transactions_5);
router.get('/vendors', authenticateToken, requireAdmin, get__vendors_6);
router.post('/vendors/register', post__vendors_register_7);
router.post('/vendors', authenticateToken, requireAdmin, post__vendors_8);
router.post('/vendors/:id/approve', authenticateToken, requireAdmin, post__vendors_id_approve_9);
router.post('/vendors/:id/reject', authenticateToken, requireAdmin, post__vendors_id_reject_18);
router.post('/vendors/:id/suspend', authenticateToken, requireAdmin, post__vendors_id_suspend_19);
router.post('/vendors/:id/reactivate', authenticateToken, requireAdmin, post__vendors_id_reactivate_20);
router.put('/vendors/:id', authenticateToken, requireAdmin, put__vendors_id_10);
router.get('/vendor-settlements', authenticateToken, requireAdmin, get__vendor_settlements_11);
router.post('/vendor-settlements', authenticateToken, requireAdmin, post__vendor_settlements_12);
router.put('/vendor-settlements/:id/status', authenticateToken, requireAdmin, put__vendor_settlements_id_status_13);
router.get('/vendor-payout-requests', authenticateToken, requireAdmin, get__vendor_payout_requests_14);
router.put('/vendor-payout-requests/:id/status', authenticateToken, requireAdmin, put__vendor_payout_requests_id_status_15);
router.get('/invoices', authenticateToken, requireAdmin, get__invoices_16);
router.get('/orders/:orderId/invoice.pdf', authenticateToken, requireAdmin, get__orders_orderId_invoice_pdf_17);

export default router;
