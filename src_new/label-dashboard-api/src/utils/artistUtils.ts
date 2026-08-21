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
