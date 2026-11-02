import { Request, Response } from 'express';
import multer from 'multer';
import { WristbandOrder, WristbandOrderItem, WristbandColor, EventWristbandSettings, Event, Brand } from '../models';
import { findEventForUser, resolveEventRole } from '../utils/eventAccess';
import { uploadToS3, deleteFromS3, getS3ObjectStream } from '../utils/s3Service';
import { sendEmail, sendWristbandOrderStatusEmail } from '../utils/emailService';
import { getBrandFrontendUrl } from '../utils/brandUtils';
import { createNotificationsForUsers, getBrandAdminUserIds } from '../utils/notificationService';
import User from '../models/User';

interface AuthRequest extends Request {
  user?: any;
}

async function getOrgAddOnsUrl(eventId: number, orgBrandId: number, suffix = ''): Promise<string | null> {
  const ticketingParentId = process.env.TICKETING_PARENT_BRAND_ID ? parseInt(process.env.TICKETING_PARENT_BRAND_ID) : null;
  let frontendUrl: string | null = null;
  let addOnsPath: string;
  if (ticketingParentId != null) {
    const orgBrand = await Brand.findByPk(orgBrandId, { attributes: ['parent_brand'] });
    const isTicketingOrganizer = orgBrand && (orgBrand as any).parent_brand === ticketingParentId;
    if (isTicketingOrganizer) {
      frontendUrl = process.env.TICKETING_FRONTEND_URL ?? null;
      addOnsPath = `/app/events/${eventId}/add-ons`;
    } else {
      frontendUrl = await getBrandFrontendUrl(orgBrandId).catch(() => null);
      addOnsPath = `/campaigns/events/add-ons?event=${eventId}`;
    }
  } else {
    frontendUrl = await getBrandFrontendUrl(orgBrandId).catch(() => null);
    addOnsPath = `/campaigns/events/add-ons?event=${eventId}`;
  }
  if (!frontendUrl) return null;
  const connector = suffix && addOnsPath.includes('?') ? suffix.replace(/^\?/, '&') : suffix;
  return `${frontendUrl}${addOnsPath}${connector}`;
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

// ─── Auth helper ───────────────────────────────────────────────────────────

// Returns the brand ID of the wristband order owner/approver for a given organizer brand:
// the organizer's parent brand, or the organizer itself if it has no parent.
async function getOwnerBrandId(organizerBrandId: number): Promise<number> {
  const orgBrand = await Brand.findByPk(organizerBrandId, { attributes: ['parent_brand'] });
  return orgBrand?.parent_brand ?? organizerBrandId;
}

// ─── Email notification ────────────────────────────────────────────────────

async function sendWristbandOrderNotification(order: any, event: any): Promise<void> {
  try {
    const ownerBrandId = await getOwnerBrandId(event.brand_id);

    const admins = await User.findAll({ where: { brand_id: ownerBrandId, is_admin: true }, attributes: ['email_address'] });
    const recipients = admins.map((u: any) => u.email_address).filter(Boolean);
    if (!recipients.length) return;

    const frontendUrl = await getBrandFrontendUrl(ownerBrandId);
    const manageUrl = `${frontendUrl}/campaigns/events/wristband-order-review?order_id=${order.id}`;

    const items = (order.items ?? []) as any[];
    const itemRows = items
      .filter((i: any) => i.quantity > 0)
      .map((i: any) => `<tr><td style="padding:4px 8px">${escapeHtml(i.color?.label ?? i.wristband_color_id)}</td><td style="padding:4px 8px;text-align:right">${escapeHtml(i.quantity)}</td></tr>`)
      .join('');
    const totalQty = items.reduce((s: number, i: any) => s + i.quantity, 0);
    const shippingFeeN = order.shipping_fee != null ? parseFloat(String(order.shipping_fee)) : 0;
    const discountN = order.discount != null ? parseFloat(String(order.discount)) : 0;
    const totalPrice = Math.max(0, (totalQty / 10) * 35 + shippingFeeN - discountN).toFixed(2);

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

    await sendEmail(recipients, `Wristband Order #${order.id} Pending Confirmation`, html, ownerBrandId);
  } catch (err) {
    console.error('sendWristbandOrderNotification error:', err);
  }
}

// ─── Wristband Settings ────────────────────────────────────────────────────

export const getWristbandSettings = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.query.event_id as string);
    if (!eventId) return res.status(400).json({ error: 'event_id is required' });

    const event = await findEventForUser(req, eventId);
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

    const event = await findEventForUser(req, eventId);
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

    const role = await resolveEventRole(req, eventId);
    if (role !== 'owner' && role !== 'manager') return res.status(403).json({ error: 'Manager access required' });
    const event = await Event.findByPk(eventId);
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

    const role = await resolveEventRole(req, eventId);
    if (role !== 'owner' && role !== 'manager') return res.status(403).json({ error: 'Manager access required' });
    const event = await Event.findByPk(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (new Date((event as any).date_and_time) < new Date()) {
      return res.status(400).json({ error: 'This event has already taken place. Orders can no longer be edited.' });
    }

    const { status, disclaimer_acknowledged, items, design_x, design_y, design_width, design_height, canvas_width } = req.body;
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
      canvas_width: canvas_width != null ? parseFloat(canvas_width) : null,
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
      getOwnerBrandId(event.brand_id).then(ownerBrandId =>
        getBrandAdminUserIds(ownerBrandId).then(adminIds =>
          createNotificationsForUsers(
            adminIds, ownerBrandId, 'wristband_order_placed',
            `New wristband order: ${event.title ?? `Event #${eventId}`}`,
            `Order #${order.id} placed — review required`,
            `/campaigns/events/wristband-order-review?order_id=${order.id}`
          )
        )
      ).catch(console.error);
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
      include: [{ model: Event, as: 'event', attributes: ['id', 'brand_id'] }],
    }) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const updateRole = await resolveEventRole(req, order.event?.id);
    if (updateRole !== 'owner' && updateRole !== 'manager') return res.status(403).json({ error: 'Manager access required' });

    if (order.status !== 'draft' && order.status !== 'rejected') {
      return res.status(400).json({ error: 'Only draft or rejected orders can be edited' });
    }

    const updateEvent = await Event.findByPk((order as any).event_id);
    if (updateEvent && new Date((updateEvent as any).date_and_time) < new Date()) {
      return res.status(400).json({ error: 'This event has already taken place. Orders can no longer be edited.' });
    }

    const previousStatus = order.status;
    const { status, disclaimer_acknowledged, items, design_x, design_y, design_width, design_height, canvas_width } = req.body;
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
      canvas_width: canvas_width != null ? parseFloat(canvas_width) : order.canvas_width,
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
      if (!(evt as any)?.brand_id) return;
      getOwnerBrandId((evt as any).brand_id).then(ownerBrandId =>
        getBrandAdminUserIds(ownerBrandId).then(adminIds =>
          createNotificationsForUsers(
            adminIds, ownerBrandId, 'wristband_order_placed',
            `New wristband order: ${(evt as any)?.title ?? `Event #${(order as any).event_id}`}`,
            `Order #${orderId} placed — review required`,
            `/campaigns/events/wristband-order-review?order_id=${orderId}`
          )
        )
      ).catch(console.error);
    }

    res.json({ order: fullOrder });
  } catch (error) {
    console.error('updateWristbandOrder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getWristbandOrder = async (req: AuthRequest, res: Response) => {
  try {
    const orderId = parseInt(String(req.params.id));
    const order = await WristbandOrder.findByPk(orderId, {
      include: [
        { model: WristbandOrderItem, as: 'items', include: [{ model: WristbandColor, as: 'color' }] },
        {
          model: Event, as: 'event', attributes: ['id', 'title', 'brand_id'],
          include: [{ model: EventWristbandSettings, as: 'wristbandSettings' }],
        },
      ],
    }) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const ownerBrandId = await getOwnerBrandId(order.event.brand_id);
    if (req.user.brand_id !== ownerBrandId) return res.status(403).json({ error: 'Forbidden' });
    res.json({ order });
  } catch (error) {
    console.error('getWristbandOrder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const confirmWristbandOrder = async (req: AuthRequest, res: Response) => {
  try {
    const orderId = parseInt(String(req.params.id));
    const order = await WristbandOrder.findByPk(orderId, {
      include: [
        { model: WristbandOrderItem, as: 'items', include: [{ model: WristbandColor, as: 'color' }] },
        { model: Event, as: 'event' },
      ],
    }) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const ownerBrandId = await getOwnerBrandId(order.event.brand_id);
    if (req.user.brand_id !== ownerBrandId) return res.status(403).json({ error: 'Forbidden' });
    if (order.status !== 'placed') return res.status(400).json({ error: 'Only placed orders can be confirmed' });
    await order.update({ status: 'confirmed' });
    const payUrl = await getOrgAddOnsUrl(order.event_id, order.event.brand_id, '?tab=payment');
    if (payUrl) sendWristbandOrderStatusEmail(order, order.event, 'confirmed', payUrl);
    getBrandAdminUserIds(order.event.brand_id).then(orgAdminIds =>
      createNotificationsForUsers(
        orgAdminIds, order.event.brand_id, 'wristband_order_accepted',
        `Wristband order accepted: ${order.event.title ?? `Event #${order.event_id}`}`,
        `Order #${orderId} has been accepted. You can now proceed to payment.`,
        `/campaigns/events/add-ons?event=${order.event_id}&tab=payment`
      )
    ).catch(console.error);
    res.json({ order });
  } catch (error) {
    console.error('confirmWristbandOrder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const rejectWristbandOrder = async (req: AuthRequest, res: Response) => {
  try {
    const orderId = parseInt(String(req.params.id));
    const order = await WristbandOrder.findByPk(orderId, {
      include: [
        { model: WristbandOrderItem, as: 'items', include: [{ model: WristbandColor, as: 'color' }] },
        { model: Event, as: 'event' },
      ],
    }) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const ownerBrandId = await getOwnerBrandId(order.event.brand_id);
    if (req.user.brand_id !== ownerBrandId) return res.status(403).json({ error: 'Forbidden' });
    if (order.status !== 'placed') return res.status(400).json({ error: 'Only placed orders can be rejected' });
    await order.update({ status: 'rejected' });
    const wristbandUrl = await getOrgAddOnsUrl(order.event_id, order.event.brand_id);
    if (wristbandUrl) sendWristbandOrderStatusEmail(order, order.event, 'rejected', wristbandUrl);
    getBrandAdminUserIds(order.event.brand_id).then(orgAdminIds =>
      createNotificationsForUsers(
        orgAdminIds, order.event.brand_id, 'wristband_order_rejected',
        `Wristband order rejected: ${order.event.title ?? `Event #${order.event_id}`}`,
        `Order #${orderId} was rejected. Please review and re-submit.`,
        `/campaigns/events/add-ons?event=${order.event_id}`
      )
    ).catch(console.error);
    res.json({ order });
  } catch (error) {
    console.error('rejectWristbandOrder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markWristbandOrderAsShipped = async (req: AuthRequest, res: Response) => {
  try {
    const orderId = parseInt(String(req.params.id));
    const order = await WristbandOrder.findByPk(orderId, {
      include: [
        { model: WristbandOrderItem, as: 'items', include: [{ model: WristbandColor, as: 'color' }] },
        { model: Event, as: 'event' },
      ],
    }) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const ownerBrandId = await getOwnerBrandId(order.event.brand_id);
    if (req.user.brand_id !== ownerBrandId) return res.status(403).json({ error: 'Forbidden' });
    if (order.status !== 'confirmed') return res.status(400).json({ error: 'Only confirmed orders can be marked as shipped' });
    const { tracking_url } = req.body;
    await order.update({ status: 'shipped', tracking_url: tracking_url || null });
    const orderUrl = await getOrgAddOnsUrl(order.event_id, order.event.brand_id);
    if (orderUrl) sendWristbandOrderStatusEmail(order, order.event, 'shipped', orderUrl, tracking_url || null);
    getBrandAdminUserIds(order.event.brand_id).then(orgAdminIds =>
      createNotificationsForUsers(
        orgAdminIds, order.event.brand_id, 'wristband_order_shipped',
        `Wristband order shipped: ${order.event.title ?? `Event #${order.event_id}`}`,
        `Order #${orderId} has been shipped and is on its way.`,
        `/campaigns/events/add-ons?event=${order.event_id}`
      )
    ).catch(console.error);
    res.json({ order });
  } catch (error) {
    console.error('markWristbandOrderAsShipped error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteWristbandOrder = async (req: AuthRequest, res: Response) => {
  try {
    const orderId = parseInt(String(req.params.id));
    const order = await WristbandOrder.findOne({
      where: { id: orderId },
      include: [{ model: Event, as: 'event', attributes: ['id', 'brand_id'] }],
    }) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const deleteRole = await resolveEventRole(req, order.event?.id);
    if (deleteRole !== 'owner' && deleteRole !== 'manager') return res.status(403).json({ error: 'Manager access required' });

    if (order.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft orders can be deleted' });
    }

    const deleteEvent = await Event.findByPk((order as any).event_id);
    if (deleteEvent && new Date((deleteEvent as any).date_and_time) < new Date()) {
      return res.status(400).json({ error: 'This event has already taken place. Orders can no longer be edited.' });
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

export const setWristbandShippingFee = async (req: AuthRequest, res: Response) => {
  try {
    const orderId = parseInt(String(req.params.id));
    const order = await WristbandOrder.findByPk(orderId, {
      include: [{ model: Event, as: 'event', attributes: ['id', 'brand_id'] }],
    }) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const ownerBrandId = await getOwnerBrandId(order.event.brand_id);
    if (req.user.brand_id !== ownerBrandId) return res.status(403).json({ error: 'Forbidden' });

    const { shipping_fee } = req.body;
    if (shipping_fee !== null && shipping_fee !== undefined) {
      const fee = parseFloat(shipping_fee);
      if (isNaN(fee) || fee < 0) {
        return res.status(400).json({ error: 'shipping_fee must be a non-negative number' });
      }
      await order.update({ shipping_fee: fee });
    } else {
      await order.update({ shipping_fee: null });
    }

    const updated = await WristbandOrder.findByPk(orderId, {
      include: [
        { model: WristbandOrderItem, as: 'items', include: [{ model: WristbandColor, as: 'color' }] },
        {
          model: Event, as: 'event', attributes: ['id', 'title', 'brand_id'],
          include: [{ model: EventWristbandSettings, as: 'wristbandSettings' }],
        },
      ],
    });
    res.json({ order: updated });
  } catch (error) {
    console.error('setWristbandShippingFee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const setWristbandDiscount = async (req: AuthRequest, res: Response) => {
  try {
    const orderId = parseInt(String(req.params.id));
    const order = await WristbandOrder.findByPk(orderId, {
      include: [{ model: Event, as: 'event', attributes: ['id', 'brand_id'] }],
    }) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const ownerBrandId = await getOwnerBrandId(order.event.brand_id);
    if (req.user.brand_id !== ownerBrandId) return res.status(403).json({ error: 'Forbidden' });

    const { discount } = req.body;
    if (discount !== null && discount !== undefined) {
      const amount = parseFloat(discount);
      if (isNaN(amount) || amount < 0) {
        return res.status(400).json({ error: 'discount must be a non-negative number' });
      }
      await order.update({ discount: amount });
    } else {
      await order.update({ discount: null });
    }

    const updated = await WristbandOrder.findByPk(orderId, {
      include: [
        { model: WristbandOrderItem, as: 'items', include: [{ model: WristbandColor, as: 'color' }] },
        {
          model: Event, as: 'event', attributes: ['id', 'title', 'brand_id'],
          include: [{ model: EventWristbandSettings, as: 'wristbandSettings' }],
        },
      ],
    });
    res.json({ order: updated });
  } catch (error) {
    console.error('setWristbandDiscount error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const proxyWristbandDesign = async (req: AuthRequest, res: Response) => {
  try {
    const orderId = parseInt(String(req.params.id));
    const order = await WristbandOrder.findByPk(orderId, {
      attributes: ['id', 'design_url'],
      include: [{ model: Event, as: 'event', attributes: ['id', 'brand_id'] }],
    }) as any;
    if (!order?.design_url) return res.status(404).json({ error: 'Design not found' });
    const ownerBrandId = await getOwnerBrandId(order.event.brand_id);
    if (req.user.brand_id !== ownerBrandId) return res.status(403).json({ error: 'Forbidden' });

    const key = order.design_url.split('/').pop() as string;
    const { Body, ContentType, ContentLength } = await getS3ObjectStream({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
    });

    res.setHeader('Content-Type', ContentType || 'image/png');
    if (ContentLength) res.setHeader('Content-Length', ContentLength);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    Body.pipe(res);
  } catch (error) {
    console.error('proxyWristbandDesign error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
