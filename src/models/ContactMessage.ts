import { DataTypes, Model } from 'sequelize';
import {sequelize} from '../models/index.js';

class ContactMessage extends Model {
  declare id: number;
  declare name: string;
  declare email: string;
  declare phone: string | null;
  declare subject: string | null;
  declare message: string;
  declare status: string;
}

ContactMessage.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: true },
    subject: { type: DataTypes.STRING, allowNull: true },
    message: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'new' },
  },
  { sequelize: sequelize, tableName: 'contact_messages', timestamps: true }
);

export default ContactMessage;
