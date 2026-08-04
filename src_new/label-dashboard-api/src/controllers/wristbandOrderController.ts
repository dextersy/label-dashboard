import { Request, Response } from 'express';
import multer from 'multer';
import { WristbandOrder, WristbandOrderItem, WristbandColor, EventWristbandSettings, Event } from '../models';
import { uploadToS3, deleteFromS3 } from '../utils/s3Service';
import { sendEmail, sendWristbandOrderStatusEmail } from '../utils/emailService';
import { getBrandFrontendUrl } from '../utils/brandUtils';
import User from '../models/User';

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

// ─── Helpers ───────────────────────────────────────────────────────────────

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Email notification ────────────────────────────────────────────────────

async function sendWristbandOrderNotification(order: any, event: any): Promise<void> {
  try {
    const parentBrandId = parseInt(process.env.TICKETING_PARENT_BRAND_ID || '0');
    if (!parentBrandId) return;

    const admins = await User.findAll({ where: { brand_id: parentBrandId, is_admin: true }, attributes: ['email_address'] });
    const recipients = admins.map((u: any) => u.email_address).filter(Boolean);
    if (!recipients.length) return;

    const frontendUrl = await getBrandFrontendUrl(parentBrandId);
    const manageUrl = `${frontendUrl}/campaigns/events/wristband-order-review?order_id=${order.id}`;

    const items = (order.items ?? []) as any[];
    const itemRows = items
      .filter((i: any) => i.quantity > 0)
      .map((i: any) => `<tr><td style="padding:4px 8px">${escapeHtml(i.color?.label ?? i.wristband_color_id)}</td><td style="padding:4px 8px;text-align:right">${escapeHtml(i.quantity)}</td></tr>`)
      .join('');
    const totalQty = items.reduce((s: number, i: any) => s + i.quantity, 0);
    const totalPrice = ((totalQty / 10) * 35).toFixed(2);

    let deliveryHtml = '';
    const settings = await EventWristbandSettings.findOne({ where: { event_id: event.id } }) as any;
    if (settings?.delivery_name || settings?.delivery_street) {
      const parts = [
        settings.delivery_name,
        settings.delivery_street,
        [settings.delivery_city, settings.delivery_country, settings.delivery_zip].filter(Boolean).join(', '),
        settings.delivery_phone,
      ].filter(Boolean).map(escapeHtml);
      deliveryHtml = `<p style="margin:16px 0 4px"><strong>Delivery Address:</strong></p><p style="margin:0;white-space:pre-line">${parts.join('\n')}</p>`;
    }

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 16px">New Wristband Order — Review Required</h2>
        <p><strong>Order ID:</strong> #${escapeHtml(order.id)}</p>
        <p><strong>Event:</strong> ${escapeHtml(event.title ?? event.name ?? event.id)}</p>
        <table style="border-collapse:collapse;width:100%;margin:12px 0">
          <thead><tr style="background:#f5f5f5">
            <th style="padding:4px 8px;text-align:left">Color</th>
            <th style="padding:4px 8px;text-align:right">Qty</th>
          </tr></thead>
          <tbody>${itemRows}</tbody>
          <tfoot><tr style="font-weight:bold;border-top:1px solid #ddd">
            <td style="padding:4px 8px">Total</td>
            <td style="padding:4px 8px;text-align:right">${totalQty} — ₱${totalPrice}</td>
          </tr></tfoot>
        </table>
        ${deliveryHtml}
        <div style="margin-top:24px">
          <a href="${manageUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">Manage Order</a>
        </div>
      </div>
    `;

    await sendEmail(recipients, `Wristband Order #${order.id} Pending Confirmation`, html, parentBrandId);
  } catch (err) {
    console.error('sendWristbandOrderNotification error:', err);
  }
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

    if (order.status === 'placed') {
      sendWristbandOrderNotification(fullOrder, event);
    }

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

    const previousStatus = order.status;
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

    const newStatus = (status || order.status) as string;
    if (previousStatus !== 'placed' && newStatus === 'placed') {
      const evt = await Event.findByPk((order as any).event_id);
      sendWristbandOrderNotification(fullOrder, evt);
    }

    res.json({ order: fullOrder });
  } catch (error) {
    console.error('updateWristbandOrder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getWristbandOrder = async (req: AuthRequest, res: Response) => {
  try {
    const parentBrandId = parseInt(process.env.TICKETING_PARENT_BRAND_ID || '0');
    if (!parentBrandId || req.user.brand_id !== parentBrandId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const orderId = parseInt(String(req.params.id));
    const order = await WristbandOrder.findByPk(orderId, {
      include: [
        { model: WristbandOrderItem, as: 'items', include: [{ model: WristbandColor, as: 'color' }] },
        { model: Event, as: 'event', attributes: ['id', 'title', 'brand_id'] },
      ],
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ order });
  } catch (error) {
    console.error('getWristbandOrder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const confirmWristbandOrder = async (req: AuthRequest, res: Response) => {
  try {
    const parentBrandId = parseInt(process.env.TICKETING_PARENT_BRAND_ID || '0');
    if (!parentBrandId || req.user.brand_id !== parentBrandId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const orderId = parseInt(String(req.params.id));
    const order = await WristbandOrder.findByPk(orderId, {
      include: [
        { model: WristbandOrderItem, as: 'items', include: [{ model: WristbandColor, as: 'color' }] },
        { model: Event, as: 'event' },
      ],
    }) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'placed') return res.status(400).json({ error: 'Only placed orders can be confirmed' });
    await order.update({ status: 'confirmed' });
    const orgFrontendUrl = await getBrandFrontendUrl(order.event.brand_id).catch(() => null);
    if (orgFrontendUrl) {
      const payUrl = `${orgFrontendUrl}/campaigns/events/add-ons?tab=payment`;
      sendWristbandOrderStatusEmail(order, order.event, 'confirmed', payUrl);
    }
    res.json({ order });
  } catch (error) {
    console.error('confirmWristbandOrder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const rejectWristbandOrder = async (req: AuthRequest, res: Response) => {
  try {
    const parentBrandId = parseInt(process.env.TICKETING_PARENT_BRAND_ID || '0');
    if (!parentBrandId || req.user.brand_id !== parentBrandId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const orderId = parseInt(String(req.params.id));
    const order = await WristbandOrder.findByPk(orderId, {
      include: [
        { model: WristbandOrderItem, as: 'items', include: [{ model: WristbandColor, as: 'color' }] },
        { model: Event, as: 'event' },
      ],
    }) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'placed') return res.status(400).json({ error: 'Only placed orders can be rejected' });
    await order.update({ status: 'rejected' });
    const orgFrontendUrl = await getBrandFrontendUrl(order.event.brand_id).catch(() => null);
    if (orgFrontendUrl) {
      const wristbandUrl = `${orgFrontendUrl}/campaigns/events/add-ons`;
      sendWristbandOrderStatusEmail(order, order.event, 'rejected', wristbandUrl);
    }
    res.json({ order });
  } catch (error) {
    console.error('rejectWristbandOrder error:', error);
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
