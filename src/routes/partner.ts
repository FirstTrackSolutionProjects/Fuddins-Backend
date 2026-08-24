import { Router } from 'express';
import { authenticateToken, requireAdmin, requirePartner, type AuthenticatedRequest } from '../middleware/auth.js';
import { get__overview, get__vendor_profile_1, put__vendor_profile_2, get__vendor_membership_3, post__vendor_membership_request_4, post__vendor_membership_payment_link_5, get__vendor_payments_6, put__vendor_payment_profile_7, post__vendor_payout_requests_8, get__vendor_payout_requests_9, get__vendor_products_10, post__vendor_products_11, put__vendor_products_id_12, delete__vendor_products_id_13, get__vendor_orders_14, put__vendor_orders_id_status_15, put__vendor_orders_id_tracking_16, get__vendor_settlements_17, get__vendor_reports_18, get__vendor_notices_19, put__vendor_notices_id_read_20, get__notices_21, post__notices_22, get__delivery_orders_23, get__delivery_profile_24, put__delivery_profile_25, get__delivery_summary_26, put__delivery_orders_id_status_27, get__delivery_assignments_28, put__delivery_assignments_orderId_29 } from '../controllers/partnerController.js';
import { requireVendor, requireDelivery } from '../controllers/partnerController.js';

const router = Router();

router.get('/overview', authenticateToken, requirePartner, get__overview);
router.get('/vendor/profile', authenticateToken, requirePartner, requireVendor, get__vendor_profile_1);
router.put('/vendor/profile', authenticateToken, requirePartner, requireVendor, put__vendor_profile_2);
router.get('/vendor/membership', authenticateToken, requirePartner, requireVendor, get__vendor_membership_3);
router.post('/vendor/membership/request', authenticateToken, requirePartner, requireVendor, post__vendor_membership_request_4);
router.post('/vendor/membership/payment-link', authenticateToken, requirePartner, requireVendor, post__vendor_membership_payment_link_5);
router.get('/vendor/payments', authenticateToken, requirePartner, requireVendor, get__vendor_payments_6);
router.put('/vendor/payment-profile', authenticateToken, requirePartner, requireVendor, put__vendor_payment_profile_7);
router.post('/vendor/payout-requests', authenticateToken, requirePartner, requireVendor, post__vendor_payout_requests_8);
router.get('/vendor/payout-requests', authenticateToken, requirePartner, requireVendor, get__vendor_payout_requests_9);
router.get('/vendor/products', authenticateToken, requirePartner, requireVendor, get__vendor_products_10);
router.post('/vendor/products', authenticateToken, requirePartner, requireVendor, post__vendor_products_11);
router.put('/vendor/products/:id', authenticateToken, requirePartner, requireVendor, put__vendor_products_id_12);
router.delete('/vendor/products/:id', authenticateToken, requirePartner, requireVendor, delete__vendor_products_id_13);
router.get('/vendor/orders', authenticateToken, requirePartner, requireVendor, get__vendor_orders_14);
router.put('/vendor/orders/:id/status', authenticateToken, requirePartner, requireVendor, put__vendor_orders_id_status_15);
router.put('/vendor/orders/:id/tracking', authenticateToken, requirePartner, requireVendor, put__vendor_orders_id_tracking_16);
router.get('/vendor/settlements', authenticateToken, requirePartner, requireVendor, get__vendor_settlements_17);
router.get('/vendor/reports', authenticateToken, requirePartner, requireVendor, get__vendor_reports_18);
router.get('/vendor/notices', authenticateToken, requirePartner, requireVendor, get__vendor_notices_19);
router.put('/vendor/notices/:id/read', authenticateToken, requirePartner, requireVendor, put__vendor_notices_id_read_20);
router.get('/notices', authenticateToken, requireAdmin, get__notices_21);
router.post('/notices', authenticateToken, requireAdmin, post__notices_22);
router.get('/delivery/orders', authenticateToken, requirePartner, requireDelivery, get__delivery_orders_23);
router.get('/delivery/profile', authenticateToken, requirePartner, requireDelivery, get__delivery_profile_24);
router.put('/delivery/profile', authenticateToken, requirePartner, requireDelivery, put__delivery_profile_25);
router.get('/delivery/summary', authenticateToken, requirePartner, requireDelivery, get__delivery_summary_26);
router.put('/delivery/orders/:id/status', authenticateToken, requirePartner, requireDelivery, put__delivery_orders_id_status_27);
router.get('/delivery/assignments', authenticateToken, requirePartner, get__delivery_assignments_28);
router.put('/delivery/assignments/:orderId', authenticateToken, requirePartner, put__delivery_assignments_orderId_29);

export default router;
