import { Router } from 'express';
import multer from 'multer';
import {
  getReleases,
  getRelease,
  createRelease,
  updateRelease,
  toggleReleaseExcludeFromEPK,
  deleteRelease,
  getReleaseEarnings,
  getReleaseExpenses,
  addReleaseExpense,
  generateCatalogNumber,
  downloadMasters
} from '../controllers/releaseController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow image files for cover art
    if (file.fieldname === 'cover_art' && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Catalog number utilities (must be before /:id routes)
router.get('/generate-catalog-number', generateCatalogNumber);

// Release CRUD operations
router.get('/', getReleases);
router.get('/:id', getRelease);
router.post('/', upload.single('cover_art'), createRelease);
router.put('/:id', upload.single('cover_art'), updateRelease);
router.patch('/:id/exclude-from-epk', toggleReleaseExcludeFromEPK);
router.delete('/:id', requireAdmin, deleteRelease);

// Release-specific data
router.get('/:id/earnings', getReleaseEarnings);
router.get('/:id/expenses', getReleaseExpenses);
router.post('/:id/expenses', requireAdmin, addReleaseExpense);

// Download masters (cover art + audio files)
router.get('/:id/download-masters', downloadMasters);

export default router;