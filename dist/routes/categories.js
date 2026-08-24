import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { get, post_1, put__id_2, delete__id_3 } from '../controllers/categoriesController.js';
const router = Router();
router.get('/', get);
router.post('/', authenticateToken, requireAdmin, post_1);
router.put('/:id', authenticateToken, requireAdmin, put__id_2);
router.delete('/:id', authenticateToken, requireAdmin, delete__id_3);
export default router;
