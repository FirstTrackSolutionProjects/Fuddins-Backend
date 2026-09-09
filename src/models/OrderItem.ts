import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-instance.js';
import Order from './Order.js';
import Product from './Product.js';
import Vendor from './Vendor.js';

class OrderItem extends Model {
  declare id: number; declare orderId: number; declare vendorId: number | null; declare productId: number;
  declare productName: string; declare sku: string | null; declare variationId: number | null;
  declare quantity: number; declare unitPrice: number; declare discount: number; declare tax: number; declare subtotal: number;
  declare itemStatus: string; declare createdAt: Date; declare updatedAt: Date;
}
OrderItem.init({
  id:{type:DataTypes.INTEGER,autoIncrement:true,primaryKey:true},
  orderId:{type:DataTypes.INTEGER,allowNull:false,references:{model:Order,key:'id'}},
  vendorId:{type:DataTypes.INTEGER,allowNull:true,references:{model:Vendor,key:'id'}},
  productId:{type:DataTypes.INTEGER,allowNull:false,references:{model:Product,key:'id'}},
  productName:{type:DataTypes.STRING,allowNull:false}, sku:{type:DataTypes.STRING,allowNull:true},
  variationId:{type:DataTypes.INTEGER,allowNull:true}, quantity:{type:DataTypes.INTEGER,allowNull:false},
  unitPrice:{type:DataTypes.FLOAT,allowNull:false}, discount:{type:DataTypes.FLOAT,allowNull:false,defaultValue:0},
  tax:{type:DataTypes.FLOAT,allowNull:false,defaultValue:0}, subtotal:{type:DataTypes.FLOAT,allowNull:false},
  itemStatus:{type:DataTypes.STRING,allowNull:false,defaultValue:'pending'}
},{sequelize,tableName:'order_items',timestamps:true,indexes:[{fields:['orderId']},{fields:['vendorId']},{fields:['productId']}]});
OrderItem.belongsTo(Order,{foreignKey:'orderId',as:'order'}); Order.hasMany(OrderItem,{foreignKey:'orderId',as:'itemsV2'});
OrderItem.belongsTo(Product,{foreignKey:'productId',as:'product'}); Product.hasMany(OrderItem,{foreignKey:'productId',as:'orderItems'});
OrderItem.belongsTo(Vendor,{foreignKey:'vendorId',as:'vendor'});
export default OrderItem;
