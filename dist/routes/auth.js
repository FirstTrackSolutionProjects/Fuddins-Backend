import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Op } from 'sequelize';
import { authenticateToken } from '../middleware/auth.js';
import User from '../models/User.js';
import AuthOtp from '../models/AuthOtp.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { sendLoginOtp } from '../services/email.js';
const router = Router();
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (secret)
        return secret;
    if (process.env.NODE_ENV === 'production')
        throw new Error('JWT_SECRET is required in production');
    return 'dev-secret';
}
function userPayload(user) {
    return { id: user.id, name: user.name, email: user.email, role: user.role };
}
function issueSession(user) {
    return { token: jwt.sign(userPayload(user), getJwtSecret(), { expiresIn: '1h' }), user: userPayload(user) };
}
function normaliseEmail(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
function otpHash(target, code) {
    return crypto.createHash('sha256').update(`${process.env.OTP_SECRET || getJwtSecret()}:${target}:${code}`).digest('hex');
}
function authRouteError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}
function googleClientIds() {
    return (process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
}
async function verifyGoogleIdToken(idToken) {
    const allowedClientIds = googleClientIds();
    if (!allowedClientIds.length)
        throw authRouteError(503, 'Google sign-in is not configured');
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!response.ok)
        throw authRouteError(401, 'Invalid Google token');
    const profile = (await response.json());
    const emailVerified = profile.email_verified === true || profile.email_verified === 'true';
    if (!profile.aud || !allowedClientIds.includes(profile.aud))
        throw authRouteError(401, 'Google token audience is not allowed');
    if (!profile.email || !emailVerified)
        throw authRouteError(401, 'Google email is not verified');
    return { email: normaliseEmail(profile.email), name: profile.name?.trim() };
}
router.post('/register', async (req, res) => {
    try {
        if (!req.body.name || !req.body.email || !req.body.password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }
        const existingUser = await User.findOne({ where: { email: req.body.email } });
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists' });
        }
        const user = await User.create({
            name: req.body.name,
            email: req.body.email,
            password: hashPassword(req.body.password),
            role: 'user',
        });
        res.status(201).json(issueSession(user));
    }
    catch (error) {
        res.status(400).json({ error: 'Unable to register user' });
    }
});
router.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ where: { email: req.body.email } });
        if (!user || !verifyPassword(req.body.password || '', user.password)) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        res.json(issueSession(user));
    }
    catch (error) {
        res.status(400).json({ error: 'Unable to login' });
    }
});
router.post('/email-otp/request', async (req, res) => {
    try {
        const email = normaliseEmail(req.body.email);
        if (!/^\S+@\S+\.\S+$/.test(email))
            return res.status(400).json({ error: 'Enter a valid email address' });
        const latest = await AuthOtp.findOne({
            where: { channel: 'email', target: email, createdAt: { [Op.gte]: new Date(Date.now() - 60_000) } },
            order: [['createdAt', 'DESC']],
        });
        if (latest)
            return res.status(429).json({ error: 'Please wait one minute before requesting another code' });
        const code = crypto.randomInt(100000, 1000000).toString();
        await AuthOtp.create({ channel: 'email', target: email, codeHash: otpHash(email, code), expiresAt: new Date(Date.now() + 10 * 60_000), attempts: 0 });
        const sent = await sendLoginOtp(email, code);
        if (!sent)
            return res.status(503).json({ error: 'Email service is not configured. Please try again later.' });
        const body = { message: 'Verification code sent. It expires in 10 minutes.' };
        if (process.env.OTP_DEBUG_RESPONSE === 'true' && process.env.NODE_ENV !== 'production')
            body.testCode = code;
        res.json(body);
    }
    catch {
        res.status(400).json({ error: 'Unable to send verification code' });
    }
});
router.post('/google', async (req, res) => {
    try {
        const idToken = typeof req.body.idToken === 'string' ? req.body.idToken.trim() : '';
        if (!idToken)
            return res.status(400).json({ error: 'Google ID token is required' });
        const profile = await verifyGoogleIdToken(idToken);
        let user = await User.findOne({ where: { email: profile.email } });
        if (!user) {
            const defaultName = profile.name || profile.email.split('@')[0].replace(/[._-]+/g, ' ') || 'Fuddins customer';
            user = await User.create({ name: defaultName, email: profile.email, password: hashPassword(crypto.randomUUID()), role: 'user' });
        }
        res.json(issueSession(user));
    }
    catch (error) {
        const routeError = error;
        res.status(routeError.status || 400).json({ error: routeError.message || 'Unable to continue with Google' });
    }
});
router.post('/email-otp/verify', async (req, res) => {
    try {
        const email = normaliseEmail(req.body.email);
        const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
        if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(code))
            return res.status(400).json({ error: 'Enter a valid email and 6-digit code' });
        const otp = await AuthOtp.findOne({ where: { channel: 'email', target: email, usedAt: null }, order: [['createdAt', 'DESC']] });
        if (!otp || otp.expiresAt.getTime() < Date.now())
            return res.status(400).json({ error: 'This code has expired. Request a new one.' });
        if (otp.attempts >= 5)
            return res.status(429).json({ error: 'Too many attempts. Request a new code.' });
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
    }
    catch {
        res.status(400).json({ error: 'Unable to verify code' });
    }
});
router.get('/me', authenticateToken, async (req, res) => {
    const authUser = req.user;
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
