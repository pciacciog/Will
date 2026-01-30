/**
 * Email Service - Simple Resend integration for password reset
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

class EmailService {
  private apiKey: string | null = null;
  private fromEmail: string = 'onboarding@resend.dev'; // Default test domain

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY || null;
    
    if (process.env.EMAIL_FROM) {
      this.fromEmail = process.env.EMAIL_FROM;
    }
    
    if (this.apiKey) {
      console.log('[EmailService] ✅ Resend API key configured');
      console.log(`[EmailService] Sending from: ${this.fromEmail}`);
    } else {
      console.log('[EmailService] ⚠️ RESEND_API_KEY not set - emails will be logged only');
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const { to, subject, html } = options;
    
    if (!this.apiKey) {
      console.log('[EmailService] 📧 SIMULATION MODE - Email would be sent:');
      console.log(`  To: ${to}`);
      console.log(`  Subject: ${subject}`);
      console.log(`  Body: ${html.substring(0, 200)}...`);
      return true;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: [to],
          subject,
          html,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[EmailService] ❌ Failed to send email:', error);
        return false;
      }

      const result = await response.json();
      console.log(`[EmailService] ✅ Email sent successfully: ${result.id}`);
      return true;
    } catch (error) {
      console.error('[EmailService] ❌ Error sending email:', error);
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, resetToken: string, baseUrl: string): Promise<boolean> {
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #10b981; font-size: 28px; margin: 0;">🖐️ WILL</h1>
          </div>
          
          <h2 style="color: #1f2937; font-size: 22px; margin-bottom: 20px;">Reset Your Password</h2>
          
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
            We received a request to reset your password. Click the button below to create a new password:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #0d9488 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            This link will expire in <strong>1 hour</strong> for security reasons.
          </p>
          
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
            If you didn't request this, you can safely ignore this email. Your password won't be changed.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            If the button doesn't work, copy and paste this link:<br>
            <a href="${resetLink}" style="color: #10b981; word-break: break-all;">${resetLink}</a>
          </p>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Reset Your WILL Password',
      html,
    });
  }
}

export const emailService = new EmailService();
