import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { sendEmailWithAttachment } from '../utils/emailService';

// Helper function to send rate limit notification to superadmin
const notifySuperadmin = async (req: Request, limitType: string) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.log('No admin email configured for rate limit notifications');
    return;
  }

  // Extract IP address (check for proxy headers)
  const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || (req.headers['x-real-ip'] as string)
    || req.socket.remoteAddress
    || 'Unknown';

  // Sanitize sensitive fields from request body
  const sanitizeData = (data: any): any => {
    if (!data || typeof data !== 'object') return data;

    const sanitized = Array.isArray(data) ? [...data] : { ...data };
    const sensitiveFields = ['password', 'password_confirmation', 'new_password', 'old_password', 'current_password', 'token', 'api_key', 'secret', 'auth_token'];

    for (const key in sanitized) {
      if (sensitiveFields.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = sanitizeData(sanitized[key]);
      }
    }

    return sanitized;
  };

  // Prepare request data for JSON attachment with sanitized body
  const requestData = {
    method: req.method,
    url: req.originalUrl || req.url,
    headers: req.headers,
    body: sanitizeData(req.body),
    query: req.query,
    params: req.params,
    timestamp: new Date().toISOString()
  };

  // Create JSON attachment
  const attachments = [{
    filename: 'request-details.json',
    content: JSON.stringify(requestData, null, 2),
    contentType: 'application/json'
  }];

  // Construct email body with details
  const subject = `SECURITY ALERT: Rate Limit Hit - ${limitType}`;
  const body = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc3545;">Rate Limit Security Alert</h2>
      <p>A rate limit has been triggered on the API.</p>

      <h3>Details:</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Rate Limit Type:</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${limitType}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">IP Address:</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${ipAddress}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">API Endpoint:</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${req.method} ${req.originalUrl || req.url}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">User Agent:</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${req.headers['user-agent'] || 'Unknown'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Timestamp:</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${new Date().toLocaleString()}</td>
        </tr>
      </table>

      <p style="margin-top: 20px; color: #666; font-size: 12px;">
        <strong>Note:</strong> Full request details including the request body are attached as a JSON file.
      </p>

      <p style="margin-top: 10px; color: #666; font-size: 12px;">
        This is an automated security notification. Please investigate this activity.
      </p>
    </div>
  `;

  try {
    // Default to brand ID 1 for system notifications
    await sendEmailWithAttachment([adminEmail], subject, body, 1, attachments);
    console.log(`Rate limit notification sent to admin for ${limitType} from IP ${ipAddress}`);
  } catch (error) {
    console.error('Failed to send rate limit notification email:', error);
  }
};

// Custom error handler with security considerations
const createRateLimitErrorHandler = (customMessage?: any) => {
  return (req: Request, res: Response) => {
    res.status(429).json({
      ...(customMessage || {
        error: 'Please Slow Down',
        message: 'You are making requests too quickly. Please wait a moment and try again.',
      }),
      retryAfter: res.get('Retry-After')
    });
  };
};

// Strict rate limiting for authentication endpoints (login, register, password reset)
export const authRateLimit = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_WINDOW_MS || '300000'), // 5 minutes
  max: parseInt(process.env.AUTH_RATE_MAX_REQUESTS || '5'), // 5 attempts per window
  message: {
    error: 'Too Many Login Attempts',
    message: 'Too many login attempts. Please wait 5 minutes before trying again for security.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks or specific IPs if needed
    return req.path === '/api/health' || req.path === '/api/db-test';
  },
  handler: (req, res) => {
    // Send notification to superadmin
    notifySuperadmin(req, 'Authentication Rate Limit').catch(err =>
      console.error('Failed to notify admin:', err)
    );
    // Send error response to client with correct message
    createRateLimitErrorHandler({
      error: 'Too Many Login Attempts',
      message: 'Too many login attempts. Please wait 5 minutes before trying again for security.',
    })(req, res);
  }
});

// Medium rate limiting for general API endpoints
export const apiRateLimit = rateLimit({
  windowMs: parseInt(process.env.API_RATE_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.API_RATE_MAX_REQUESTS || '100'), // 100 requests per minute
  message: {
    error: 'Please Slow Down',
    message: 'You are browsing too quickly. Please wait a moment and try again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    notifySuperadmin(req, 'General API Rate Limit').catch(err =>
      console.error('Failed to notify admin:', err)
    );
    createRateLimitErrorHandler({
      error: 'Please Slow Down',
      message: 'You are browsing too quickly. Please wait a moment and try again.',
    })(req, res);
  }
});

// Strict rate limiting for file upload endpoints
export const uploadRateLimit = rateLimit({
  windowMs: parseInt(process.env.UPLOAD_RATE_WINDOW_MS || '300000'), // 5 minutes
  max: parseInt(process.env.UPLOAD_RATE_MAX_REQUESTS || '10'), // 10 uploads per 5 minutes
  message: {
    error: 'Upload Limit Reached',
    message: 'Upload limit reached. Please wait a few minutes before uploading more files.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    notifySuperadmin(req, 'Upload Rate Limit').catch(err =>
      console.error('Failed to notify admin:', err)
    );
    createRateLimitErrorHandler({
      error: 'Upload Limit Reached',
      message: 'Upload limit reached. Please wait a few minutes before uploading more files.',
    })(req, res);
  }
});

// Very strict rate limiting for email sending endpoints
export const emailRateLimit = rateLimit({
  windowMs: parseInt(process.env.EMAIL_RATE_WINDOW_MS || '3600000'), // 1 hour
  max: parseInt(process.env.EMAIL_RATE_MAX_REQUESTS || '20'), // 20 emails per hour
  message: {
    error: 'Email Limit Reached',
    message: 'You have reached the hourly email limit. Please wait before sending more messages.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    notifySuperadmin(req, 'Email Rate Limit').catch(err =>
      console.error('Failed to notify admin:', err)
    );
    createRateLimitErrorHandler({
      error: 'Email Limit Reached',
      message: 'You have reached the hourly email limit. Please wait before sending more messages.',
    })(req, res);
  }
});

// Lenient rate limiting for public endpoints (ticket buying, verification)
export const publicRateLimit = rateLimit({
  windowMs: parseInt(process.env.PUBLIC_RATE_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.PUBLIC_RATE_MAX_REQUESTS || '50'), // 50 requests per minute
  message: {
    error: 'High Traffic Detected',
    message: 'High traffic detected. Please wait a moment and refresh the page.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    notifySuperadmin(req, 'Public API Rate Limit').catch(err =>
      console.error('Failed to notify admin:', err)
    );
    createRateLimitErrorHandler({
      error: 'High Traffic Detected',
      message: 'High traffic detected. Please wait a moment and refresh the page.',
    })(req, res);
  }
});

// Very strict rate limiting for admin operations
export const adminRateLimit = rateLimit({
  windowMs: parseInt(process.env.ADMIN_RATE_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.ADMIN_RATE_MAX_REQUESTS || '30'), // 30 admin operations per minute
  message: {
    error: 'Please Slow Down',
    message: 'Please slow down your admin actions to prevent errors.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    notifySuperadmin(req, 'Admin Rate Limit').catch(err =>
      console.error('Failed to notify admin:', err)
    );
    createRateLimitErrorHandler({
      error: 'Please Slow Down',
      message: 'Please slow down your admin actions to prevent errors.',
    })(req, res);
  }
});

// Progressive rate limiting for payment endpoints (more strict for failed payments)
export const createPaymentRateLimit = (maxRequests: number = 10, windowMs: number = 300000) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    message: {
      error: 'Payment Limit Reached',
      message: 'Multiple payment attempts detected. Please wait 5 minutes before trying again.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Allow successful payments to not count against rate limit as heavily
      return false;
    },
    handler: (req, res) => {
      notifySuperadmin(req, 'Payment Rate Limit').catch(err =>
        console.error('Failed to notify admin:', err)
      );
      createRateLimitErrorHandler({
        error: 'Payment Limit Reached',
        message: 'Multiple payment attempts detected. Please wait 5 minutes before trying again.',
      })(req, res);
    }
  });
};

// Global fallback rate limiter for all endpoints
export const globalRateLimit = rateLimit({
  windowMs: parseInt(process.env.GLOBAL_RATE_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.GLOBAL_RATE_MAX_REQUESTS || '200'), // 200 requests per minute globally
  message: {
    error: 'Please Slow Down',
    message: 'Please slow down - you are making requests too quickly.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip for health checks
    return req.path === '/api/health' || req.path === '/api/db-test';
  },
  handler: (req, res) => {
    notifySuperadmin(req, 'Global Rate Limit').catch(err =>
      console.error('Failed to notify admin:', err)
    );
    createRateLimitErrorHandler({
      error: 'Please Slow Down',
      message: 'Please slow down - you are making requests too quickly.',
    })(req, res);
  }
});