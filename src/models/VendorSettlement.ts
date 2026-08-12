import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
import Vendor from './Vendor.js';
import Order from './Order.js';

class VendorSettlement extends Model {
  declare id: number;
  declare vendorId: number | null;
  declare legacyVendorId: number | null;
  declare orderId: number | null;
  declare legacyOrderId: number | null;
  declare transactionId: string | null;
  declare transactionType: string;
  declare grossAmount: number;
  declare commissionAmount: number;
  declare netAmount: number;
  declare paidAmount: number;
  declare status: string;
  declare notes: string | null;
  declare settledAt: Date | null;
}

VendorSettlement.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    vendorId: { type: DataTypes.INTEGER, allowNull: true, references: { model: Vendor, key: 'id' } },
    legacyVendorId: { type: DataTypes.INTEGER, allowNull: true },
    orderId: { type: DataTypes.INTEGER, allowNull: true, references: { model: Order, key: 'id' } },
    legacyOrderId: { type: DataTypes.INTEGER, allowNull: true },
    transactionId: { type: DataTypes.STRING, allowNull: true },
    transactionType: { type: DataTypes.STRING, allowNull: false, defaultValue: 'commission' },
    grossAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    commissionAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    netAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    paidAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
    notes: { type: DataTypes.TEXT, allowNull: true },
    settledAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'vendor_settlements',
    timestamps: true,
    indexes: [{ name: 'uniq_vendor_legacy_txn', unique: true, fields: ['legacyVendorId', 'legacyOrderId', 'transactionId'] }],
  }
);

VendorSettlement.belongsTo(Vendor, { foreignKey: 'vendorId', as: 'vendor' });
VendorSettlement.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

export default VendorSettlement;
