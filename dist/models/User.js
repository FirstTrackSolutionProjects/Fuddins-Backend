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
    billingAddress: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    shippingAddress: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
}, {
    sequelize,
    tableName: 'users',
    timestamps: true,
});
export default User;
