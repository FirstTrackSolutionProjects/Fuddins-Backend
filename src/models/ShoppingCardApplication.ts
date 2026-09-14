import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-instance.js';

class ShoppingCardApplication extends Model {
  declare id: number;
  declare email: string;
  declare phone: string;
  declare amount: number;
  declare status: string;
  declare paymentStatus: string;
  declare paymentLinkId: string | null;
  declare razorpayOrderId: string | null;
  declare paymentId: string | null;
}

ShoppingCardApplication.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  email: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false },
  amount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 999 },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
  paymentStatus: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
  paymentLinkId: { type: DataTypes.STRING, allowNull: true, unique: true },
  razorpayOrderId: { type: DataTypes.STRING, allowNull: true, unique: true },
  paymentId: { type: DataTypes.STRING, allowNull: true },
}, { sequelize, tableName: 'shopping_card_applications', timestamps: true });

export default ShoppingCardApplication;
