import type { Request, Response } from 'express';
import Banner from '../models/Banner.js';
import { Op } from 'sequelize';
import Vendor from '../models/Vendor.js';

export async function listPublicBanners(_req: Request, res: Response) {
  const banners = await Banner.findAll({ where: { active: true }, order: [['sortOrder', 'ASC'], ['id', 'ASC']] });
  const vendors = await Vendor.findAll({ where: { status: 'active', storeBannerUrl: { [Op.ne]: null } }, attributes: ['id', 'storeName', 'storeBannerUrl'], order: [['storeName', 'ASC']] });
  res.json([...banners, ...vendors.map((vendor) => ({ id: `vendor-${vendor.id}`, title: vendor.storeName, subtitle: 'Featured store', imageUrl: vendor.storeBannerUrl, linkUrl: null, active: true, sortOrder: 1000 + vendor.id }))]);
}

export async function listBanners(_req: Request, res: Response) {
  res.json(await Banner.findAll({ order: [['sortOrder', 'ASC'], ['id', 'ASC']] }));
}

export async function createBanner(req: Request, res: Response) {
  const { title, subtitle, imageUrl, linkUrl, sortOrder } = req.body;
  if (typeof title !== 'string' || !title.trim() || typeof imageUrl !== 'string' || !imageUrl.trim()) return res.status(400).json({ error: 'Title and image are required' });
  res.status(201).json(await Banner.create({ title: title.trim(), subtitle: typeof subtitle === 'string' ? subtitle.trim() || null : null, imageUrl: imageUrl.trim(), linkUrl: typeof linkUrl === 'string' ? linkUrl.trim() || null : null, sortOrder: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0 }));
}

export async function updateBanner(req: Request, res: Response) {
  const bannerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!/^\d+$/.test(bannerId)) return res.status(400).json({ error: 'Invalid banner id' });
  const banner = await Banner.findByPk(bannerId);
  if (!banner) return res.status(404).json({ error: 'Banner not found' });
  const { title, subtitle, imageUrl, linkUrl, active, sortOrder } = req.body;
  if (typeof title === 'string' && !title.trim()) return res.status(400).json({ error: 'Title cannot be empty' });
  if (typeof imageUrl === 'string' && !imageUrl.trim()) return res.status(400).json({ error: 'Image URL cannot be empty' });
  await banner.update({
    ...(typeof title === 'string' ? { title: title.trim() } : {}),
    ...(typeof subtitle === 'string' ? { subtitle: subtitle.trim() || null } : {}),
    ...(typeof imageUrl === 'string' ? { imageUrl: imageUrl.trim() } : {}),
    ...(typeof linkUrl === 'string' ? { linkUrl: linkUrl.trim() || null } : {}),
    ...(typeof active === 'boolean' ? { active } : {}),
    ...(Number.isFinite(Number(sortOrder)) ? { sortOrder: Number(sortOrder) } : {}),
  });
  res.json(banner);
}

export async function deleteBanner(req: Request, res: Response) {
  const bannerId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!/^\d+$/.test(bannerId)) return res.status(400).json({ error: 'Invalid banner id' });
  const banner = await Banner.findByPk(bannerId);
  if (!banner) return res.status(404).json({ error: 'Banner not found' });
  await banner.destroy();
  res.status(204).end();
}
