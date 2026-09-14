import dotenv from 'dotenv';
import CareerApplication from '../models/CareerApplication.js';

dotenv.config();

try {
  await CareerApplication.sync();
  console.log('career_applications table is ready');
  process.exitCode = 0;
} catch (error) {
  console.error('Unable to create career_applications table:', error);
  process.exitCode = 1;
}
