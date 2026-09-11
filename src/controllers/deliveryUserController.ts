import type { Request, Response } from 'express';
import User from '../models/User.js';
import { hashPassword } from '../utils/password.js';

const DELIVERY_ATTRIBUTES = [
  'id', 'name', 'email', 'phone', 'role', 'active',
  'deliveryVehicleType', 'deliveryVehicleNumber', 'deliveryStatus', 'deliveryLastSeenAt',
  'createdAt', 'updatedAt',
];

export async function listDeliveryUsers(_req: Request, res: Response) {
  const users = await User.findAll({ where: { role: 'delivery' }, attributes: DELIVERY_ATTRIBUTES, order: [['name', 'ASC']] });
  res.json(users);
}

export async function createDeliveryUser(req: Request, res: Response) {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : null;
    const password = String(req.body.password || '');
    const vehicleType = typeof req.body.vehicleType === 'string' ? req.body.vehicleType.trim() : null;
    const vehicleNumber = typeof req.body.vehicleNumber === 'string' ? req.body.vehicleNumber.trim().toUpperCase() : null;

    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'A valid email is required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'A user with this email already exists' });

    const user = await User.create({
      name, email, phone, role: 'delivery', active: true,
      password: hashPassword(password),
      deliveryVehicleType: vehicleType, deliveryVehicleNumber: vehicleNumber,
    });

    const { password: _omit, ...payload } = user.get({ plain: true }) as Record<string, unknown>;
    res.status(201).json(payload);
  } catch (error) {
    console.error('Create delivery user failed:', error);
    res.status(400).json({ error: 'Unable to create delivery user' });
  }
}

export async function getDeliveryUser(req: Request, res: Response) {
  const user = await User.findOne({ where: { id: Number(req.params.id), role: 'delivery' }, attributes: DELIVERY_ATTRIBUTES });
  if (!user) return res.status(404).json({ error: 'Delivery user not found' });
  res.json(user);
}

export async function updateDeliveryUser(req: Request, res: Response) {
  const user = await User.findOne({ where: { id: Number(req.params.id), role: 'delivery' } });
  if (!user) return res.status(404).json({ error: 'Delivery user not found' });

  const patch: Record<string, unknown> = {};
  if (typeof req.body.name === 'string' && req.body.name.trim()) patch.name = req.body.name.trim();
  if (typeof req.body.phone === 'string') patch.phone = req.body.phone.trim();
  if (typeof req.body.vehicleType === 'string') patch.deliveryVehicleType = req.body.vehicleType.trim();
  if (typeof req.body.vehicleNumber === 'string') patch.deliveryVehicleNumber = req.body.vehicleNumber.trim().toUpperCase();
  if (typeof req.body.password === 'string' && req.body.password) {
    if (req.body.password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    patch.password = hashPassword(req.body.password);
  }

  await user.update(patch);
  const { password: _omit, ...payload } = user.get({ plain: true }) as Record<string, unknown>;
  res.json(payload);
}

export async function activateDeliveryUser(req: Request, res: Response) {
  const user = await User.findOne({ where: { id: Number(req.params.id), role: 'delivery' } });
  if (!user) return res.status(404).json({ error: 'Delivery user not found' });
  await user.update({ active: true });
  res.json({ id: user.id, active: true });
}

export async function deactivateDeliveryUser(req: Request, res: Response) {
  const user = await User.findOne({ where: { id: Number(req.params.id), role: 'delivery' } });
  if (!user) return res.status(404).json({ error: 'Delivery user not found' });
  await user.update({ active: false });
  res.json({ id: user.id, active: false });
}