import type { Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import Category from '../models/Category.js';

export async function get(_req: Request, res: Response) {
  const categories = await Category.findAll({ order: [['name', 'ASC']] });
  res.json(categories);

}

export async function post_1(req: Request, res: Response) {
  try {
    if (!req.body.name?.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const category = await Category.create({ name: req.body.name.trim() });
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ error: 'Unable to create category' });
  }

}

export async function put__id_2(req: Request, res: Response) {
  try {
    if (!req.body.name?.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const category = await Category.findByPk(Number(req.params.id));
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await category.update({ name: req.body.name.trim() });
    res.json(category);
  } catch (error) {
    res.status(400).json({ error: 'Unable to update category' });
  }

}

export async function delete__id_3(req: Request, res: Response) {
  try {
    const category = await Category.findByPk(Number(req.params.id));
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    await category.destroy();
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Unable to delete category' });
  }

}
