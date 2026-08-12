import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';
import Category from './Category.js';

class Product extends Model {
  declare id: number;
  declare legacyProductId: number | null;
  declare name: string;
  declare price: number;
  declare regularPrice: number | null;
  declare salePrice: number | null;
  declare sku: string | null;
  declare description: string;
  declare fullDescription: string | null;
  declare imageUrl: string | null;
  declare galleryImages: string | null;
  declare brand: string | null;
  declare stockQuantity: number | null;
  declare stockStatus: string;
  declare attributes: string | null;
  declare variations: string | null;
  declare categoryId: number | null;
}

Product.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    legacyProductId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    regularPrice: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    salePrice: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    sku: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    fullDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    imageUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    galleryImages: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    brand: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    stockQuantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    stockStatus: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'instock',
    },
    attributes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    variations: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Category,
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'products',
    timestamps: true,
  }
);

Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });

export default Product;
