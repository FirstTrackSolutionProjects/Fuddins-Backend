import Order from '../models/Order.js';

type TrackingStep = { key: string; label: string; description: string; completed: boolean; active: boolean; timestamp: string | null };

const displayStatus = (value: string | null | undefined) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function buildOrderTracking(order: Order) {
  const deliveryStatus = String(order.deliveryStatus || 'unassigned');
  const orderStatus = String(order.status || 'pending');
  const cancelled = ['cancelled', 'canceled'].includes(orderStatus) || deliveryStatus === 'failed';
  const preparing = ['processing', 'completed'].includes(orderStatus) || ['assigned', 'picked_up', 'out_for_delivery', 'delivered'].includes(deliveryStatus);
  const assigned = ['assigned', 'picked_up', 'out_for_delivery', 'delivered'].includes(deliveryStatus);
  const pickedUp = ['picked_up', 'out_for_delivery', 'delivered'].includes(deliveryStatus);
  const outForDelivery = ['out_for_delivery', 'delivered'].includes(deliveryStatus);
  const delivered = deliveryStatus === 'delivered' || orderStatus === 'completed';
  const steps: TrackingStep[] = [
    { key: 'placed', label: 'Order placed', description: 'We received your order.', completed: true, active: !preparing && !cancelled, timestamp: order.createdAt?.toISOString() || null },
    { key: 'preparing', label: 'Being prepared', description: 'The store is preparing your items.', completed: preparing, active: preparing && !assigned && !cancelled, timestamp: preparing ? order.updatedAt?.toISOString() || null : null },
    { key: 'assigned', label: 'Delivery partner assigned', description: 'A delivery partner is assigned to your order.', completed: assigned, active: assigned && !pickedUp && !cancelled, timestamp: assigned ? order.updatedAt?.toISOString() || null : null },
    { key: 'picked_up', label: 'Picked up', description: 'Your order has left the store.', completed: pickedUp, active: pickedUp && !outForDelivery && !cancelled, timestamp: pickedUp ? order.updatedAt?.toISOString() || null : null },
    { key: 'out_for_delivery', label: 'Out for delivery', description: 'Your order is on its way.', completed: outForDelivery, active: outForDelivery && !delivered && !cancelled, timestamp: outForDelivery ? order.updatedAt?.toISOString() || null : null },
    { key: 'delivered', label: 'Delivered', description: 'Order delivered successfully.', completed: delivered, active: delivered, timestamp: order.deliveredAt?.toISOString() || (delivered ? order.updatedAt?.toISOString() || null : null) },
  ];
  if (cancelled) {
    steps.push({ key: 'failed', label: deliveryStatus === 'failed' ? 'Delivery failed' : 'Order cancelled', description: order.deliveryNote || 'This order is no longer active.', completed: true, active: true, timestamp: order.updatedAt?.toISOString() || null });
  }
  return { orderId: order.id, status: orderStatus, statusLabel: cancelled ? (deliveryStatus === 'failed' ? 'Delivery failed' : 'Cancelled') : displayStatus(deliveryStatus !== 'unassigned' ? deliveryStatus : orderStatus), deliveryStatus, paymentStatus: order.paymentStatus, trackingCode: order.trackingCode, trackingUrl: order.trackingUrl, timeline: steps };
}
