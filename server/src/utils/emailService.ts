import nodemailer, { type Transporter } from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// Create transporter using Gmail SMTP or custom SMTP if configured
const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || '';
const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '';
const smtpFrom = process.env.SMTP_FROM || `"Tagore Hostel Safety System" <${smtpUser || 'no-reply@hostelsafety.edu'}>`;

let transporter: Transporter | null = null;

if (smtpUser && smtpPass) {
  try {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
    console.log(`[Email Service] Configured live SMTP transport via ${smtpHost} for ${smtpUser}`);
  } catch (err: any) {
    console.warn('[Email Service Warning] Failed to initialize live SMTP transporter:', err.message);
  }
}

export interface PasswordResetEmailParams {
  toEmail: string;
  recipientName: string;
  otp: string;
  expiresInMinutes?: number;
}

export async function sendPasswordResetEmail({
  toEmail,
  recipientName,
  otp,
  expiresInMinutes = 10
}: PasswordResetEmailParams): Promise<{ sent: boolean; messageId?: string; simulated?: boolean; error?: string }> {
  const subject = `Hostel Safety Portal: Password Reset Code [${otp}]`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f8fc; margin: 0; padding: 24px; color: #172033; }
        .card { background: #ffffff; max-width: 520px; margin: 0 auto; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        .header { border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 24px; }
        .logo-title { font-size: 18px; font-weight: 700; color: #1e3a8a; display: flex; align-items: center; gap: 8px; }
        .otp-box { background: #eff6ff; border: 2px dashed #93c5fd; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
        .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #1d4ed8; }
        .expiry-note { font-size: 12px; color: #64748b; margin-top: 8px; }
        .footer { border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 28px; font-size: 11px; color: #94a3b8; text-align: center; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="logo-title">🏛️ Tagore Central Hostel Complex</div>
          <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Automated Identity & Access Verification Portal</p>
        </div>

        <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0;">Password Reset Request</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
          Hello <strong>${recipientName}</strong>,
        </p>
        <p style="font-size: 13px; line-height: 1.6; color: #475569;">
          We received a request to reset your password for the Hostel Safety & Biometric Attendance System. Please use the 6-digit one-time verification code below to authorize this password change:
        </p>

        <div class="otp-box">
          <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; tracking-wider; color: #2563eb; margin-bottom: 6px;">
            One-Time Password (OTP)
          </div>
          <div class="otp-code">${otp}</div>
          <div class="expiry-note">This code will expire in ${expiresInMinutes} minutes. Never share this code with anyone.</div>
        </div>

        <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
          If you did not request a password reset, you can safely disregard this email. Your password will remain unchanged, and your account remains secure.
        </p>

        <div class="footer">
          Tagore Central Hostel Complex Management & Security Office<br>
          For assistance or urgent reporting, please contact the Chief Warden's Desk.
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Tagore Central Hostel Complex - Password Reset Code

Hello ${recipientName},

We received a request to reset your password for the Hostel Safety System.
Your 6-digit verification code is: ${otp}

This code will expire in ${expiresInMinutes} minutes.
If you did not request this, please ignore this email.
  `.trim();

  // If live transporter is active, attempt to send real email
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: smtpFrom,
        to: toEmail,
        subject,
        text: textContent,
        html: htmlContent
      });
      console.log(`[Email Service] Live email successfully dispatched to ${toEmail} (MessageId: ${info.messageId})`);
      return { sent: true, messageId: info.messageId, simulated: false };
    } catch (err: any) {
      console.warn(`[Email Service Error] Failed to send live email via SMTP to ${toEmail}:`, err.message);
      // Fallback to simulated delivery confirmation
    }
  }

  // Fallback: Log email details cleanly to server console
  console.log(`------------------------------------------------------------`);
  console.log(`📧 [GMAIL PASSWORD RESET DISPATCH]`);
  console.log(`   To: ${toEmail} (${recipientName})`);
  console.log(`   Subject: ${subject}`);
  console.log(`   OTP: ${otp} (Valid for ${expiresInMinutes} min)`);
  console.log(`   Status: Simulated dispatch (Configure GMAIL_USER & GMAIL_APP_PASSWORD in .env for live SMTP delivery)`);
  console.log(`------------------------------------------------------------`);

  return { sent: true, simulated: true };
}
