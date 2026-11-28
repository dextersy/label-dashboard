import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { ProductCategory, ProductProductCategory, Product } from '../models';

interface AuthRequest extends Request {
  user?: any;
}

// GET /product-categories — list all categories for the brand (excludes soft-deleted)
export const getCategories = async (req: AuthRequest, res: Response) => {
  try {
    const brandId = req.user.brand_id;

    const categories = await ProductCategory.findAll({
      where: {
        brand_id: brandId,
        deleted_at: { [Op.is as any]: null },
      },
      order: [['sort_order', 'ASC'], ['name', 'ASC']],
    });

    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /product-categories — create a category
export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    const brandId = req.user.brand_id;
    const { name, description, color, sort_order } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    // Auto-generate slug from name
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Check slug uniqueness within brand
    const existing = await ProductCategory.findOne({
      where: { brand_id: brandId, slug, deleted_at: { [Op.is as any]: null } },
    });
    if (existing) {
      return res.status(409).json({ error: 'A category with this name already exists' });
    }

    const category = await ProductCategory.create({
      brand_id: brandId,
      name: name.trim(),
      slug,
      description: description || null,
      color: color || null,
      sort_order: sort_order ?? 0,
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /product-categories/:id — update a category
export const updateCategory = async (req: AuthRequest, res: Response) => {
  try {
    const brandId = req.user.brand_id;
    const categoryId = parseInt(req.params.id as string, 10);
    const { name, description, color, sort_order } = req.body;

    const category = await ProductCategory.findOne({
      where: { id: categoryId, brand_id: brandId, deleted_at: { [Op.is as any]: null } },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    if (name !== undefined) {
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      // Check slug uniqueness (exclude self)
      const conflict = await ProductCategory.findOne({
        where: {
          brand_id: brandId,
          slug,
          id: { [Op.ne]: categoryId },
          deleted_at: { [Op.is as any]: null },
        },
      });
      if (conflict) {
        return res.status(409).json({ error: 'A category with this name already exists' });
      }
      category.name = name.trim();
      category.slug = slug;
    }

    if (description !== undefined) category.description = description || null;
    if (color !== undefined) category.color = color || null;
    if (sort_order !== undefined) category.sort_order = sort_order;

    await category.save();

    res.json(category);
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /product-categories/:id — soft-delete a category
export const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    const brandId = req.user.brand_id;
    const categoryId = parseInt(req.params.id as string, 10);

    const category = await ProductCategory.findOne({
      where: { id: categoryId, brand_id: brandId, deleted_at: { [Op.is as any]: null } },
    });

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Remove all product associations for this category
    await ProductProductCategory.destroy({ where: { category_id: categoryId } });

    // Soft-delete
    category.deleted_at = new Date();
    await category.save();

    res.json({ message: 'Category deleted' });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /products/:id/categories — get categories for a product
export const getProductCategories = async (req: AuthRequest, res: Response) => {
  try {
    const brandId = req.user.brand_id;
    const productId = parseInt(req.params.id as string, 10);

    const product = await Product.findOne({ where: { id: productId, brand_id: brandId } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const rows = await ProductProductCategory.findAll({
      where: { product_id: productId },
      include: [{ model: ProductCategory, as: 'category' }],
    });

    const categories = rows
      .map((r: any) => r.category)
      .filter((c: any) => c && !c.deleted_at);

    res.json(categories);
  } catch (error) {
    console.error('Get product categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /products/:id/categories — set categories for a product (replaces all)
export const setProductCategories = async (req: AuthRequest, res: Response) => {
  try {
    const brandId = req.user.brand_id;
    const productId = parseInt(req.params.id as string, 10);
    const { category_ids } = req.body;

    if (!Array.isArray(category_ids)) {
      return res.status(400).json({ error: 'category_ids must be an array' });
    }

    const product = await Product.findOne({ where: { id: productId, brand_id: brandId } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Verify all category IDs belong to this brand and are not deleted
    if (category_ids.length > 0) {
      const validCategories = await ProductCategory.findAll({
        where: {
          id: { [Op.in]: category_ids },
          brand_id: brandId,
          deleted_at: { [Op.is as any]: null },
        },
      });
      if (validCategories.length !== category_ids.length) {
        return res.status(400).json({ error: 'One or more category IDs are invalid' });
      }
    }

    // Replace all associations
    await ProductProductCategory.destroy({ where: { product_id: productId } });

    if (category_ids.length > 0) {
      await ProductProductCategory.bulkCreate(
        category_ids.map((cid: number) => ({ product_id: productId, category_id: cid }))
      );
    }

    // Return updated categories
    const rows = await ProductProductCategory.findAll({
      where: { product_id: productId },
      include: [{ model: ProductCategory, as: 'category' }],
    });
    const categories = rows.map((r: any) => r.category).filter(Boolean);

    res.json(categories);
  } catch (error) {
    console.error('Set product categories error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
