import { Request } from 'express';
import fs from 'fs';
import path from 'path';

/**
 * Audit Logger for System API Access
 *
 * Logs all system API calls with enhanced details for security and compliance:
 * - Who accessed what endpoint
 * - When the access occurred
 * - What data was requested/modified
 * - IP addresses and user agents
 *
 * Security features:
 * - Separate log file for system actions
 * - Tamper-evident timestamping
 * - IP tracking for forensics
 */

interface AuditLogEntry {
  timestamp: string;
  userId: number | null;
  userEmail: string;
  action: string;
  endpoint: string;
  method: string;
  ip: string;
  proxyIp: string;
  userAgent: string;
  brandId?: number | null;
  requestBody?: any;
  responseStatus?: number;
  error?: string;
  duration?: number;
}

class AuditLogger {
  private logDir: string;
  private logFile: string;

  constructor() {
    // Store logs in a dedicated directory
    this.logDir = path.join(__dirname, '../../logs');
    this.logFile = path.join(this.logDir, 'system-audit.log');

    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Log system API access
   */
  logSystemAccess(req: Request, action: string, additionalData?: Partial<AuditLogEntry>): void {
    const user = (req as any).user;

    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      userId: user?.id || null,
      userEmail: user?.email_address || 'unknown',
      action,
      endpoint: req.path,
      method: req.method,
      ip: req.ip || 'unknown',
      proxyIp: req.get('X-Forwarded-For') || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      brandId: user?.brand_id,
      ...additionalData
    };

    this.writeLog(entry);
  }

  /**
   * Log authentication attempts (both successful and failed)
   */
  logAuthAttempt(req: Request, success: boolean, userEmail: string, error?: string): void {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      userId: null,
      userEmail,
      action: success ? 'SYSTEM_AUTH_SUCCESS' : 'SYSTEM_AUTH_FAILED',
      endpoint: req.path,
      method: req.method,
      ip: req.ip || 'unknown',
      proxyIp: req.get('X-Forwarded-For') || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      error
    };

    this.writeLog(entry);
  }

  /**
   * Log data access with query details
   */
  logDataAccess(
    req: Request,
    resourceType: string,
    action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE',
    recordCount: number,
    filters?: any
  ): void {
    const user = (req as any).user;

    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      userId: user?.id || null,
      userEmail: user?.email_address || 'unknown',
      action: `SYSTEM_DATA_${action}`,
      endpoint: req.path,
      method: req.method,
      ip: req.ip || 'unknown',
      proxyIp: req.get('X-Forwarded-For') || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      requestBody: {
        resourceType,
        recordCount,
        filters
      }
    };

    this.writeLog(entry);
  }

  /**
   * Write log entry to file
   */
  private writeLog(entry: AuditLogEntry): void {
    try {
      const logLine = JSON.stringify(entry) + '\n';

      // Append to log file
      fs.appendFileSync(this.logFile, logLine, 'utf8');

      // Also log to console for monitoring
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 AUDIT:', entry.action, `by ${entry.userEmail}`, `at ${entry.endpoint}`);
      }
    } catch (error) {
      console.error('❌ Failed to write audit log:', error);
      // Don't throw error to avoid breaking the application
    }
  }

  /**
   * Get recent audit logs (for admin review)
   */
  async getRecentLogs(limit: number = 100): Promise<AuditLogEntry[]> {
    try {
      const logContent = fs.readFileSync(this.logFile, 'utf8');
      const lines = logContent.trim().split('\n');

      // Get last N lines
      const recentLines = lines.slice(-limit);

      // Parse JSON entries
      return recentLines
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(entry => entry !== null) as AuditLogEntry[];

    } catch (error) {
      console.error('Failed to read audit logs:', error);
      return [];
    }
  }

  /**
   * Search audit logs by criteria
   */
  async searchLogs(criteria: {
    userId?: number;
    userEmail?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<AuditLogEntry[]> {
    try {
      const allLogs = await this.getRecentLogs(10000); // Get more for searching

      return allLogs.filter(log => {
        if (criteria.userId && log.userId !== criteria.userId) return false;
        if (criteria.userEmail && log.userEmail !== criteria.userEmail) return false;
        if (criteria.action && !log.action.includes(criteria.action)) return false;

        const logDate = new Date(log.timestamp);
        if (criteria.startDate && logDate < criteria.startDate) return false;
        if (criteria.endDate && logDate > criteria.endDate) return false;

        return true;
      }).slice(0, criteria.limit || 100);

    } catch (error) {
      console.error('Failed to search audit logs:', error);
      return [];
    }
  }
}

// Singleton instance
export const auditLogger = new AuditLogger();
