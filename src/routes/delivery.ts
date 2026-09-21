import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { requireDelivery } from '../controllers/partnerController.js';
import {
  listAssignedOrders,
  getAssignedOrder,
  updateDeliveryOrderStatus,
  deliveryDashboard,
  deliveryHistory,
  getDeliveryPayoutProfile,
  updateDeliveryPayoutProfile,
  getDeliveryWallet,
  createDeliveryWithdrawal,
  listDeliveryPayoutRequests,
  processDeliveryPayout,
} from '../controllers/deliveryController.js';

const router = Router();

router.get('/dashboard', authenticateToken, requireDelivery, deliveryDashboard);
router.get('/orders', authenticateToken, requireDelivery, listAssignedOrders);
router.get('/orders/:id', authenticateToken, requireDelivery, getAssignedOrder);
router.post('/orders/:id/status', authenticateToken, requireDelivery, updateDeliveryOrderStatus);
router.get('/history', authenticateToken, requireDelivery, deliveryHistory);
router.get('/payout-profile', authenticateToken, requireDelivery, getDeliveryPayoutProfile);
router.put('/payout-profile', authenticateToken, requireDelivery, updateDeliveryPayoutProfile);
router.get('/wallet', authenticateToken, requireDelivery, getDeliveryWallet);
router.post('/withdrawals', authenticateToken, requireDelivery, createDeliveryWithdrawal);
router.get('/admin/withdrawals', authenticateToken, requireAdmin, listDeliveryPayoutRequests);
router.post('/admin/withdrawals/:id/process', authenticateToken, requireAdmin, processDeliveryPayout);

export default router;
