import { Router } from 'express';
import { getAll, post } from '../controllers/onboardingEnquiryController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.post('/', post);
router.get('/', authenticateToken, requireAdmin, getAll);

export default router;
