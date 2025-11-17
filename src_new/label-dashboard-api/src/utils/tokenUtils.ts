import crypto from 'crypto';

/**
 * Generates a cryptographically strong random token
 *
 * Uses 64 bytes of random data, providing 512 bits of entropy
 * Encoded as URL-safe base64 (removes padding and makes it URL-friendly)
 *
 * Output: ~86 characters (well within 255 character database limit)
 * Entropy: 512 bits (extremely strong, more than sufficient for security tokens)
 *
 * @returns A cryptographically secure random token suitable for:
 *          - Password reset tokens
 *          - Invite hashes
 *          - Session tokens
 *          - Any security-critical unique identifier
 */
export const generateSecureToken = (): string => {
  return crypto
    .randomBytes(64) // 64 bytes = 512 bits of entropy
    .toString('base64') // Convert to base64
    .replace(/\+/g, '-') // Replace + with - (URL-safe)
    .replace(/\//g, '_') // Replace / with _ (URL-safe)
    .replace(/=/g, ''); // Remove padding
};
