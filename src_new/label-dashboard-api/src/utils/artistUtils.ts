import Artist from '../models/Artist';
import { getEffectiveLimitsForBrand } from '../services/subscriptionService';
import { Op } from 'sequelize';

/**
 * Returns the Set of artist IDs that are locked (over the plan's active artist limit)
 * for the given brand. An active artist is locked if its alphabetical rank among active
 * artists exceeds the limit. An inactive artist is locked when the brand is already over
 * the active limit.
 */
export const getLockedArtistIds = async (brandId: number): Promise<Set<number>> => {
  const limits = await getEffectiveLimitsForBrand(brandId);
  const artistLimit = limits?.limit_artists ?? null;
  if (artistLimit === null) return new Set();

  const activeArtists = await Artist.findAll({
    where: { brand_id: brandId, status: 'Active' },
    attributes: ['id'],
    order: [['name', 'ASC']],
    raw: true,
  });

  const overLimit = activeArtists.length > artistLimit;
  const lockedIds = new Set<number>();

  // Active artists beyond the limit are locked
  (activeArtists as any[]).slice(artistLimit).forEach((a) => lockedIds.add(a.id));

  // Inactive artists are locked when the brand is already over the active limit
  if (overLimit) {
    const inactiveArtists = await Artist.findAll({
      where: { brand_id: brandId, status: 'Inactive' },
      attributes: ['id'],
      raw: true,
    });
    (inactiveArtists as any[]).forEach((a) => lockedIds.add(a.id));
  }

  return lockedIds;
};

/**
 * Returns true if the given artist is locked (over plan limit) for the given brand.
 */
export const isArtistLocked = async (artist: Artist, brandId: number): Promise<boolean> => {
  const lockedIds = await getLockedArtistIds(brandId);
  return lockedIds.has(artist.id);
};

/**
 * Batched version of getLockedArtistIds for multiple brands.
 * Uses 2-3 queries total regardless of the number of brands, instead of 2 per brand.
 * Returns a Map<brandId, Set<artistId>> of locked artist IDs per brand.
 */
export const getLockedArtistIdsForBrands = async (brandIds: number[]): Promise<Map<number, Set<number>>> => {
  if (brandIds.length === 0) return new Map();

  // Fetch limits for all brands in parallel
  const limitsEntries = await Promise.all(
    brandIds.map(async (brandId) => {
      const limits = await getEffectiveLimitsForBrand(brandId);
      return { brandId, limit: limits?.limit_artists ?? null };
    })
  );

  // Brands with no limit are never locked
  const brandsWithLimit = limitsEntries.filter(e => e.limit !== null) as { brandId: number; limit: number }[];
  const result = new Map<number, Set<number>>(brandIds.map(id => [id, new Set()]));

  if (brandsWithLimit.length === 0) return result;

  const brandIdsWithLimit = brandsWithLimit.map(e => e.brandId);
  const limitMap = new Map(brandsWithLimit.map(e => [e.brandId, e.limit]));

  // Single query for all active artists across brands with a limit
  const activeArtists = await Artist.findAll({
    where: { brand_id: { [Op.in]: brandIdsWithLimit }, status: 'Active' },
    attributes: ['id', 'brand_id', 'name'],
    order: [['brand_id', 'ASC'], ['name', 'ASC']],
    raw: true,
  }) as any[];

  // Group by brand and apply limit
  const activeByBrand = new Map<number, number[]>();
  for (const a of activeArtists) {
    if (!activeByBrand.has(a.brand_id)) activeByBrand.set(a.brand_id, []);
    activeByBrand.get(a.brand_id)!.push(a.id);
  }

  const overLimitBrandIds: number[] = [];
  for (const { brandId, limit } of brandsWithLimit) {
    const active = activeByBrand.get(brandId) ?? [];
    const locked = result.get(brandId)!;
    // Active artists beyond the limit are locked (already ordered by name)
    active.slice(limit).forEach(id => locked.add(id));
    if (active.length > limit) overLimitBrandIds.push(brandId);
  }

  // Single query for inactive artists only for brands that are over limit
  if (overLimitBrandIds.length > 0) {
    const inactiveArtists = await Artist.findAll({
      where: { brand_id: { [Op.in]: overLimitBrandIds }, status: 'Inactive' },
      attributes: ['id', 'brand_id'],
      raw: true,
    }) as any[];
    for (const a of inactiveArtists) {
      result.get(a.brand_id)?.add(a.id);
    }
  }

  return result;
};
