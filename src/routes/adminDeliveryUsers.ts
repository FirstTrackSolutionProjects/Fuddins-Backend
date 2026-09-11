import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
  listDeliveryUsers,
  createDeliveryUser,
  getDeliveryUser,
  updateDeliveryUser,
  activateDeliveryUser,
  deactivateDeliveryUser,
} from '../controllers/deliveryUserController.js';

const router = Router();

router.get('/delivery-users', authenticateToken, requireAdmin, listDeliveryUsers);
router.post('/delivery-users', authenticateToken, requireAdmin, createDeliveryUser);
router.get('/delivery-users/:id', authenticateToken, requireAdmin, getDeliveryUser);
router.patch('/delivery-users/:id', authenticateToken, requireAdmin, updateDeliveryUser);
router.post('/delivery-users/:id/activate', authenticateToken, requireAdmin, activateDeliveryUser);
router.post('/delivery-users/:id/deactivate', authenticateToken, requireAdmin, deactivateDeliveryUser);

export default router;