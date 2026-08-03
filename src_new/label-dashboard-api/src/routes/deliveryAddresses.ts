import { Router } from 'express';
import {
  getSavedDeliveryAddresses,
  createSavedDeliveryAddress,
  updateSavedDeliveryAddress,
  deleteSavedDeliveryAddress,
} from '../controllers/savedDeliveryAddressController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', getSavedDeliveryAddresses);
router.post('/', createSavedDeliveryAddress);
router.put('/:id', updateSavedDeliveryAddress);
router.delete('/:id', deleteSavedDeliveryAddress);

export default router;
