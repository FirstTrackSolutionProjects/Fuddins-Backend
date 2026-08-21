import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
class Order extends Model {
}
Order.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    legacyOrderId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        unique: true,
    },
    customerName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    total: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    subtotal: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    discountTotal: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    shippingTotal: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    taxTotal: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    items: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
    },
    couponCode: {
        type: DataTypes.STRING,
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
    phone: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    paymentMethod: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'cod',
    },
    paymentStatus: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
    },
    paymentProvider: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    paymentLinkId: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
    },
    paymentId: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    deliveryUserId: { type: DataTypes.INTEGER, allowNull: true },
    deliveryStatus: { type: DataTypes.STRING, allowNull: false, defaultValue: 'unassigned' },
    deliveredAt: { type: DataTypes.DATE, allowNull: true },
    deliveryNote: { type: DataTypes.TEXT, allowNull: true },
}, {
    sequelize,
    tableName: 'orders',
    timestamps: true,
});
export default Order;
