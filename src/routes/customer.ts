import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { get__orders, get__orders_id_tracking_1, post__orders_id_cancel_11, get__wallet_2, get__rewards_3, get__wishlist_4, post__wishlist_productId_5, delete__wishlist_productId_6, get__downloads_7, get__profile_8, get__referrals, patch__profile_9, patch__password_10, put__profile_image_11 } from '../controllers/customerController.js';
import { upload } from '../controllers/uploadsController.js';

const router = Router();
router.use(authenticateToken);

router.get('/orders', get__orders);
router.get('/orders/:id/tracking', get__orders_id_tracking_1);
router.post('/orders/:id/cancel', post__orders_id_cancel_11);
router.get('/wallet', get__wallet_2);
router.get('/rewards', get__rewards_3);
router.get('/wishlist', get__wishlist_4);
router.post('/wishlist/:productId', post__wishlist_productId_5);
router.delete('/wishlist/:productId', delete__wishlist_productId_6);
router.get('/downloads', get__downloads_7);
router.get('/profile', get__profile_8);
router.get('/referrals', get__referrals);
router.patch('/profile', patch__profile_9);
router.put('/profile/image', upload.single('image'), put__profile_image_11);
router.patch('/password', patch__password_10);

export default router;
