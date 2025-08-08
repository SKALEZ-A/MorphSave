export class EmailTemplate {
  private baseTemplate(title: string, content: string): { html: string; text: string } {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8fafc;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 28px;
            font-weight: bold;
            color: #3b82f6;
            margin-bottom: 10px;
        }
        .title {
            font-size: 24px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 20px;
        }
        .content {
            font-size: 16px;
            line-height: 1.6;
            color: #4b5563;
        }
        .button {
            display: inline-block;
            background: #3b82f6;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 14px;
            color: #6b7280;
        }
        .stats {
            background: #f3f4f6;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .stat-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        .stat-value {
            font-weight: 600;
            color: #059669;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🏦 MorphSave</div>
            <div class="title">${title}</div>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p>This email was sent by MorphSave. If you no longer wish to receive these emails, you can <a href="${process.env.FRONTEND_URL}/settings/notifications">update your preferences</a>.</p>
            <p>&copy; 2024 MorphSave. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

    const text = this.htmlToText(html);
    return { html, text };
  }

  getWelcomeEmail(username: string): { subject: string; html: string; text: string } {
    const subject = 'Welcome to MorphSave! 🎉';
    const content = `
        <p>Hi ${username},</p>
        <p>Welcome to MorphSave! We're excited to help you transform the way you save money through gamification and blockchain technology.</p>
        <p>Here's what you can do to get started:</p>
        <ul>
            <li>🏦 Connect your bank account for automatic round-up savings</li>
            <li>🎯 Set your first savings goal</li>
            <li>🏆 Unlock achievements as you save</li>
            <li>👥 Invite friends and join savings challenges</li>
            <li>📈 Watch your savings grow with DeFi yields</li>
        </ul>
        <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Get Started</a>
        <p>Happy saving!</p>
        <p>The MorphSave Team</p>
    `;

    const { html, text } = this.baseTemplate(subject, content);
    return { subject, html, text };
  }

  getAchievementEmail(username: string, title: string, message: string, data?: any): { subject: string; html: string; text: string } {
    const subject = `🏆 Achievement Unlocked: ${title}`;
    const content = `
        <p>Hi ${username},</p>
        <p>Congratulations! You've unlocked a new achievement:</p>
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h2 style="margin: 0; font-size: 24px;">${data?.icon || '🏆'} ${title}</h2>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${message}</p>
            ${data?.points ? `<p style="margin: 10px 0 0 0; font-weight: bold;">+${data.points} points earned!</p>` : ''}
        </div>
        <p>Keep up the great work! Every achievement brings you closer to your savings goals.</p>
        <a href="${process.env.FRONTEND_URL}/achievements" class="button">View All Achievements</a>
    `;

    const { html, text } = this.baseTemplate(subject, content);
    return { subject, html, text };
  }

  getChallengeEmail(username: string, title: string, message: string, data?: any): { subject: string; html: string; text: string } {
    const subject = `🎯 Challenge Update: ${title}`;
    const content = `
        <p>Hi ${username},</p>
        <p>${message}</p>
        ${data?.challengeName ? `<p><strong>Challenge:</strong> ${data.challengeName}</p>` : ''}
        ${data?.progress ? `<p><strong>Your Progress:</strong> $${data.progress.toFixed(2)}</p>` : ''}
        ${data?.rank ? `<p><strong>Current Rank:</strong> #${data.rank}</p>` : ''}
        <a href="${process.env.FRONTEND_URL}/challenges" class="button">View Challenge</a>
    `;

    const { html, text } = this.baseTemplate(subject, content);
    return { subject, html, text };
  }

  getSavingsMilestoneEmail(username: string, title: string, message: string, data?: any): { subject: string; html: string; text: string } {
    const subject = `💰 Savings Milestone: ${title}`;
    const content = `
        <p>Hi ${username},</p>
        <p>Amazing news! ${message}</p>
        ${data?.totalSaved ? `
        <div class="stats">
            <div class="stat-item">
                <span>Total Saved:</span>
                <span class="stat-value">$${data.totalSaved.toFixed(2)}</span>
            </div>
            ${data.yieldEarned ? `
            <div class="stat-item">
                <span>Yield Earned:</span>
                <span class="stat-value">$${data.yieldEarned.toFixed(2)}</span>
            </div>
            ` : ''}
            ${data.streakDays ? `
            <div class="stat-item">
                <span>Savings Streak:</span>
                <span class="stat-value">${data.streakDays} days</span>
            </div>
            ` : ''}
        </div>
        ` : ''}
        <p>Keep up the momentum! Your financial future is looking brighter every day.</p>
        <a href="${process.env.FRONTEND_URL}/dashboard" class="button">View Dashboard</a>
    `;

    const { html, text } = this.baseTemplate(subject, content);
    return { subject, html, text };
  }

  getWeeklyDigestEmail(username: string, digestData: any): { subject: string; html: string; text: string } {
    const subject = '📊 Your Weekly Savings Summary';
    const content = `
        <p>Hi ${username},</p>
        <p>Here's your weekly savings summary:</p>
        <div class="stats">
            <div class="stat-item">
                <span>💰 Total Saved This Week:</span>
                <span class="stat-value">$${digestData.totalSaved.toFixed(2)}</span>
            </div>
            <div class="stat-item">
                <span>🏆 Achievements Unlocked:</span>
                <span class="stat-value">${digestData.achievementsUnlocked}</span>
            </div>
            <div class="stat-item">
                <span>🎯 Challenges Completed:</span>
                <span class="stat-value">${digestData.challengesCompleted}</span>
            </div>
            <div class="stat-item">
                <span>📈 Yield Earned:</span>
                <span class="stat-value">$${digestData.yieldEarned.toFixed(2)}</span>
            </div>
            <div class="stat-item">
                <span>🔥 Current Streak:</span>
                <span class="stat-value">${digestData.streakDays} days</span>
            </div>
        </div>
        <p>You're doing great! Keep building those healthy savings habits.</p>
        <a href="${process.env.FRONTEND_URL}/dashboard" class="button">View Full Dashboard</a>
    `;

    const { html, text } = this.baseTemplate(subject, content);
    return { subject, html, text };
  }

  getChallengeInviteEmail(username: string, challengeName: string, inviterName: string, challengeUrl: string): { subject: string; html: string; text: string } {
    const subject = `🎯 You're Invited to Join "${challengeName}"`;
    const content = `
        <p>Hi ${username},</p>
        <p>${inviterName} has invited you to join the savings challenge "<strong>${challengeName}</strong>"!</p>
        <p>Savings challenges are a fun way to stay motivated and compete with friends while building your financial future.</p>
        <p>Join now to:</p>
        <ul>
            <li>🏆 Compete on the leaderboard</li>
            <li>💪 Stay motivated with friends</li>
            <li>🎁 Earn bonus rewards</li>
            <li>📈 Track your progress together</li>
        </ul>
        <a href="${challengeUrl}" class="button">Join Challenge</a>
        <p>Don't miss out on the fun!</p>
    `;

    const { html, text } = this.baseTemplate(subject, content);
    return { subject, html, text };
  }

  getPasswordResetEmail(username: string, resetUrl: string): { subject: string; html: string; text: string } {
    const subject = 'Reset Your MorphSave Password';
    const content = `
        <p>Hi ${username},</p>
        <p>We received a request to reset your MorphSave password. Click the button below to create a new password:</p>
        <a href="${resetUrl}" class="button">Reset Password</a>
        <p>This link will expire in 1 hour for security reasons.</p>
        <p>If you didn't request this password reset, please ignore this email. Your account remains secure.</p>
        <p>Need help? Contact our support team at support@morphsave.com</p>
    `;

    const { html, text } = this.baseTemplate(subject, content);
    return { subject, html, text };
  }

  getSystemEmail(username: string, title: string, message: string): { subject: string; html: string; text: string } {
    const subject = `MorphSave: ${title}`;
    const content = `
        <p>Hi ${username},</p>
        <p>${message}</p>
        <p>If you have any questions, please don't hesitate to contact our support team.</p>
        <a href="${process.env.FRONTEND_URL}/support" class="button">Contact Support</a>
    `;

    const { html, text } = this.baseTemplate(subject, content);
    return { subject, html, text };
  }

  getGenericEmail(username: string, title: string, message: string): { subject: string; html: string; text: string } {
    const subject = title;
    const content = `
        <p>Hi ${username},</p>
        <p>${message}</p>
        <a href="${process.env.FRONTEND_URL}/dashboard" class="button">View Dashboard</a>
    `;

    const { html, text } = this.baseTemplate(subject, content);
    return { subject, html, text };
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  }
}