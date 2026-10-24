import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-instance.js';
import Product from './Product.js';
import User from './User.js';

class ProductReview extends Model {
  declare id: number;
  declare productId: number;
  declare userId: number;
  declare reviewerName: string;
  declare rating: number;
  declare review: string;
  declare status: 'pending' | 'approved' | 'rejected';
  declare createdAt: Date;
  declare updatedAt: Date;
}

ProductReview.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  productId: { type: DataTypes.INTEGER, allowNull: false, references: { model: Product, key: 'id' } },
  userId: { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  reviewerName: { type: DataTypes.STRING, allowNull: false },
  rating: { type: DataTypes.INTEGER, allowNull: false },
  review: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
}, {
  sequelize,
  tableName: 'product_reviews',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['productId', 'userId'], name: 'product_reviews_product_user_unique' },
    { fields: ['productId', 'status'], name: 'product_reviews_product_status' },
  ],
});

ProductReview.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
Product.hasMany(ProductReview, { foreignKey: 'productId', as: 'reviews' });
ProductReview.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(ProductReview, { foreignKey: 'userId', as: 'productReviews' });

export default ProductReview;
