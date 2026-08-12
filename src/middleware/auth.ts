import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production');
  return 'dev-secret';
}

export type AuthenticatedRequest = Request & {
  user?: {
    id: number;
    email: string;
    role: string;
  };
};

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
  const token = (authHeader && authHeader.split(' ')[1]) || queryToken;

  if (!token) {
    return res.status(401).json({ error: 'Access token missing' });
  }

  try {
    const user = jwt.verify(token, getJwtSecret()) as { id: number; email: string; role: string };
    (req as AuthenticatedRequest).user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as AuthenticatedRequest).user;

  if (user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
}
