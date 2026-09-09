import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-instance.js';   // index.js ki jagah
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
  declare passwordHash: string | null;
  declare profile: string | null;
  declare businessHours: string | null;
  declare acceptingOrders: boolean;
  declare minimumOrderAmount: number;
  declare deliveryRadius: number | null;
  declare membershipPlan: string;
  declare membershipStatus: string;
  declare membershipFee: number;
  declare membershipPaymentStatus: string;
  declare membershipStartedAt: Date | null;
  declare membershipExpiresAt: Date | null;
  declare membershipPaymentLinkId: string | null;
  declare membershipPaymentId: string | null;
  declare payoutMethod: string;
  declare payoutAccountName: string | null;
  declare payoutAccountNumber: string | null;
  declare payoutIfsc: string | null;
  declare payoutUpi: string | null;
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
    passwordHash: { type: DataTypes.STRING, allowNull: true },
    profile: { type: DataTypes.TEXT, allowNull: true },
    businessHours: { type: DataTypes.STRING, allowNull: true },
    acceptingOrders: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    minimumOrderAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    deliveryRadius: { type: DataTypes.FLOAT, allowNull: true },
    membershipPlan: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Standard' },
    membershipStatus: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
    membershipFee: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    membershipPaymentStatus: { type: DataTypes.STRING, allowNull: false, defaultValue: 'unpaid' },
    membershipStartedAt: { type: DataTypes.DATE, allowNull: true },
    membershipExpiresAt: { type: DataTypes.DATE, allowNull: true },
    membershipPaymentLinkId: { type: DataTypes.STRING, allowNull: true },
    membershipPaymentId: { type: DataTypes.STRING, allowNull: true },
    payoutMethod: { type: DataTypes.STRING, allowNull: false, defaultValue: 'upi' },
    payoutAccountName: { type: DataTypes.STRING, allowNull: true },
    payoutAccountNumber: { type: DataTypes.STRING, allowNull: true },
    payoutIfsc: { type: DataTypes.STRING, allowNull: true },
    payoutUpi: { type: DataTypes.STRING, allowNull: true },
  },
  { sequelize, tableName: 'vendors', timestamps: true }
);

Vendor.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export default Vendor;