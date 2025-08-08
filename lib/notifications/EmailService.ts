import nodemailer from 'nodemailer';
import { EmailTemplate } from './EmailTemplates';

export interface EmailNotificationData {
  to: string;
  username: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private config: EmailConfig;
  private templates: EmailTemplate;

  constructor() {
    this.config = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      },
      from: process.env.SMTP_FROM || 'noreply@morphsave.com'
    };

    this.transporter = nodemailer.createTransporter({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.auth
    });

    this.templates = new EmailTemplate();
  }

  /**
   * Send a notification email
   */
  async sendNotificationEmail(data: EmailNotificationData): Promise<void> {
    try {
      const { subject, html, text } = this.generateEmailContent(data);

      const mailOptions = {
        from: this.config.from,
        to: data.to,
        subject,
        html,
        text
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Email notification sent to ${data.to}`);
    } catch (error) {
      console.error('Failed to send email notification:', error);
      throw error;
    }
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(to: string, username: string): Promise<void> {
    try {
      const { subject, html, text } = this.templates.getWelcomeEmail(username);

      const mailOptions = {
        from: this.config.from,
        to,
        subject,
        html,
        text
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Welcome email sent to ${to}`);
    } catch (error) {
      console.error('Failed to send welcome email:', error);
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(to: string, username: string, resetToken: string): Promise<void> {
    try {
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      const { subject, html, text } = this.templates.getPasswordResetEmail(username, resetUrl);

      const mailOptions = {
        from: this.config.from,
        to,
        subject,
        html,
        text
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Password reset email sent to ${to}`);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw error;
    }
  }

  /**
   * Send weekly digest email
   */
  async sendWeeklyDigest(
    to: string, 
    username: string, 
    digestData: {
      totalSaved: number;
      achievementsUnlocked: number;
      challengesCompleted: number;
      yieldEarned: number;
      streakDays: number;
    }
  ): Promise<void> {
    try {
      const { subject, html, text } = this.templates.getWeeklyDigestEmail(username, digestData);

      const mailOptions = {
        from: this.config.from,
        to,
        subject,
        html,
        text
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Weekly digest sent to ${to}`);
    } catch (error) {
      console.error('Failed to send weekly digest:', error);
      throw error;
    }
  }

  /**
   * Send challenge invitation email
   */
  async sendChallengeInviteEmail(
    to: string, 
    username: string, 
    challengeName: string, 
    inviterName: string,
    challengeUrl: string
  ): Promise<void> {
    try {
      const { subject, html, text } = this.templates.getChallengeInviteEmail(
        username, 
        challengeName, 
        inviterName, 
        challengeUrl
      );

      const mailOptions = {
        from: this.config.from,
        to,
        subject,
        html,
        text
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Challenge invite email sent to ${to}`);
    } catch (error) {
      console.error('Failed to send challenge invite email:', error);
      throw error;
    }
  }

  /**
   * Generate email content based on notification type
   */
  private generateEmailContent(data: EmailNotificationData): { subject: string; html: string; text: string } {
    switch (data.type) {
      case 'achievement':
        return this.templates.getAchievementEmail(data.username, data.title, data.message, data.data);
      
      case 'challenge':
        return this.templates.getChallengeEmail(data.username, data.title, data.message, data.data);
      
      case 'savings_milestone':
        return this.templates.getSavingsMilestoneEmail(data.username, data.title, data.message, data.data);
      
      case 'system':
        return this.templates.getSystemEmail(data.username, data.title, data.message);
      
      default:
        return this.templates.getGenericEmail(data.username, data.title, data.message);
    }
  }

  /**
   * Test email configuration
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('Email service connection verified');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }

  /**
   * Send test email
   */
  async sendTestEmail(to: string): Promise<void> {
    try {
      const mailOptions = {
        from: this.config.from,
        to,
        subject: 'MorphSave - Test Email',
        html: '<h1>Test Email</h1><p>This is a test email from MorphSave notification system.</p>',
        text: 'Test Email - This is a test email from MorphSave notification system.'
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Test email sent to ${to}`);
    } catch (error) {
      console.error('Failed to send test email:', error);
      throw error;
    }
  }
}