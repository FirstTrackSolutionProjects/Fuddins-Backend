import { DataTypes, Model } from 'sequelize'; import { sequelize } from './sequelize-instance.js'; import User from './User.js';
class Notification extends Model {}
Notification.init({id:{type:DataTypes.INTEGER,autoIncrement:true,primaryKey:true},userId:{type:DataTypes.INTEGER,allowNull:false,references:{model:User,key:'id'}},type:{type:DataTypes.STRING,allowNull:false},title:{type:DataTypes.STRING,allowNull:false},message:{type:DataTypes.TEXT,allowNull:false},data:{type:DataTypes.TEXT,allowNull:true},readAt:{type:DataTypes.DATE,allowNull:true}}, {sequelize,tableName:'notifications',timestamps:true,indexes:[{fields:['userId','readAt']}]});
Notification.belongsTo(User,{foreignKey:'userId',as:'user'}); User.hasMany(Notification,{foreignKey:'userId',as:'notifications'});
export default Notification;
