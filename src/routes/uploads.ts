import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { post } from '../controllers/uploadsController.js';
import { upload } from '../controllers/uploadsController.js';

const router = Router();

router.post('/', authenticateToken, requireAdmin, upload.single('image'), post);

export default router;
