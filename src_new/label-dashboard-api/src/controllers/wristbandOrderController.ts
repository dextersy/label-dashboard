import { Request, Response } from 'express';
import multer from 'multer';
import { WristbandOrder, WristbandOrderItem, WristbandColor, EventWristbandSettings, Event } from '../models';
import { uploadToS3, deleteFromS3 } from '../utils/s3Service';

interface AuthRequest extends Request {
  user?: any;
}

// Multer for memory storage — PNG uploads only
const storage = multer.memoryStorage();
const fileFilter = (_req: any, file: any, cb: any) => {
  if (file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    cb(new Error('Only PNG files are accepted for wristband designs'), false);
  }
};
export const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Shared helpers ────────────────────────────────────────────────────────

async function resolveEvent(eventId: number, brandId: number): Promise<InstanceType<typeof Event> | null> {
  return Event.findOne({ where: { id: eventId, brand_id: brandId } });
}

async function validateItems(
  items: { wristband_color_id: number; quantity: number }[]
): Promise<string | null> {
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 0) {
      return 'Item quantities must be non-negative integers';
    }
  }
  const colorIds = items.map(i => i.wristband_color_id);
  const colors = await WristbandColor.findAll({ where: { id: colorIds } });
  if (colors.length !== colorIds.length) {
    return 'One or more wristband color IDs are invalid';
  }
  return null;
}

// ─── Wristband Settings ────────────────────────────────────────────────────

export const getWristbandSettings = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.query.event_id as string);
    if (!eventId) return res.status(400).json({ error: 'event_id is required' });

    const event = await resolveEvent(eventId, req.user.brand_id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const settings = await EventWristbandSettings.findOne({ where: { event_id: eventId } });
    res.json({ settings: settings ?? { event_id: eventId, delivery_name: null, delivery_street: null, delivery_city: null, delivery_country: null, delivery_zip: null, delivery_phone: null } });
  } catch (error) {
    console.error('getWristbandSettings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const upsertWristbandSettings = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.query.event_id as string);
    if (!eventId) return res.status(400).json({ error: 'event_id is required' });

    const event = await resolveEvent(eventId, req.user.brand_id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const { delivery_name, delivery_street, delivery_city, delivery_country, delivery_zip, delivery_phone } = req.body;

    const [settings] = await EventWristbandSettings.upsert({
      event_id: eventId,
      delivery_name: delivery_name ?? null,
      delivery_street: delivery_street ?? null,
      delivery_city: delivery_city ?? null,
      delivery_country: delivery_country ?? null,
      delivery_zip: delivery_zip ?? null,
      delivery_phone: delivery_phone ?? null,
    });

    res.json({ settings });
  } catch (error) {
    console.error('upsertWristbandSettings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─── Wristband Orders ──────────────────────────────────────────────────────

export const getWristbandOrders = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.query.event_id as string);
    if (!eventId) return res.status(400).json({ error: 'event_id is required' });

    const event = await resolveEvent(eventId, req.user.brand_id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const orders = await WristbandOrder.findAll({
      where: { event_id: eventId },
      include: [
        {
          model: WristbandOrderItem,
          as: 'items',
          include: [{ model: WristbandColor, as: 'color' }],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json({ orders });
  } catch (error) {
    console.error('getWristbandOrders error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createWristbandOrder = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.query.event_id as string);
    if (!eventId) return res.status(400).json({ error: 'event_id is required' });

    const event = await resolveEvent(eventId, req.user.brand_id);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const { status, disclaimer_acknowledged, items, design_x, design_y, design_width, design_height } = req.body;
    const parsedItems: { wristband_color_id: number; quantity: number }[] =
      typeof items === 'string' ? JSON.parse(items) : items;

    if (parsedItems && Array.isArray(parsedItems)) {
      const itemError = await validateItems(parsedItems);
      if (itemError) return res.status(400).json({ error: itemError });
    }

    let designUrl: string | null = null;
    if (req.file) {
      const key = `wristband-design-${Date.now()}.png`;
      const result = await uploadToS3({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
        Body: req.file.buffer,
        ContentType: 'image/png',
      });
      designUrl = result.Location;
    }

    const order = await WristbandOrder.create({
      event_id: eventId,
      status: status || 'draft',
      design_url: designUrl,
      design_x: design_x != null ? parseFloat(design_x) : null,
      design_y: design_y != null ? parseFloat(design_y) : null,
      design_width: design_width != null ? parseFloat(design_width) : null,
      design_height: design_height != null ? parseFloat(design_height) : null,
      disclaimer_acknowledged: disclaimer_acknowledged === true || disclaimer_acknowledged === 'true',
      created_by: req.user.id,
    });

    if (parsedItems && Array.isArray(parsedItems)) {
      const validItems = parsedItems.filter(i => i.quantity > 0);
      await WristbandOrderItem.bulkCreate(
        validItems.map(i => ({ order_id: order.id, wristband_color_id: i.wristband_color_id, quantity: i.quantity }))
      );
    }

    const fullOrder = await WristbandOrder.findByPk(order.id, {
      include: [{ model: WristbandOrderItem, as: 'items', include: [{ model: WristbandColor, as: 'color' }] }],
    });

    res.status(201).json({ order: fullOrder });
  } catch (error) {
    console.error('createWristbandOrder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateWristbandOrder = async (req: AuthRequest, res: Response) => {
  try {
    const orderId = parseInt(String(req.params.id));
    const order = await WristbandOrder.findOne({
      where: { id: orderId },
      include: [{ model: Event, as: 'event', attributes: ['brand_id'] }],
    }) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.event?.brand_id !== req.user.brand_id) return res.status(403).json({ error: 'Forbidden' });

    if (order.status !== 'draft' && order.status !== 'rejected') {
      return res.status(400).json({ error: 'Only draft or rejected orders can be edited' });
    }

    const { status, disclaimer_acknowledged, items, design_x, design_y, design_width, design_height } = req.body;
    const parsedItems: { wristband_color_id: number; quantity: number }[] =
      typeof items === 'string' ? JSON.parse(items) : items;

    if (parsedItems && Array.isArray(parsedItems)) {
      const itemError = await validateItems(parsedItems);
      if (itemError) return res.status(400).json({ error: itemError });
    }

    let designUrl = order.design_url;
    if (req.file) {
      // Delete old design from S3
      if (order.design_url) {
        try {
          const oldKey = order.design_url.split('/').pop()!;
          await deleteFromS3({ Bucket: process.env.S3_BUCKET!, Key: oldKey });
        } catch (e) {
          console.warn('Could not delete old design from S3:', e);
        }
      }
      const key = `wristband-design-${Date.now()}.png`;
      const result = await uploadToS3({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
        Body: req.file.buffer,
        ContentType: 'image/png',
      });
      designUrl = result.Location;
    }

    await order.update({
      status: status || order.status,
      design_url: designUrl,
      design_x: design_x != null ? parseFloat(design_x) : order.design_x,
      design_y: design_y != null ? parseFloat(design_y) : order.design_y,
      design_width: design_width != null ? parseFloat(design_width) : order.design_width,
      design_height: design_height != null ? parseFloat(design_height) : order.design_height,
      disclaimer_acknowledged: disclaimer_acknowledged === true || disclaimer_acknowledged === 'true',
    });

    if (parsedItems && Array.isArray(parsedItems)) {
      await WristbandOrderItem.destroy({ where: { order_id: orderId } });
      const validItems = parsedItems.filter(i => i.quantity > 0);
      await WristbandOrderItem.bulkCreate(
        validItems.map(i => ({ order_id: orderId, wristband_color_id: i.wristband_color_id, quantity: i.quantity }))
      );
    }

    const fullOrder = await WristbandOrder.findByPk(orderId, {
      include: [{ model: WristbandOrderItem, as: 'items', include: [{ model: WristbandColor, as: 'color' }] }],
    });

    res.json({ order: fullOrder });
  } catch (error) {
    console.error('updateWristbandOrder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteWristbandOrder = async (req: AuthRequest, res: Response) => {
  try {
    const orderId = parseInt(String(req.params.id));
    const order = await WristbandOrder.findOne({
      where: { id: orderId },
      include: [{ model: Event, as: 'event', attributes: ['brand_id'] }],
    }) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.event?.brand_id !== req.user.brand_id) return res.status(403).json({ error: 'Forbidden' });

    if (order.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft orders can be deleted' });
    }

    if (order.design_url) {
      try {
        const key = order.design_url.split('/').pop()!;
        await deleteFromS3({ Bucket: process.env.S3_BUCKET!, Key: key });
      } catch (e) {
        console.warn('Could not delete design from S3:', e);
      }
    }

    await WristbandOrderItem.destroy({ where: { order_id: orderId } });
    await order.destroy();

    res.json({ message: 'Order deleted' });
  } catch (error) {
    console.error('deleteWristbandOrder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
