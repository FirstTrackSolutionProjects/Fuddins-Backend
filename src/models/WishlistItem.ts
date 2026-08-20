import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
import User from './User.js';
import Product from './Product.js';

class WishlistItem extends Model {
  declare id: number;
  declare userId: number;
  declare productId: number;
  declare product: Product | null;
  declare createdAt: Date;
}

WishlistItem.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  productId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Product, key: 'id' } },
}, {
  sequelize,
  tableName: 'wishlist_items',
  timestamps: true,
  indexes: [{ unique: true, fields: ['userId', 'productId'] }],
});

WishlistItem.belongsTo(User, { foreignKey: 'userId', as: 'user' });
WishlistItem.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

export default WishlistItem;
