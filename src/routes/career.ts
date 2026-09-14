import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { get, post, putStatus, resumeUpload } from '../controllers/careerController.js';

const router = Router();
router.post('/apply', resumeUpload.single('resume'), post);
router.get('/applications', authenticateToken, requireAdmin, get);
router.put('/applications/:id/status', authenticateToken, requireAdmin, putStatus);

export default router;
