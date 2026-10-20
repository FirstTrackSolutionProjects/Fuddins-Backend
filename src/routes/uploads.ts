import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { post } from '../controllers/uploadsController.js';
import { upload } from '../controllers/uploadsController.js';
import { postVendorBanner, vendorBannerUpload } from '../controllers/vendorBannerUploadController.js';
import { requirePartner } from '../middleware/auth.js';

const router = Router();

router.post('/', authenticateToken, requireAdmin, upload.single('image'), post);
router.post('/vendor-banner', authenticateToken, requirePartner, vendorBannerUpload.single('image'), postVendorBanner);

export default router;
