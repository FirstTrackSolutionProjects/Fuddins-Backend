import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import VendorOrder from '../models/VendorOrder.js';
import Order from '../models/Order.js';
import Vendor from '../models/Vendor.js';
import Notification from '../models/Notification.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { attachOrderItems } from './marketplaceController.js';

function actor(req: Request) {
  return (req as AuthenticatedRequest).user!;
}

const INCLUDE = [
  { model: Order, as: 'order' },
  { model: Vendor, as: 'vendor', attributes: ['id', 'storeName', 'phone', 'address', 'userId'] },
];

export async function listAssignedOrders(req: Request, res: Response) {
  const user = actor(req);
  const rows = await VendorOrder.findAll({
    where: { deliveryUserId: user.id, status: { [Op.in]: ['assigned', 'picked_up'] } },
    include: INCLUDE,
    order: [['createdAt', 'DESC']],
  });
  res.json(await attachOrderItems(rows));
}

export async function getAssignedOrder(req: Request, res: Response) {
  const user = actor(req);
  const vo = await VendorOrder.findOne({ where: { id: Number(req.params.id), deliveryUserId: user.id }, include: INCLUDE });
  if (!vo) return res.status(404).json({ error: 'Assigned order not found' });
  const [withItems] = await attachOrderItems([vo]);
  res.json(withItems);
}

const DELIVERY_TRANSITIONS: Record<string, string[]> = { assigned: ['picked_up'], picked_up: ['delivered'] };

export async function updateDeliveryOrderStatus(req: Request, res: Response) {
  const user = actor(req);
  const vo = await VendorOrder.findOne({
    where: { id: Number(req.params.id), deliveryUserId: user.id },
    include: [{ model: Vendor, as: 'vendor', attributes: ['id', 'storeName', 'userId'] }],
  });
  if (!vo) return res.status(404).json({ error: 'Assigned order not found' });

  const status = String(req.body.status || '').trim();
  if (!(DELIVERY_TRANSITIONS[vo.status] || []).includes(status)) {
    return res.status(400).json({ error: `Cannot move delivery from ${vo.status} to ${status}` });
  }

  const now = new Date();
  const patch: Record<string, unknown> = { status };
  if (status === 'picked_up') patch.pickedUpAt = now;
  if (status === 'delivered') patch.deliveredAt = now;
  await vo.update(patch);

  const vendorUserId = (vo as any).vendor?.userId;
  if (vendorUserId) {
    await Notification.create({
      userId: vendorUserId,
      type: status === 'delivered' ? 'vendor_order_delivered' : 'vendor_order_picked_up',
      title: status === 'delivered' ? 'Order delivered' : 'Order picked up',
      message: status === 'delivered' ? `Order #${vo.orderId} has been delivered.` : `Order #${vo.orderId} has been picked up for delivery.`,
      data: JSON.stringify({ vendorOrderId: vo.id }),
    });
  }

  res.json({ success: true, data: vo });
}

export async function deliveryDashboard(req: Request, res: Response) {
  const user = actor(req);
  const [assigned, pickedUp, delivered] = await Promise.all([
    VendorOrder.count({ where: { deliveryUserId: user.id, status: 'assigned' } }),
    VendorOrder.count({ where: { deliveryUserId: user.id, status: 'picked_up' } }),
    VendorOrder.count({ where: { deliveryUserId: user.id, status: 'delivered' } }),
  ]);
  res.json({ assigned, pickedUp, delivered, pendingTasks: assigned + pickedUp });
}

export async function deliveryHistory(req: Request, res: Response) {
  const user = actor(req);
  const rows = await VendorOrder.findAll({
    where: { deliveryUserId: user.id, status: { [Op.in]: ['delivered', 'cancelled'] } },
    include: INCLUDE,
    order: [['updatedAt', 'DESC']],
    limit: 200,
  });
  res.json(await attachOrderItems(rows));
}