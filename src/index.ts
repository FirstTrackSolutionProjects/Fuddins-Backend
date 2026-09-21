import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {sequelize} from './models/index.js';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import categoriesRoutes from './routes/categories.js';
import commerceRoutes from './routes/commerce.js';
import contactRoutes from './routes/contact.js';
import careerRoutes from './routes/career.js';
import shoppingCardRoutes from './routes/shoppingCard.js';
import onboardingEnquiriesRoutes from './routes/onboardingEnquiries.js';
import ordersRoutes from './routes/orders.js';
import customerRoutes from './routes/customer.js';
import pagesRoutes from './routes/pages.js';
import partnerRoutes from './routes/partner.js';
import uploadsRoutes from './routes/uploads.js';
import paymentsRoutes from './routes/payments.js';
import marketplaceRoutes from './routes/marketplace.js';
import adminDeliveryUsersRoutes from './routes/adminDeliveryUsers.js';
import deliveryRoutes from './routes/delivery.js';
import { verifyMailTransport } from './services/email.js';
import { razorpayWebhook } from './controllers/paymentsController.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5000);
const host = process.env.HOST || '0.0.0.0';
const syncAlter = process.env.DB_SYNC_ALTER === 'true' || process.env.NODE_ENV !== 'production';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const legacyUploadsPath = path.resolve(__dirname, '../../../domains/fuddins.com/public_html/wp-content/uploads');

app.use(cors());
// Razorpay signatures must be calculated from the untouched request body.
// This must be registered before express.json().
app.post('/payments/razorpay/webhook', express.raw({ type: 'application/json' }), razorpayWebhook);
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

app.use('/api', apiRoutes);
app.use('/auth', authRoutes);
app.use('/categories', categoriesRoutes);
app.use('/commerce', commerceRoutes);
app.use('/contact', contactRoutes);
app.use('/career', careerRoutes);
app.use('/shopping-card', shoppingCardRoutes);
app.use('/onboarding-enquiries', onboardingEnquiriesRoutes);
app.use('/orders', ordersRoutes);
app.use('/customer', customerRoutes);
// Keep the customer API available behind the existing /api prefix used by older mobile builds.
app.use('/api/customer', customerRoutes);
app.use('/pages', pagesRoutes);
app.use('/partner', partnerRoutes);
app.use('/payments', paymentsRoutes);
app.use('/marketplace', marketplaceRoutes);
app.use('/admin', adminDeliveryUsersRoutes);
app.use('/delivery', deliveryRoutes);
app.use('/uploads', uploadsRoutes);
app.use('/uploads', express.static('uploads'));
app.use('/legacy-uploads', express.static(legacyUploadsPath));

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connected');
  } catch (error) {
    console.error('Database connection failed:', error);
  }

  const server = app.listen(port, host, () => {
    console.log(`Server running on http://${host}:${port}`);
  });
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Stop the existing backend process before starting another one.`);
      return;
    }
    console.error('Backend server failed to start:', error);
    process.exitCode = 1;
  });
  // Do not block startup on SMTP, but make bad Railway SMTP credentials
  // immediately visible in deploy logs instead of silently dropping OTPs.
  void verifyMailTransport();
}

start();
