import express, { Router } from 'express';
import { optionalAuthenticateToken } from '../middleware/auth.js';
import { createRazorpayPaymentLink, getPaymentStatus, razorpayWebhook, } from '../controllers/paymentsController.js';
const router = Router();
router.post('/razorpay/webhook', express.raw({ type: 'application/json' }), razorpayWebhook);
router.post('/razorpay/payment-link', optionalAuthenticateToken, createRazorpayPaymentLink);
router.get('/orders/:id/status', getPaymentStatus);
export default router;
