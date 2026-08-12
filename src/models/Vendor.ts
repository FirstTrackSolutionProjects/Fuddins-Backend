import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';

class Vendor extends Model {
  declare id: number;
  declare userId: number | null;
  declare legacyVendorId: number | null;
  declare storeName: string;
  declare email: string | null;
  declare phone: string | null;
  declare address: string | null;
  declare status: string;
  declare profile: string | null;
}

Vendor.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: true, references: { model: User, key: 'id' } },
    legacyVendorId: { type: DataTypes.INTEGER, allowNull: true, unique: true },
    storeName: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
    profile: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, tableName: 'vendors', timestamps: true }
);

Vendor.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export default Vendor;
