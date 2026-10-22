import { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { EventAddOnPayment, Event, User, WristbandOrder, WristbandOrderItem, WristbandColor, Brand } from '../models';
import { resolveEventRole } from '../utils/eventAccess';
import { getBrandReceivableBalance } from '../utils/labelBalanceUtils';
import { PaymentService } from '../utils/paymentService';
import { getBrandFrontendUrl } from '../utils/brandUtils';
import { sendAddOnPaymentNotification } from '../utils/emailService';
import { createNotification, createNotificationsForUsers, getBrandAdminUserIds } from '../utils/notificationService';
import { fetchImageBuffer, lerpHex, drawGradientRect, formatMoney, fmtShort, drawDot, hairline } from '../utils/pdfUtils';

const paymentService = new PaymentService();

const PRICE_PER_10 = 35;

async function isFullyPaid(eventId: number): Promise<boolean> {
  const confirmedOrders = await WristbandOrder.findAll({
    where: { event_id: eventId, status: 'confirmed' },
    include: [{ model: WristbandOrderItem, as: 'items' }],
  });
  const totalOwed = confirmedOrders.reduce((sum: number, o: any) => {
    const qty = (o.items ?? []).reduce((s: number, i: any) => s + i.quantity, 0);
    return sum + ((qty / 10) * PRICE_PER_10);
  }, 0);

  if (totalOwed <= 0) return false;

  const payments = await EventAddOnPayment.findAll({ where: { event_id: eventId, status: 'succeeded' } });
  const totalPaid = payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);

  return totalPaid >= totalOwed;
}

async function notifyAddOnPayment(payment: any, event: any, initiatorUser: any): Promise<void> {
  try {
    const parentBrandId = parseInt(process.env.TICKETING_PARENT_BRAND_ID || '0');

    const fullyPaid = await isFullyPaid(event.id);
    if (!fullyPaid) return;

    // Fetch wristband orders for the event to include in the notification
    const orders = await WristbandOrder.findAll({
      where: { event_id: event.id },
      include: [{ model: WristbandOrderItem, as: 'items', include: [{ model: WristbandColor, as: 'color' }] }],
    });

    // Email: admins + receipt to initiator
    sendAddOnPaymentNotification(payment, event, initiatorUser, orders);

    // Bell notification: ticketing parent brand admins
    if (parentBrandId) {
      const parentAdminIds = await getBrandAdminUserIds(parentBrandId);
      const addOnsLink = '/campaigns/events/add-ons?tab=payment';
      await createNotificationsForUsers(
        parentAdminIds,
        parentBrandId,
        'addon_payment_made',
        `Add-on payment received: ${event.title ?? `Event #${event.id}`}`,
        `₱${parseFloat(payment.amount).toFixed(2)} via ${payment.method === 'balance' ? 'Label Balance' : 'Paymongo'}`,
        addOnsLink
      );
    }

    // Bell notification: the initiator (if different brand from parent)
    if (initiatorUser) {
      await createNotification(
        initiatorUser.id,
        event.brand_id,
        'addon_payment_made',
        `Payment submitted: ${event.title ?? `Event #${event.id}`}`,
        `₱${parseFloat(payment.amount).toFixed(2)} via ${payment.method === 'balance' ? 'Label Balance' : 'Paymongo'}`,
        '/campaigns/events/add-ons?tab=payment'
      );
    }
  } catch (err) {
    console.error('notifyAddOnPayment error:', err);
  }
}

interface AuthRequest extends Request {
  user?: any;
}

export const getAddOnPayments = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.query.event_id as string);
    if (!eventId) return res.status(400).json({ error: 'event_id is required' });

    const getRole = await resolveEventRole(req, eventId);
    if (!getRole) return res.status(403).json({ error: 'Access denied for this event' });
    const event = await Event.findOne({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const payments = await EventAddOnPayment.findAll({
      where: { event_id: eventId },
      include: [{ model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name', 'email_address'] }],
      order: [['createdAt', 'DESC']],
    });

    const totalPaid = payments
      .filter(p => p.status === 'succeeded')
      .reduce((sum, p) => sum + parseFloat(p.amount as any), 0);

    res.json({ payments, total_paid: totalPaid });
  } catch (error) {
    console.error('getAddOnPayments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createAddOnPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { event_id, amount, method, reference_number, notes } = req.body;

    if (!event_id || !amount || !method) {
      return res.status(400).json({ error: 'event_id, amount, and method are required' });
    }
    if (!['balance', 'paymongo'].includes(method)) {
      return res.status(400).json({ error: 'method must be balance or paymongo' });
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const createRole = await resolveEventRole(req, event_id);
    if (createRole !== 'owner' && createRole !== 'manager') return res.status(403).json({ error: 'Manager access required' });
    const event = await Event.findOne({ where: { id: event_id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    if (method === 'balance') {
      const availableBalance = await getBrandReceivableBalance(req.user.brand_id);
      if (parsedAmount > availableBalance) {
        return res.status(422).json({ error: 'Insufficient label balance for this payment' });
      }
    }

    const payment = await EventAddOnPayment.create({
      event_id,
      amount: parsedAmount,
      method,
      status: 'succeeded',
      reference_number: reference_number ?? null,
      notes: notes ?? null,
      created_by: req.user.id,
    });

    notifyAddOnPayment(payment, event, req.user);

    res.status(201).json({ payment });
  } catch (error) {
    console.error('createAddOnPayment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const PRICE_PER_10_INVOICE = 35;

async function buildAddOnInvoicePdfBuffer(eventId: number, brandId: number): Promise<Buffer | null> {
  try {
    const event = await Event.findOne({ where: { id: eventId } });
    if (!event) return null;

    const confirmedOrders = await WristbandOrder.findAll({
      where: { event_id: eventId, status: 'confirmed' },
      include: [{ model: WristbandOrderItem, as: 'items', include: [{ model: WristbandColor, as: 'color' }] }],
      order: [['id', 'ASC']],
    });

    const payments = await EventAddOnPayment.findAll({
      where: { event_id: eventId, status: 'succeeded' },
      order: [['createdAt', 'DESC']],
    });

    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount as any), 0);
    const totalDue = confirmedOrders.reduce((sum, o: any) => {
      const qty = (o.items ?? []).reduce((s: number, i: any) => s + i.quantity, 0);
      return sum + (Math.floor(qty / 10) * PRICE_PER_10_INVOICE) + (parseFloat(o.shipping_fee ?? '0') || 0);
    }, 0);
    const isPaid = totalDue > 0 && totalPaid >= totalDue;

    // ── Issuer brand (walk to parent) ────────────────────────────────────────
    const currentBrand = await Brand.findByPk(brandId, { attributes: ['id', 'brand_name', 'logo_url', 'brand_color', 'parent_brand', 'billing_company_name', 'billing_address', 'billing_tin'] });
    let issuerBrand = currentBrand;
    if ((currentBrand as any)?.parent_brand) {
      const parentBrand = await Brand.findByPk((currentBrand as any).parent_brand, { attributes: ['id', 'brand_name', 'logo_url', 'brand_color', 'billing_company_name', 'billing_address', 'billing_tin'] });
      if (parentBrand) issuerBrand = parentBrand;
    }
    const issuerOfficialName = (issuerBrand as any)?.billing_company_name ?? null;
    const issuerName    = issuerOfficialName ?? (issuerBrand as any)?.brand_name ?? 'Platform';
    const issuerLogoUrl = (issuerBrand as any)?.logo_url ?? null;
    const rawBrandColor = (issuerBrand as any)?.brand_color ?? null;
    const ACCENT        = rawBrandColor
      ? (rawBrandColor.startsWith('#') ? rawBrandColor : `#${rawBrandColor}`)
      : '#2D2D2D';

    const adminUser = await User.findOne({
      where: { brand_id: brandId, is_admin: true },
      order: [['id', 'ASC']],
      attributes: ['first_name', 'last_name', 'email_address'],
    });
    const billedToName  = adminUser
      ? [(adminUser as any).first_name, (adminUser as any).last_name].filter(Boolean).join(' ') || issuerName
      : issuerName;
    const billedToEmail = (adminUser as any)?.email_address ?? null;
    const billedToCompany = (currentBrand as any)?.billing_company_name ?? null;
    const billedToAddress = (currentBrand as any)?.billing_address ?? null;

    const issuerAddress = (issuerBrand as any)?.billing_address ?? process.env.INVOICE_ISSUER_ADDRESS ?? null;
    const issuerTin     = (issuerBrand as any)?.billing_tin     ?? process.env.INVOICE_ISSUER_TIN     ?? null;
    const supportEmail  = process.env.INVOICE_SUPPORT_EMAIL  ?? (process.env.FROM_EMAIL ?? null);

    let logoBuffer: Buffer | null = null;
    if (issuerLogoUrl) logoBuffer = await fetchImageBuffer(issuerLogoUrl);

    const currency = 'PHP';
    const issuedOn = new Date();
    const latestPayment = payments[0] ?? null;
    const paidOnDate = latestPayment?.createdAt ?? null;
    const paymentMethodDisplay = latestPayment
      ? (latestPayment.method === 'balance' ? 'Label Balance' : 'Paymongo')
      : '-';
    const transactionRef = (latestPayment as any)?.reference_number ?? '-';

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
        .text(`INV-${brandId}-${new Date().getFullYear()}-E${eventId}`, rightColX, headerRowY + 28, { width: rightColW, align: 'right', lineBreak: false });

      // Status pill
      const pillY     = headerRowY + 44;
      const pillLabel = isPaid ? 'Paid' : totalDue === 0 ? 'Unpaid' : 'Unpaid';
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
      const colW3 = CW / 3, labelFs = 8, valueFs = 10;
      const infoCol = (x: number, label: string, lines: (string | null)[]): number => {
        doc.font('Helvetica').fontSize(labelFs).fillColor(MUTED)
          .text(label, x, curY, { width: colW3 - 6, lineBreak: false });
        let yy = curY + 16;
        for (const line of lines) {
          if (!line) continue;
          doc.font('Helvetica').fontSize(valueFs).fillColor(INK).text(line, x, yy, { width: colW3 - 6 });
          yy = doc.y + 2;
        }
        return yy;
      };

      const colBottoms = [
        infoCol(ML,             'From',      [issuerName, issuerAddress, issuerTin ? `TIN: ${issuerTin}` : null]),
        infoCol(ML + colW3,     'Billed to', [billedToCompany ?? billedToName, billedToCompany ? billedToName : null, billedToEmail, billedToAddress]),
        infoCol(ML + colW3 * 2, 'Event',     [(event as any).title ?? `Event #${eventId}`, fmtShort((event as any).date_and_time)]),
      ];
      curY = Math.max(...colBottoms) + 14;
      hairline(doc, ML, curY, CW);
      curY += 12;

      // 4. Dates line
      doc.font('Helvetica').fontSize(9).fillColor(MUTED)
        .text('Issued  ', ML, curY, { continued: true, lineBreak: false });
      doc.font('Helvetica-Bold').fillColor(INK)
        .text(fmtShort(issuedOn), { continued: isPaid, lineBreak: false });
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

      // Height needed after line items: separator + totals + payment box + footer (~206px actual)
      const TAIL_HEIGHT = 170;
      const PAGE_BOTTOM = PH - 20;

      const maybePageBreak = (rowHeight: number): void => {
        if (curY + rowHeight + TAIL_HEIGHT > PAGE_BOTTOM) {
          doc.addPage();
          drawGradientRect(doc, 0, 0, PW, 6, ACCENT, ACCENT_LIGHT);
          curY = 36;
          // Redraw column headers on continuation page
          doc.roundedRect(ML, curY, CW, tableHdrH, 4).fill(TINT);
          const contHdrY = curY + (tableHdrH - 10) / 2;
          doc.font('Helvetica').fontSize(9).fillColor(MUTED);
          doc.text('Description', colDesc,           contHdrY, { width: descW,  lineBreak: false });
          doc.text('Qty',         qtyRight - qtyW,   contHdrY, { width: qtyW,   align: 'right', lineBreak: false });
          doc.text('Unit price',  unitRight - unitW, contHdrY, { width: unitW,  align: 'right', lineBreak: false });
          doc.text('Amount',      amtRight - amtW,   contHdrY, { width: amtW,   align: 'right', lineBreak: false });
          curY += tableHdrH + 8;
        }
      };

      for (const order of confirmedOrders) {
        const items = (order as any).items ?? [];
        const qty = items.reduce((s: number, i: any) => s + i.quantity, 0);
        const wristbandPrice = Math.floor(qty / 10) * PRICE_PER_10_INVOICE;
        const shipping = parseFloat((order as any).shipping_fee ?? '0') || 0;
        const colorSummary = items
          .filter((i: any) => i.quantity > 0 && i.color)
          .map((i: any) => `${i.color.label} x${i.quantity}`)
          .join(', ');

        const rowHeight = (colorSummary ? 28 : 18) + (shipping > 0 ? 20 : 0);
        maybePageBreak(rowHeight);

        const rowStartY = curY;
        doc.font('Helvetica-Bold').fontSize(10).fillColor(INK)
          .text(`Wristband Order #${(order as any).id}`, colDesc, rowStartY, { width: descW, lineBreak: false });
        if (colorSummary) {
          doc.font('Helvetica').fontSize(8).fillColor(MUTED)
            .text(colorSummary, colDesc, rowStartY + 13, { width: descW, lineBreak: false });
        }
        doc.font('Helvetica').fontSize(10).fillColor(INK)
          .text(String(qty), qtyRight - qtyW, rowStartY, { width: qtyW, align: 'right', lineBreak: false });
        doc.text(formatMoney(qty > 0 ? PRICE_PER_10_INVOICE / 10 : 0, currency), unitRight - unitW, rowStartY, { width: unitW, align: 'right', lineBreak: false });
        doc.text(formatMoney(wristbandPrice, currency), amtRight - amtW, rowStartY, { width: amtW, align: 'right', lineBreak: false });
        curY = rowStartY + (colorSummary ? 28 : 18);

        if (shipping > 0) {
          doc.font('Helvetica').fontSize(8).fillColor(MUTED)
            .text(`Shipping #${(order as any).id}`, colDesc, curY, { width: descW, lineBreak: false });
          doc.text('1', qtyRight - qtyW, curY, { width: qtyW, align: 'right', lineBreak: false });
          doc.text(formatMoney(shipping, currency), unitRight - unitW, curY, { width: unitW, align: 'right', lineBreak: false });
          doc.text(formatMoney(shipping, currency), amtRight - amtW, curY, { width: amtW, align: 'right', lineBreak: false });
          curY += 20;
        }
      }

      hairline(doc, ML, curY, CW);
      curY += 14;

      // 6. Totals block
      const totW      = 320;
      const totX      = PW - ML - totW;
      const totLabelW = 110;
      const totValW   = totW - totLabelW;
      const totRow    = (label: string, value: string, labelColor = MUTED, valueColor = INK, fs = 10): void => {
        doc.font('Helvetica').fontSize(fs).fillColor(labelColor)
          .text(label, totX, curY, { width: totLabelW, lineBreak: false });
        doc.font('Helvetica').fontSize(fs).fillColor(valueColor)
          .text(value, totX + totLabelW, curY, { width: totValW, align: 'right', lineBreak: false });
        curY += fs + 8;
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
        .text(`${amountLineLabel}  ${formatMoney(isPaid ? totalPaid : totalDue - totalPaid, currency)}`, totX, curY, { width: totW, align: 'right', lineBreak: false });
      curY += 28;

      // 7. Payment box
      if (latestPayment) {
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
        payCell(ML + boxPad + payColW,     'Paid on',        isPaid && paidOnDate ? fmtShort(paidOnDate) : '-');
        payCell(ML + boxPad + payColW * 2, 'Reference',      transactionRef);
        curY += boxH + 20;
      } else {
        curY += 8;
      }

      // 8. Footer
      const footerY = Math.max(curY, PH - 60);
      hairline(doc, ML, footerY, CW);
      doc.font('Helvetica').fontSize(9).fillColor(MUTED)
        .text('Thank you for your business.', ML, footerY + 10, { width: CW * 0.6, lineBreak: false });
      if (supportEmail) {
        doc.font('Helvetica').fontSize(9).fillColor(MUTED)
          .text(`Questions? ${supportEmail}`, ML + CW * 0.4, footerY + 10, { width: CW * 0.6, align: 'right', lineBreak: false });
      }

      doc.end();
    });
  } catch (err) {
    console.error('buildAddOnInvoicePdfBuffer error:', err);
    return null;
  }
}

export const getAddOnInvoicePdf = async (req: AuthRequest, res: Response) => {
  try {
    const eventId = parseInt(req.params.event_id as string, 10);
    if (!eventId) return res.status(400).json({ error: 'event_id is required' });

    const role = await resolveEventRole(req, eventId);
    if (!role) return res.status(403).json({ error: 'Access denied for this event' });

    const event = await Event.findOne({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const brandId = req.user?.brand_id;
    const pdfBuffer = await buildAddOnInvoicePdfBuffer(eventId, brandId);
    if (!pdfBuffer) return res.status(500).json({ error: 'Failed to generate invoice PDF' });

    const filename = `INV-${brandId}-${new Date().getFullYear()}-E${eventId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('getAddOnInvoicePdf error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const initiateAddOnPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { event_id, amount, notes } = req.body;

    if (!event_id || !amount) {
      return res.status(400).json({ error: 'event_id and amount are required' });
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const initiateRole = await resolveEventRole(req, event_id);
    if (initiateRole !== 'owner' && initiateRole !== 'manager') return res.status(403).json({ error: 'Manager access required' });
    const event = await Event.findOne({ where: { id: event_id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const frontendUrl = await getBrandFrontendUrl(req.user.brand_id);
    const successUrl = `${frontendUrl}/campaigns/events/add-ons?tab=payment&payment_status=success`;
    const cancelUrl = `${frontendUrl}/campaigns/events/add-ons?tab=payment&payment_status=cancelled`;

    // Create a pending payment record first so the webhook can match it
    const payment = await EventAddOnPayment.create({
      event_id,
      amount: parsedAmount,
      method: 'paymongo',
      status: 'pending',
      notes: notes ?? null,
      created_by: req.user.id,
    });

    const checkoutSession = await paymentService.createCheckoutSession({
      line_items: [{
        name: `Event Add-On Payment`,
        amount: Math.round(parsedAmount * 100),
        currency: 'PHP',
        quantity: 1,
      }],
      payment_method_types: ['card', 'gcash', 'paymaya', 'grab_pay', 'dob', 'dob_ubp', 'qrph'],
      success_url: successUrl,
      cancel_url: cancelUrl,
      description: `Add-on payment for event #${event_id}${notes ? ': ' + notes : ''}`,
    });

    if (!checkoutSession) {
      await payment.destroy();
      return res.status(502).json({ error: 'Failed to create Paymongo checkout session' });
    }

    await payment.update({
      checkout_key: checkoutSession.attributes.client_key,
      checkout_session_id: checkoutSession.id,
    });

    res.status(201).json({
      payment_id: payment.id,
      checkout_url: checkoutSession.attributes.checkout_url,
    });
  } catch (error) {
    console.error('initiateAddOnPayment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
