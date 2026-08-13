import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
class AuthOtp extends Model {
}
AuthOtp.init({
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    channel: { type: DataTypes.STRING, allowNull: false },
    target: { type: DataTypes.STRING, allowNull: false },
    codeHash: { type: DataTypes.STRING, allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    usedAt: { type: DataTypes.DATE, allowNull: true },
}, {
    sequelize,
    tableName: 'auth_otps',
    timestamps: true,
    indexes: [{ fields: ['channel', 'target', 'createdAt'] }],
});
export default AuthOtp;
