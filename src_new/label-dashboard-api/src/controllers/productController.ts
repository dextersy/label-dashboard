import { Request, Response } from 'express';
import { Op, fn, col } from 'sequelize';
import { Product, ProductImage, ProductArtist, Brand, Release, Artist, Earning, Royalty, ReleaseArtist, ArtistAccess, RecuperableExpense } from '../models';
import { uploadToS3, deleteFromS3 } from '../utils/s3Service';
import { checkStorageLimitForBrand } from '../services/subscriptionService';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

interface AuthRequest extends Request {
  user?: any;
}

/**
 * Returns the set of product IDs a non-admin user may access within a brand.
 * A product is accessible if the user has an accepted ArtistAccess record for:
 *   - the product's direct artist_id, OR
 *   - the primary artist of the product's linked release, OR
 *   - any artist listed in the product's ProductArtist splits.
 */
async function getAccessibleProductIds(userId: number, brandId: number): Promise<number[]> {
  const accessRows = await ArtistAccess.findAll({
    where: { user_id: userId, status: 'Accepted' },
    attributes: ['artist_id'],
  });
  const artistIds = accessRows.map((r: any) => r.artist_id);

  if (artistIds.length === 0) return [];

  // Products directly linked to an accessible artist
  const direct = await Product.findAll({
    where: { brand_id: brandId, artist_id: { [Op.in]: artistIds } },
    attributes: ['id'],
  });

  // Products linked via a release whose primary artist is accessible
  const viaRelease = await Product.findAll({
    where: { brand_id: brandId, release_id: { [Op.ne]: null } },
    include: [{
      model: Release, as: 'release',
      where: { artist_id: { [Op.in]: artistIds } },
      attributes: [],
    }],
    attributes: ['id'],
  });

  // Products where the user's artist appears in splits
  const viaSplits = await ProductArtist.findAll({
    where: { artist_id: { [Op.in]: artistIds } },
    attributes: ['product_id'],
  });

  const ids = new Set<number>([
    ...direct.map((p: any) => p.id),
    ...viaRelease.map((p: any) => p.id),
    ...viaSplits.map((pa: any) => pa.product_id),
  ]);

  return [...ids];
}

// Multer configuration for product image uploads
const storage = multer.memoryStorage();
const imageFilter = (req: any, file: any, cb: any) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

export const productImageUpload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// GET /products — list for brand
export const getProducts = async (req: AuthRequest, res: Response) => {
  try {
    const brandId = req.user.brand_id;
    const { artist_id, release_id, status, search, page = '1', limit = '25' } = req.query;

    const where: any = { brand_id: brandId };

    // Non-admins: restrict to products linked to their accessible artists
    if (!req.user.is_admin) {
      const accessibleIds = await getAccessibleProductIds(req.user.id, brandId);
      if (accessibleIds.length === 0) return res.json({ products: [], total: 0 });
      where.id = { [Op.in]: accessibleIds };
    }

    if (artist_id) where.artist_id = parseInt(artist_id as string, 10);
    if (release_id) where.release_id = parseInt(release_id as string, 10);
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { sku: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const offset = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);

    const { rows, count } = await Product.findAndCountAll({
      where,
      include: [
        { model: Release, as: 'release', attributes: ['id', 'title', 'catalog_no', 'cover_art'] },
        { model: Artist, as: 'artist', attributes: ['id', 'name', 'profile_photo'] },
        { model: ProductImage, as: 'images', attributes: ['id', 'path', 'sort_order'], order: [['sort_order', 'ASC']], limit: 1, separate: true },
      ],
      order: [['id', 'DESC']],
      limit: parseInt(limit as string, 10),
      offset,
    });

    res.json({ products: rows, total: count });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /products/:id — detail
export const getProduct = async (req: AuthRequest, res: Response) => {
  try {
    const brandId = req.user.brand_id;
    const productId = parseInt(req.params.id as string, 10);

    const product = await Product.findOne({
      where: { id: productId, brand_id: brandId },
      include: [
        { model: Release, as: 'release', attributes: ['id', 'title', 'catalog_no', 'cover_art'] },
        { model: Artist, as: 'artist', attributes: ['id', 'name'] },
        { model: ProductImage, as: 'images', attributes: ['id', 'path', 'sort_order'], separate: true, order: [['sort_order', 'ASC']] },
        {
          model: ProductArtist, as: 'productArtists',
          include: [{ model: Artist, as: 'artist', attributes: ['id', 'name'] }],
        },
      ],
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Non-admins: verify the product is linked to an artist they have access to
    if (!req.user.is_admin) {
      const accessibleIds = await getAccessibleProductIds(req.user.id, brandId);
      if (!accessibleIds.includes(productId)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /products — create
/** Seed ProductArtist rows from a release's merch splits. Skips artists already present. */
async function seedSplitsFromRelease(productId: number, releaseId: number): Promise<void> {
  const releaseArtists = await ReleaseArtist.findAll({ where: { release_id: releaseId } });
  for (const ra of releaseArtists) {
    const exists = await ProductArtist.findOne({ where: { product_id: productId, artist_id: ra.artist_id } });
    if (!exists) {
      await ProductArtist.create({
        product_id: productId,
        artist_id: ra.artist_id,
        merch_royalty_percentage: ra.merch_royalty_percentage ?? 0.5,
        merch_royalty_type: ra.merch_royalty_type ?? 'Revenue',
      });
    }
  }
}

export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, sku, description, price, release_id, artist_id, status } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    const brandId = req.user.brand_id;

    // Check SKU uniqueness within brand
    if (sku) {
      const existing = await Product.findOne({ where: { brand_id: brandId, sku } });
      if (existing) {
        return res.status(409).json({ error: 'A product with this SKU already exists' });
      }
    }

    // Validate release belongs to brand
    if (release_id) {
      const release = await Release.findOne({ where: { id: release_id, brand_id: brandId } });
      if (!release) {
        return res.status(404).json({ error: 'Release not found' });
      }
    }

    // Validate artist belongs to brand
    if (artist_id) {
      const artist = await Artist.findOne({ where: { id: artist_id, brand_id: brandId } });
      if (!artist) {
        return res.status(404).json({ error: 'Artist not found' });
      }
    }

    const product = await Product.create({
      name,
      sku: sku || null,
      description: description || null,
      price: price != null ? price : null,
      brand_id: brandId,
      release_id: release_id || null,
      artist_id: artist_id || null,
      status: status || 'active',
    });

    // Seed artist splits from release merch splits
    if (release_id) {
      await seedSplitsFromRelease(product.id, release_id);
    }

    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /products/:id — update
export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const brandId = req.user.brand_id;
    const productId = parseInt(req.params.id as string, 10);

    const product = await Product.findOne({ where: { id: productId, brand_id: brandId } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const { name, sku, description, price, release_id, artist_id, status } = req.body;

    // Check SKU uniqueness if changing
    if (sku && sku !== product.sku) {
      const existing = await Product.findOne({ where: { brand_id: brandId, sku, id: { [Op.ne]: productId } } });
      if (existing) {
        return res.status(409).json({ error: 'A product with this SKU already exists' });
      }
    }

    // Validate release belongs to brand
    if (release_id) {
      const release = await Release.findOne({ where: { id: release_id, brand_id: brandId } });
      if (!release) {
        return res.status(404).json({ error: 'Release not found' });
      }
    }

    // Validate artist belongs to brand
    if (artist_id) {
      const artist = await Artist.findOne({ where: { id: artist_id, brand_id: brandId } });
      if (!artist) {
        return res.status(404).json({ error: 'Artist not found' });
      }
    }

    const prevReleaseId = product.release_id;
    const newReleaseId = release_id !== undefined ? (release_id || null) : product.release_id;

    await product.update({
      name: name !== undefined ? name : product.name,
      sku: sku !== undefined ? (sku || null) : product.sku,
      description: description !== undefined ? (description || null) : product.description,
      price: price !== undefined ? (price != null ? price : null) : product.price,
      release_id: newReleaseId,
      artist_id: artist_id !== undefined ? (artist_id || null) : product.artist_id,
      status: status !== undefined ? status : product.status,
    });

    // If a release was just linked and the product has no existing splits, seed from release
    if (newReleaseId && newReleaseId !== prevReleaseId) {
      const existingSplits = await ProductArtist.count({ where: { product_id: productId } });
      if (existingSplits === 0) {
        await seedSplitsFromRelease(productId, newReleaseId);
      }
    }

    res.json(product);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /products/:id — soft-delete (inactive) or hard-delete if no earnings
export const deleteProduct = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const brandId = req.user.brand_id;
    const productId = parseInt(req.params.id as string, 10);

    const product = await Product.findOne({ where: { id: productId, brand_id: brandId } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Check if product has earnings
    const earningCount = await Earning.count({ where: { product_id: productId } });

    if (earningCount > 0) {
      // Soft delete — set to inactive
      await product.update({ status: 'inactive' });
      res.json({ message: 'Product deactivated (has earnings)' });
    } else {
      // Hard delete — remove images from S3 first
      const images = await ProductImage.findAll({ where: { product_id: productId } });
      for (const img of images) {
        try {
          const key = new URL(img.path).pathname.replace(/^\//, '');
          await deleteFromS3({ Bucket: process.env.S3_BUCKET!, Key: key });
        } catch (e) {
          console.warn('Could not delete product image from S3:', e);
        }
      }
      await ProductImage.destroy({ where: { product_id: productId } });
      await ProductArtist.destroy({ where: { product_id: productId } });
      await product.destroy();
      res.json({ message: 'Product deleted' });
    }
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /products/:id/artists — get product artist splits
export const getProductArtists = async (req: AuthRequest, res: Response) => {
  try {
    const brandId = req.user.brand_id;
    const productId = parseInt(req.params.id as string, 10);

    const product = await Product.findOne({ where: { id: productId, brand_id: brandId } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (!req.user.is_admin) {
      const accessibleIds = await getAccessibleProductIds(req.user.id, brandId);
      if (!accessibleIds.includes(productId)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const productArtists = await ProductArtist.findAll({
      where: { product_id: productId },
      include: [{ model: Artist, as: 'artist', attributes: ['id', 'name'] }],
    });

    res.json(productArtists);
  } catch (error) {
    console.error('Get product artists error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /products/:id/artists — set product artist splits (replace all)
// POST /products/:id/artists/inherit — replace splits with the linked release's merch splits
export const inheritSplitsFromRelease = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const brandId = req.user.brand_id;
    const productId = parseInt(req.params.id as string, 10);

    const product = await Product.findOne({
      where: { id: productId, brand_id: brandId },
      include: [{ model: ProductArtist, as: 'productArtists' }],
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!product.release_id) return res.status(400).json({ error: 'Product is not linked to a release' });

    await ProductArtist.destroy({ where: { product_id: productId } });
    await seedSplitsFromRelease(productId, product.release_id);

    const updated = await ProductArtist.findAll({
      where: { product_id: productId },
      include: [{ model: Artist, as: 'artist', attributes: ['id', 'name'] }],
    });
    res.json(updated);
  } catch (error) {
    console.error('Inherit splits error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const setProductArtists = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const brandId = req.user.brand_id;
    const productId = parseInt(req.params.id as string, 10);

    const product = await Product.findOne({ where: { id: productId, brand_id: brandId } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const { artists } = req.body; // Array of { artist_id, merch_royalty_percentage, merch_royalty_type }

    if (!Array.isArray(artists)) {
      return res.status(400).json({ error: 'Artists array is required' });
    }

    // Validate all artists and split percentages
    for (const a of artists) {
      const pct = a.merch_royalty_percentage;
      if (pct !== undefined && pct !== null && (typeof pct !== 'number' || pct < 0 || pct > 1)) {
        return res.status(400).json({ error: `merch_royalty_percentage must be between 0 and 1` });
      }
      const artist = await Artist.findOne({ where: { id: a.artist_id, brand_id: brandId } });
      if (!artist) {
        return res.status(404).json({ error: `Artist ${a.artist_id} not found` });
      }
    }

    // Replace all splits
    await ProductArtist.destroy({ where: { product_id: productId } });

    const created = [];
    for (const a of artists) {
      const pa = await ProductArtist.create({
        product_id: productId,
        artist_id: a.artist_id,
        merch_royalty_percentage: a.merch_royalty_percentage ?? 0.500,
        merch_royalty_type: a.merch_royalty_type || 'Revenue',
      });
      created.push(pa);
    }

    // Re-fetch with artist names
    const result = await ProductArtist.findAll({
      where: { product_id: productId },
      include: [{ model: Artist, as: 'artist', attributes: ['id', 'name'] }],
    });

    res.json(result);
  } catch (error) {
    console.error('Set product artists error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /products/:id/images — upload image
export const addProductImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const brandId = req.user.brand_id;
    const productId = parseInt(req.params.id as string, 10);

    const product = await Product.findOne({ where: { id: productId, brand_id: brandId } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const storageCheck = await checkStorageLimitForBrand(brandId, file.size);
    if (!storageCheck.allowed) {
      return res.status(402).json({ error: 'LIMIT_REACHED', limit_type: 'storage' });
    }

    // Get max sort_order
    const maxImg = await ProductImage.findOne({
      where: { product_id: productId },
      order: [['sort_order', 'DESC']],
      attributes: ['sort_order'],
    });
    const sortOrder = (maxImg?.sort_order ?? -1) + 1;

    const ext = path.extname(file.originalname) || '.jpg';
    const key = `products/${brandId}/${productId}/${crypto.randomUUID()}${ext}`;

    const result = await uploadToS3({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    const image = await ProductImage.create({
      product_id: productId,
      path: result.Location,
      sort_order: sortOrder,
    });

    res.status(201).json(image);
  } catch (error) {
    console.error('Add product image error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /products/:id/images/:imgId — remove image
export const deleteProductImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const brandId = req.user.brand_id;
    const productId = parseInt(req.params.id as string, 10);
    const imgId = parseInt(req.params.imgId as string, 10);

    const product = await Product.findOne({ where: { id: productId, brand_id: brandId } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const image = await ProductImage.findOne({ where: { id: imgId, product_id: productId } });
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    try {
      const key = new URL(image.path).pathname.replace(/^\//, '');
      await deleteFromS3({ Bucket: process.env.S3_BUCKET!, Key: key });
    } catch (e) {
      console.warn('Could not delete product image from S3:', e);
    }

    await image.destroy();
    res.json({ message: 'Image deleted' });
  } catch (error) {
    console.error('Delete product image error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /products/:id/images/reorder — update sort_order
export const reorderProductImages = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const brandId = req.user.brand_id;
    const productId = parseInt(req.params.id as string, 10);

    const product = await Product.findOne({ where: { id: productId, brand_id: brandId } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const { image_ids } = req.body; // Array of image IDs in desired order

    if (!Array.isArray(image_ids)) {
      return res.status(400).json({ error: 'image_ids array is required' });
    }

    for (let i = 0; i < image_ids.length; i++) {
      await ProductImage.update(
        { sort_order: i },
        { where: { id: image_ids[i], product_id: productId } }
      );
    }

    const images = await ProductImage.findAll({
      where: { product_id: productId },
      order: [['sort_order', 'ASC']],
    });

    res.json(images);
  } catch (error) {
    console.error('Reorder product images error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /financial/earning-targets — search releases + products for autocomplete
export const searchEarningTargets = async (req: AuthRequest, res: Response) => {
  try {
    const brandId = req.user.brand_id;
    const search = (req.query.search as string) || '';

    const searchWhere = search
      ? { [Op.or]: [
          { title: { [Op.iLike]: `%${search}%` } },
          { catalog_no: { [Op.iLike]: `%${search}%` } },
        ] }
      : {};

    const releases = await Release.findAll({
      where: { brand_id: brandId, ...searchWhere },
      attributes: ['id', 'title', 'catalog_no', 'cover_art'],
      limit: 10,
      order: [['title', 'ASC']],
    });

    const productSearchWhere = search
      ? { [Op.or]: [
          { name: { [Op.iLike]: `%${search}%` } },
          { sku: { [Op.iLike]: `%${search}%` } },
        ] }
      : {};

    const products = await Product.findAll({
      where: { brand_id: brandId, status: 'active', ...productSearchWhere },
      attributes: ['id', 'name', 'sku'],
      include: [{ model: ProductImage, as: 'images', attributes: ['path'], limit: 1, separate: true, order: [['sort_order', 'ASC']] }],
      limit: 10,
      order: [['name', 'ASC']],
    });

    res.json({ releases, products });
  } catch (error) {
    console.error('Search earning targets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addProductExpense = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const productId = parseInt(req.params.id as string, 10);
    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const { expense_description, expense_amount, date_recorded } = req.body;

    if (!expense_description || !expense_amount) {
      return res.status(400).json({ error: 'Description and amount are required' });
    }

    const product = await Product.findOne({ where: { id: productId, brand_id: req.user.brand_id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const expense = await RecuperableExpense.create({
      product_id: productId,
      expense_description,
      expense_amount: parseFloat(expense_amount),
      date_recorded: date_recorded ? new Date(date_recorded) : new Date(),
      brand_id: req.user.brand_id,
    });

    res.status(201).json({ message: 'Recuperable expense added successfully', expense });
  } catch (error) {
    console.error('Add product expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
