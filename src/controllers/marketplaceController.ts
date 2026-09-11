import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { sequelize } from '../models/index.js';
import Product from '../models/Product.js';
import Vendor from '../models/Vendor.js';
import Order from '../models/Order.js';
import OrderItem from '../models/OrderItem.js';
import VendorOrder from '../models/VendorOrder.js';
import VendorSettlement from '../models/VendorSettlement.js';
import VendorPayoutRequest from '../models/VendorPayoutRequest.js';
import InventoryTransaction from '../models/InventoryTransaction.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { authenticateToken, requireAdmin, requirePartner, type AuthenticatedRequest } from '../middleware/auth.js';

const COMMISSION_RATE = () => Math.max(0, Math.min(100, Number(process.env.VENDOR_COMMISSION_PERCENT || 10)));

function actor(req: Request) { return (req as AuthenticatedRequest).user; }

export async function adminDashboard(_req: Request, res: Response) {
  const [orders, vendors, products, payouts, pendingProducts, pendingVendors] = await Promise.all([
    Order.count(), Vendor.count(), Product.count(), VendorPayoutRequest.count({ where:{status:'requested'} }),
    Product.count({where:{approvalStatus:'pending_review'}}), Vendor.count({where:{status:'pending'}})
  ]);
  const paidOrders = await Order.sum('total',{where:{paymentStatus:'paid'}});
  res.json({success:true,data:{orders,vendors,products,pendingPayouts:payouts,pendingProducts,pendingVendors,gmv:Number(paidOrders||0)}});
}

export async function pendingProducts(_req: Request,res: Response) {
  const rows=await Product.findAll({where:{approvalStatus:'pending_review'},include:[{model:Vendor,as:'vendor',attributes:['id','storeName','email']}],order:[['submittedAt','DESC']]});
  res.json(rows);
}

export async function approveProduct(req: Request,res: Response) {
  const product=await Product.findByPk(Number(req.params.id));
  if(!product) return res.status(404).json({error:'Product not found'});
  await product.update({approvalStatus:'approved',approvedBy:actor(req)?.id||null,approvedAt:new Date(),rejectionReason:null,stockStatus:product.stockQuantity===0?'outofstock':product.stockStatus});
  if(product.vendorId){const v=await Vendor.findByPk(product.vendorId); if(v?.userId) await Notification.create({userId:v.userId,type:'product_approved',title:'Product approved',message:`${product.name} is now approved.`,data:JSON.stringify({productId:product.id})});}
  res.json({success:true,data:product});
}

export async function rejectProduct(req: Request,res: Response) {
  const product=await Product.findByPk(Number(req.params.id));
  if(!product) return res.status(404).json({error:'Product not found'});
  const reason=String(req.body.reason||'Product needs changes').trim();
  await product.update({approvalStatus:'rejected',approvedBy:actor(req)?.id||null,approvedAt:null,rejectionReason:reason});
  if(product.vendorId){const v=await Vendor.findByPk(product.vendorId); if(v?.userId) await Notification.create({userId:v.userId,type:'product_rejected',title:'Product needs changes',message:reason,data:JSON.stringify({productId:product.id})});}
  res.json({success:true,data:product});
}

export async function submitProduct(req: Request,res: Response) {
  const user=actor(req); if(user?.role!=='vendor') return res.status(403).json({error:'Vendor access required'});
  const vendor=await Vendor.findOne({where:{userId:user.id}}); if(!vendor) return res.status(404).json({error:'Vendor profile not found'});
  const product=await Product.findOne({where:{id:Number(req.params.id),vendorId:vendor.id}});
  if(!product) return res.status(404).json({error:'Product not found'});
  await product.update({approvalStatus:'pending_review',submittedAt:new Date(),rejectionReason:null});
  res.json({success:true,data:product});
}

export async function createVendorOrderRecords(order: Order) {
  const raw=JSON.parse(order.items||'[]') as Array<any>;
  if(!Array.isArray(raw)||!raw.length) throw new Error('Order has no items');
  const productIds=[...new Set(raw.map(i=>Number(i.productId)).filter(Number.isInteger))];
  const products=await Product.findAll({where:{id:{[Op.in]:productIds}}});
  const map=new Map(products.map(p=>[p.id,p]));
  const groups=new Map<number,any[]>();
  for(const item of raw){
    const p=map.get(Number(item.productId)); if(!p?.vendorId) continue;
    const arr=groups.get(p.vendorId)||[]; arr.push({...item,vendorId:p.vendorId}); groups.set(p.vendorId,arr);
  }
  const transaction=await sequelize.transaction();
  try{
    const created=[];
    for(const [vendorId,items] of groups){
      let subtotal=0;
      for(const i of items) subtotal+=Number(i.price||0)*Number(i.quantity||0);
      const commission=Number((subtotal*COMMISSION_RATE()/100).toFixed(2));
      const payable=Number((subtotal-commission).toFixed(2));
      const [vo,createdNow]=await VendorOrder.findOrCreate({where:{orderId:order.id,vendorId},defaults:{orderId:order.id,vendorId,subtotal,commissionAmount:commission,vendorPayable:payable,status:'pending'},transaction});
      if(createdNow) {
        for(const i of items) await OrderItem.create({orderId:order.id,vendorId,productId:Number(i.productId),productName:String(i.name||map.get(Number(i.productId))?.name||'Product'),sku:i.sku||null,variationId:i.variationId||null,quantity:Number(i.quantity||1),unitPrice:Number(i.price||0),discount:0,tax:0,subtotal:Number(i.price||0)*Number(i.quantity||1),itemStatus:'pending'},{transaction});
        await VendorSettlement.findOrCreate({where:{orderId:order.id,vendorId,transactionType:'order'},defaults:{orderId:order.id,vendorId,transactionType:'order',grossAmount:subtotal,commissionAmount:commission,netAmount:payable,paidAmount:0,status:'pending'},transaction});
      }
      created.push(vo);
    }
    await transaction.commit();
    return created;
  }catch(e){await transaction.rollback();throw e;}
}


export async function syncOrder(req: Request,res: Response) {
  const order=await Order.findByPk(Number(req.params.orderId));
  if(!order) return res.status(404).json({error:'Order not found'});
  try { const data=await createVendorOrderRecords(order); res.json({success:true,data}); }
  catch(e){res.status(400).json({error:e instanceof Error?e.message:'Unable to sync order'});}
}

export async function attachOrderItems(vendorOrders: VendorOrder[]) {
  if (!vendorOrders.length) return vendorOrders.map((vo) => ({ ...vo.get({ plain: true }), items: [] }));
  const orderIds = [...new Set(vendorOrders.map((vo) => vo.orderId))];
  const vendorIds = [...new Set(vendorOrders.map((vo) => vo.vendorId))];
  const allItems = await OrderItem.findAll({ where: { orderId: { [Op.in]: orderIds }, vendorId: { [Op.in]: vendorIds } } });
  return vendorOrders.map((vo) => ({
    ...vo.get({ plain: true }),
    items: allItems.filter((item) => item.orderId === vo.orderId && item.vendorId === vo.vendorId).map((item) => item.get({ plain: true })),
  }));
}

export async function vendorOrders(req: Request,res: Response) {
  const user=actor(req); const vendor=await Vendor.findOne({where:{userId:user?.id}});
  if(!vendor) return res.status(404).json({error:'Vendor profile not found'});
  const rows=await VendorOrder.findAll({where:{vendorId:vendor.id},include:[{model:Order,as:'order'},{model:Vendor,as:'vendor',attributes:['id','storeName']}],order:[['createdAt','DESC']]});
  res.json(await attachOrderItems(rows));
}

const transitions:Record<string,string[]>={pending:['accepted','rejected','cancelled'],accepted:['preparing','cancelled'],preparing:['ready','cancelled'],ready:['cancelled'],assigned:[],picked_up:[],delivered:[]};
export async function changeVendorOrderStatus(req: Request,res: Response) {
  const user=actor(req); const vendor=await Vendor.findOne({where:{userId:user?.id}});
  if(!vendor) return res.status(404).json({error:'Vendor profile not found'});
  const vo=await VendorOrder.findOne({where:{id:Number(req.params.id),vendorId:vendor.id}});
  if(!vo) return res.status(404).json({error:'Vendor order not found'});
  const status=String(req.body.status||''); if(!(transitions[vo.status]||[]).includes(status)) return res.status(400).json({error:`Cannot change ${vo.status} to ${status}`});
  const now=new Date(); const patch:any={status};
  if(status==='accepted') patch.acceptedAt=now; if(status==='preparing') patch.preparingAt=now; if(status==='ready') patch.readyAt=now;
  if(status==='rejected') patch.rejectionReason=String(req.body.reason||'Rejected by vendor');
  if(status==='cancelled') patch.cancellationReason=String(req.body.reason||'Cancelled by vendor');
  await vo.update(patch);
  res.json({success:true,data:vo});
}

export async function adminVendorOrders(_req: Request, res: Response) {
  const vendorOrders = await VendorOrder.findAll({
    where: { status: { [Op.in]: ['ready', 'assigned', 'picked_up', 'delivered'] } },
    include: [
      { model: Order, as: 'order' },
      { model: Vendor, as: 'vendor', attributes: ['id', 'storeName', 'phone'] },
    ],
    order: [['updatedAt', 'DESC']],
    limit: 100,
  });
  const deliveryUsers = await User.findAll({ where: { role: 'delivery', active: true }, attributes: ['id', 'name', 'phone', 'deliveryStatus'] });
  res.json({ vendorOrders: await attachOrderItems(vendorOrders), deliveryUsers });
}

export async function assignVendorOrderDelivery(req: Request, res: Response) {
  const vo = await VendorOrder.findByPk(Number(req.params.id), { include: [{ model: Vendor, as: 'vendor', attributes: ['id', 'storeName', 'userId'] }] });
  if (!vo) return res.status(404).json({ error: 'Vendor order not found' });
  if (vo.status !== 'ready') return res.status(400).json({ error: `Order must be ready before assigning delivery (current status: ${vo.status})` });

  const deliveryUserId = Number(req.body.deliveryUserId);
  if (!Number.isInteger(deliveryUserId)) return res.status(400).json({ error: 'deliveryUserId is required' });
  const deliveryUser = await User.findOne({ where: { id: deliveryUserId, role: 'delivery' } });
  if (!deliveryUser) return res.status(404).json({ error: 'Delivery user not found' });
  if (deliveryUser.active === false) return res.status(400).json({ error: 'This delivery user is deactivated' });

  await vo.update({ deliveryUserId, status: 'assigned' });
  await Notification.create({
    userId: deliveryUser.id,
    type: 'delivery_assigned',
    title: 'New delivery assigned',
    message: `You have been assigned an order from ${(vo as any).vendor?.storeName || 'a vendor'}.`,
    data: JSON.stringify({ vendorOrderId: vo.id }),
  });
  res.json({ success: true, data: vo });
}

export async function inventory(req: Request,res: Response) {
  const user=actor(req); const vendor=await Vendor.findOne({where:{userId:user?.id}}); if(!vendor) return res.status(404).json({error:'Vendor profile not found'});
  const rows=await InventoryTransaction.findAll({where:{vendorId:vendor.id},order:[['createdAt','DESC']],limit:100}); res.json(rows);
}

export async function adjustInventory(req: Request,res: Response) {
  const user=actor(req); const vendor=await Vendor.findOne({where:{userId:user?.id}}); if(!vendor) return res.status(404).json({error:'Vendor profile not found'});
  const product=await Product.findOne({where:{id:Number(req.params.id),vendorId:vendor.id}}); if(!product) return res.status(404).json({error:'Product not found'});
  const quantity=Number(req.body.quantity); if(!Number.isInteger(quantity)||quantity===0) return res.status(400).json({error:'Quantity must be a non-zero integer'});
  const transaction=await sequelize.transaction();
  try{
    const previous=Number(product.stockQuantity||0); const next=Math.max(0,previous+quantity);
    await product.update({stockQuantity:next,stockStatus:next>0?'instock':'outofstock'}, {transaction});
    await InventoryTransaction.create({productId:product.id,vendorId:vendor.id,type:quantity>0?'RESTOCK':'ADJUSTMENT',quantity:Math.abs(quantity),previousStock:previous,newStock:next,referenceType:'manual',createdBy:user?.id},{transaction});
    await transaction.commit(); res.json({success:true,data:product});
  }catch(e){await transaction.rollback();res.status(400).json({error:e instanceof Error?e.message:'Unable to adjust stock'});}
}

export async function myNotifications(req: Request,res: Response) {
  const user=actor(req); const rows=await Notification.findAll({where:{userId:user?.id},order:[['createdAt','DESC']],limit:100}); res.json(rows);
}
export async function markNotification(req: Request,res: Response) {
  const user=actor(req); const row=await Notification.findOne({where:{id:Number(req.params.id),userId:user?.id}}); if(!row)return res.status(404).json({error:'Notification not found'});
  await row.update({readAt:new Date()});res.json(row);
}