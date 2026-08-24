import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
class User extends Model {
}
User.init({
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
}, {
    sequelize,
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
});
export default User;
