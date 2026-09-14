import { DataTypes, Model } from 'sequelize';
import { sequelize } from './sequelize-instance.js';

class OnboardingEnquiry extends Model {
  declare id: number;
  declare shopName: string;
  declare vendorName: string;
  declare vendorPhone: string;
  declare category: string | null;
  declare executiveName: string;
  declare executivePhone: string;
  declare address: string;
  declare zip: string;
  declare enquiryDate: string;
  declare remarks: string;
  declare email: string;
  declare status: string;
}

OnboardingEnquiry.init({
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  shopName: { type: DataTypes.STRING, allowNull: false },
  vendorName: { type: DataTypes.STRING, allowNull: false },
  vendorPhone: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: true },
  executiveName: { type: DataTypes.STRING, allowNull: false },
  executivePhone: { type: DataTypes.STRING, allowNull: false },
  address: { type: DataTypes.TEXT, allowNull: false },
  zip: { type: DataTypes.STRING, allowNull: false },
  enquiryDate: { type: DataTypes.DATEONLY, allowNull: false },
  remarks: { type: DataTypes.TEXT, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'new' },
}, { sequelize, tableName: 'onboarding_enquiries', timestamps: true });

export default OnboardingEnquiry;
