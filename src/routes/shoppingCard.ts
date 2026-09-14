import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { createCheckoutOrder, createPaymentLink, getApplications, verifyCheckoutPayment } from '../controllers/shoppingCardController.js';

const router = Router();
router.post('/payment-link', createPaymentLink);
router.post('/checkout-order', createCheckoutOrder);
router.post('/verify-payment', verifyCheckoutPayment);
router.get('/applications', authenticateToken, requireAdmin, getApplications);
export default router;
