import type { Request, Response } from 'express';
import multer, { type FileFilterCallback } from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import CareerApplication from '../models/CareerApplication.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const resumeDir = path.join(__dirname, '../../uploads/resumes');
fs.mkdirSync(resumeDir, { recursive: true });

const allowedTypes = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
const resumeStorage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, resumeDir),
  filename: (_req, file, callback) => callback(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-')}`),
});

export const resumeUpload = multer({
  storage: resumeStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback: FileFilterCallback) => {
    if (!allowedTypes.has(file.mimetype)) return callback(new Error('Resume must be a PDF, DOC, or DOCX file'));
    callback(null, true);
  },
});

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export async function post(req: Request, res: Response) {
  try {
    const firstName = text(req.body.firstName);
    const lastName = text(req.body.lastName);
    const email = text(req.body.email).toLowerCase();
    if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'First name, last name, and a valid email are required' });

    const application = await CareerApplication.create({
      firstName, lastName, email,
      contactNo: text(req.body.contactNo) || null,
      city: text(req.body.city) || null,
      state: text(req.body.state) || null,
      zip: text(req.body.zip) || null,
      qualification: text(req.body.qualification) || null,
      resumeUrl: req.file ? `/uploads/resumes/${req.file.filename}` : null,
      resumeName: req.file?.originalname || null,
    });
    res.status(201).json({ id: application.id, message: 'Career application received' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to submit career application' });
  }
}

export async function get(_req: Request, res: Response) {
  res.json(await CareerApplication.findAll({ order: [['createdAt', 'DESC']] }));
}

export async function putStatus(req: Request, res: Response) {
  const application = await CareerApplication.findByPk(Number(req.params.id));
  if (!application) return res.status(404).json({ error: 'Career application not found' });
  const status = text(req.body.status);
  if (!status) return res.status(400).json({ error: 'Status is required' });
  await application.update({ status });
  res.json(application);
}
