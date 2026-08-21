# Backend

## Run

```bash
npm install
npm run dev
```

## Admin Seed

```bash
npm run seed:admin
```

Required env:

```bash
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-admin-password
JWT_SECRET=change-this-secret
```

## API

Public:

- `GET /health`
- `GET /api/products`
- `GET /categories`
- `GET /pages`
- `GET /pages/:slug`
- `POST /orders`
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /payments/razorpay/payment-link`
- `GET /payments/orders/:id/status?email=customer@example.com`

Admin token required:

- `GET /api/users`
- `POST /api/users`
- `POST /api/products`
- `PUT /api/products/:id`
- `DELETE /api/products/:id`
- `POST /categories`
- `PUT /categories/:id`
- `DELETE /categories/:id`
- `GET /orders`
- `POST /pages`
- `DELETE /pages/:slug`
- `POST /uploads`

## Razorpay payment links

Add the Razorpay test or live credentials only to `backend/.env`:

```bash
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

For reliable paid-order confirmation, configure the Razorpay `payment_link.paid` webhook to `https://YOUR_API_DOMAIN/payments/razorpay/webhook`. The webhook endpoint must be publicly reachable over HTTPS; do not use a localhost URL in Razorpay Dashboard.

## Hostinger order emails

Customer order confirmations, Razorpay payment-link emails, payment receipts, and admin order alerts use SMTP. Add the following settings to `backend/.env` after rotating the mailbox password:

```bash
SMTP_HOST=smtp.hostinger.com
# STARTTLS on 587 is recommended for hosted deployments such as Railway.
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=info@yourdomain.com
SMTP_PASSWORD=your-rotated-mailbox-password
EMAIL_FROM="Fuddins <info@yourdomain.com>"
ORDER_NOTIFICATION_EMAIL=info@yourdomain.com
```
