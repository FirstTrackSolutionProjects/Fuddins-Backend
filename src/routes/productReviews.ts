import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { deleteAdminProductReview, listAdminProductReviews, updateAdminProductReview } from '../controllers/productReviewsController.js';

const router = Router();
router.get('/admin', authenticateToken, requireAdmin, listAdminProductReviews);
router.put('/admin/:id', authenticateToken, requireAdmin, updateAdminProductReview);
router.delete('/admin/:id', authenticateToken, requireAdmin, deleteAdminProductReview);

export default router;
