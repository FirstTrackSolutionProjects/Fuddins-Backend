import type { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import Vendor from '../models/Vendor.js';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
export const vendorBannerUpload = multer({
  storage: multer.diskStorage({ destination: directory, filename: (_req, file, callback) => callback(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`) }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => { if (!file.mimetype.startsWith('image/')) return callback(new Error('Only image files are allowed')); callback(null, true); },
});

export async function postVendorBanner(req: AuthenticatedRequest, res: Response) {
  if (req.user?.role !== 'vendor') return res.status(403).json({ error: 'Vendor access required' });
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  const vendor = await Vendor.findOne({ where: { userId: req.user!.id } });
  if (!vendor) return res.status(404).json({ error: 'Vendor profile not found' });
  const storeBannerUrl = `/uploads/${req.file.filename}`;
  await vendor.update({ storeBannerUrl });
  res.json({ imageUrl: storeBannerUrl, storeBannerUrl });
}
