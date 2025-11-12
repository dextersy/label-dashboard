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

/**
 * Check if a user has a password set (either bcrypt or MD5)
 *
 * @param user The user to check
 * @returns boolean True if user has any password set
 */
export const hasPassword = (user: User): boolean => {
  return !!(user.password_hash || (user.password_md5 && user.password_md5.trim() !== ''));
};

/**
 * Password Requirements
 */
export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?'
};

/**
 * Interface for password validation result
 */
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate password against security requirements
 *
 * Requirements:
 * - Minimum 8 characters
 * - Maximum 128 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 *
 * @param password The password to validate
 * @returns PasswordValidationResult with isValid flag and array of error messages
 */
export const validatePassword = (password: string): PasswordValidationResult => {
  const errors: string[] = [];

  if (!password) {
    errors.push('Password is required');
    return { isValid: false, errors };
  }

  // Check minimum length
  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`);
  }

  // Check maximum length
  if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
    errors.push(`Password must not exceed ${PASSWORD_REQUIREMENTS.maxLength} characters`);
  }

  // Check for uppercase letter
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for lowercase letter
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for number
  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check for special character
  if (PASSWORD_REQUIREMENTS.requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Get a formatted string describing password requirements
 *
 * @returns string User-friendly description of password requirements
 */
export const getPasswordRequirementsText = (): string => {
  const requirements = [
    `At least ${PASSWORD_REQUIREMENTS.minLength} characters long`,
    'At least one uppercase letter (A-Z)',
    'At least one lowercase letter (a-z)',
    'At least one number (0-9)',
    `At least one special character (${PASSWORD_REQUIREMENTS.specialChars})`
  ];

  return 'Password must contain:\n' + requirements.map(req => `• ${req}`).join('\n');
};

