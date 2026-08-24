'use strict';

import fs from 'fs';
import path from 'path';
import * as Sequelize from "sequelize";
import process from 'process';
import config from '../../config/config.json' with { type: "json" };
import { fileURLToPath, pathToFileURL } from "node:url";
import User from './User.js';
import AuthOtp from './AuthOtp.js';
import Category from './Category.js';
import ContactMessage from './ContactMessage.js';
import Coupon from './Coupon.js';
import Invoice from './Invoice.js';
import Order from './Order.js';
import Page from './Page.js';
import Product from './Product.js';
import RewardTransaction from './RewardTransaction.js';
import Vendor from './Vendor.js';
import VendorNotice from './VendorNotice.js';
import VendorPayoutRequest from './VendorPayoutRequest.js';
import VendorSettlement from './VendorSettlement.js';
import WishlistItem from './WishlistItem.js';
import WalletTransaction from './WalletTransaction.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const basename = path.basename(__filename);
type Environment = keyof typeof config;
const env = (process.env.NODE_ENV || 'development') as Environment;
const envConfig = config[env]
const db = {
    User,
    AuthOtp,
    Category,
    ContactMessage,
    Coupon,
    Invoice,
    Order,
    Page,
    Product,
    RewardTransaction,
    Vendor,
    VendorNotice,
    VendorPayoutRequest,
    VendorSettlement,
    WishlistItem,
    WalletTransaction,
};

let sequelize : Sequelize.Sequelize;
if ("use_env_variable" in envConfig) {
  sequelize = new Sequelize.Sequelize(envConfig.use_env_variable, envConfig as any);
} else {
  sequelize = new Sequelize.Sequelize(envConfig.database, envConfig.username, envConfig.password, envConfig as any);
}

// const files = fs
//   .readdirSync(__dirname)
//   .filter((file) => {
//     return (
//       file.indexOf(".") !== 0 &&
//       file !== basename &&
//       file.endsWith(".js") &&
//       !file.includes(".test.js")
//     );
//   });

// for (const file of files) {
//   const modulePath = pathToFileURL(path.join(__dirname, file)).href;

//   const module = await import(modulePath);

//   const model = module.default(sequelize, Sequelize.DataTypes);

//   db[model.name] = model;
// }

export default db;

export {
    sequelize,
    Sequelize
}
