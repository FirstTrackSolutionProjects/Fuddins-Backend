import jwt from 'jsonwebtoken';
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (secret)
        return secret;
    if (process.env.NODE_ENV === 'production')
        throw new Error('JWT_SECRET is required in production');
    return 'dev-secret';
}
export const PARTNER_ROLES = ['admin', 'admin_team', 'vendor', 'delivery'];
export function isPartnerRole(role) {
    return Boolean(role && PARTNER_ROLES.includes(role));
}
export function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
    const token = (authHeader && authHeader.split(' ')[1]) || queryToken;
    if (!token) {
        return res.status(401).json({ error: 'Access token missing' });
    }
    try {
        const user = jwt.verify(token, getJwtSecret());
        req.user = user;
        next();
    }
    catch (error) {
        return res.status(403).json({ error: 'Invalid token' });
    }
}
// Allows public checkout while still attaching the customer when a valid token is provided.
// Routes can require authentication only when a protected action (wallet/reward redemption) is requested.
export function optionalAuthenticateToken(req, _res, next) {
    const authHeader = req.headers.authorization;
    const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
    const token = (authHeader && authHeader.split(' ')[1]) || queryToken;
    if (!token)
        return next();
    try {
        const user = jwt.verify(token, getJwtSecret());
        req.user = user;
    }
    catch {
        // Keep the request public; protected fields will be rejected by the route when needed.
    }
    return next();
}
export function requireAdmin(req, res, next) {
    const user = req.user;
    if (user?.role !== 'admin' && user?.role !== 'admin_team') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}
export function requirePartner(req, res, next) {
    const user = req.user;
    if (!isPartnerRole(user?.role)) {
        return res.status(403).json({ error: 'Partner access required' });
    }
    next();
}
