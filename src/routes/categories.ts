import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import Category from '../models/Category.js';

const router = Router();

router.get('/', async (_req, res) => {
  const categories = await Category.findAll();
  res.json(categories);
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!req.body.name?.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const category = await Category.create({ name: req.body.name.trim() });
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ error: 'Unable to create category' });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
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
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
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
});

export default router;
