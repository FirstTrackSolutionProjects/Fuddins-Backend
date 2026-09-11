import { Router } from 'express';
import { authenticateToken, requireAdmin, requirePartner } from '../middleware/auth.js';
import { adminDashboard, pendingProducts, approveProduct, rejectProduct, submitProduct, syncOrder, vendorOrders, changeVendorOrderStatus, assignVendorOrderDelivery, adminVendorOrders, inventory, adjustInventory, myNotifications, markNotification } from '../controllers/marketplaceController.js';
const router=Router();

router.get('/admin/dashboard',authenticateToken,requireAdmin,adminDashboard);
router.get('/admin/products/pending',authenticateToken,requireAdmin,pendingProducts);
router.post('/admin/products/:id/approve',authenticateToken,requireAdmin,approveProduct);
router.post('/admin/products/:id/reject',authenticateToken,requireAdmin,rejectProduct);
router.post('/admin/vendor-orders/:id/assign-delivery',authenticateToken,requireAdmin,assignVendorOrderDelivery);
router.get('/admin/vendor-orders',authenticateToken,requireAdmin,adminVendorOrders);

router.post('/orders/:orderId/sync-vendor-orders',authenticateToken,requireAdmin,syncOrder);
router.get('/vendor/orders',authenticateToken,requirePartner,vendorOrders);
router.post('/vendor/orders/:id/status',authenticateToken,requirePartner,changeVendorOrderStatus);
router.post('/vendor/products/:id/submit',authenticateToken,requirePartner,submitProduct);
router.get('/vendor/inventory',authenticateToken,requirePartner,inventory);
router.post('/vendor/products/:id/inventory-adjust',authenticateToken,requirePartner,adjustInventory);

router.get('/notifications',authenticateToken,requirePartner,myNotifications);
router.post('/notifications/:id/read',authenticateToken,requirePartner,markNotification);

export default router;