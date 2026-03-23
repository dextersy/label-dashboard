import { Router } from 'express';
import {
  scannerLogin,
  scannerGetTicket,
  scannerCheckIn,
  scannerGetWalkInTypes,
  scannerRegisterWalkIn
} from '../controllers/scannerController';
import { authenticateScannerToken } from '../middleware/scannerAuth';
import { publicRateLimit } from '../middleware/rateLimiting';

const router = Router();

// Public - login with PIN to get JWT
router.post('/login', publicRateLimit, scannerLogin);

// Protected - require scanner JWT
router.post('/ticket', authenticateScannerToken, scannerGetTicket);
router.post('/check-in', authenticateScannerToken, scannerCheckIn);
router.post('/walk-in/types', authenticateScannerToken, scannerGetWalkInTypes);
router.post('/walk-in/register', authenticateScannerToken, scannerRegisterWalkIn);

export default router;
