import { Request, Response } from 'express';
import { EventAddOnPayment, Event, User } from '../models';
import { getBrandReceivableBalance } from '../utils/labelBalanceUtils';

interface AuthRequest extends Request {
  user?: any;
}

export const getAddOnPayments = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.query.event_id as string);
    if (!eventId) return res.status(400).json({ error: 'event_id is required' });

    const event = await Event.findOne({ where: { id: eventId, brand_id: req.user.brand_id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const payments = await EventAddOnPayment.findAll({
      where: { event_id: eventId },
      include: [{ model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name', 'email_address'] }],
      order: [['createdAt', 'DESC']],
    });

    const totalPaid = payments
      .filter(p => p.status === 'succeeded')
      .reduce((sum, p) => sum + parseFloat(p.amount as any), 0);

    res.json({ payments, total_paid: totalPaid });
  } catch (error) {
    console.error('getAddOnPayments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createAddOnPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { event_id, amount, method, reference_number, notes } = req.body;

    if (!event_id || !amount || !method) {
      return res.status(400).json({ error: 'event_id, amount, and method are required' });
    }
    if (!['balance', 'paymongo'].includes(method)) {
      return res.status(400).json({ error: 'method must be balance or paymongo' });
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const event = await Event.findOne({ where: { id: event_id, brand_id: req.user.brand_id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (method === 'balance') {
      const availableBalance = await getBrandReceivableBalance(req.user.brand_id);
      if (parsedAmount > availableBalance) {
        return res.status(422).json({ error: 'Insufficient label balance for this payment' });
      }
    }

    const payment = await EventAddOnPayment.create({
      event_id,
      amount: parsedAmount,
      method,
      status: 'succeeded',
      reference_number: reference_number ?? null,
      notes: notes ?? null,
      created_by: req.user.id,
    });

    res.status(201).json({ payment });
  } catch (error) {
    console.error('createAddOnPayment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
