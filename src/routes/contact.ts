import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { post, get_1, put__id_status_2 } from '../controllers/contactController.js';

const router = Router();

router.post('/', post);
router.get('/', authenticateToken, requireAdmin, get_1);
router.put('/:id/status', authenticateToken, requireAdmin, put__id_status_2);

export default router;
