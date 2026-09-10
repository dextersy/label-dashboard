import { Router } from 'express';
import {
  listTemplates,
  createTemplate,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  hideTemplate,
  unhideTemplate,
} from '../controllers/releaseTaskTemplateController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', listTemplates);
router.post('/', createTemplate);
router.get('/:id', getTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);
router.post('/:id/hide', hideTemplate);
router.delete('/:id/hide', unhideTemplate);

export default router;
