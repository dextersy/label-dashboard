import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import multer from 'multer';
import { WristbandOrder, WristbandOrderItem, WristbandColor, Event, EventWristbandSettings, EventAddOnPayment } from '../models';
import { uploadToS3, deleteFromS3, getS3ObjectStream } from '../utils/s3Service';
import {
  sendPublicWristbandOrderCreatedEmail,
  sendWristbandOrderPlacedAdminEmail,
  sendWristbandOrderStatusEmail,
  sendPublicWristbandOrderSavedReminderEmail,
} from '../utils/emailService';
import { PaymentService } from '../utils/paymentService';
import { createNotificationsForUsers, getBrandAdminUserIds } from '../utils/notificationService';

export const PRICE_PER_10 = 45;

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local[0]}***@${domain}`;
}

function maskOrder(order: any): any {
  if (!order) return order;
  const plain = order.toJSON ? order.toJSON() : { ...order };
  if (plain.customer_email) plain.customer_email = maskEmail(plain.customer_email);
  if (plain.customer_name) plain.customer_name = plain.customer_name.split(' ')[0]; // first name only
  return plain;
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

function buildOrderIncludes() {
  return [
    { model: WristbandOrderItem, as: 'items', include: [{ model: WristbandColor, as: 'color' }] },
    { model: Event, as: 'event', attributes: ['id'], include: [{ model: EventWristbandSettings, as: 'wristbandSettings' }] },
  ];
}

async function withPaymentStatus(order: any): Promise<any> {
  if (!order) return order;
  const addOnPayment = await EventAddOnPayment.findOne({ where: { event_id: order.event_id, method: 'paymongo' } });
  const paymentStatus: 'unpaid' | 'pending' | 'paid' =
    !addOnPayment ? 'unpaid'
    : (addOnPayment as any).status === 'succeeded' ? 'paid'
    : 'pending';
  return { ...(order.toJSON ? order.toJSON() : order), payment_status: paymentStatus };
}

// GET /api/public/wristband-colors
export const getPublicWristbandColors = async (_req: Request, res: Response) => {
  try {
    const colors = await WristbandColor.findAll({ order: [['sort_order', 'ASC']] });
    res.json({ colors });
  } catch (error) {
    console.error('getPublicWristbandColors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/public/wristband-orders
// Step 1 of wizard: create draft order with name + email, send manage link by email
export const createPublicWristbandOrder = async (req: Request, res: Response) => {
  try {
    const { name, email } = req.body;
    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'name and email are required' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Create a dummy event to anchor the order (brand_id=null keeps it invisible in all brand-filtered queries)
    const dummyEvent = await (Event as any).create({
      brand_id: null,
      title: 'Public Wristband Order',
      date_and_time: new Date('2099-01-01T00:00:00Z'),
      venue: 'N/A',
      ticket_price: 0,
      verification_pin: Math.random().toString(36).substring(2, 8).toUpperCase(),
      verification_link: randomUUID(),
      ticketing_enabled: false,
      listed_on_ticketing: false,
      status: 'draft',
    });

    await EventWristbandSettings.create({ event_id: dummyEvent.id });

    let order: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        order = await WristbandOrder.create({
          event_id: dummyEvent.id,
          is_public: true,
          public_token: randomUUID(),
          customer_name: name.trim(),
          customer_email: email.trim().toLowerCase(),
          status: 'draft',
        });
        break;
      } catch (err: any) {
        if (attempt === 2 || !err?.message?.includes('unique')) throw err;
      }
    }
    const token = (order as any).public_token;

    sendPublicWristbandOrderCreatedEmail(order).catch(console.error);

    res.status(201).json({ token });
  } catch (error) {
    console.error('createPublicWristbandOrder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/public/wristband-orders/:token
export const getPublicWristbandOrder = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const order = await WristbandOrder.findOne({
      where: { public_token: token, is_public: true },
      include: buildOrderIncludes(),
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ order: maskOrder(await withPaymentStatus(order)) });
  } catch (error) {
    console.error('getPublicWristbandOrder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /api/public/wristband-orders/:token
// Update order details (items, delivery address, design, notes, disclaimer)
export const updatePublicWristbandOrder = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const order = await WristbandOrder.findOne({
      where: { public_token: token, is_public: true },
    }) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status !== 'draft' && order.status !== 'rejected') {
      return res.status(400).json({ error: 'Only draft or rejected orders can be edited' });
    }

    const {
      items, disclaimer_acknowledged, notes,
      design_x, design_y, design_width, design_height, canvas_width,
      delivery_name, delivery_street, delivery_city, delivery_country, delivery_zip, delivery_phone,
    } = req.body;

    const parsedItems: { wristband_color_id: number; quantity: number }[] =
      typeof items === 'string' ? JSON.parse(items) : items;

    if (parsedItems && Array.isArray(parsedItems)) {
      const itemError = await validateItems(parsedItems);
      if (itemError) return res.status(400).json({ error: itemError });
    }

    // Update delivery in EventWristbandSettings
    const hasDelivery = [delivery_name, delivery_street, delivery_city, delivery_country, delivery_zip, delivery_phone]
      .some(v => v !== undefined);
    if (hasDelivery) {
      const settings = await EventWristbandSettings.findOne({ where: { event_id: order.event_id } }) as any;
      await EventWristbandSettings.upsert({
        event_id: order.event_id,
        delivery_name: delivery_name !== undefined ? delivery_name : settings?.delivery_name ?? null,
        delivery_street: delivery_street !== undefined ? delivery_street : settings?.delivery_street ?? null,
        delivery_city: delivery_city !== undefined ? delivery_city : settings?.delivery_city ?? null,
        delivery_country: delivery_country !== undefined ? delivery_country : settings?.delivery_country ?? null,
        delivery_zip: delivery_zip !== undefined ? delivery_zip : settings?.delivery_zip ?? null,
        delivery_phone: delivery_phone !== undefined ? delivery_phone : settings?.delivery_phone ?? null,
      });
    }

    let designUrl = order.design_url;
    if (req.file) {
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
      design_url: designUrl,
      design_x: design_x != null ? parseFloat(design_x) : order.design_x,
      design_y: design_y != null ? parseFloat(design_y) : order.design_y,
      design_width: design_width != null ? parseFloat(design_width) : order.design_width,
      design_height: design_height != null ? parseFloat(design_height) : order.design_height,
      canvas_width: canvas_width != null ? parseFloat(canvas_width) : order.canvas_width,
      disclaimer_acknowledged: disclaimer_acknowledged === true || disclaimer_acknowledged === 'true',
      notes: notes !== undefined ? notes : order.notes,
    });

    if (parsedItems && Array.isArray(parsedItems)) {
      await WristbandOrderItem.destroy({ where: { order_id: order.id } });
      const validItems = parsedItems.filter(i => i.quantity > 0);
      await WristbandOrderItem.bulkCreate(
        validItems.map(i => ({ order_id: order.id, wristband_color_id: i.wristband_color_id, quantity: i.quantity }))
      );
    }

    const fullOrder = await WristbandOrder.findOne({
      where: { public_token: token },
      include: buildOrderIncludes(),
    });
    res.json({ order: await withPaymentStatus(fullOrder) });
  } catch (error) {
    console.error('updatePublicWristbandOrder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/public/wristband-orders/:token/place
// Transition draft/rejected → placed
export const placePublicWristbandOrder = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const order = await WristbandOrder.findOne({
      where: { public_token: token, is_public: true },
      include: buildOrderIncludes(),
    }) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status !== 'draft' && order.status !== 'rejected') {
      return res.status(400).json({ error: 'Only draft or rejected orders can be placed' });
    }

    const items = (order.items ?? []) as any[];
    const totalQty = items.reduce((s: number, i: any) => s + i.quantity, 0);
    if (totalQty === 0) return res.status(400).json({ error: 'Order must have at least one item' });
    if (!order.disclaimer_acknowledged) return res.status(400).json({ error: 'Disclaimer must be acknowledged' });

    await order.update({ status: 'placed' });

    const parentBrandId = parseInt(process.env.TICKETING_PARENT_BRAND_ID || '0');
    if (parentBrandId) {
      sendWristbandOrderPlacedAdminEmail(order, parentBrandId, PRICE_PER_10).catch(console.error);
      getBrandAdminUserIds(parentBrandId).then(adminIds =>
        createNotificationsForUsers(
          adminIds, parentBrandId, 'wristband_order_placed',
          `New public wristband order: #${order.id}`,
          `Order #${order.id} placed — review required`,
          `/campaigns/events/wristband-order-review?order_id=${order.id}`
        )
      ).catch(console.error);
    }
    const placedCtaUrl = `${process.env.TICKETING_FRONTEND_URL}/wristband-order/${order.public_token}`;
    sendWristbandOrderStatusEmail(order, 'placed', placedCtaUrl).catch(console.error);

    const fullOrder = await WristbandOrder.findOne({
      where: { public_token: token },
      include: buildOrderIncludes(),
    });
    res.json({ order: await withPaymentStatus(fullOrder) });
  } catch (error) {
    console.error('placePublicWristbandOrder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/public/wristband-orders/:token/payment/initiate
// Create Paymongo checkout session and EventAddOnPayment for a confirmed public order
export const initiatePublicWristbandPayment = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const order = await WristbandOrder.findOne({
      where: { public_token: token, is_public: true },
      include: [{ model: WristbandOrderItem, as: 'items' }],
    }) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'confirmed') return res.status(400).json({ error: 'Order must be confirmed before payment' });
    const existingPayment = await EventAddOnPayment.findOne({ where: { event_id: order.event_id, method: 'paymongo' } });
    if ((existingPayment as any)?.status === 'succeeded') return res.status(400).json({ error: 'Order has already been paid' });

    const items = (order.items ?? []) as any[];
    const totalQty = items.reduce((s: number, i: any) => s + i.quantity, 0);
    const shippingFee = order.shipping_fee != null ? parseFloat(String(order.shipping_fee)) : 0;
    const discount = order.discount != null ? parseFloat(String(order.discount)) : 0;
    const totalAmount = Math.max(0, (totalQty / 10) * PRICE_PER_10 + shippingFee - discount);

    if (totalAmount <= 0) return res.status(400).json({ error: 'Order total must be greater than zero' });

    const frontendUrl = process.env.TICKETING_FRONTEND_URL!;
    const manageUrl = `${frontendUrl}/wristband-order/${token}`;

    const paymentService = new PaymentService();
    const checkoutSession = await paymentService.createCheckoutSession({
      line_items: [{
        name: `Wristband Order #${order.id}`,
        amount: Math.round(totalAmount * 100),
        currency: 'PHP',
        quantity: 1,
      }],
      payment_method_types: ['card', 'gcash', 'paymaya', 'grab_pay', 'dob', 'dob_ubp', 'qrph'],
      success_url: `${manageUrl}?payment_status=success`,
      cancel_url: `${manageUrl}?payment_status=cancelled`,
      description: `Wristband order #${order.id}`,
    });

    if (!checkoutSession) {
      return res.status(502).json({ error: 'Failed to create payment session' });
    }

    // Store checkout details on EventAddOnPayment (unified with logged-in flow)
    await EventAddOnPayment.create({
      event_id: order.event_id,
      amount: totalAmount,
      method: 'paymongo',
      status: 'pending',
      checkout_key: checkoutSession.attributes.client_key,
      checkout_session_id: checkoutSession.id,
    } as any);

    res.status(201).json({
      checkout_url: checkoutSession.attributes.checkout_url,
    });
  } catch (error) {
    console.error('initiatePublicWristbandPayment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/public/wristband-orders/:token/remind
// Re-send the manage link to the buyer's email (save draft reminder)
export const remindPublicWristbandOrder = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const order = await WristbandOrder.findOne({
      where: { public_token: token, is_public: true },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'draft' && order.status !== 'rejected') {
      return res.status(400).json({ error: 'Reminder can only be sent for draft or rejected orders' });
    }

    sendPublicWristbandOrderSavedReminderEmail(order).catch(console.error);
    res.json({ message: 'Reminder sent' });
  } catch (error) {
    console.error('remindPublicWristbandOrder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/public/wristband-orders/:token/design
// Proxy S3 design image
export const proxyPublicWristbandDesign = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const order = await WristbandOrder.findOne({
      where: { public_token: token, is_public: true },
      attributes: ['id', 'design_url'],
    });
    if (!order?.design_url) return res.status(404).json({ error: 'Design not found' });

    const key = order.design_url.split('/').pop() as string;
    const { Body, ContentType, ContentLength } = await getS3ObjectStream({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
    });

    res.setHeader('Content-Type', ContentType || 'image/png');
    if (ContentLength) res.setHeader('Content-Length', ContentLength);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    Body.pipe(res);
  } catch (error) {
    console.error('proxyPublicWristbandDesign error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
