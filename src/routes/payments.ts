import express, { Router } from 'express';
import { authenticateToken, optionalAuthenticateToken } from '../middleware/auth.js';
import {
  createWalletTopUp,
  createRazorpayPaymentLink,
  getPaymentStatus,
  razorpayWebhook,
} from '../controllers/paymentsController.js';

const router = Router();

router.post('/razorpay/webhook', express.raw({ type: 'application/json' }), razorpayWebhook);
router.post('/wallet/top-up', authenticateToken, createWalletTopUp);
router.post('/razorpay/payment-link', optionalAuthenticateToken, createRazorpayPaymentLink);
router.get('/orders/:id/status', getPaymentStatus);

export default router;
