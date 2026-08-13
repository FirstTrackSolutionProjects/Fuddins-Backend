import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
class Coupon extends Model {
}
Coupon.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    legacyCouponId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        unique: true,
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    discountType: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'fixed_cart',
    },
    amount: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
    },
    usageLimit: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    usedCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
}, {
    sequelize,
    tableName: 'coupons',
    timestamps: true,
});
export default Coupon;
