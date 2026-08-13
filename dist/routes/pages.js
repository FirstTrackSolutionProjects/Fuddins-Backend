import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import Page from '../models/Page.js';
const router = Router();
router.get('/', async (_req, res) => {
    const pages = await Page.findAll({ order: [['updatedAt', 'DESC']] });
    res.json(pages);
});
router.get('/:slug', async (req, res) => {
    const page = await Page.findOne({ where: { slug: req.params.slug } });
    if (!page) {
        return res.status(404).json({ error: 'Page not found' });
    }
    res.json(page);
});
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        if (!req.body.slug?.trim() || !req.body.title?.trim() || !req.body.content?.trim()) {
            return res.status(400).json({ error: 'Slug, title, and content are required' });
        }
        const [page, created] = await Page.findOrCreate({
            where: { slug: req.body.slug.trim() },
            defaults: {
                title: req.body.title.trim(),
                content: req.body.content,
            },
        });
        if (!created) {
            await page.update({ title: req.body.title.trim(), content: req.body.content });
        }
        res.status(created ? 201 : 200).json(page);
    }
    catch (error) {
        res.status(400).json({ error: 'Unable to create or update page' });
    }
});
router.delete('/:slug', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const deletedCount = await Page.destroy({ where: { slug: req.params.slug } });
        if (!deletedCount) {
            return res.status(404).json({ error: 'Page not found' });
        }
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: 'Unable to delete page' });
    }
});
export default router;
