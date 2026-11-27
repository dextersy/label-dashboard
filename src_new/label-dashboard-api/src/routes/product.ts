import { Router } from 'express';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductArtists,
  setProductArtists,
  inheritSplitsFromRelease,
  addProductImage,
  deleteProductImage,
  reorderProductImages,
  productImageUpload,
  addProductExpense,
} from '../controllers/productController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Product CRUD
router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', requireAdmin, createProduct);
router.put('/:id', requireAdmin, updateProduct);
router.delete('/:id', requireAdmin, deleteProduct);

// Product artist splits
router.get('/:id/artists', getProductArtists);
router.put('/:id/artists', requireAdmin, setProductArtists);
router.post('/:id/artists/inherit', requireAdmin, inheritSplitsFromRelease);

// Product expenses
router.post('/:id/expenses', requireAdmin, addProductExpense);

// Product images
router.post('/:id/images', requireAdmin, productImageUpload.single('image'), addProductImage);
router.delete('/:id/images/:imgId', requireAdmin, deleteProductImage);
router.put('/:id/images/reorder', requireAdmin, reorderProductImages);

export default router;
