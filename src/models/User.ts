import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-instance.js';   // index.js ki jagah

class User extends Model {
  declare id: number;
  declare legacyUserId: number | null;
  declare name: string;
  declare email: string;
  declare password: string;
  declare role: string;
  declare phone: string | null;
  declare profileImageUrl: string | null;
  declare notificationPreferences: string | null;
  declare referralCode: string | null;
  declare referredByUserId: number | null;
  declare billingAddress: string | null;
  declare shippingAddress: string | null;
  declare deliveryVehicleType: string | null;
  declare deliveryVehicleNumber: string | null;
  declare deliveryStatus: string;
  declare deliveryLastSeenAt: Date | null;
  declare active: boolean;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    legacyUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'user',
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    profileImageUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    notificationPreferences: { type: DataTypes.TEXT, allowNull: true },
    referralCode: {
      type: DataTypes.STRING(32),
      allowNull: true,
      unique: true,
    },
    referredByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    billingAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    shippingAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    deliveryVehicleType: { type: DataTypes.STRING, allowNull: true },
    deliveryVehicleNumber: { type: DataTypes.STRING, allowNull: true },
    deliveryStatus: { type: DataTypes.STRING, allowNull: false, defaultValue: 'offline' },
    deliveryLastSeenAt: { type: DataTypes.DATE, allowNull: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize: sequelize,
    tableName: 'users',
    timestamps: true,
    // Delivery profile fields were added after the original customer import.
    // Keep them out of normal customer/auth SELECT * queries so an older
    // database remains usable while the startup migration adds the columns.
    defaultScope: {
      attributes: {
        exclude: ['deliveryVehicleType', 'deliveryVehicleNumber', 'deliveryStatus', 'deliveryLastSeenAt'],
      },
    },
  }
);

export default User;
