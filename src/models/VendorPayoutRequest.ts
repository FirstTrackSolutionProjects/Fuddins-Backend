import { DataTypes, Model } from 'sequelize';
import {sequelize} from '../models/index.js';
import Vendor from './Vendor.js';

class VendorPayoutRequest extends Model {
  declare id: number;
  declare vendorId: number;
  declare amount: number;
  declare method: string;
  declare accountSnapshot: string | null;
  declare status: string;
  declare notes: string | null;
  declare processedAt: Date | null;
}

VendorPayoutRequest.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    vendorId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Vendor, key: 'id' } },
    amount: { type: DataTypes.FLOAT, allowNull: false },
    method: { type: DataTypes.STRING, allowNull: false, defaultValue: 'upi' },
    accountSnapshot: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'requested' },
    notes: { type: DataTypes.TEXT, allowNull: true },
    processedAt: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, tableName: 'vendor_payout_requests', timestamps: true }
);

VendorPayoutRequest.belongsTo(Vendor, { foreignKey: 'vendorId', as: 'vendor' });

export default VendorPayoutRequest;
