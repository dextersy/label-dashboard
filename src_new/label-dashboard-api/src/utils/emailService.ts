import nodemailer from 'nodemailer';

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

export const sendBrandedEmail = async (
  recipients: string[],
  subject: string,
  templateName: string,
  templateData: any,
  brandInfo?: any
): Promise<boolean> => {
  // In a full implementation, you would load email templates
  // For now, we'll use a simple template system
  let htmlBody = templateData.body || '';

  if (brandInfo) {
    htmlBody = `
      <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <div style="background-color: ${brandInfo.brand_color}; padding: 20px; text-align: center;">
          <img src="${brandInfo.logo_url}" alt="${brandInfo.brand_name}" style="max-height: 60px;">
        </div>
        <div style="padding: 20px;">
          ${htmlBody}
        </div>
        <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 12px; color: #666;">
          <p>© ${new Date().getFullYear()} ${brandInfo.brand_name}. All rights reserved.</p>
        </div>
      </div>
    `;
  }

  return await sendEmail(recipients, subject, htmlBody);
};