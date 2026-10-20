import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-instance.js';

class Banner extends Model {
  declare id: number;
  declare title: string;
  declare subtitle: string | null;
  declare imageUrl: string;
  declare linkUrl: string | null;
  declare active: boolean;
  declare sortOrder: number;
}

Banner.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  subtitle: { type: DataTypes.STRING, allowNull: true },
  imageUrl: { type: DataTypes.STRING, allowNull: false },
  linkUrl: { type: DataTypes.STRING, allowNull: true },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { sequelize, tableName: 'banners', timestamps: true });

export default Banner;
