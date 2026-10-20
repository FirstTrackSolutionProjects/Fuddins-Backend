import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { createBanner, deleteBanner, listBanners, listPublicBanners, updateBanner } from '../controllers/bannersController.js';

const router = Router();
router.get('/', listPublicBanners);
router.get('/admin', authenticateToken, requireAdmin, listBanners);
router.post('/admin', authenticateToken, requireAdmin, createBanner);
router.put('/admin/:id', authenticateToken, requireAdmin, updateBanner);
router.delete('/admin/:id', authenticateToken, requireAdmin, deleteBanner);
export default router;
