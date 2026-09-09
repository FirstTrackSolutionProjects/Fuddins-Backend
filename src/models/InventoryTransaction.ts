import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-instance.js';
import Product from './Product.js'; import Vendor from './Vendor.js';

class InventoryTransaction extends Model {}
InventoryTransaction.init({
 id:{type:DataTypes.INTEGER,autoIncrement:true,primaryKey:true},
 productId:{type:DataTypes.INTEGER,allowNull:false,references:{model:Product,key:'id'}},
 vendorId:{type:DataTypes.INTEGER,allowNull:true,references:{model:Vendor,key:'id'}},
 variantId:{type:DataTypes.INTEGER,allowNull:true}, type:{type:DataTypes.STRING,allowNull:false},
 quantity:{type:DataTypes.INTEGER,allowNull:false}, previousStock:{type:DataTypes.INTEGER,allowNull:false},
 newStock:{type:DataTypes.INTEGER,allowNull:false}, referenceType:{type:DataTypes.STRING,allowNull:true},
 referenceId:{type:DataTypes.STRING,allowNull:true}, createdBy:{type:DataTypes.INTEGER,allowNull:true}
},{sequelize,tableName:'inventory_transactions',timestamps:true,indexes:[{fields:['productId']},{fields:['vendorId']},{fields:['referenceType','referenceId']}]});
InventoryTransaction.belongsTo(Product,{foreignKey:'productId',as:'product'}); InventoryTransaction.belongsTo(Vendor,{foreignKey:'vendorId',as:'vendor'});
export default InventoryTransaction;
