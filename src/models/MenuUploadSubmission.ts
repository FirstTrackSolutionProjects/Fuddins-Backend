import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-instance.js';

class MenuUploadSubmission extends Model {
  declare id: number;
  declare executiveName: string;
  declare executiveMobile: string;
  declare storeName: string;
  declare storeMobile: string;
  declare menuDate: string;
  declare fileUrl: string;
  declare fileName: string;
  declare status: string;
}

MenuUploadSubmission.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  executiveName: { type: DataTypes.STRING, allowNull: false },
  executiveMobile: { type: DataTypes.STRING, allowNull: false },
  storeName: { type: DataTypes.STRING, allowNull: false },
  storeMobile: { type: DataTypes.STRING, allowNull: false },
  menuDate: { type: DataTypes.DATEONLY, allowNull: false },
  fileUrl: { type: DataTypes.STRING, allowNull: false },
  fileName: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'new' },
}, { sequelize, tableName: 'menu_upload_submissions', timestamps: true });

export default MenuUploadSubmission;
