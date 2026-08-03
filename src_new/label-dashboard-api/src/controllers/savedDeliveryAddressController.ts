import { Request, Response } from 'express';
import { SavedDeliveryAddress } from '../models';

interface AuthRequest extends Request {
  user?: any;
}

export const getSavedDeliveryAddresses = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const addresses = await SavedDeliveryAddress.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
    });

    res.json({ addresses });
  } catch (error) {
    console.error('getSavedDeliveryAddresses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createSavedDeliveryAddress = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { label, name, street, city, country, zip, phone, latitude, longitude } = req.body;

    const saved = await SavedDeliveryAddress.create({
      user_id: userId,
      label: label?.trim() || null,
      name: name?.trim() || null,
      street: street?.trim() || null,
      city: city?.trim() || null,
      country: country?.trim() || null,
      zip: zip?.trim() || null,
      phone: phone?.trim() || null,
      latitude: latitude != null ? parseFloat(latitude) : null,
      longitude: longitude != null ? parseFloat(longitude) : null,
    });

    res.status(201).json({ address: saved });
  } catch (error) {
    console.error('createSavedDeliveryAddress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSavedDeliveryAddress = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = parseInt(String(req.params.id));
    const record = await SavedDeliveryAddress.findOne({ where: { id, user_id: userId } });
    if (!record) return res.status(404).json({ error: 'Address not found' });

    const { label, name, street, city, country, zip, phone, latitude, longitude } = req.body;

    await record.update({
      label:     label     !== undefined ? (label?.trim()     || null) : record.label,
      name:      name      !== undefined ? (name?.trim()      || null) : record.name,
      street:    street    !== undefined ? (street?.trim()    || null) : record.street,
      city:      city      !== undefined ? (city?.trim()      || null) : record.city,
      country:   country   !== undefined ? (country?.trim()   || null) : record.country,
      zip:       zip       !== undefined ? (zip?.trim()       || null) : record.zip,
      phone:     phone     !== undefined ? (phone?.trim()     || null) : record.phone,
      latitude:  latitude  !== undefined ? (latitude  != null ? parseFloat(latitude)  : null) : record.latitude,
      longitude: longitude !== undefined ? (longitude != null ? parseFloat(longitude) : null) : record.longitude,
    });

    res.json({ address: record });
  } catch (error) {
    console.error('updateSavedDeliveryAddress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteSavedDeliveryAddress = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = parseInt(String(req.params.id));
    const record = await SavedDeliveryAddress.findOne({ where: { id, user_id: userId } });
    if (!record) return res.status(404).json({ error: 'Address not found' });

    await record.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('deleteSavedDeliveryAddress error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
