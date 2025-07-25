import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'ssl',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async (
  recipients: string[],
  subject: string,
  htmlBody: string,
  textBody?: string
): Promise<boolean> => {
  try {
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: recipients.join(', '),
      subject,
      html: htmlBody,
      text: textBody || htmlBody.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
};

export const sendNotificationEmail = async (
  type: 'login_success' | 'login_failure' | 'admin_alert',
  data: any
): Promise<boolean> => {
  let subject: string;
  let body: string;
  let recipients: string[];

  switch (type) {
    case 'login_success':
      subject = 'Successful login to your account';
      recipients = [data.user.email_address];
      body = `
        <h2>Successful Login Notification</h2>
        <p>Hi ${data.user.first_name}!</p>
        <p>We've detected a successful login from your account just now.</p>
        <p>If this was you, you can safely ignore this notification.</p>
        <p>If you didn't log in to your account, please notify your administrator.</p>
        <p><strong>Login Details:</strong></p>
        <ul>
          <li>Remote IP: ${data.remote_ip}</li>
          <li>Proxy IP: ${data.proxy_ip}</li>
          <li>Time: ${new Date().toLocaleString()}</li>
        </ul>
      `;
      break;

    case 'login_failure':
      subject = 'WARNING: Too many failed logins detected';
      recipients = [process.env.ADMIN_EMAIL || 'sy.dexter@gmail.com'];
      body = `
        <h2>Security Alert: Multiple Login Failures</h2>
        <p>We've detected multiple login failures for user <strong>${data.username}</strong>.</p>
        <p><strong>Details:</strong></p>
        <ul>
          <li>Username: ${data.username}</li>
          <li>Remote IP: ${data.remote_ip}</li>
          <li>Proxy IP: ${data.proxy_ip}</li>
          <li>Failed Attempts: ${data.attempts}</li>
          <li>Time: ${new Date().toLocaleString()}</li>
        </ul>
        <p>Please investigate this potential security threat.</p>
      `;
      break;

    case 'admin_alert':
      subject = data.subject;
      recipients = [process.env.ADMIN_EMAIL || 'sy.dexter@gmail.com'];
      body = data.body;
      break;

    default:
      return false;
  }

  return await sendEmail(recipients, subject, body);
};

// Load email template from file
const loadEmailTemplate = (templateName: string): string => {
  try {
    const templatePath = path.join(__dirname, '../assets/templates', `${templateName}.html`);
    return fs.readFileSync(templatePath, 'utf8');
  } catch (error) {
    console.error(`Failed to load email template ${templateName}:`, error);
    return '';
  }
};

// Replace template variables with actual values
const processTemplate = (template: string, data: Record<string, any>): string => {
  let processedTemplate = template;
  
  // Replace all %VARIABLE% placeholders with actual values
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `%${key.toUpperCase()}%`;
    processedTemplate = processedTemplate.replace(new RegExp(placeholder, 'g'), String(value || ''));
  }
  
  return processedTemplate;
};

export const sendBrandedEmail = async (
  email: string,
  templateName: string,
  templateData: Record<string, any>
): Promise<boolean> => {
  try {
    // Load the email template
    const template = loadEmailTemplate(templateName);
    if (!template) {
      console.error(`Template ${templateName} not found`);
      return false;
    }

    // Process template with data
    const htmlBody = processTemplate(template, templateData);
    
    // Determine subject based on template
    let subject = '';
    switch (templateName) {
      case 'invite_email':
        subject = `You've been invited to join ${templateData.artist || 'the team'}!`;
        break;
      case 'artist_update_email':
        subject = `${templateData.artist_name || 'Artist'} profile has been updated`;
        break;
      case 'reset_password_email':
        subject = 'Reset your password';
        break;
      default:
        subject = 'Notification';
    }

    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: email,
      subject,
      html: htmlBody,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Branded email sent successfully:', result.messageId);
    return true;
  } catch (error) {
    console.error('Branded email sending failed:', error);
    return false;
  }
};

// Send team invitation email
export const sendTeamInviteEmail = async (
  email: string,
  artistName: string,
  inviterName: string,
  inviteUrl: string,
  brandInfo: any
): Promise<boolean> => {
  const templateData = {
    artist: artistName,
    member_name: inviterName,
    url: inviteUrl,
    brand_color: brandInfo?.brand_color || '#1595e7',
    logo: brandInfo?.logo_url || ''
  };

  return await sendBrandedEmail(email, 'invite_email', templateData);
};

// Send artist update notification email
export const sendArtistUpdateEmail = async (
  email: string,
  artistName: string,
  updaterName: string,
  changes: Array<{field: string, oldValue: string, newValue: string}>,
  dashboardUrl: string,
  brandInfo: any
): Promise<boolean> => {
  // Generate changed items HTML
  const changedItemsHtml = changes.map(change => {
    return `
      <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
        <tr>
          <td align="left" valign="top" style="padding: 10px 0;">
            <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
              <tr>
                <td valign="top" align="left" style="width: 30%; padding-right: 10px;">
                  <div class="pc-font-alt" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: bold; color: #333333;">
                    ${change.field}:
                  </div>
                </td>
                <td valign="top" align="left" style="width: 70%;">
                  <div class="pc-font-alt" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #333333;">
                    <div style="color: #999999; text-decoration: line-through;">${change.oldValue || '(empty)'}</div>
                    <div style="color: #000000; font-weight: bold;">${change.newValue || '(empty)'}</div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  }).join('');

  const templateData = {
    artist_name: artistName,
    member_name: updaterName,
    changed_items: changedItemsHtml,
    url: dashboardUrl,
    brand_color: brandInfo?.brand_color || '#1595e7',
    logo: brandInfo?.logo_url || ''
  };

  return await sendBrandedEmail(email, 'artist_update_email', templateData);
};