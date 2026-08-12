import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Page extends Model {
  declare id: number;
  declare slug: string;
  declare title: string;
  declare content: string;
}

Page.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'pages',
    timestamps: true,
  }
);

export default Page;
