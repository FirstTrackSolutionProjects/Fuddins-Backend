import { Router } from 'express';
import { authenticateToken, isPartnerRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { post__register, post__login_1, post__password_reset_request_2, post__password_reset_confirm_3, post__partner_login_4, get__partner_setup_status_5, post__partner_setup_admin_6, post__email_otp_request_7, post__google_8, post__email_otp_verify_9, post__phone_otp_request_10, post__phone_otp_verify_11, get__me_12 } from '../controllers/authController.js';

const router = Router();

router.post('/register', post__register);
router.post('/login', post__login_1);
router.post('/password-reset/request', post__password_reset_request_2);
router.post('/password-reset/confirm', post__password_reset_confirm_3);
router.post('/partner/login', post__partner_login_4);
router.get('/partner/setup-status', get__partner_setup_status_5);
router.post('/partner/setup-admin', post__partner_setup_admin_6);
router.post('/email-otp/request', post__email_otp_request_7);
router.post('/google', post__google_8);
router.post('/email-otp/verify', post__email_otp_verify_9);
router.post('/phone-otp/request', post__phone_otp_request_10);
router.post('/phone-otp/verify', post__phone_otp_verify_11);
router.get('/me', authenticateToken, get__me_12);

export default router;
