import { Request } from 'express';

/**
 * Extract the requesting domain from Origin or Referer headers.
 * Used to validate that public/scanner API calls originate from a brand's domain.
 */
export const getRequestDomain = (req: Request): string => {
  let requestDomain = '';

  // Try Origin header first (for CORS/XHR requests - contains the frontend domain)
  const originHeader = req.get('origin') || '';
  if (originHeader) {
    try {
      const url = new URL(originHeader);
      requestDomain = url.hostname;
    } catch (error) {
      console.error('Invalid origin header:', originHeader);
    }
  }

  // Fallback to Referer header (for navigation/redirect - also contains frontend domain)
  if (!requestDomain) {
    const refererUrl = req.get('referer') || req.get('referrer') || '';
    if (refererUrl) {
      try {
        const url = new URL(refererUrl);
        requestDomain = url.hostname;
      } catch (error) {
        console.error('Invalid referer URL:', refererUrl);
      }
    }
  }

  return requestDomain;
};
