import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { get, get__slug_1, post_2, delete__slug_3 } from '../controllers/pagesController.js';
const router = Router();
router.get('/', get);
router.get('/:slug', get__slug_1);
router.post('/', authenticateToken, requireAdmin, post_2);
router.delete('/:slug', authenticateToken, requireAdmin, delete__slug_3);
export default router;
