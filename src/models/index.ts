'use strict';

import User from './User.js';
import AuthOtp from './AuthOtp.js';
import Category from './Category.js';
import ContactMessage from './ContactMessage.js';
import Coupon from './Coupon.js';
import Invoice from './Invoice.js';
import Order from './Order.js';
import OrderItem from './OrderItem.js';
import VendorOrder from './VendorOrder.js';
import InventoryTransaction from './InventoryTransaction.js';
import Notification from './Notification.js';
import Page from './Page.js';
import Product from './Product.js';
import RewardTransaction from './RewardTransaction.js';
import Vendor from './Vendor.js';
import VendorNotice from './VendorNotice.js';
import VendorPayoutRequest from './VendorPayoutRequest.js';
import VendorSettlement from './VendorSettlement.js';
import WishlistItem from './WishlistItem.js';
import WalletTransaction from './WalletTransaction.js';
import { sequelize, Sequelize } from './sequelize-instance.js';

const db = {
  User,
  AuthOtp,
  Category,
  ContactMessage,
  Coupon,
  Invoice,
  Order,
  OrderItem,
  VendorOrder,
  InventoryTransaction,
  Notification,
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

export default db;

export {
  sequelize,
  Sequelize,
};