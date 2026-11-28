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
  getProductExpenses,
  getProductEarnings,
  getMerchEarnings,
  getMerchExpenses,
} from '../controllers/productController';
import { getProductCategories, setProductCategories } from '../controllers/productCategoryController';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Brand-wide merch sales (must be before /:id routes)
router.get('/sales/earnings', getMerchEarnings);
router.get('/sales/expenses', getMerchExpenses);

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

// Product earnings & expenses
router.get('/:id/earnings', getProductEarnings);
router.get('/:id/expenses', getProductExpenses);
router.post('/:id/expenses', requireAdmin, addProductExpense);

// Product categories
router.get('/:id/categories', getProductCategories);
router.put('/:id/categories', requireAdmin, setProductCategories);

// Product images
router.post('/:id/images', requireAdmin, productImageUpload.single('image'), addProductImage);
router.delete('/:id/images/:imgId', requireAdmin, deleteProductImage);
router.put('/:id/images/reorder', requireAdmin, reorderProductImages);

export default router;
