import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { authenticateToken, isPartnerRole, type AuthenticatedRequest } from '../middleware/auth.js';
import User from '../models/User.js';
import AuthOtp from '../models/AuthOtp.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { sendLoginOtp, sendPasswordResetOtp } from '../services/email.js';
import { sendLoginOtpSms } from '../services/sms.js';

const router = Router();
function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production');
  return 'dev-secret';
}

function userPayload(user: User) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function issueSession(user: User) {
  return { token: jwt.sign(userPayload(user), getJwtSecret(), { expiresIn: '1h' }), user: userPayload(user) };
}

function normaliseEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalisePhone(value: unknown) {
  if (typeof value !== 'string') return '';
  const raw = value.trim().replace(/[\s().-]/g, '');
  const withCountry = raw.startsWith('+') ? raw : `${process.env.PHONE_DEFAULT_COUNTRY_CODE || '+91'}${raw.replace(/^0+/, '')}`;
  return /^\+[1-9]\d{9,14}$/.test(withCountry) ? withCountry : '';
}

function otpHash(target: string, code: string) {
  return crypto.createHash('sha256').update(`${process.env.OTP_SECRET || getJwtSecret()}:${target}:${code}`).digest('hex');
}

function authRouteError(status: number, message: string) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function googleClientIds() {
  return (process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

type GoogleTokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  sub?: string;
};

async function verifyGoogleIdToken(idToken: string) {
  const allowedClientIds = googleClientIds();
  if (!allowedClientIds.length) throw authRouteError(503, 'Google sign-in is not configured');

  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!response.ok) throw authRouteError(401, 'Invalid Google token');

  const profile = (await response.json()) as GoogleTokenInfo;
  const emailVerified = profile.email_verified === true || profile.email_verified === 'true';
  if (!profile.aud || !allowedClientIds.includes(profile.aud)) throw authRouteError(401, 'Google token audience is not allowed');
  if (!profile.email || !emailVerified) throw authRouteError(401, 'Google email is not verified');

  return { email: normaliseEmail(profile.email), name: profile.name?.trim() };
}

router.post('/register', async (req, res) => {
  try {
    const email = normaliseEmail(req.body.email);
    if (!req.body.name || !email || !req.body.password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const user = await User.create({
      name: req.body.name.trim(),
      email,
      password: hashPassword(req.body.password),
      role: 'user',
    });

    res.status(201).json(issueSession(user));
  } catch (error) {
    console.error('Register failed:', error);
    res.status(500).json({ error: 'Unable to register user' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = normaliseEmail(req.body.email);
    const user = await User.findOne({ where: { email } });
    if (!user || !verifyPassword(req.body.password || '', user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json(issueSession(user));
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ error: 'Unable to login' });
  }
});

router.post('/password-reset/request', async (req, res) => {
  try {
    const email = normaliseEmail(req.body.email);
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });

    const latest = await AuthOtp.findOne({
      where: { channel: 'password_reset', target: email, createdAt: { [Op.gte]: new Date(Date.now() - 60_000) } },
      order: [['createdAt', 'DESC']],
    });
    if (latest) return res.status(429).json({ error: 'Please wait one minute before requesting another code' });

    const user = await User.findOne({ where: { email } });
    // Keep the response generic so this endpoint cannot be used to enumerate accounts.
    if (!user) return res.json({ message: 'If an account exists for this email, a reset code has been sent.' });

    const code = crypto.randomInt(100000, 1000000).toString();
    const sent = await sendPasswordResetOtp(email, code);
    if (!sent) return res.status(503).json({ error: 'Email service is not configured. Please try again later.' });
    await AuthOtp.create({ channel: 'password_reset', target: email, codeHash: otpHash(email, code), expiresAt: new Date(Date.now() + 10 * 60_000), attempts: 0 });
    const body: { message: string; testCode?: string } = { message: 'Reset code sent. It expires in 10 minutes.' };
    if (process.env.OTP_DEBUG_RESPONSE === 'true' && process.env.NODE_ENV !== 'production') body.testCode = code;
    res.json(body);
  } catch (error) {
    console.error('Password reset request failed:', error);
    res.status(400).json({ error: 'Unable to request a password reset' });
  }
});

router.post('/password-reset/confirm', async (req, res) => {
  try {
    const email = normaliseEmail(req.body.email);
    const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(code) || password.length < 8) {
      return res.status(400).json({ error: 'Enter a valid email, 6-digit code, and password of at least 8 characters' });
    }

    const otp = await AuthOtp.findOne({ where: { channel: 'password_reset', target: email, usedAt: null }, order: [['createdAt', 'DESC']] });
    if (!otp || otp.expiresAt.getTime() < Date.now()) return res.status(400).json({ error: 'This reset code has expired. Request a new one.' });
    if (otp.attempts >= 5) return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
    if (otp.codeHash !== otpHash(email, code)) {
      await otp.increment('attempts');
      return res.status(401).json({ error: 'Incorrect reset code' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Unable to reset this account' });
    await user.update({ password: hashPassword(password) });
    await otp.update({ usedAt: new Date() });
    res.json(issueSession(user));
  } catch (error) {
    console.error('Password reset confirmation failed:', error);
    res.status(400).json({ error: 'Unable to reset password' });
  }
});

router.post('/partner/login', async (req, res) => {
  try {
    const email = normaliseEmail(req.body.email);
    const user = await User.findOne({ where: { email } });
    if (!user || !verifyPassword(req.body.password || '', user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!isPartnerRole(user.role)) {
      return res.status(403).json({ error: 'This account is not authorised for Foodiens Partner' });
    }
    res.json(issueSession(user));
  } catch (error) {
    console.error('Partner login failed:', error);
    res.status(500).json({ error: 'Unable to login to Foodiens Partner' });
  }
});

// The first administrator can bootstrap the partner workspace. Once an admin
// (or admin team member) exists this endpoint is permanently closed and the
// normal partner-account flow must be used instead.
router.get('/partner/setup-status', async (_req, res) => {
  try {
    const existingAdmin = await User.findOne({ where: { role: { [Op.in]: ['admin', 'admin_team'] } } });
    res.json({ available: !existingAdmin });
  } catch (error) {
    console.error('Admin setup status failed:', error);
    res.status(500).json({ error: 'Unable to check admin setup status' });
  }
});

router.post('/partner/setup-admin', async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = normaliseEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
      return res.status(400).json({ error: 'Name, valid email, and a password of at least 8 characters are required' });
    }

    const existingAdmin = await User.findOne({ where: { role: { [Op.in]: ['admin', 'admin_team'] } } });
    if (existingAdmin) {
      return res.status(409).json({ error: 'Admin setup is already completed. Use partner login.' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) return res.status(409).json({ error: 'An account with this email already exists' });

    const user = await User.create({ name, email, password: hashPassword(password), role: 'admin' });
    res.status(201).json(issueSession(user));
  } catch (error) {
    console.error('Admin setup failed:', error);
    res.status(500).json({ error: 'Unable to create the admin account' });
  }
});

router.post('/email-otp/request', async (req, res) => {
  try {
    const email = normaliseEmail(req.body.email);
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });

    const latest = await AuthOtp.findOne({
      where: { channel: 'email', target: email, createdAt: { [Op.gte]: new Date(Date.now() - 60_000) } },
      order: [['createdAt', 'DESC']],
    });
    if (latest) return res.status(429).json({ error: 'Please wait one minute before requesting another code' });

    const code = crypto.randomInt(100000, 1000000).toString();
    const sent = await sendLoginOtp(email, code);
    if (!sent) return res.status(503).json({ error: 'Email service is not configured. Please try again later.' });
    await AuthOtp.create({ channel: 'email', target: email, codeHash: otpHash(email, code), expiresAt: new Date(Date.now() + 10 * 60_000), attempts: 0 });
    const body: { message: string; testCode?: string } = { message: 'Verification code sent. It expires in 10 minutes.' };
    if (process.env.OTP_DEBUG_RESPONSE === 'true' && process.env.NODE_ENV !== 'production') body.testCode = code;
    res.json(body);
  } catch {
    res.status(400).json({ error: 'Unable to send verification code' });
  }
});

router.post('/google', async (req, res) => {
  try {
    const idToken = typeof req.body.idToken === 'string' ? req.body.idToken.trim() : '';
    if (!idToken) return res.status(400).json({ error: 'Google ID token is required' });

    const profile = await verifyGoogleIdToken(idToken);
    let user = await User.findOne({ where: { email: profile.email } });
    if (!user) {
      const defaultName = profile.name || profile.email.split('@')[0].replace(/[._-]+/g, ' ') || 'Fuddins customer';
      user = await User.create({ name: defaultName, email: profile.email, password: hashPassword(crypto.randomUUID()), role: 'user' });
    }

    res.json(issueSession(user));
  } catch (error) {
    const routeError = error as Error & { status?: number };
    res.status(routeError.status || 400).json({ error: routeError.message || 'Unable to continue with Google' });
  }
});

router.post('/email-otp/verify', async (req, res) => {
  try {
    const email = normaliseEmail(req.body.email);
    const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
    if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Enter a valid email and 6-digit code' });

    const otp = await AuthOtp.findOne({ where: { channel: 'email', target: email, usedAt: null }, order: [['createdAt', 'DESC']] });
    if (!otp || otp.expiresAt.getTime() < Date.now()) return res.status(400).json({ error: 'This code has expired. Request a new one.' });
    if (otp.attempts >= 5) return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
    if (otp.codeHash !== otpHash(email, code)) {
      await otp.increment('attempts');
      return res.status(401).json({ error: 'Incorrect verification code' });
    }

    await otp.update({ usedAt: new Date() });
    let user = await User.findOne({ where: { email } });
    if (!user) {
      const defaultName = email.split('@')[0].replace(/[._-]+/g, ' ') || 'Fuddins customer';
      user = await User.create({ name: defaultName, email, password: hashPassword(crypto.randomUUID()), role: 'user' });
    }
    res.json(issueSession(user));
  } catch {
    res.status(400).json({ error: 'Unable to verify code' });
  }
});

router.post('/phone-otp/request', async (req, res) => {
  try {
    const phone = normalisePhone(req.body.phone);
    if (!phone) return res.status(400).json({ error: 'Enter a valid phone number with country code' });

    const latest = await AuthOtp.findOne({
      where: { channel: 'phone', target: phone, createdAt: { [Op.gte]: new Date(Date.now() - 60_000) } },
      order: [['createdAt', 'DESC']],
    });
    if (latest) return res.status(429).json({ error: 'Please wait one minute before requesting another code' });

    const code = crypto.randomInt(100000, 1000000).toString();
    await AuthOtp.create({ channel: 'phone', target: phone, codeHash: otpHash(phone, code), expiresAt: new Date(Date.now() + 10 * 60_000), attempts: 0 });
    const sent = await sendLoginOtpSms(phone, code);
    if (!sent && !(process.env.OTP_DEBUG_RESPONSE === 'true' && process.env.NODE_ENV !== 'production')) {
      return res.status(503).json({ error: 'SMS service is not configured. Please try again later.' });
    }
    const body: { message: string; phone: string; testCode?: string } = { message: 'Verification code sent. It expires in 10 minutes.', phone };
    if (process.env.OTP_DEBUG_RESPONSE === 'true' && process.env.NODE_ENV !== 'production') body.testCode = code;
    res.json(body);
  } catch {
    res.status(400).json({ error: 'Unable to send phone verification code' });
  }
});

router.post('/phone-otp/verify', async (req, res) => {
  try {
    const phone = normalisePhone(req.body.phone);
    const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
    if (!phone || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Enter a valid phone number and 6-digit code' });

    const otp = await AuthOtp.findOne({ where: { channel: 'phone', target: phone, usedAt: null }, order: [['createdAt', 'DESC']] });
    if (!otp || otp.expiresAt.getTime() < Date.now()) return res.status(400).json({ error: 'This code has expired. Request a new one.' });
    if (otp.attempts >= 5) return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
    if (otp.codeHash !== otpHash(phone, code)) {
      await otp.increment('attempts');
      return res.status(401).json({ error: 'Incorrect verification code' });
    }

    await otp.update({ usedAt: new Date() });
    let user = await User.findOne({ where: { phone } });
    if (!user) {
      const phoneAlias = crypto.createHash('sha256').update(phone).digest('hex').slice(0, 16);
      user = await User.create({ name: 'Foodiens customer', email: `phone-${phoneAlias}@foodiens.local`, password: hashPassword(crypto.randomUUID()), role: 'user', phone });
    }
    res.json(issueSession(user));
  } catch {
    res.status(400).json({ error: 'Unable to verify phone code' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  const authUser = (req as AuthenticatedRequest).user;
  if (!authUser) {
    return res.status(401).json({ error: 'Access token missing' });
  }

  const user = await User.findByPk(authUser.id, { attributes: ['id', 'name', 'email', 'role'] });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(user);
});

export default router;
