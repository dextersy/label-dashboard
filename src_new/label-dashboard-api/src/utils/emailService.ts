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
      from: process.env.FROM_EMAIL,
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

// Send payment method update notification
export const sendPaymentMethodNotification = async (
  recipients: string[],
  artistName: string,
  paymentMethodData: {
    type: string;
    account_name: string;
    account_number_or_email: string;
  },
  updaterName: string,
  brand: any
): Promise<boolean> => {
  try {
    const templatePath = path.join(__dirname, '../../src/assets/templates/add_payment_method_email.html');
    let template = fs.readFileSync(templatePath, 'utf8');

    // Replace template variables
    template = template.replace(/%LOGO%/g, brand?.logo_url || '');
    template = template.replace(/%ARTIST_NAME%/g, artistName);
    template = template.replace(/%BANK_NAME%/g, paymentMethodData.type);
    template = template.replace(/%ACCOUNT_NAME%/g, paymentMethodData.account_name);
    template = template.replace(/%ACCOUNT_NUMBER%/g, paymentMethodData.account_number_or_email);
    template = template.replace(/%MEMBER_NAME%/g, updaterName);
    template = template.replace(/%BRAND%/g, brand?.name || 'Your Label');
    template = template.replace(/%BRAND_COLOR%/g, brand?.brand_color || '#1595e7');
    template = template.replace(/%LINK%/g, `${process.env.FRONTEND_URL}/financial#payments`);

    const subject = `A new payment method has been added to ${artistName}`;
    return await sendEmail(recipients, subject, template);
  } catch (error) {
    console.error('Error sending payment method notification:', error);
    return false;
  }
};

// Send payout point update notification
export const sendPayoutPointNotification = async (
  recipients: string[],
  artistName: string,
  newPayoutPoint: number,
  updaterName: string,
  brand: any
): Promise<boolean> => {
  try {
    const templatePath = path.join(__dirname, '../../src/assets/templates/artist_update_payout_point.html');
    let template = fs.readFileSync(templatePath, 'utf8');

    // Replace template variables
    template = template.replace(/%LOGO%/g, brand?.logo_url || '');
    template = template.replace(/%ARTIST_NAME%/g, artistName);
    template = template.replace(/%PAYOUT_POINT%/g, `₱ ${newPayoutPoint.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    template = template.replace(/%BRAND_NAME%/g, brand?.name || 'Your Label');
    template = template.replace(/%BRAND_COLOR%/g, brand?.brand_color || '#1595e7');
    template = template.replace(/%MEMBER_NAME%/g, updaterName);
    template = template.replace(/%URL%/g, `${process.env.FRONTEND_URL}/financial#payments`);

    const subject = `Payout point for ${artistName} updated.`;
    return await sendEmail(recipients, subject, template);
  } catch (error) {
    console.error('Error sending payout point notification:', error);
    return false;
  }
};

// Send earnings notification (matching PHP logic)
export const sendEarningsNotification = async (
  recipients: string[],
  artistName: string,
  releaseTitle: string,
  earningDescription: string,
  earningAmount: string,
  recuperatedExpense: string,
  recuperableBalance: string,
  royaltyAmount: string | null,
  brandName: string,
  brandColor: string,
  brandLogo: string,
  dashboardUrl: string
): Promise<boolean> => {
  try {
    const templatePath = path.join(__dirname, '../assets/templates/earning_notification.html');
    let template = fs.readFileSync(templatePath, 'utf8');

    // Replace template variables (matching PHP logic)
    template = template.replace(/%LOGO%/g, brandLogo);
    template = template.replace(/%ARTIST_NAME%/g, artistName);
    template = template.replace(/%RELEASE_TITLE%/g, releaseTitle);
    template = template.replace(/%EARNING_DESC%/g, earningDescription);
    template = template.replace(/%EARNING_AMOUNT%/g, earningAmount);
    template = template.replace(/%RECUPERATED_EXPENSE%/g, recuperatedExpense);
    template = template.replace(/%RECUPERABLE_BALANCE%/g, recuperableBalance);
    template = template.replace(/%ROYALTY%/g, royaltyAmount || '(Not applied)');
    template = template.replace(/%BRAND_NAME%/g, brandName);
    template = template.replace(/%BRAND_COLOR%/g, brandColor);
    template = template.replace(/%URL%/g, dashboardUrl);

    const subject = `New earnings posted for ${artistName} - ${releaseTitle}`;
    return await sendEmail(recipients, subject, template);
  } catch (error) {
    console.error('Error sending earnings notification:', error);
    return false;
  }
};

// Send login success notification (matching PHP logic)
export const sendLoginNotification = async (
  userEmail: string,
  firstName: string,
  remoteIp: string,
  proxyIp: string
): Promise<boolean> => {
  const subject = 'Successful login to your account.';
  
  // Using simple HTML template matching PHP logic
  const body = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h3>Hi ${firstName}!</h3>
      <p>We've detected a successful login from your account just now.</p>
      <p>If this was you, you can safely ignore this notification.</p>
      <p>If you didn't log in to your account, please notify your administrator or reply to this email.</p>
      <br>
      <p><strong>Remote login IP:</strong> ${remoteIp}</p>
      <p><strong>Proxy login IP:</strong> ${proxyIp}</p>
      <br>
      <p style="color: #666; font-size: 12px;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  `;

  return await sendEmail([userEmail], subject, body);
};

// Send admin failed login alert (matching PHP logic)
export const sendAdminFailedLoginAlert = async (
  username: string,
  remoteIp: string,
  proxyIp: string
): Promise<boolean> => {
  const subject = 'WARNING: Too many failed logins detected.';
  
  // Match exact PHP email format
  const body = `We've detected multiple login failures for user <b>${username}</b>.<br>Remote login IP: ${remoteIp}<br>Proxy login IP: ${proxyIp}<br><br>`;

  const adminEmail = process.env.ADMIN_EMAIL || 'sy.dexter@gmail.com'; // Matching PHP default
  return await sendEmail([adminEmail], subject, body);
};