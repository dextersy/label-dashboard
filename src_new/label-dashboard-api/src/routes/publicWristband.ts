import { Router } from 'express';
import {
  getPublicWristbandColors,
  createPublicWristbandOrder,
  getPublicWristbandOrder,
  updatePublicWristbandOrder,
  placePublicWristbandOrder,
  remindPublicWristbandOrder,
  initiatePublicWristbandPayment,
  proxyPublicWristbandDesign,
  upload,
} from '../controllers/publicWristbandController';
import {
  wristbandOrderCreateRateLimit,
  wristbandReminderRateLimit,
  createPaymentRateLimit,
} from '../middleware/rateLimiting';

const router = Router();

// Wristband color catalog (no auth)
router.get('/wristband-colors', getPublicWristbandColors);

// Order lifecycle
router.post('/wristband-orders', wristbandOrderCreateRateLimit, createPublicWristbandOrder);
router.get('/wristband-orders/:token', getPublicWristbandOrder);
router.put('/wristband-orders/:token', upload.single('design'), updatePublicWristbandOrder);
router.post('/wristband-orders/:token/place', placePublicWristbandOrder);
router.post('/wristband-orders/:token/remind', wristbandReminderRateLimit, remindPublicWristbandOrder);
router.post('/wristband-orders/:token/payment/initiate', createPaymentRateLimit(5, 15 * 60 * 1000), initiatePublicWristbandPayment);
router.get('/wristband-orders/:token/design', proxyPublicWristbandDesign);

export default router;
