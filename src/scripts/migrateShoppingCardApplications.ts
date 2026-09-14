import dotenv from 'dotenv';
import ShoppingCardApplication from '../models/ShoppingCardApplication.js';

dotenv.config();
try {
  await ShoppingCardApplication.sync({ alter: true });
  console.log('shopping_card_applications table is ready');
} catch (error) {
  console.error('Unable to create shopping_card_applications table:', error);
  process.exitCode = 1;
}
