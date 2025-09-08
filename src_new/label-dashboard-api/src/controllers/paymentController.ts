import { Request, Response } from 'express';
import { PaymentService } from '../utils/paymentService';

export const getSupportedBanks = async (req: Request, res: Response) => {
  try {
    const paymentService = new PaymentService();
    const supportedBanks = await paymentService.getSupportedBanks();
    
    if (supportedBanks) {
      res.json(supportedBanks);
    } else {
      res.status(500).json({ error: 'Failed to retrieve supported banks from payment provider' });
    }
  } catch (error) {
    console.error('Error fetching supported banks:', error);
    res.status(500).json({ error: 'Internal server error while fetching supported banks' });
  }
};