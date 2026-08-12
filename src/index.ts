import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize from './config/database.js';
import { ensureDatabase } from './config/ensureDatabase.js';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import categoriesRoutes from './routes/categories.js';
import commerceRoutes from './routes/commerce.js';
import ordersRoutes from './routes/orders.js';
import pagesRoutes from './routes/pages.js';
import uploadsRoutes from './routes/uploads.js';
import { createRazorpayPaymentLink, getPaymentStatus, razorpayWebhook } from './routes/payments.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5000);
const host = process.env.HOST || '0.0.0.0';
const syncAlter = process.env.DB_SYNC_ALTER === 'true' || process.env.NODE_ENV !== 'production';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const legacyUploadsPath = path.resolve(__dirname, '../../../domains/fuddins.com/public_html/wp-content/uploads');

app.use(cors());
app.post('/payments/razorpay/webhook', express.raw({ type: 'application/json' }), razorpayWebhook);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

app.use('/api', apiRoutes);
app.use('/auth', authRoutes);
app.use('/categories', categoriesRoutes);
app.use('/commerce', commerceRoutes);
app.use('/orders', ordersRoutes);
app.use('/pages', pagesRoutes);
app.use('/uploads', uploadsRoutes);
app.post('/payments/razorpay/payment-link', createRazorpayPaymentLink);
app.get('/payments/orders/:id/status', getPaymentStatus);
app.use('/uploads', express.static('uploads'));
app.use('/legacy-uploads', express.static(legacyUploadsPath));

async function start() {
  try {
    await ensureDatabase();
    await sequelize.authenticate();
    await sequelize.sync({ alter: syncAlter });
    console.log('Database connected and synced');
  } catch (error) {
    console.error('Database connection failed:', error);
  }

  app.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}`);
  });
}

start();
