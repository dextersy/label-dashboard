import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import multer from 'multer';
import PDFDocument from 'pdfkit';
import { WristbandOrder, WristbandOrderItem, WristbandColor, Event, EventWristbandSettings, EventAddOnPayment, Brand } from '../models';
import { uploadToS3, deleteFromS3, getS3ObjectStream } from '../utils/s3Service';
import { fetchImageBuffer, lerpHex, drawGradientRect, formatMoney, fmtShort, drawDot, hairline } from '../utils/pdfUtils';
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
      billing_same_as_shipping, billing_name, billing_street, billing_city, billing_country, billing_zip,
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

    const isSameAsShipping = billing_same_as_shipping !== undefined
      ? (billing_same_as_shipping === true || billing_same_as_shipping === 'true')
      : order.billing_same_as_shipping;

    await order.update({
      design_url: designUrl,
      design_x: design_x != null ? parseFloat(design_x) : order.design_x,
      design_y: design_y != null ? parseFloat(design_y) : order.design_y,
      design_width: design_width != null ? parseFloat(design_width) : order.design_width,
      design_height: design_height != null ? parseFloat(design_height) : order.design_height,
      canvas_width: canvas_width != null ? parseFloat(canvas_width) : order.canvas_width,
      disclaimer_acknowledged: disclaimer_acknowledged === true || disclaimer_acknowledged === 'true',
      notes: notes !== undefined ? notes : order.notes,
      billing_same_as_shipping: isSameAsShipping,
      billing_name: isSameAsShipping ? null : (billing_name !== undefined ? billing_name : order.billing_name),
      billing_street: isSameAsShipping ? null : (billing_street !== undefined ? billing_street : order.billing_street),
      billing_city: isSameAsShipping ? null : (billing_city !== undefined ? billing_city : order.billing_city),
      billing_country: isSameAsShipping ? null : (billing_country !== undefined ? billing_country : order.billing_country),
      billing_zip: isSameAsShipping ? null : (billing_zip !== undefined ? billing_zip : order.billing_zip),
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
      include: [
        { model: WristbandOrderItem, as: 'items' },
        { model: Event, as: 'event', attributes: ['id'], include: [{ model: EventWristbandSettings, as: 'wristbandSettings' }] },
      ],
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
      billing: (() => {
        const settings = order.event?.wristbandSettings ?? null;
        const usesShipping = order.billing_same_as_shipping !== false;
        const line1    = usesShipping ? (settings?.delivery_street ?? '') : (order.billing_street ?? '');
        const city     = usesShipping ? (settings?.delivery_city    ?? '') : (order.billing_city    ?? '');
        const country  = usesShipping ? (settings?.delivery_country ?? '') : (order.billing_country ?? '');
        const postal   = usesShipping ? (settings?.delivery_zip     ?? '') : (order.billing_zip     ?? '');
        return {
          name:  order.customer_name  ?? '',
          email: order.customer_email ?? '',
          phone: settings?.delivery_phone ?? '',
          address: { line1, city, country, postal_code: postal },
        };
      })(),
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

// GET /api/public/wristband-orders/:token/invoice
// Generate and download a PDF invoice for a confirmed or paid public wristband order
async function buildPublicOrderInvoicePdfBuffer(order: any): Promise<Buffer | null> {
  try {
    const parentBrandId = parseInt(process.env.TICKETING_PARENT_BRAND_ID || '0');
    let issuerBrand: any = null;
    if (parentBrandId) {
      issuerBrand = await Brand.findByPk(parentBrandId, { attributes: ['id', 'brand_name', 'logo_url', 'brand_color', 'billing_company_name', 'billing_address', 'billing_tin'] });
    }

    const issuerOfficialName = issuerBrand?.billing_company_name ?? null;
    const issuerName    = issuerOfficialName ?? issuerBrand?.brand_name ?? 'Platform';
    const issuerLogoUrl = issuerBrand?.logo_url ?? null;
    const rawBrandColor = issuerBrand?.brand_color ?? null;
    const ACCENT        = rawBrandColor
      ? (rawBrandColor.startsWith('#') ? rawBrandColor : `#${rawBrandColor}`)
      : '#2D2D2D';

    const issuerAddress = issuerBrand?.billing_address ?? process.env.INVOICE_ISSUER_ADDRESS ?? null;
    const issuerTin     = issuerBrand?.billing_tin     ?? process.env.INVOICE_ISSUER_TIN     ?? null;
    const supportEmail  = process.env.INVOICE_SUPPORT_EMAIL ?? (process.env.FROM_EMAIL ?? null);

    let logoBuffer: Buffer | null = null;
    if (issuerLogoUrl) logoBuffer = await fetchImageBuffer(issuerLogoUrl);

    const items = order.items ?? [];
    const qty = items.reduce((s: number, i: any) => s + i.quantity, 0);
    const wristbandSubtotal = (qty / 10) * PRICE_PER_10;
    const shipping = parseFloat(order.shipping_fee ?? '0') || 0;
    const discount  = parseFloat(order.discount  ?? '0') || 0;
    const totalDue  = Math.max(0, wristbandSubtotal + shipping - discount);
    const isPaid    = order.payment_status === 'paid';

    const payment = await EventAddOnPayment.findOne({
      where: { event_id: order.event_id, status: 'succeeded' },
      order: [['createdAt', 'DESC']],
    });
    const paidOnDate = (payment as any)?.createdAt ?? null;
    const transactionRef = (payment as any)?.reference_number ?? '-';
    const paymentMethodDisplay = payment
      ? ((payment as any).method === 'balance' ? 'Label Balance' : 'Paymongo')
      : '-';

    const currency  = 'PHP';
    const issuedOn  = new Date();

    return await new Promise<Buffer>((resolve, reject) => {
      const doc    = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
      const chunks: Buffer[] = [];
      doc.on('data',  (chunk: Buffer) => chunks.push(chunk));
      doc.on('end',   () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      const PW = doc.page.width;
      const PH = doc.page.height;
      const ML = 48;
      const CW = PW - ML * 2;
      const INK   = '#1D1A2B';
      const MUTED = '#6B6780';
      const TINT  = '#F5F5F7';
      const ACCENT_LIGHT = lerpHex(ACCENT, '#FFFFFF', 0.35);

      // 1. Accent band
      drawGradientRect(doc, 0, 0, PW, 6, ACCENT, ACCENT_LIGHT);
      let curY = 6;

      // 2. Header row
      curY += 28;
      const headerRowY = curY;
      const logoSize   = 52;
      if (logoBuffer) {
        const lx = ML, ly = headerRowY, r = 8;
        doc.roundedRect(lx, ly, logoSize, logoSize, r).fill(ACCENT);
        doc.save()
          .moveTo(lx + r, ly).lineTo(lx + logoSize - r, ly)
          .quadraticCurveTo(lx + logoSize, ly, lx + logoSize, ly + r)
          .lineTo(lx + logoSize, ly + logoSize - r)
          .quadraticCurveTo(lx + logoSize, ly + logoSize, lx + logoSize - r, ly + logoSize)
          .lineTo(lx + r, ly + logoSize)
          .quadraticCurveTo(lx, ly + logoSize, lx, ly + logoSize - r)
          .lineTo(lx, ly + r)
          .quadraticCurveTo(lx, ly, lx + r, ly)
          .closePath().clip()
          .image(logoBuffer, lx, ly, { fit: [logoSize, logoSize], align: 'center', valign: 'center' })
          .restore();
      }
      const nameX    = logoBuffer ? ML + logoSize + 10 : ML;
      const nameMaxW = CW * 0.5;
      const nameFs   = 11, emailFs = 9, lineGap = 5;
      const textBlockH = supportEmail ? nameFs + lineGap + emailFs : nameFs;
      const nameY    = headerRowY + Math.round((logoSize - textBlockH) / 2);
      doc.font('Helvetica-Bold').fontSize(nameFs).fillColor(INK)
        .text(issuerName, nameX, nameY, { width: nameMaxW, lineBreak: false });
      if (supportEmail) {
        doc.font('Helvetica').fontSize(emailFs).fillColor(MUTED)
          .text(supportEmail, nameX, nameY + nameFs + lineGap, { width: nameMaxW, lineBreak: false });
      }

      const rightColW = CW * 0.45;
      const rightColX = PW - ML - rightColW;
      doc.font('Helvetica').fontSize(28).fillColor(INK)
        .text('Invoice', rightColX, headerRowY - 4, { width: rightColW, align: 'right', lineBreak: false });
      doc.font('Helvetica').fontSize(9).fillColor(MUTED)
        .text(`INV-PUB-${order.id}`, rightColX, headerRowY + 28, { width: rightColW, align: 'right', lineBreak: false });

      // Status pill
      const pillY     = headerRowY + 44;
      const pillLabel = isPaid ? 'Paid' : 'Unpaid';
      const pillBg    = isPaid ? '#E4F5EC' : '#FEF3C7';
      const pillFg    = isPaid ? '#17744B' : '#92400E';
      const dotR      = 3, dotGap = 5;
      doc.font('Helvetica-Bold').fontSize(9);
      const pillLabelW = doc.widthOfString(pillLabel);
      const pillPadX = 9, pillPadY = 4;
      const pillInnerW = dotR * 2 + dotGap + pillLabelW;
      const pillW = pillInnerW + pillPadX * 2;
      const pillH = 9 + pillPadY * 2;
      const pillX = PW - ML - pillW;
      doc.roundedRect(pillX, pillY, pillW, pillH, pillH / 2).fill(pillBg);
      drawDot(doc, pillX + pillPadX + dotR, pillY + pillH / 2, dotR, pillFg);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(pillFg)
        .text(pillLabel, pillX + pillPadX + dotR * 2 + dotGap, pillY + pillPadY, { width: pillLabelW, lineBreak: false });

      curY = Math.max(headerRowY + logoSize, pillY + pillH) + 24;

      // 3. Info row
      hairline(doc, ML, curY, CW);
      curY += 14;
      const colW2 = CW / 2, labelFs = 8, valueFs = 10;
      const infoCol = (x: number, label: string, lines: (string | null)[]): number => {
        doc.font('Helvetica').fontSize(labelFs).fillColor(MUTED)
          .text(label, x, curY, { width: colW2 - 6, lineBreak: false });
        let yy = curY + 16;
        for (const line of lines) {
          if (!line) continue;
          doc.font('Helvetica').fontSize(valueFs).fillColor(INK).text(line, x, yy, { width: colW2 - 6 });
          yy = doc.y + 2;
        }
        return yy;
      };

      // Resolve billing address: use billing fields if set, otherwise fall back to shipping address
      const settings = order.event?.wristbandSettings ?? null;
      const usesShippingForBilling = order.billing_same_as_shipping !== false;
      const billingName    = usesShippingForBilling ? (settings?.delivery_name ?? null)   : (order.billing_name ?? null);
      const billingStreet  = usesShippingForBilling ? (settings?.delivery_street ?? null) : (order.billing_street ?? null);
      const billingCityZip = usesShippingForBilling
        ? [settings?.delivery_city, settings?.delivery_zip, settings?.delivery_country].filter(Boolean).join(', ') || null
        : [order.billing_city, order.billing_zip, order.billing_country].filter(Boolean).join(', ') || null;

      const colBottoms = [
        infoCol(ML,         'From',      [issuerName, issuerAddress, issuerTin ? `TIN: ${issuerTin}` : null]),
        infoCol(ML + colW2, 'Billed to', [order.customer_name, order.customer_email, billingName, billingStreet, billingCityZip]),
      ];
      curY = Math.max(...colBottoms) + 14;
      hairline(doc, ML, curY, CW);
      curY += 12;

      // 4. Dates line
      doc.font('Helvetica').fontSize(9).fillColor(MUTED)
        .text('Issued  ', ML, curY, { continued: true, lineBreak: false });
      doc.font('Helvetica-Bold').fillColor(INK)
        .text(fmtShort(issuedOn), { continued: isPaid && !!paidOnDate, lineBreak: false });
      if (isPaid && paidOnDate) {
        doc.font('Helvetica').fillColor(MUTED).text('      Paid  ', { continued: true, lineBreak: false });
        doc.font('Helvetica-Bold').fillColor(INK).text(fmtShort(paidOnDate), { lineBreak: false });
      }
      curY += 22;

      // 5. Line items table
      hairline(doc, ML, curY, CW);
      curY += 2;
      const tableHdrH = 28;
      doc.roundedRect(ML, curY, CW, tableHdrH, 4).fill(TINT);
      const tblPad    = 10;
      const amtRight  = ML + CW - tblPad;
      const amtW      = 96;
      const unitRight = amtRight - amtW - 14;
      const unitW     = 100;
      const qtyRight  = unitRight - unitW - 14;
      const qtyW      = 36;
      const colDesc   = ML + tblPad;
      const descW     = qtyRight - qtyW - colDesc - 8;
      const tblHdrY   = curY + (tableHdrH - 10) / 2;
      doc.font('Helvetica').fontSize(9).fillColor(MUTED);
      doc.text('Description', colDesc,           tblHdrY, { width: descW,  lineBreak: false });
      doc.text('Qty',         qtyRight - qtyW,   tblHdrY, { width: qtyW,   align: 'right', lineBreak: false });
      doc.text('Unit price',  unitRight - unitW, tblHdrY, { width: unitW,  align: 'right', lineBreak: false });
      doc.text('Amount',      amtRight - amtW,   tblHdrY, { width: amtW,   align: 'right', lineBreak: false });
      curY += tableHdrH + 8;

      const colorSummary = items
        .filter((i: any) => i.quantity > 0 && i.color)
        .map((i: any) => `${i.color.label} x${i.quantity}`)
        .join(', ');

      const rowStartY = curY;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(INK)
        .text(`Wristband Order #${order.id}`, colDesc, rowStartY, { width: descW, lineBreak: false });
      if (colorSummary) {
        doc.font('Helvetica').fontSize(8).fillColor(MUTED)
          .text(colorSummary, colDesc, rowStartY + 13, { width: descW, lineBreak: false });
      }
      doc.font('Helvetica').fontSize(10).fillColor(INK)
        .text(String(qty), qtyRight - qtyW, rowStartY, { width: qtyW, align: 'right', lineBreak: false });
      doc.text(formatMoney(qty > 0 ? PRICE_PER_10 / 10 : 0, currency), unitRight - unitW, rowStartY, { width: unitW, align: 'right', lineBreak: false });
      doc.text(formatMoney(wristbandSubtotal, currency), amtRight - amtW, rowStartY, { width: amtW, align: 'right', lineBreak: false });
      curY = rowStartY + (colorSummary ? 28 : 18);

      if (shipping > 0) {
        doc.font('Helvetica').fontSize(8).fillColor(MUTED)
          .text('Shipping fee', colDesc, curY, { width: descW, lineBreak: false });
        doc.text('1', qtyRight - qtyW, curY, { width: qtyW, align: 'right', lineBreak: false });
        doc.text(formatMoney(shipping, currency), unitRight - unitW, curY, { width: unitW, align: 'right', lineBreak: false });
        doc.text(formatMoney(shipping, currency), amtRight - amtW, curY, { width: amtW, align: 'right', lineBreak: false });
        curY += 20;
      }

      if (discount > 0) {
        doc.font('Helvetica').fontSize(8).fillColor(MUTED)
          .text('Discount', colDesc, curY, { width: descW, lineBreak: false });
        doc.text('—', qtyRight - qtyW, curY, { width: qtyW, align: 'right', lineBreak: false });
        doc.text('', unitRight - unitW, curY, { width: unitW, align: 'right', lineBreak: false });
        doc.fillColor('#17744B')
          .text(`-${formatMoney(discount, currency)}`, amtRight - amtW, curY, { width: amtW, align: 'right', lineBreak: false });
        curY += 20;
      }

      hairline(doc, ML, curY, CW);
      curY += 14;

      // 6. Totals block
      const totW      = 320;
      const totX      = PW - ML - totW;
      const totLabelW = 110;
      const totValW   = totW - totLabelW;
      const totRow    = (label: string, value: string, labelColor = MUTED, valueColor = INK): void => {
        doc.font('Helvetica').fontSize(10).fillColor(labelColor)
          .text(label, totX, curY, { width: totLabelW, lineBreak: false });
        doc.font('Helvetica').fontSize(10).fillColor(valueColor)
          .text(value, totX + totLabelW, curY, { width: totValW, align: 'right', lineBreak: false });
        curY += 18;
      };
      totRow('Subtotal', formatMoney(totalDue, currency));
      totRow('VAT (0%)', formatMoney(0, currency));
      curY += 4;
      doc.save().strokeColor(ACCENT).lineWidth(2)
        .moveTo(totX, curY).lineTo(PW - ML, curY).stroke().restore();
      curY += 12;
      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK)
        .text('Total', totX, curY + 4, { width: totLabelW, lineBreak: false });
      doc.font('Helvetica-Bold').fontSize(18).fillColor(INK)
        .text(formatMoney(totalDue, currency), totX + totLabelW, curY, { width: totValW, align: 'right', lineBreak: false });
      curY += 28;
      const amountLineColor = isPaid ? '#17744B' : '#92400E';
      const amountLineLabel = isPaid ? 'Amount paid' : 'Amount due';
      doc.font('Helvetica-Bold').fontSize(10).fillColor(amountLineColor)
        .text(`${amountLineLabel}  ${formatMoney(isPaid ? totalDue : totalDue, currency)}`, totX, curY, { width: totValW + totLabelW, align: 'right', lineBreak: false });
      curY += 28;

      // 7. Payment box (if paid)
      if (isPaid && payment) {
        const boxH = 64, boxPad = 16;
        doc.roundedRect(ML, curY, CW, boxH, 6).fill(TINT);
        const payColW = CW / 3;
        const payY    = curY + boxPad;
        const payCell = (x: number, label: string, value: string): void => {
          doc.font('Helvetica').fontSize(8).fillColor(MUTED)
            .text(label, x, payY, { width: payColW - 8, lineBreak: false });
          doc.font('Helvetica').fontSize(10).fillColor(INK)
            .text(value, x, payY + 13, { width: payColW - 8, lineBreak: false });
        };
        payCell(ML + boxPad,               'Payment method', paymentMethodDisplay);
        payCell(ML + boxPad + payColW,     'Paid on',        paidOnDate ? fmtShort(paidOnDate) : '-');
        payCell(ML + boxPad + payColW * 2, 'Reference',      transactionRef);
        curY += boxH + 20;
      } else {
        curY += 8;
      }

      // 8. Footer
      const footerY = Math.max(curY, PH - 60);
      hairline(doc, ML, footerY, CW);
      doc.font('Helvetica').fontSize(9).fillColor(MUTED)
        .text('Thank you for your order.', ML, footerY + 10, { width: CW * 0.6, lineBreak: false });
      if (supportEmail) {
        doc.font('Helvetica').fontSize(9).fillColor(MUTED)
          .text(`Questions? ${supportEmail}`, ML + CW * 0.4, footerY + 10, { width: CW * 0.6, align: 'right', lineBreak: false });
      }

      doc.end();
    });
  } catch (err) {
    console.error('buildPublicOrderInvoicePdfBuffer error:', err);
    return null;
  }
}

export const getPublicWristbandOrderInvoice = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const order = await WristbandOrder.findOne({
      where: { public_token: token, is_public: true },
      include: [
        { model: WristbandOrderItem, as: 'items', include: [{ model: WristbandColor, as: 'color' }] },
        { model: Event, as: 'event', attributes: ['id'], include: [{ model: EventWristbandSettings, as: 'wristbandSettings' }] },
      ],
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const o = await withPaymentStatus(order);
    if (o.status !== 'confirmed' && o.status !== 'shipped' && o.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Invoice is only available once the order is confirmed or paid' });
    }

    const pdfBuffer = await buildPublicOrderInvoicePdfBuffer(o);
    if (!pdfBuffer) return res.status(500).json({ error: 'Failed to generate invoice PDF' });

    const filename = `INV-PUB-${o.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('getPublicWristbandOrderInvoice error:', error);
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
