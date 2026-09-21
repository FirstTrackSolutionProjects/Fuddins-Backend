import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-instance.js';
import User from './User.js';

class DeliveryPayoutRequest extends Model {
  declare id: number;
  declare deliveryUserId: number;
  declare amount: number;
  declare method: string;
  declare accountSnapshot: string;
  declare status: string;
  declare razorpayPayoutId: string | null;
  declare failureReason: string | null;
  declare processedAt: Date | null;
}

DeliveryPayoutRequest.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  deliveryUserId: { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  method: { type: DataTypes.STRING, allowNull: false },
  accountSnapshot: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
  razorpayPayoutId: { type: DataTypes.STRING, allowNull: true },
  failureReason: { type: DataTypes.TEXT, allowNull: true },
  processedAt: { type: DataTypes.DATE, allowNull: true },
}, { sequelize, tableName: 'delivery_payout_requests', timestamps: true });

DeliveryPayoutRequest.belongsTo(User, { foreignKey: 'deliveryUserId', as: 'deliveryUser' });
export default DeliveryPayoutRequest;
