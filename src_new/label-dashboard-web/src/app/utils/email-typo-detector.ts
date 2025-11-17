/**
 * Email Typo Detector
 *
 * Detects common typos in email addresses and suggests corrections
 * Based on industry best practices (similar to mailcheck.js)
 */

// Most common email domains
const COMMON_DOMAINS = [
  // Gmail variants
  'gmail.com', 'googlemail.com',
  // Yahoo variants
  'yahoo.com', 'ymail.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de',
  // Microsoft variants
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'hotmail.co.uk',
  // Other major providers
  'aol.com', 'icloud.com', 'me.com', 'mac.com',
  'protonmail.com', 'zoho.com',
  // Business/Professional
  'mail.com', 'gmx.com', 'fastmail.com'
];

// Common typos for popular domains
const COMMON_TYPOS: Record<string, string[]> = {
  'gmail.com': ['gmai.com', 'gmial.com', 'gmaol.com', 'gmil.com', 'gmaill.com', 'gamil.com', 'gnail.com', 'gmaii.com'],
  'yahoo.com': ['yaho.com', 'yahooo.com', 'yajoo.com', 'yahho.com', 'yaoo.com'],
  'hotmail.com': ['hotmial.com', 'hotmali.com', 'hotmai.com', 'hotmil.com', 'hotmaii.com'],
  'outlook.com': ['outlok.com', 'outllook.com', 'putlook.com', 'outtlook.com'],
  'icloud.com': ['iclou.com', 'iclod.com', 'icould.com']
};

/**
 * Calculate Levenshtein distance between two strings
 * (Minimum number of single-character edits needed to change one word into another)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost  // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Find the closest matching domain from common domains
 */
function findClosestDomain(domain: string): { domain: string; distance: number } | null {
  const lowerDomain = domain.toLowerCase();
  let closestDomain: string | null = null;
  let minDistance = Infinity;

  // Check exact matches first (no typo)
  if (COMMON_DOMAINS.includes(lowerDomain)) {
    return null; // No typo detected
  }

  // Check known typos
  for (const [correctDomain, typos] of Object.entries(COMMON_TYPOS)) {
    if (typos.includes(lowerDomain)) {
      return { domain: correctDomain, distance: 0 }; // Known typo
    }
  }

  // Calculate Levenshtein distance for all common domains
  for (const commonDomain of COMMON_DOMAINS) {
    const distance = levenshteinDistance(lowerDomain, commonDomain);

    // Only consider if distance is 1-3 (likely typos)
    // Distance of 0 means exact match (already handled above)
    // Distance > 3 is probably a different domain, not a typo
    if (distance > 0 && distance <= 3 && distance < minDistance) {
      minDistance = distance;
      closestDomain = commonDomain;
    }
  }

  if (closestDomain && minDistance <= 3) {
    return { domain: closestDomain, distance: minDistance };
  }

  return null;
}

export interface EmailTypoResult {
  suggestedEmail?: string;
}

/**
 * Check if an email address has a potential typo
 *
 * @param email - The email address to check
 * @returns EmailTypoResult with suggested correction if typo detected
 */
export function checkEmailTypo(email: string): EmailTypoResult {
  if (!email || typeof email !== 'string') {
    return {};
  }

  const trimmedEmail = email.trim();

  // Basic email format validation
  const emailParts = trimmedEmail.split('@');
  if (emailParts.length !== 2) {
    return {}; // Invalid format, not a typo issue
  }

  const [localPart, domain] = emailParts;

  // Check if domain is valid
  if (!domain || !localPart) {
    return {};
  }

  // Find closest common domain
  const closestMatch = findClosestDomain(domain);

  if (closestMatch) {
    const suggestedEmail = `${localPart}@${closestMatch.domain}`;
    return { suggestedEmail };
  }

  return {};
}

interface NameEmailMismatchResult {
  hasPotentialMismatch: boolean;
  message?: string;
  suggestedEmail?: string;
}

/**
 * Check if the name and email address might be mismatched
 *
 * @param name - Full name of the person
 * @param email - Email address
 * @returns NameEmailMismatchResult with mismatch detection
 */
export function checkNameEmailMismatch(name: string, email: string): NameEmailMismatchResult {
  if (!name || !email || typeof name !== 'string' || typeof email !== 'string') {
    return { hasPotentialMismatch: false };
  }

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();

  // Extract local part of email (before @)
  const emailParts = trimmedEmail.split('@');
  if (emailParts.length !== 2 || !emailParts[0]) {
    return { hasPotentialMismatch: false };
  }

  const emailLocalPart = emailParts[0].toLowerCase();
  const domain = emailParts[1];

  // Tokenize name (split by spaces and common separators)
  const nameTokens = trimmedName
    .toLowerCase()
    .split(/[\s\-_.]+/)
    .filter(token => token.length >= 2); // Ignore single characters

  if (nameTokens.length === 0) {
    return { hasPotentialMismatch: false };
  }

  // Generate expected email patterns from name
  // For "Dexter Sy" we expect: dexter.sy, dexter_sy, sy.dexter, sy_dexter, dextersy, sydexter
  // Priority: patterns with separators first, then concatenated
  const expectedPatterns: string[] = [];
  const separatorsWithPriority = ['.', '_', '-']; // Common separators
  const concatenated = ''; // No separator (lower priority)

  // Forward order with separators: first.last, first_last, first-last
  for (const sep of separatorsWithPriority) {
    expectedPatterns.push(nameTokens.join(sep));
  }

  // Reverse order with separators: last.first, last_first, last-first (only if we have 2+ tokens)
  if (nameTokens.length >= 2) {
    const reversedTokens = [...nameTokens].reverse();
    for (const sep of separatorsWithPriority) {
      expectedPatterns.push(reversedTokens.join(sep));
    }
  }

  // Concatenated patterns (lower priority)
  expectedPatterns.push(nameTokens.join(concatenated)); // firstlast
  if (nameTokens.length >= 2) {
    const reversedTokens = [...nameTokens].reverse();
    expectedPatterns.push(reversedTokens.join(concatenated)); // lastfirst
  }

  // Check if email matches any expected pattern exactly
  if (expectedPatterns.includes(emailLocalPart)) {
    return { hasPotentialMismatch: false }; // Perfect match
  }

  // Check for close matches with expected patterns
  // Find the BEST match across ALL patterns (lowest distance wins)
  let closestPattern: string | null = null;
  let minDistance = Infinity;

  for (const pattern of expectedPatterns) {
    const distance = levenshteinDistance(emailLocalPart, pattern);

    if (distance === 0) {
      return { hasPotentialMismatch: false }; // Exact match
    }

    if (distance > 0 && distance <= 3 && distance < minDistance) {
      minDistance = distance;
      closestPattern = pattern;
    }
  }

  if (closestPattern) {
    return {
      hasPotentialMismatch: true,
      message: `Possible typo in email address.`,
      suggestedEmail: `${closestPattern}@${domain}`
    };
  }

  // Tokenize email local part (split by common separators)
  const emailTokens = emailLocalPart
    .split(/[\-_.]+/)
    .filter(token => token.length >= 2);

  if (emailTokens.length === 0) {
    return { hasPotentialMismatch: false };
  }

  // Check for exact token matches
  for (const nameToken of nameTokens) {
    for (const emailToken of emailTokens) {
      if (nameToken === emailToken) {
        return { hasPotentialMismatch: false }; // Found a match, likely correct
      }
    }
  }

  // Check for close token matches (1-2 character differences)
  for (const nameToken of nameTokens) {
    for (const emailToken of emailTokens) {
      const distance = levenshteinDistance(nameToken, emailToken);

      // If tokens are similar (within 1-2 edits), might be a typo
      if (distance > 0 && distance <= 2 && nameToken.length >= 2) {
        // Generate suggested email by replacing the mismatched token
        const suggestedLocalPart = emailLocalPart.replace(
          new RegExp(emailToken, 'gi'),
          nameToken.toLowerCase()
        );
        const suggestedEmail = `${suggestedLocalPart}@${domain}`;

        return {
          hasPotentialMismatch: true,
          message: `Your name contains "${nameToken}" but your email has "${emailToken}".`,
          suggestedEmail
        };
      }
    }
  }

  // Check if name tokens appear as substrings within the email (even if not separated)
  // Example: "Dolloso" should match "dollosi" in "thebeadollosi@gmail.com"
  // Find the BEST match (lowest distance) across all positions and tokens
  let bestMatch: { nameToken: string; position: number; distance: number } | null = null;

  for (const nameToken of nameTokens) {
    if (nameToken.length < 3) continue; // Skip very short tokens

    // Look for the name token or close variations within the email
    // We'll check sliding windows of similar length
    const tokenLength = nameToken.length;
    for (let i = 0; i <= emailLocalPart.length - tokenLength; i++) {
      const substring = emailLocalPart.substring(i, i + tokenLength);
      const distance = levenshteinDistance(nameToken, substring);

      // If we find a close match (1-2 character difference)
      if (distance > 0 && distance <= 2) {
        // Track the best match (prefer longer tokens, then lower distance)
        if (!bestMatch ||
            distance < bestMatch.distance ||
            (distance === bestMatch.distance && tokenLength > bestMatch.nameToken.length)) {
          bestMatch = { nameToken, position: i, distance };
        }
      }
    }
  }

  // If we found a good substring match, apply the correction
  if (bestMatch) {
    const suggestedLocalPart =
      emailLocalPart.substring(0, bestMatch.position) +
      bestMatch.nameToken.toLowerCase() +
      emailLocalPart.substring(bestMatch.position + bestMatch.nameToken.length);
    const suggestedEmail = `${suggestedLocalPart}@${domain}`;

    return {
      hasPotentialMismatch: true,
      message: `Possible typo in email address.`,
      suggestedEmail
    };
  }

  // No matches found - could be generic email or just different
  const genericEmailPrefixes = ['info', 'contact', 'admin', 'support', 'hello', 'mail', 'office', 'team'];
  const isGenericEmail = genericEmailPrefixes.some(prefix => emailLocalPart.includes(prefix));

  if (isGenericEmail) {
    return { hasPotentialMismatch: false };
  }

  return { hasPotentialMismatch: false };
}

/**
 * Unified check for both email typos and name/email mismatch
 *
 * @param email - Email address to check
 * @param name - Optional name to check against email
 * @returns EmailTypoResult with suggested correction if any issue detected
 */
export function checkEmailIssues(email: string, name?: string): EmailTypoResult {
  // First check for email domain typos (highest priority)
  const typoResult = checkEmailTypo(email);

  // If domain typo found, return that suggestion
  if (typoResult.suggestedEmail) {
    return typoResult;
  }

  // If no name provided, return the typo check result
  if (!name) {
    return typoResult;
  }

  // Check for name/email mismatch
  const mismatchResult = checkNameEmailMismatch(name, email);

  // If name/email mismatch found with a suggestion, return it
  if (mismatchResult.suggestedEmail) {
    return { suggestedEmail: mismatchResult.suggestedEmail };
  }

  // No suggestion available
  return {};
}
