import { Router } from 'express';
import ContactMessage from '../models/ContactMessage.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { sendContactNotification } from '../services/email.js';

const router = Router();

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

router.post('/', async (req, res) => {
  try {
    const name = clean(req.body.name);
    const email = clean(req.body.email).toLowerCase();
    const phone = clean(req.body.phone) || null;
    const subject = clean(req.body.subject) || 'Website enquiry';
    const message = clean(req.body.message);

    if (!name || !/^\S+@\S+\.\S+$/.test(email) || !message) {
      return res.status(400).json({ error: 'Name, valid email, and message are required' });
    }

    const contactMessage = await ContactMessage.create({ name, email, phone, subject, message });
    void sendContactNotification({ name, email, phone, subject, message });
    res.status(201).json({ id: contactMessage.id, message: 'Message received' });
  } catch {
    res.status(400).json({ error: 'Unable to send message' });
  }
});

router.get('/', authenticateToken, requireAdmin, async (_req, res) => {
  const messages = await ContactMessage.findAll({ order: [['createdAt', 'DESC']] });
  res.json(messages);
});

router.put('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const status = clean(req.body.status);
    if (!status) return res.status(400).json({ error: 'Status is required' });
    const message = await ContactMessage.findByPk(Number(req.params.id));
    if (!message) return res.status(404).json({ error: 'Message not found' });
    await message.update({ status });
    res.json(message);
  } catch {
    res.status(400).json({ error: 'Unable to update message' });
  }
});

export default router;
