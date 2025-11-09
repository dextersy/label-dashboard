import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models';

const BCRYPT_ROUNDS = 12; // Recommended for security/performance balance

/**
 * Password Migration Strategy: Lazy Migration
 *
 * - New passwords: Always use bcrypt
 * - Existing MD5 passwords: Verify with MD5, then upgrade to bcrypt on successful login
 * - This gradually migrates all users to bcrypt without forcing password resets
 */

/**
 * Hash a password using bcrypt (for new passwords or password changes)
 *
 * @param plainPassword The plaintext password
 * @returns Promise<string> The bcrypt hash
 */
export const hashPassword = async (plainPassword: string): Promise<string> => {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
};

/**
 * Verify a password against stored hash(es) with automatic MD5 → bcrypt migration
 *
 * This implements "lazy migration":
 * 1. If user has bcrypt hash → verify against bcrypt
 * 2. If user only has MD5 hash → verify against MD5, then upgrade to bcrypt
 * 3. Returns both verification result and whether migration occurred
 *
 * @param plainPassword The plaintext password to verify
 * @param user The user object with password_hash and/or password_md5
 * @returns Promise with { isValid: boolean, needsMigration: boolean }
 */
export const verifyPassword = async (
  plainPassword: string,
  user: User
): Promise<{ isValid: boolean; needsMigration: boolean }> => {

  // Priority 1: Check bcrypt hash (modern, secure)
  if (user.password_hash) {
    const isValid = await bcrypt.compare(plainPassword, user.password_hash);
    return { isValid, needsMigration: false };
  }

  // Priority 2: Check MD5 hash (legacy, insecure - needs migration)
  if (user.password_md5) {
    const md5Hash = crypto.createHash('md5').update(plainPassword).digest('hex');
    const isValid = md5Hash === user.password_md5;

    // If valid, this user needs migration to bcrypt
    return { isValid, needsMigration: isValid };
  }

  // No password set at all
  return { isValid: false, needsMigration: false };
};

/**
 * Migrate a user from MD5 to bcrypt after successful login
 *
 * Call this after verifying password when needsMigration is true
 *
 * @param user The user to migrate
 * @param plainPassword The verified plaintext password
 */
export const migrateUserPassword = async (
  user: User,
  plainPassword: string
): Promise<void> => {
  // Generate bcrypt hash
  const bcryptHash = await hashPassword(plainPassword);

  // Update user with bcrypt hash and remove insecure MD5 hash
  await user.update({
    password_hash: bcryptHash,
    password_md5: null
  });

  console.log(`✅ Password migrated from MD5 to bcrypt for user ${user.id} (${user.email_address})`);
};

