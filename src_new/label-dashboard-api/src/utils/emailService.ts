import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import EmailAttempt from '../models/EmailAttempt';
import User from '../models/User';
import Brand from '../models/Brand';
import { getBrandFrontendUrl } from './brandUtils';

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

// Log email attempt to database (matching PHP implementation)
const logEmailAttempt = async (
  recipients: string[],
  subject: string,
  body: string,
  result: boolean,
  brandId: number
): Promise<void> => {
  try {
    await EmailAttempt.create({
      recipients: recipients.join(','),
      subject,
      body,
      result: result ? 'Success' : 'Failed',
      brand_id: brandId,
    });
  } catch (error) {
    console.error('Error logging email attempt:', error);
    // Don't throw - logging failure shouldn't prevent email sending
  }
};

export const sendEmail = async (
  recipients: string[],
  subject: string,
  htmlBody: string,
  brandId: number,
  textBody?: string
): Promise<boolean> => {
  let success = false;
  
  try {
    // Fetch brand information to use brand name as "From" name
    const brand = await Brand.findByPk(brandId);
    const fromName = brand?.brand_name || 'Dashboard';
    const fromEmail = process.env.FROM_EMAIL;
    
    // Quote the display name if it contains special characters like parentheses
    const quotedFromName = /[()<>@,;:\\".\[\]]/.test(fromName) ? `"${fromName}"` : fromName;
    
    const mailOptions = {
      from: `${quotedFromName} <${fromEmail}>`,
      to: recipients.join(', '),
      subject,
      html: htmlBody,
      text: textBody || htmlToText(htmlBody), // Convert HTML to clean text for preview
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    success = true;
  } catch (error) {
    console.error('Email sending failed:', error);
    success = false;
  }

  // Log the email attempt (matching PHP implementation)
  await logEmailAttempt(recipients, subject, htmlBody, success, brandId);
  
  return success;
};

// Helper function to get all admin users for a brand
const getBrandAdministrators = async (brandId: number): Promise<string[]> => {
  try {
    const adminUsers = await User.findAll({
      where: {
        brand_id: brandId,
        is_admin: true
      },
      attributes: ['email_address']
    });

    return adminUsers
      .filter(user => user.email_address)
      .map(user => user.email_address);
  } catch (error) {
    console.error('Error fetching brand administrators:', error);
    return [];
  }
};

export const sendNotificationEmail = async (
  type: 'login_success' | 'login_failure' | 'admin_alert',
  data: any,
  brandId: number
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
      const adminEmailForLogin = process.env.ADMIN_EMAIL;
      if (!adminEmailForLogin) {
        console.log('No admin email configured for login failure notifications, skipping email');
        return false;
      }
      recipients = [adminEmailForLogin];
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
      const adminEmailForAlert = process.env.ADMIN_EMAIL;
      if (!adminEmailForAlert) {
        console.log('No admin email configured for admin alerts, skipping email');
        return false;
      }
      recipients = [adminEmailForAlert];
      body = data.body;
      break;

    default:
      return false;
  }

  return await sendEmail(recipients, subject, body, brandId);
};

// Load email template from file
export const loadEmailTemplate = (templateName: string): string => {
  try {
    const templatePath = path.join(__dirname, '../assets/templates', `${templateName}.html`);
    return fs.readFileSync(templatePath, 'utf8');
  } catch (error) {
    console.error(`Failed to load email template ${templateName}:`, error);
    return '';
  }
};

// Replace template variables with actual values
export const processTemplate = (template: string, data: Record<string, any>): string => {
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
  templateData: Record<string, any>,
  brandId: number
): Promise<boolean> => {
  
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
    case 'payment_notification_email':
      subject = `Payment made to ${templateData.artist || templateData.artistName}!`;
      break;
    case 'event_ticket_email':
      subject = `Here's your ticket to ${templateData.event_name}!`;
      break;
    case 'event_ticket_payment_link':
      subject = `Payment link for ${templateData.event_name}`;
      break;
    case 'event_ticket_canceled_email':
      subject = `Ticket to ${templateData.event_name} has been canceled.`;
      break;
    case 'payment_confirmed':
      subject = `Payment confirmed for ${templateData.event_name}!`;
      break;
    case 'donation_thank_you':
      subject = `Thank you for contributing to ${templateData.FUNDRAISER_TITLE}!`;
      break;
    case 'ticket_admin_notification':
      subject = `New ticket order for ${templateData.EVENT_TITLE} completed.`;
      break;
    case 'donation_admin_notification':
      subject = `New Donation: ${templateData.FUNDRAISER_TITLE}`;
      break;
    default:
      subject = 'Notification';
  }

  try {
    // Fetch brand information to use brand name as "From" name
    const brand = await Brand.findByPk(brandId);
    const fromName = brand?.brand_name || 'Dashboard';
    const fromEmail = process.env.FROM_EMAIL;
    
    // Quote the display name if it contains special characters like parentheses
    const quotedFromName = /[()<>@,;:\\".\[\]]/.test(fromName) ? `"${fromName}"` : fromName;
    
    const mailOptions = {
      from: `${quotedFromName} <${fromEmail}>`,
      to: email,
      subject,
      html: htmlBody,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Branded email sent successfully:', result.messageId);
    
    // Log successful email attempt
    await logEmailAttempt([email], subject, htmlBody, true, brandId);
    return true;
  } catch (error) {
    console.error('Branded email sending failed:', error);
    
    // Log failed email attempt
    await logEmailAttempt([email], subject, htmlBody, false, brandId);
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

  return await sendBrandedEmail(email, 'invite_email', templateData, brandInfo?.id || 1);
};

// Send artist update notification email to specific recipient
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

  return await sendBrandedEmail(email, 'artist_update_email', templateData, brandInfo?.id || 1);
};

// Send artist update notifications to team members AND brand administrators
export const sendArtistUpdateNotifications = async (
  teamEmails: string[],
  artistName: string,
  updaterName: string,
  changes: Array<{field: string, oldValue: string, newValue: string}>,
  dashboardUrl: string,
  brandInfo: any
): Promise<boolean> => {
  try {
    // Get brand administrators
    const adminEmails = await getBrandAdministrators(brandInfo?.id || 1);
    
    // Combine team member emails and admin emails, removing duplicates
    const allRecipients = [...new Set([...teamEmails, ...adminEmails])];
    
    if (allRecipients.length === 0) {
      console.log('No recipients found for artist update notification');
      return false;
    }

    let allSuccessful = true;
    
    // Send notification to each recipient
    for (const email of allRecipients) {
      try {
        const success = await sendArtistUpdateEmail(
          email,
          artistName,
          updaterName,
          changes,
          dashboardUrl,
          brandInfo
        );
        if (!success) {
          allSuccessful = false;
        }
      } catch (emailError) {
        console.error(`Failed to send artist update email to ${email}:`, emailError);
        allSuccessful = false;
      }
    }

    return allSuccessful;
  } catch (error) {
    console.error('Error sending artist update notifications:', error);
    return false;
  }
};

// Send payment method update notification to team members AND brand administrators
export const sendPaymentMethodNotification = async (
  teamRecipients: string[],
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
    // Get brand administrators
    const adminEmails = await getBrandAdministrators(brand?.id || 1);
    
    // Combine team member emails and admin emails, removing duplicates
    const allRecipients = [...new Set([...teamRecipients, ...adminEmails])];
    
    if (allRecipients.length === 0) {
      console.log('No recipients found for payment method notification');
      return false;
    }

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
    template = template.replace(/%LINK%/g, `${await getBrandFrontendUrl(brand?.id || 1)}/financial#payments`);

    const subject = `A new payment method has been added to ${artistName}`;
    return await sendEmail(allRecipients, subject, template, brand?.id || 1);
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
    template = template.replace(/%URL%/g, `${await getBrandFrontendUrl(brand?.id || 1)}/financial#payments`);

    const subject = `Payout point for ${artistName} updated.`;
    return await sendEmail(recipients, subject, template, brand?.id || 1);
  } catch (error) {
    console.error('Error sending payout point notification:', error);
    return false;
  }
};

// Helper function to format currency with thousands separator and 2 decimal places
const formatCurrency = (value: string | number): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '0.00';
  return numValue.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
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
  dashboardUrl: string,
  brandId: number,
  needsPaymentMethod: boolean = false,
  paymentScreenUrl: string = ''
): Promise<boolean> => {
  try {
    const templatePath = path.join(__dirname, '../assets/templates/earning_notification.html');
    let template = fs.readFileSync(templatePath, 'utf8');

    // Format all monetary values with thousands separator and 2 decimal places
    const formattedEarningAmount = formatCurrency(earningAmount);
    const formattedRecuperatedExpense = formatCurrency(recuperatedExpense);
    const formattedRecuperableBalance = formatCurrency(recuperableBalance);
    const formattedRoyalty = royaltyAmount ? formatCurrency(royaltyAmount) : '(Not applied)';

    // Create payment method note if needed
    const paymentMethodNote = needsPaymentMethod && paymentScreenUrl
      ? `<div class="pc-font-alt" style="line-height: 21px; letter-spacing: -0.2px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: normal; font-variant-ligatures: normal; color: #31708f; text-align: left; text-align-last: left; background-color: #d9edf7; padding: 15px; margin: 10px 0; border-left: 4px solid #5bc0de;">
          <div><span style="font-weight: 700;">ℹ️ Payment Method Required</span></div>
          <div style="margin-top: 5px;"><span>You haven't set up a payment method yet. To receive payments, please <a href="${paymentScreenUrl}" style="color: #31708f; text-decoration: underline;">add your payment details here</a>.</span></div>
        </div>`
      : '';

    // Replace template variables (matching PHP logic)
    template = template.replace(/%LOGO%/g, brandLogo);
    template = template.replace(/%ARTIST_NAME%/g, artistName);
    template = template.replace(/%RELEASE_TITLE%/g, releaseTitle);
    template = template.replace(/%EARNING_DESC%/g, earningDescription);
    template = template.replace(/%EARNING_AMOUNT%/g, formattedEarningAmount);
    template = template.replace(/%RECUPERATED_EXPENSE%/g, formattedRecuperatedExpense);
    template = template.replace(/%RECUPERABLE_BALANCE%/g, formattedRecuperableBalance);
    template = template.replace(/%ROYALTY%/g, formattedRoyalty);
    template = template.replace(/%BRAND_NAME%/g, brandName);
    template = template.replace(/%BRAND_COLOR%/g, brandColor);
    template = template.replace(/%URL%/g, dashboardUrl);
    template = template.replace(/%PAYMENT_METHOD_NOTE%/g, paymentMethodNote);

    const subject = `New earnings posted for ${artistName} - ${releaseTitle}`;
    return await sendEmail(recipients, subject, template, brandId);
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
  proxyIp: string,
  brandId: number
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

  return await sendEmail([userEmail], subject, body, brandId);
};

// Send admin failed login alert (matching PHP logic)
export const sendAdminFailedLoginAlert = async (
  username: string,
  remoteIp: string,
  proxyIp: string,
  brandId: number
): Promise<boolean> => {
  const subject = 'WARNING: Too many failed logins detected.';
  
  // Match exact PHP email format
  const body = `We've detected multiple login failures for user <b>${username}</b>.<br>Remote login IP: ${remoteIp}<br>Proxy login IP: ${proxyIp}<br><br>`;

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.log('No admin email configured for failed login alerts, skipping email');
    return false;
  }
  return await sendEmail([adminEmail], subject, body, brandId);
};

// Send payment notification email (matching PHP logic)
export const sendPaymentNotification = async (
  recipients: string[],
  artistName: string,
  payment: {
    amount: number;
    description?: string;
    payment_processing_fee?: number;
    paid_thru_type?: string;
    paid_thru_account_name?: string;
    paid_thru_account_number?: string;
    paymentMethod?: {
      type: string;
      account_name: string;
      account_number_or_email: string;
    } | null;
  },
  brand: {
    name?: string;
    brand_color?: string;
    logo_url?: string;
    id: number;
  },
  dashboardUrl?: string
): Promise<boolean> => {
  try {
    const templatePath = path.join(__dirname, '../assets/templates/payment_notification_email.html');
    let template = fs.readFileSync(templatePath, 'utf8');

    // Calculate net amount (matching PHP logic)
    const processingFee = payment.payment_processing_fee || 0;
    const netAmount = payment.amount - processingFee;

    // Format payment method as "Bank name - Account name - Account number" (matching PHP logic)
    // Prioritize PaymentMethod data over legacy paid_thru_* fields
    let formattedMethod = 'Non-cash / adjustment';
    
    if (payment.paymentMethod) {
      // Use PaymentMethod data (preferred for new payments)
      const { type, account_name, account_number_or_email } = payment.paymentMethod;
      if (type && account_name && account_number_or_email) {
        formattedMethod = `${type} - ${account_name} - ${account_number_or_email}`;
      } else if (type && account_name) {
        formattedMethod = `${type} - ${account_name}`;
      } else if (type) {
        formattedMethod = type;
      }
    } else {
      // Fall back to legacy paid_thru_* fields (for backward compatibility)
      if (payment.paid_thru_type && payment.paid_thru_account_name && payment.paid_thru_account_number) {
        formattedMethod = `${payment.paid_thru_type} - ${payment.paid_thru_account_name} - ${payment.paid_thru_account_number}`;
      } else if (payment.paid_thru_type && payment.paid_thru_account_name) {
        formattedMethod = `${payment.paid_thru_type} - ${payment.paid_thru_account_name}`;
      } else if (payment.paid_thru_type) {
        formattedMethod = payment.paid_thru_type;
      }
    }

    // Replace template variables (matching PHP __generatePaymentEmailFromTemplate logic)
    template = template.replace(/%LOGO%/g, brand.logo_url || '');
    template = template.replace(/%BRAND_NAME%/g, brand.name || '');
    template = template.replace(/%BRAND_COLOR%/g, brand.brand_color || '#1595e7');
    template = template.replace(/%ARTIST%/g, artistName);
    template = template.replace(/%AMOUNT%/g, `₱ ${payment.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    template = template.replace(/%PROCESSING_FEE%/g, `₱ ${processingFee.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    template = template.replace(/%NET_AMOUNT%/g, `₱ ${netAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    template = template.replace(/%DESCRIPTION%/g, payment.description || '');
    template = template.replace(/%METHOD%/g, formattedMethod);
    
    // Set dashboard URL (matching PHP logic)
    if (!dashboardUrl) {
      dashboardUrl = `${await getBrandFrontendUrl(brand.id)}/financial#payments`;
    }
    template = template.replace(/%URL%/g, dashboardUrl);

    // Subject matches PHP logic exactly
    const subject = `Payment made to ${artistName}!`;

    return await sendEmail(recipients, subject, template, brand.id);
  } catch (error) {
    console.error('Error sending payment notification:', error);
    return false;
  }
};

// Send sublabel payment notification email to sublabel admins
export const sendSublabelPaymentNotification = async (
  sublabelBrandId: number,
  sublabelName: string,
  payment: {
    amount: number;
    description?: string;
    payment_processing_fee?: number;
    paid_thru_type?: string;
    paid_thru_account_name?: string;
    paid_thru_account_number?: string;
    paymentMethod?: {
      type: string;
      account_name: string;
      account_number_or_email: string;
    } | null;
  },
  parentBrand: {
    name?: string;
    brand_color?: string;
    logo_url?: string;
    id: number;
  }
): Promise<boolean> => {
  try {
    // Get sublabel administrators
    const recipients = await getBrandAdministrators(sublabelBrandId);
    
    if (recipients.length === 0) {
      console.log('No administrators found for sublabel, skipping payment notification');
      return false;
    }

    // Use the same template as artist payments
    const templatePath = path.join(__dirname, '../assets/templates/payment_notification_email.html');
    let template = fs.readFileSync(templatePath, 'utf8');

    // Calculate net amount
    const processingFee = payment.payment_processing_fee || 0;
    const netAmount = payment.amount - processingFee;

    // Format payment method as "Bank name - Account name - Account number"
    let formattedMethod = 'Non-cash / adjustment';
    
    if (payment.paymentMethod) {
      const { type, account_name, account_number_or_email } = payment.paymentMethod;
      if (type && account_name && account_number_or_email) {
        formattedMethod = `${type} - ${account_name} - ${account_number_or_email}`;
      } else if (type && account_name) {
        formattedMethod = `${type} - ${account_name}`;
      } else if (type) {
        formattedMethod = type;
      }
    } else {
      if (payment.paid_thru_type && payment.paid_thru_account_name && payment.paid_thru_account_number) {
        formattedMethod = `${payment.paid_thru_type} - ${payment.paid_thru_account_name} - ${payment.paid_thru_account_number}`;
      } else if (payment.paid_thru_type && payment.paid_thru_account_name) {
        formattedMethod = `${payment.paid_thru_type} - ${payment.paid_thru_account_name}`;
      } else if (payment.paid_thru_type) {
        formattedMethod = payment.paid_thru_type;
      }
    }

    // Get sublabel's frontend URL for the dashboard link (labels earnings page)
    const dashboardUrl = `${await getBrandFrontendUrl(sublabelBrandId)}/labels/earnings`;

    // Replace template variables - using sublabel name instead of artist name
    template = template.replace(/%LOGO%/g, parentBrand.logo_url || '');
    template = template.replace(/%BRAND_NAME%/g, parentBrand.name || '');
    template = template.replace(/%BRAND_COLOR%/g, parentBrand.brand_color || '#1595e7');
    template = template.replace(/%ARTIST%/g, sublabelName); // Sublabel name in place of artist
    template = template.replace(/%AMOUNT%/g, `₱ ${payment.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    template = template.replace(/%PROCESSING_FEE%/g, `₱ ${processingFee.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    template = template.replace(/%NET_AMOUNT%/g, `₱ ${netAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    template = template.replace(/%DESCRIPTION%/g, payment.description || '');
    template = template.replace(/%METHOD%/g, formattedMethod);
    template = template.replace(/%URL%/g, dashboardUrl);

    const subject = `Payment made to ${sublabelName}!`;

    return await sendEmail(recipients, subject, template, sublabelBrandId);
  } catch (error) {
    console.error('Error sending sublabel payment notification:', error);
    return false;
  }
};

// Send release submission notification to admins
export const sendReleaseSubmissionNotification = async (
  releaseData: {
    title: string;
    catalog_no: string;
    release_date: string;
    track_count: number;
  },
  artistName: string,
  brandId: number
): Promise<boolean> => {
  try {
    // Get brand administrators
    const adminEmails = await getBrandAdministrators(brandId);

    if (adminEmails.length === 0) {
      console.log('No administrators found for brand, skipping release submission notification');
      return false;
    }

    // Fetch brand information
    const brand = await Brand.findByPk(brandId);
    if (!brand) {
      console.error('Brand not found for release submission notification');
      return false;
    }

    // Get brand frontend URL for dashboard link
    const dashboardUrl = await getBrandFrontendUrl(brandId);

    // Load email template
    const templatePath = path.join(__dirname, '../assets/templates/release_submission_notification.html');
    let template = fs.readFileSync(templatePath, 'utf8');

    // Format release date
    const formattedDate = new Date(releaseData.release_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Replace placeholders
    template = template
      .replace(/%BRAND_NAME%/g, brand.brand_name || 'Dashboard')
      .replace(/%BRAND_COLOR%/g, brand.brand_color || '#1595e7')
      .replace(/%LOGO%/g, brand.logo_url || '')
      .replace(/%ARTIST_NAME%/g, artistName)
      .replace(/%RELEASE_TITLE%/g, releaseData.title)
      .replace(/%CATALOG_NO%/g, releaseData.catalog_no)
      .replace(/%RELEASE_DATE%/g, formattedDate)
      .replace(/%TRACK_COUNT%/g, releaseData.track_count.toString())
      .replace(/%DASHBOARD_URL%/g, dashboardUrl);

    const subject = `New Release Submitted: ${releaseData.title}`;

    return await sendEmail(adminEmails, subject, template, brand.id);
  } catch (error) {
    console.error('Error sending release submission notification:', error);
    return false;
  }
};

// Send release pending notification to artist team members
// This is sent when a release status changes to "Pending" (submitted for distribution)
export const sendReleasePendingNotification = async (
  releaseData: {
    id: number;
    title: string;
    catalog_no: string;
    release_date: string;
    track_count: number;
  },
  artistName: string,
  teamEmails: string[],
  brandId: number
): Promise<boolean> => {
  try {
    if (teamEmails.length === 0) {
      console.log('No team members found for release pending notification');
      return false;
    }

    // Fetch brand information
    const brand = await Brand.findByPk(brandId);
    if (!brand) {
      console.error('Brand not found for release pending notification');
      return false;
    }

    // Get brand frontend URL for release link
    const frontendUrl = await getBrandFrontendUrl(brandId);
    const releaseUrl = `${frontendUrl}/music/releases/edit/${releaseData.id}`;

    // Load email template
    const templatePath = path.join(__dirname, '../assets/templates/release_pending_notification.html');
    let template = fs.readFileSync(templatePath, 'utf8');

    // Format release date
    const formattedDate = new Date(releaseData.release_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Replace placeholders
    template = template
      .replace(/%BRAND_NAME%/g, brand.brand_name || 'Dashboard')
      .replace(/%BRAND_COLOR%/g, brand.brand_color || '#1595e7')
      .replace(/%LOGO%/g, brand.logo_url || '')
      .replace(/%ARTIST_NAME%/g, artistName)
      .replace(/%RELEASE_TITLE%/g, releaseData.title)
      .replace(/%CATALOG_NO%/g, releaseData.catalog_no)
      .replace(/%RELEASE_DATE%/g, formattedDate)
      .replace(/%TRACK_COUNT%/g, releaseData.track_count.toString())
      .replace(/%RELEASE_URL%/g, releaseUrl);

    const subject = `🚀 Your release "${releaseData.title}" is on its way!`;

    return await sendEmail(teamEmails, subject, template, brand.id);
  } catch (error) {
    console.error('Error sending release pending notification:', error);
    return false;
  }
};

// Process base64 images and convert them to inline attachments for email
const processInlineImages = (htmlContent: string): { html: string, attachments: any[] } => {
  const base64ImageRegex = /<img[^>]+src="data:image\/([^;]+);base64,([^"]+)"[^>]*>/gi;
  let processedHtml = htmlContent;
  const attachments: any[] = [];
  let match;
  let imageIndex = 0;

  while ((match = base64ImageRegex.exec(htmlContent)) !== null) {
    try {
      const [fullMatch, imageType, base64Data] = match;
      
      // Validate image type
      const allowedTypes = ['jpeg', 'jpg', 'png', 'gif'];
      if (!allowedTypes.includes(imageType.toLowerCase())) {
        console.warn(`Unsupported image type for email: ${imageType}, skipping image`);
        continue;
      }
      
      // Convert base64 to buffer
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      // Check image size limit (5MB for email attachments)
      const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
      if (imageBuffer.length > MAX_IMAGE_SIZE) {
        console.warn(`Image too large for email: ${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB (max: ${MAX_IMAGE_SIZE / 1024 / 1024}MB), skipping image`);
        continue;
      }
      
      // Generate unique content ID for inline attachment
      const cid = `image${imageIndex++}@email`;
      
      // Add attachment
      attachments.push({
        filename: `image${imageIndex}.${imageType}`,
        content: imageBuffer,
        contentType: `image/${imageType}`,
        cid: cid,
        disposition: 'inline'
      });
      
      // Replace base64 src with cid reference
      const newImgTag = fullMatch.replace(/src="data:image\/[^;]+;base64,[^"]+"/, `src="cid:${cid}"`);
      processedHtml = processedHtml.replace(fullMatch, newImgTag);
      
      console.log(`Processed inline image for email: ${imageType} (${(imageBuffer.length / 1024).toFixed(2)}KB)`);
      
    } catch (error) {
      console.error('Failed to process inline image:', error);
    }
  }
  
  return { html: processedHtml, attachments };
};

// Send email with attachments
export const sendEmailWithAttachment = async (
  recipients: string[],
  subject: string,
  htmlBody: string,
  brandId: number,
  attachments: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>
): Promise<boolean> => {
  let success = false;

  try {
    // Fetch brand information to use brand name as "From" name
    const brand = await Brand.findByPk(brandId);
    const fromName = brand?.brand_name || 'Dashboard';
    const fromEmail = process.env.FROM_EMAIL;

    // Quote the display name if it contains special characters like parentheses
    const quotedFromName = /[()<>@,;:\\".\[\]]/.test(fromName) ? `"${fromName}"` : fromName;

    const mailOptions = {
      from: `${quotedFromName} <${fromEmail}>`,
      to: recipients.join(', '),
      subject,
      html: htmlBody,
      text: htmlToText(htmlBody),
      attachments
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email with attachments sent successfully:', result.messageId);
    success = true;
  } catch (error) {
    console.error('Email sending with attachments failed:', error);
    success = false;
  }

  // Log the email attempt
  await logEmailAttempt(recipients, subject, htmlBody, success, brandId);

  return success;
};

// Convert HTML to clean text for email previews
const htmlToText = (html: string): string => {
  let text = html;
  
  // Remove script and style elements completely
  text = text.replace(/<(script|style)[^>]*>[\s\S]*?<\/(script|style)>/gi, '');
  
  // Replace common block elements with line breaks
  text = text.replace(/<(div|p|br|h[1-6]|li|tr)[^>]*>/gi, '\n');
  text = text.replace(/<\/(div|p|h[1-6]|li|tr)>/gi, '\n');
  
  // Replace list items with bullet points
  text = text.replace(/<li[^>]*>/gi, '\n• ');
  
  // Replace table cells with spaces
  text = text.replace(/<(td|th)[^>]*>/gi, ' ');
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  
  // Clean up whitespace
  text = text.replace(/\n\s*\n/g, '\n\n'); // Replace multiple newlines with double newline
  text = text.replace(/[ \t]+/g, ' '); // Replace multiple spaces/tabs with single space
  text = text.replace(/^\s+|\s+$/gm, ''); // Trim lines
  text = text.trim(); // Trim overall
  
  return text;
};


// Send email with inline image support for test emails
export const sendEmailWithInlineImages = async (
  recipients: string[],
  subject: string,
  htmlBody: string,
  brandId: number,
  textBody?: string,
  eventContext?: { eventTitle: string; messageContent: string; isTestEmail: boolean }
): Promise<boolean> => {
  let success = false;
  
  try {
    // Process inline images
    const { html: processedHtml, attachments } = processInlineImages(htmlBody);
    
    // Fetch brand information to use brand name as "From" name
    const brand = await Brand.findByPk(brandId);
    const fromName = brand?.brand_name || 'Dashboard';
    const fromEmail = process.env.FROM_EMAIL;
    
    // Quote the display name if it contains special characters like parentheses
    const quotedFromName = /[()<>@,;:\\".\[\]]/.test(fromName) ? `"${fromName}"` : fromName;
    
    // Generate appropriate text version
    let finalTextBody = textBody;
    if (!finalTextBody) {
      // For event emails, use the original message content; for others, use the processed HTML
      const htmlToConvert = eventContext ? eventContext.messageContent : processedHtml;
      finalTextBody = htmlToText(htmlToConvert);
    }
    
    const mailOptions = {
      from: `${quotedFromName} <${fromEmail}>`,
      to: recipients.join(', '),
      subject,
      html: processedHtml,
      text: finalTextBody,
      attachments: attachments // Include inline attachments
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email with inline images sent successfully:', result.messageId);
    success = true;
  } catch (error) {
    console.error('Email sending with inline images failed:', error);
    success = false;
  }

  // Log the email attempt
  await logEmailAttempt(recipients, subject, htmlBody, success, brandId);
  
  return success;
};