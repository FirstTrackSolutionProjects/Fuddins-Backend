import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
import Order from './Order.js';

class Invoice extends Model {
  declare id: number;
  declare orderId: number;
  declare invoiceNumber: string;
  declare status: string;
  declare issuedAt: Date;
}

Invoice.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    orderId: { type: DataTypes.INTEGER, allowNull: false, unique: true, references: { model: Order, key: 'id' } },
    invoiceNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'issued' },
    issuedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: 'invoices', timestamps: true }
);

Invoice.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

export default Invoice;
