import { Request, Response } from 'express';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import Brand from '../models/Brand';

// Reject URLs pointing at private/loopback ranges or non-HTTPS schemes
function assertPublicHttpsUrl(urlStr: string): void {
  const parsed = new URL(urlStr);
  if (parsed.protocol !== 'https:') throw new Error('Only HTTPS URLs are allowed.');
  const h = parsed.hostname.toLowerCase();
  if (
    h === 'localhost' ||
    h.endsWith('.local') ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h === '169.254.169.254'
  ) throw new Error('URL resolves to a private or reserved address.');
}

// Generic helper: make an outbound HTTPS GET and resolve with { status, body }
function fetchJson(urlStr: string, headers: Record<string, string>): Promise<{ status: number; body: any }> {
  assertPublicHttpsUrl(urlStr);
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const lib = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers,
      timeout: 10000,
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let body: any = {};
        try { body = JSON.parse(data); } catch { body = {}; }
        resolve({ status: res.statusCode ?? 0, body });
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.on('error', reject);
    req.end();
  });
}

export const testLoyverseConnection = async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const brand = await Brand.findByPk(brandId as string);
    if (!brand) return res.status(404).json({ error: 'Brand not found' });

    const apiKey = req.body.loyverse_api_key ?? brand.loyverse_api_key;

    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'No Loyverse API token configured.' });
    }

    // GET /v1.0/merchant returns the authenticated merchant – lightest single-object endpoint.
    const result = await fetchJson('https://api.loyverse.com/v1.0/merchant', {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    });

    if (result.status === 200 && result.body?.id) {
      const name = result.body.name || result.body.business_name || '';
      return res.json({ success: true, message: `Connected to Loyverse${name ? ` as "${name}"` : ''}.` });
    } else if (result.status === 401) {
      return res.json({ success: false, message: 'Loyverse rejected the token. Check your API token in the Loyverse dashboard under Settings → Access Tokens.' });
    } else if (result.status === 429) {
      return res.json({ success: false, message: 'Loyverse rate limit reached. Try again in a moment.' });
    } else {
      return res.json({ success: false, message: `Loyverse returned an unexpected response (HTTP ${result.status}).` });
    }
  } catch (err: any) {
    const isTimeout = err?.message?.includes('timed out');
    return res.json({ success: false, message: isTimeout ? 'Connection to Loyverse timed out.' : 'Could not reach Loyverse. Check your server\'s internet connection.' });
  }
};

export const testWoocommerceConnection = async (req: Request, res: Response) => {
  try {
    const { brandId } = req.params;
    const brand = await Brand.findByPk(brandId as string);
    if (!brand) return res.status(404).json({ error: 'Brand not found' });

    const storeUrlRaw = req.body.woocommerce_url ?? brand.woocommerce_url;
    const consumerKey = req.body.woocommerce_consumer_key ?? brand.woocommerce_consumer_key;
    const consumerSecret = req.body.woocommerce_consumer_secret ?? brand.woocommerce_consumer_secret;

    if (!storeUrlRaw || !consumerKey || !consumerSecret) {
      return res.status(400).json({ success: false, message: 'WooCommerce store URL, consumer key, and consumer secret are all required.' });
    }

    // Normalise URL: strip trailing slash, ensure it starts with https
    let storeUrl = storeUrlRaw.trim().replace(/\/$/, '');
    if (!storeUrl.startsWith('http://') && !storeUrl.startsWith('https://')) {
      storeUrl = `https://${storeUrl}`;
    }

    // GET /wp-json/wc/v3/system_status requires auth and proves both connectivity + credentials.
    const encoded = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const result = await fetchJson(`${storeUrl}/wp-json/wc/v3/system_status`, {
      'Authorization': `Basic ${encoded}`,
      'Accept': 'application/json',
    });

    if (result.status === 200 && result.body?.environment) {
      const wpVersion = result.body.environment?.wp_version;
      const wcVersion = result.body.environment?.wc_version;
      const versionStr = wpVersion && wcVersion ? ` (WP ${wpVersion}, WooCommerce ${wcVersion})` : '';
      return res.json({ success: true, message: `Connected to WooCommerce store successfully${versionStr}.` });
    } else if (result.status === 401) {
      return res.json({ success: false, message: 'WooCommerce rejected the credentials. Verify your consumer key and secret, and ensure the API user has Administrator role.' });
    } else if (result.status === 403) {
      return res.json({ success: false, message: 'WooCommerce denied access. The API user may lack the required permissions (Administrator role needed).' });
    } else if (result.status === 404) {
      return res.json({ success: false, message: 'WooCommerce REST API not found. Verify the store URL is correct and WooCommerce is installed.' });
    } else {
      return res.json({ success: false, message: `WooCommerce returned an unexpected response (HTTP ${result.status}).` });
    }
  } catch (err: any) {
    const isTimeout = err?.message?.includes('timed out');
    if (isTimeout) return res.json({ success: false, message: 'Connection to the WooCommerce store timed out.' });
    const isUnreachable = err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND';
    if (isUnreachable) return res.json({ success: false, message: 'Could not reach the WooCommerce store. Check the store URL is correct and the site is online.' });
    return res.json({ success: false, message: 'Could not connect to WooCommerce. Check the store URL.' });
  }
};
