import express from 'express';
import { getBrandByDomain, getBrandSettings } from '../controllers/brandController';

const router = express.Router();

// Public route to get brand settings by domain (used for login page)
router.get('/by-domain', getBrandByDomain);

// Protected route to get brand settings by ID
router.get('/:brandId', getBrandSettings);

export default router;