import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-instance.js';
import Order from './Order.js'; import Vendor from './Vendor.js'; import User from './User.js';

class VendorOrder extends Model {
  declare id:number; declare orderId:number; declare vendorId:number; declare subtotal:number; declare discount:number;
  declare tax:number; declare deliveryFee:number; declare commissionAmount:number; declare refundAmount:number;
  declare vendorPayable:number; declare status:string; declare deliveryUserId:number|null;
  declare acceptedAt:Date|null; declare preparingAt:Date|null; declare readyAt:Date|null; declare pickedUpAt:Date|null;
  declare deliveredAt:Date|null; declare cancelledAt:Date|null; declare rejectionReason:string|null; declare cancellationReason:string|null;
}
VendorOrder.init({
 id:{type:DataTypes.INTEGER,autoIncrement:true,primaryKey:true},
 orderId:{type:DataTypes.INTEGER,allowNull:false,references:{model:Order,key:'id'}},
 vendorId:{type:DataTypes.INTEGER,allowNull:false,references:{model:Vendor,key:'id'}},
 subtotal:{type:DataTypes.FLOAT,allowNull:false,defaultValue:0}, discount:{type:DataTypes.FLOAT,allowNull:false,defaultValue:0},
 tax:{type:DataTypes.FLOAT,allowNull:false,defaultValue:0}, deliveryFee:{type:DataTypes.FLOAT,allowNull:false,defaultValue:0},
 commissionAmount:{type:DataTypes.FLOAT,allowNull:false,defaultValue:0}, refundAmount:{type:DataTypes.FLOAT,allowNull:false,defaultValue:0},
 vendorPayable:{type:DataTypes.FLOAT,allowNull:false,defaultValue:0},
 status:{type:DataTypes.STRING,allowNull:false,defaultValue:'pending'},
 deliveryUserId:{type:DataTypes.INTEGER,allowNull:true,references:{model:User,key:'id'}},
 acceptedAt:{type:DataTypes.DATE,allowNull:true}, preparingAt:{type:DataTypes.DATE,allowNull:true}, readyAt:{type:DataTypes.DATE,allowNull:true},
 pickedUpAt:{type:DataTypes.DATE,allowNull:true}, deliveredAt:{type:DataTypes.DATE,allowNull:true}, cancelledAt:{type:DataTypes.DATE,allowNull:true},
 rejectionReason:{type:DataTypes.TEXT,allowNull:true}, cancellationReason:{type:DataTypes.TEXT,allowNull:true}
},{sequelize,tableName:'vendor_orders',timestamps:true,indexes:[{unique:true,fields:['orderId','vendorId']},{fields:['vendorId','status']},{fields:['deliveryUserId']}]});
VendorOrder.belongsTo(Order,{foreignKey:'orderId',as:'order'}); Order.hasMany(VendorOrder,{foreignKey:'orderId',as:'vendorOrders'});
VendorOrder.belongsTo(Vendor,{foreignKey:'vendorId',as:'vendor'}); Vendor.hasMany(VendorOrder,{foreignKey:'vendorId',as:'vendorOrders'});
VendorOrder.belongsTo(User,{foreignKey:'deliveryUserId',as:'deliveryUser'});
export default VendorOrder;
