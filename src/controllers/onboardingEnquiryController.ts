import type { Request, Response } from 'express';
import OnboardingEnquiry from '../models/OnboardingEnquiry.js';

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const validEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value);

export async function post(req: Request, res: Response) {
  try {
    const shopName = text(req.body.shopName);
    const vendorName = text(req.body.vendorName);
    const vendorPhone = text(req.body.vendorPhone);
    const category = text(req.body.category);
    const executiveName = text(req.body.executiveName);
    const executivePhone = text(req.body.executivePhone);
    const address = text(req.body.address);
    const zip = text(req.body.zip);
    const enquiryDate = text(req.body.enquiryDate);
    const remarks = text(req.body.remarks);
    const email = text(req.body.email).toLowerCase();

    if (!shopName || !vendorName || !vendorPhone || !executiveName || !executivePhone || !address || !zip || !enquiryDate || !remarks || !validEmail(email)) {
      return res.status(400).json({ error: 'Please complete all required enquiry fields with a valid email address' });
    }

    const enquiry = await OnboardingEnquiry.create({ shopName, vendorName, vendorPhone, category: category || null, executiveName, executivePhone, address, zip, enquiryDate, remarks, email });
    res.status(201).json({ id: enquiry.id, message: 'Your onboarding enquiry has been submitted.' });
  } catch {
    res.status(400).json({ error: 'Unable to submit the onboarding enquiry' });
  }
}

export async function getAll(_req: Request, res: Response) {
  res.json(await OnboardingEnquiry.findAll({ order: [['createdAt', 'DESC']] }));
}
