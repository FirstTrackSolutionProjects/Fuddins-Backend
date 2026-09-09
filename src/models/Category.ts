import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-instance.js';   // index.js ki jagah

class Category extends Model {
  declare id: number;
  declare name: string;
}

Category.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    tableName: 'categories',
    timestamps: true,
  }
);

export default Category;
