import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
  listUsers,
  createUser,
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  listCoupons,
  validateCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from '../controllers/apiController.js';

const router = Router();

router.get('/users', authenticateToken, requireAdmin, listUsers);
router.post('/users', authenticateToken, requireAdmin, createUser);

router.get('/products', listProducts);
router.post('/products', authenticateToken, requireAdmin, createProduct);
router.put('/products/:id', authenticateToken, requireAdmin, updateProduct);
router.delete('/products/:id', authenticateToken, requireAdmin, deleteProduct);

router.get('/coupons', authenticateToken, requireAdmin, listCoupons);
router.post('/coupons/validate', validateCoupon);
router.post('/coupons', authenticateToken, requireAdmin, createCoupon);
router.put('/coupons/:id', authenticateToken, requireAdmin, updateCoupon);
router.delete('/coupons/:id', authenticateToken, requireAdmin, deleteCoupon);

export default router;
