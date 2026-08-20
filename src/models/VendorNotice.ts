import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
import Vendor from './Vendor.js';

class VendorNotice extends Model {
  declare id: number;
  declare vendorId: number | null;
  declare title: string;
  declare message: string;
  declare type: string;
  declare readAt: Date | null;
}

VendorNotice.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    vendorId: { type: DataTypes.INTEGER, allowNull: true, references: { model: Vendor, key: 'id' } },
    title: { type: DataTypes.STRING, allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'notice' },
    readAt: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, tableName: 'vendor_notices', timestamps: true }
);

VendorNotice.belongsTo(Vendor, { foreignKey: 'vendorId', as: 'vendor' });

export default VendorNotice;
