import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireDelivery } from '../controllers/partnerController.js';
import {
  listAssignedOrders,
  getAssignedOrder,
  updateDeliveryOrderStatus,
  deliveryDashboard,
  deliveryHistory,
} from '../controllers/deliveryController.js';

const router = Router();

router.get('/dashboard', authenticateToken, requireDelivery, deliveryDashboard);
router.get('/orders', authenticateToken, requireDelivery, listAssignedOrders);
router.get('/orders/:id', authenticateToken, requireDelivery, getAssignedOrder);
router.post('/orders/:id/status', authenticateToken, requireDelivery, updateDeliveryOrderStatus);
router.get('/history', authenticateToken, requireDelivery, deliveryHistory);

export default router;