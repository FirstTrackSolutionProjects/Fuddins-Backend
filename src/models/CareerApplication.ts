import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-instance.js';

class CareerApplication extends Model {
  declare id: number;
  declare firstName: string;
  declare lastName: string;
  declare email: string;
  declare contactNo: string | null;
  declare city: string | null;
  declare state: string | null;
  declare zip: string | null;
  declare qualification: string | null;
  declare resumeUrl: string | null;
  declare resumeName: string | null;
  declare status: string;
}

CareerApplication.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  firstName: { type: DataTypes.STRING, allowNull: false },
  lastName: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  contactNo: { type: DataTypes.STRING, allowNull: true },
  city: { type: DataTypes.STRING, allowNull: true },
  state: { type: DataTypes.STRING, allowNull: true },
  zip: { type: DataTypes.STRING, allowNull: true },
  qualification: { type: DataTypes.STRING, allowNull: true },
  resumeUrl: { type: DataTypes.STRING, allowNull: true },
  resumeName: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'new' },
}, { sequelize, tableName: 'career_applications', timestamps: true });

export default CareerApplication;
