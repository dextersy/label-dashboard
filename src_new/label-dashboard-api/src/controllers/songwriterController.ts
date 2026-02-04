import { Request, Response } from 'express';
import { Songwriter } from '../models';
import { Op } from 'sequelize';

interface AuthRequest extends Request {
  user?: any;
}

// Search/list songwriters (with optional filtering)
export const searchSongwriters = async (req: AuthRequest, res: Response) => {
  try {
    const { search } = req.query;

    const whereClause: any = {};

    if (search && typeof search === 'string') {
      // Search by name, pro_affiliation, or ipi_number
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { pro_affiliation: { [Op.like]: `%${search}%` } },
        { ipi_number: { [Op.like]: `%${search}%` } }
      ];
    }

    const songwriters = await Songwriter.findAll({
      where: whereClause,
      order: [['name', 'ASC']],
      limit: 50 // Limit results for autocomplete
    });

    res.json({ songwriters });
  } catch (error) {
    console.error('Search songwriters error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get a single songwriter
export const getSongwriter = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const songwriter = await Songwriter.findByPk(id as string);

    if (!songwriter) {
      return res.status(404).json({ error: 'Songwriter not found' });
    }

    res.json({ songwriter });
  } catch (error) {
    console.error('Get songwriter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a new songwriter
export const createSongwriter = async (req: AuthRequest, res: Response) => {
  try {
    const { name, pro_affiliation, ipi_number } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Check if songwriter already exists with same name, pro_affiliation, and ipi_number
    const existingSongwriter = await Songwriter.findOne({
      where: {
        name,
        pro_affiliation: pro_affiliation || null,
        ipi_number: ipi_number || null
      }
    });

    if (existingSongwriter) {
      return res.status(200).json({ songwriter: existingSongwriter });
    }

    // Create new songwriter
    const songwriter = await Songwriter.create({
      name,
      pro_affiliation: pro_affiliation || null,
      ipi_number: ipi_number || null
    });

    res.status(201).json({ songwriter });
  } catch (error) {
    console.error('Create songwriter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update a songwriter
export const updateSongwriter = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, pro_affiliation, ipi_number } = req.body;

    const songwriter = await Songwriter.findByPk(id as string);

    if (!songwriter) {
      return res.status(404).json({ error: 'Songwriter not found' });
    }

    // Only admins can update songwriters
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Only administrators can update songwriters' });
    }

    await songwriter.update({
      name: name !== undefined ? name : songwriter.name,
      pro_affiliation: pro_affiliation !== undefined ? pro_affiliation : songwriter.pro_affiliation,
      ipi_number: ipi_number !== undefined ? ipi_number : songwriter.ipi_number
    });

    res.json({ songwriter });
  } catch (error) {
    console.error('Update songwriter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete a songwriter
export const deleteSongwriter = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Only admins can delete songwriters
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Only administrators can delete songwriters' });
    }

    const songwriter = await Songwriter.findByPk(id as string);

    if (!songwriter) {
      return res.status(404).json({ error: 'Songwriter not found' });
    }

    // Check if songwriter is referenced in any songs
    // The database constraint will prevent deletion if there are references
    try {
      await songwriter.destroy();
      res.json({ message: 'Songwriter deleted successfully' });
    } catch (dbError: any) {
      if (dbError.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({
          error: 'Cannot delete songwriter that is referenced in songs'
        });
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Delete songwriter error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
