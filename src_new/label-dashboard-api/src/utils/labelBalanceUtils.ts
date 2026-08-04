import { Op, literal } from 'sequelize';
import { Earning, Royalty, Ticket, Event, Release, LabelPayment, Artist, Payment, Fundraiser, Donation, EventAddOnPayment } from '../models';

/**
 * Calculates the all-time receivable balance for a brand.
 * This is the net earnings (music + events + fundraisers) minus payments received
 * by the label, minus add-on payments charged against the label balance.
 */
export async function getBrandReceivableBalance(brandId: number): Promise<number> {
  // Music earnings
  let musicEarnings = 0;
  const releaseIds = await Release.findAll({
    where: { brand_id: brandId },
    attributes: ['id'],
    raw: true,
  });
  const releaseIdList = releaseIds.map((r: any) => r.id);

  if (releaseIdList.length > 0) {
    const grossEarnings = await Earning.sum('amount', { where: { release_id: { [Op.in]: releaseIdList } } }) || 0;
    const royalties = await Royalty.sum('amount', { where: { release_id: { [Op.in]: releaseIdList } } }) || 0;
    const musicPlatformFees = await Earning.sum('platform_fee', { where: { release_id: { [Op.in]: releaseIdList } } }) || 0;
    musicEarnings = grossEarnings - royalties - musicPlatformFees;
  }

  // Event earnings
  let eventEarnings = 0;
  const eventSalesQuery = await Ticket.findAll({
    attributes: [[literal('SUM(price_per_ticket * number_of_entries)'), 'total_sales']],
    include: [{ model: Event, as: 'event', where: { brand_id: brandId }, attributes: [] }],
    where: { status: { [Op.in]: ['Payment Confirmed', 'Ticket sent.'] }, platform_fee: { [Op.not]: null } },
    raw: true,
  });
  const eventFeesQuery = await Ticket.findAll({
    attributes: [
      [literal('SUM(platform_fee)'), 'total_platform_fee'],
      [literal('SUM(payment_processing_fee)'), 'total_processing_fee'],
    ],
    include: [{ model: Event, as: 'event', where: { brand_id: brandId }, attributes: [] }],
    where: { status: { [Op.in]: ['Payment Confirmed', 'Ticket sent.', 'Refunded'] }, platform_fee: { [Op.not]: null } },
    raw: true,
  });
  const eventSales = parseFloat((eventSalesQuery[0] as any)?.total_sales) || 0;
  const eventPlatformFees = parseFloat((eventFeesQuery[0] as any)?.total_platform_fee) || 0;
  eventEarnings = eventSales - eventPlatformFees;

  // Fundraiser earnings
  let fundraiserEarnings = 0;
  const fundraiserIds = await Fundraiser.findAll({ where: { brand_id: brandId }, attributes: ['id'], raw: true });
  const fundraiserIdList = fundraiserIds.map((f: any) => f.id);
  if (fundraiserIdList.length > 0) {
    const donationsQuery = await Donation.findAll({
      attributes: [
        [literal('SUM(amount)'), 'total_amount'],
        [literal('SUM(platform_fee)'), 'total_platform_fee'],
      ],
      where: { fundraiser_id: { [Op.in]: fundraiserIdList }, payment_status: 'paid' },
      raw: true,
    });
    const grossDonations = parseFloat((donationsQuery[0] as any)?.total_amount) || 0;
    const donationPlatformFees = parseFloat((donationsQuery[0] as any)?.total_platform_fee) || 0;
    fundraiserEarnings = grossDonations - donationPlatformFees;
  }

  // Payments received by the label
  const totalPayments = await LabelPayment.sum('amount', { where: { brand_id: brandId, status: 'succeeded' } }) || 0;

  // Add-on payments charged against label balance
  const brandEventIds = await Event.findAll({ where: { brand_id: brandId }, attributes: ['id'], raw: true });
  const brandEventIdList = brandEventIds.map((e: any) => e.id);
  const totalAddOnBalancePayments = brandEventIdList.length > 0
    ? await EventAddOnPayment.sum('amount', {
        where: { event_id: { [Op.in]: brandEventIdList }, method: 'balance', status: 'succeeded' },
      }) || 0
    : 0;

  return musicEarnings + eventEarnings + fundraiserEarnings - totalPayments - totalAddOnBalancePayments;
}
