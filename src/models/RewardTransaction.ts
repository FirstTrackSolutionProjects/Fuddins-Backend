import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-instance.js';   // index.js ki jagah
import User from './User.js';
import Order from './Order.js';

class RewardTransaction extends Model {
  declare id: number;
  declare userId: number | null;
  declare legacyUserId: number | null;
  declare orderId: number | null;
  declare type: string;
  declare points: number;
  declare balanceAfter: number | null;
  declare description: string | null;
  declare status: string;
}

RewardTransaction.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: true, references: { model: User, key: 'id' } },
    legacyUserId: { type: DataTypes.INTEGER, allowNull: true },
    orderId: { type: DataTypes.INTEGER, allowNull: true, references: { model: Order, key: 'id' } },
    type: { type: DataTypes.STRING, allowNull: false },
    points: { type: DataTypes.INTEGER, allowNull: false },
    balanceAfter: { type: DataTypes.INTEGER, allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'completed' },
  },
  { sequelize, tableName: 'reward_transactions', timestamps: true }
);

RewardTransaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });
RewardTransaction.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

export default RewardTransaction;
