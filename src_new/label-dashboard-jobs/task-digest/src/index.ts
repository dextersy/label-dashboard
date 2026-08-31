import { Handler, ScheduledEvent } from 'aws-lambda';
import nodemailer from 'nodemailer';
import axios from 'axios';

interface LambdaResponse {
  statusCode: number;
  body: string;
}

interface DigestTask {
  id: number;
  title: string;
  due_date: string;
  status: string;
  notes: string | null;
}

interface TaskDigestEntry {
  user_id: number;
  user_email: string;
  user_name: string;
  release_id: number;
  release_title: string;
  brand_id: number;
  brand_name: string;
  brand_color: string | null;
  brand_logo_url: string | null;
  tasks_url: string;
  tasks_overdue: DigestTask[];
  tasks_due_today: DigestTask[];
  tasks_due_this_week: DigestTask[];
}

interface TaskDigestResponse {
  digests: TaskDigestEntry[];
  date: string;
}

class TaskDigestService {
  private transporter: nodemailer.Transporter;
  private apiBaseUrl: string;
  private fromEmail: string;
  private authToken: string | null = null;

  constructor() {
    const requiredEnvVars = [
      'API_BASE_URL',
      'API_USERNAME',
      'API_PASSWORD',
      'FROM_EMAIL',
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASS',
    ];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    this.apiBaseUrl = process.env.API_BASE_URL!;
    this.fromEmail = process.env.FROM_EMAIL!;

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST!,
      port: parseInt(process.env.SMTP_PORT!),
      secure: process.env.SMTP_SECURE === 'ssl',
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!,
      },
    });
  }

  private async authenticate(): Promise<void> {
    console.log('Authenticating with System API...');
    const response = await axios.post(`${this.apiBaseUrl}/api/system/auth/login`, {
      email: process.env.API_USERNAME,
      password: process.env.API_PASSWORD,
    });
    if (response.data?.token) {
      this.authToken = response.data.token;
      console.log('Successfully authenticated with System API');
    } else {
      throw new Error('No token received from System API');
    }
  }

  private async apiGet<T>(endpoint: string): Promise<T> {
    if (!this.authToken) await this.authenticate();

    try {
      const response = await axios.get<T>(`${this.apiBaseUrl}${endpoint}`, {
        headers: { Authorization: `Bearer ${this.authToken}` },
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        console.log('Token expired, re-authenticating...');
        await this.authenticate();
        const response = await axios.get<T>(`${this.apiBaseUrl}${endpoint}`, {
          headers: { Authorization: `Bearer ${this.authToken}` },
        });
        return response.data;
      }
      throw error;
    }
  }

  private async apiPost<T>(endpoint: string, data?: any): Promise<T> {
    if (!this.authToken) await this.authenticate();

    const response = await axios.post<T>(`${this.apiBaseUrl}${endpoint}`, data ?? {}, {
      headers: { Authorization: `Bearer ${this.authToken}` },
    });
    return response.data;
  }

  private formatDate(dateStr: string): string {
    // dateStr is YYYY-MM-DD; parse as local date to avoid UTC offset shifting the day
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  private generateEmailHTML(entry: TaskDigestEntry): string {
    const brandColor = entry.brand_color || '#1595e7';

    const logoHtml = entry.brand_logo_url
      ? `<img src="${entry.brand_logo_url}" alt="${entry.brand_name}" style="max-width:140px;max-height:52px;height:auto;" />`
      : `<span style="font-size:18px;font-weight:bold;color:#ffffff;">${entry.brand_name}</span>`;

    const taskRow = (task: DigestTask, badge: 'overdue' | 'today' | 'week') => {
      const dueDateLabel = badge === 'today'
        ? `<span style="display:inline-block;background:#dc2626;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:8px;vertical-align:middle;letter-spacing:0.03em;">DUE TODAY</span>`
        : badge === 'overdue'
        ? `<span style="font-size:12px;color:#7f1d1d;margin-left:6px;">was due ${this.formatDate(task.due_date)}</span>`
        : `<span style="font-size:12px;color:#9ca3af;margin-left:6px;">${this.formatDate(task.due_date)}</span>`;

      const notesHtml = task.notes
        ? `<div style="margin-top:4px;font-size:13px;color:#6b7280;font-style:italic;">${task.notes}</div>`
        : '';

      return `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #f3f4f6;">
            <div style="font-size:14px;color:#111827;font-weight:500;">
              ${task.title}${dueDateLabel}
            </div>
            ${notesHtml}
          </td>
        </tr>`;
    };

    const overdueSection = entry.tasks_overdue.length > 0 ? `
      <div style="margin-bottom:24px;">
        <div style="display:flex;align-items:center;margin-bottom:12px;">
          <div style="width:4px;height:20px;background:#7f1d1d;border-radius:2px;margin-right:10px;"></div>
          <h3 style="margin:0;font-size:13px;font-weight:700;color:#7f1d1d;text-transform:uppercase;letter-spacing:0.07em;">Overdue</h3>
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="border:1px solid #fca5a5;border-radius:6px;overflow:hidden;background:#fef2f2;">
          <tbody>
            ${entry.tasks_overdue.map(t => taskRow(t, 'overdue')).join('')}
          </tbody>
        </table>
      </div>` : '';

    const todaySection = entry.tasks_due_today.length > 0 ? `
      <div style="margin-bottom:24px;">
        <div style="display:flex;align-items:center;margin-bottom:12px;">
          <div style="width:4px;height:20px;background:#dc2626;border-radius:2px;margin-right:10px;"></div>
          <h3 style="margin:0;font-size:13px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.07em;">Due Today</h3>
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="border:1px solid #fecaca;border-radius:6px;overflow:hidden;background:#fff5f5;">
          <tbody>
            ${entry.tasks_due_today.map(t => taskRow(t, 'today')).join('')}
          </tbody>
        </table>
      </div>` : '';

    const weekSection = entry.tasks_due_this_week.length > 0 ? `
      <div style="margin-bottom:24px;">
        <div style="display:flex;align-items:center;margin-bottom:12px;">
          <div style="width:4px;height:20px;background:#d97706;border-radius:2px;margin-right:10px;"></div>
          <h3 style="margin:0;font-size:13px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:0.07em;">Due This Week</h3>
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;background:#ffffff;">
          <tbody>
            ${entry.tasks_due_this_week.map(t => taskRow(t, 'week')).join('')}
          </tbody>
        </table>
      </div>` : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0"
        style="background:#ffffff;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.07);overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:${brandColor};padding:20px 28px;">
            ${logoHtml}
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 28px 8px;">
            <p style="margin:0 0 6px;font-size:16px;color:#111827;">Hi ${entry.user_name},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#4b5563;">
              Here are your upcoming tasks for <strong>${entry.release_title}</strong>:
            </p>

            ${overdueSection}
            ${todaySection}
            ${weekSection}

            <p style="margin:0 0 24px;">
              <a href="${entry.tasks_url}"
                style="display:inline-block;background:${brandColor};color:#ffffff;text-decoration:none;
                       padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
                Go to Tasks &rarr;
              </a>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 28px 24px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              You received this because you have tasks assigned to you in the ${entry.brand_name} dashboard.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private generateEmailText(entry: TaskDigestEntry): string {
    let text = `Hi ${entry.user_name},\n\n`;
    text += `Here are your tasks for "${entry.release_title}":\n\n`;

    if (entry.tasks_overdue.length > 0) {
      text += `OVERDUE\n`;
      text += `-------\n`;
      entry.tasks_overdue.forEach(t => {
        text += `• ${t.title} (was due ${this.formatDate(t.due_date)})`;
        if (t.notes) text += `\n  ${t.notes}`;
        text += `\n`;
      });
      text += `\n`;
    }

    if (entry.tasks_due_today.length > 0) {
      text += `DUE TODAY\n`;
      text += `---------\n`;
      entry.tasks_due_today.forEach(t => {
        text += `• ${t.title}`;
        if (t.notes) text += `\n  ${t.notes}`;
        text += `\n`;
      });
      text += `\n`;
    }

    if (entry.tasks_due_this_week.length > 0) {
      text += `DUE THIS WEEK\n`;
      text += `-------------\n`;
      entry.tasks_due_this_week.forEach(t => {
        text += `• ${t.title} (${this.formatDate(t.due_date)})`;
        if (t.notes) text += `\n  ${t.notes}`;
        text += `\n`;
      });
      text += `\n`;
    }

    text += `Go to Tasks: ${entry.tasks_url}\n`;
    return text;
  }

  private buildSubject(entry: TaskDigestEntry): string {
    const overdueCount = entry.tasks_overdue.length;
    const todayCount = entry.tasks_due_today.length;
    const weekCount = entry.tasks_due_this_week.length;

    const parts: string[] = [];
    if (overdueCount > 0) parts.push(`${overdueCount} overdue`);
    if (todayCount > 0) parts.push(`${todayCount} due today`);
    if (weekCount > 0) parts.push(`${weekCount} due this week`);

    return `${entry.release_title} — Your Tasks: ${parts.join(', ')}`;
  }

  async sendDigestEmails(digests: TaskDigestEntry[], dryRun: boolean): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const entry of digests) {
      if (!entry.user_email) continue;

      const subject = this.buildSubject(entry);

      if (dryRun) {
        console.log(`[DRY RUN] Would send email to ${entry.user_email} for release "${entry.release_title}"`);
        console.log(`[DRY RUN]   Subject: ${subject}`);
        console.log(`[DRY RUN]   Overdue: ${entry.tasks_overdue.length}, Due today: ${entry.tasks_due_today.length}, Due this week: ${entry.tasks_due_this_week.length}`);
        sent++;
        continue;
      }

      try {
        await this.transporter.sendMail({
          from: `${entry.brand_name} <${this.fromEmail}>`,
          to: entry.user_email,
          subject,
          html: this.generateEmailHTML(entry),
          text: this.generateEmailText(entry),
        });
        console.log(`Email sent to ${entry.user_email} for release "${entry.release_title}"`);
        sent++;
      } catch (error: any) {
        console.error(`Failed to send email to ${entry.user_email} for release "${entry.release_title}":`, error.message);
        failed++;
      }
    }

    return { sent, failed };
  }

  async run(): Promise<{ emailsSent: number; emailsFailed: number; notificationsCreated: number }> {
    const dryRun = process.env.DRY_RUN === 'true';
    if (dryRun) console.log('[DRY RUN] Mode enabled — no emails or notifications will be sent.');

    console.log('Starting task digest job...');

    await this.authenticate();

    // 1. Fetch digest data
    console.log('Fetching task digest from API...');
    const { digests, date } = await this.apiGet<TaskDigestResponse>('/api/system/task-digest');
    console.log(`Retrieved ${digests.length} digest entries for ${date}`);

    if (digests.length === 0) {
      console.log('No tasks due today or this week — nothing to do.');
      return { emailsSent: 0, emailsFailed: 0, notificationsCreated: 0 };
    }

    // Log summary
    const totalOverdue = digests.reduce((n, d) => n + d.tasks_overdue.length, 0);
    const totalToday = digests.reduce((n, d) => n + d.tasks_due_today.length, 0);
    const totalWeek = digests.reduce((n, d) => n + d.tasks_due_this_week.length, 0);
    console.log(`Tasks overdue: ${totalOverdue}, due today: ${totalToday}, due this week: ${totalWeek}`);

    // Only email users who have at least one overdue or due-today task; week tasks are supplementary
    const digestsToEmail = digests.filter(d => d.tasks_overdue.length > 0 || d.tasks_due_today.length > 0);
    console.log(`Sending emails to ${digestsToEmail.length} of ${digests.length} user/release combination(s) (skipping ${digests.length - digestsToEmail.length} with no urgent tasks)...`);

    // 2. Send emails
    const { sent, failed } = await this.sendDigestEmails(digestsToEmail, dryRun);
    console.log(`Emails ${dryRun ? '(dry run) ' : ''}sent: ${sent}, failed: ${failed}`);

    // 3. Create in-app notifications for tasks due today
    let notificationsCreated = 0;
    if (dryRun) {
      const dueTodayEntries = digests.filter(d => d.tasks_due_today.length > 0);
      console.log(`[DRY RUN] Would create in-app notifications for ${dueTodayEntries.length} user/release combination(s) with tasks due today`);
    } else {
      console.log('Creating in-app notifications for tasks due today...');
      const notifResponse = await this.apiPost<{ notifications_created: number }>(
        '/api/system/task-digest/create-notifications'
      );
      notificationsCreated = notifResponse.notifications_created;
      console.log(`In-app notifications created: ${notificationsCreated}`);
    }

    console.log(`Task digest job completed successfully${dryRun ? ' (dry run)' : ''}.`);
    return {
      emailsSent: sent,
      emailsFailed: failed,
      notificationsCreated,
    };
  }
}

export const handler: Handler<ScheduledEvent, LambdaResponse> = async (event, context) => {
  console.log('Task Digest Lambda triggered', { event, context });

  try {
    const service = new TaskDigestService();
    const result = await service.run();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Task digest completed successfully',
        ...result,
      }),
    };
  } catch (error: any) {
    console.error('Lambda execution failed:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Task digest failed',
        error: error.message,
      }),
    };
  }
};
