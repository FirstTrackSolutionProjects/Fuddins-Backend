import type { Request, Response } from 'express';
import multer, { type FileFilterCallback } from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import MenuUploadSubmission from '../models/MenuUploadSubmission.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const menuUploadDir = path.join(__dirname, '../../uploads/menus');
fs.mkdirSync(menuUploadDir, { recursive: true });
const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

export const menuUpload = multer({
  storage: multer.diskStorage({ destination: (_req, _file, callback) => callback(null, menuUploadDir), filename: (_req, file, callback) => callback(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-')}`) }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback: FileFilterCallback) => allowedTypes.has(file.mimetype) ? callback(null, true) : callback(new Error('Menu file must be PDF, JPG, PNG, DOC, or DOCX')),
});

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export async function post(req: Request, res: Response) {
  try {
    const executiveName = text(req.body.executiveName);
    const executiveMobile = text(req.body.executiveMobile);
    const storeName = text(req.body.storeName);
    const storeMobile = text(req.body.storeMobile);
    const menuDate = text(req.body.date);
    if (!executiveName || !executiveMobile || !storeName || !storeMobile || !menuDate || !req.file) return res.status(400).json({ error: 'All fields and a menu file are required' });
    const submission = await MenuUploadSubmission.create({ executiveName, executiveMobile, storeName, storeMobile, menuDate, fileUrl: `/uploads/menus/${req.file.filename}`, fileName: req.file.originalname });
    res.status(201).json({ id: submission.id, message: 'Menu uploaded successfully' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to upload menu' });
  }
}

export async function getAll(_req: Request, res: Response) {
  res.json(await MenuUploadSubmission.findAll({ order: [['createdAt', 'DESC']] }));
}
