import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db/prisma';
import { verifyAuth } from '../../../../lib/middleware/auth';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.userId!;
    const body = await request.json();
    const { emails, message } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: 'Email addresses are required' },
        { status: 400 }
      );
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = emails.filter(email => emailRegex.test(email));

    if (validEmails.length === 0) {
      return NextResponse.json(
        { error: 'No valid email addresses provided' },
        { status: 400 }
      );
    }

    // Get user info for the invitation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        email: true
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Create invitation records
    const invitations = await Promise.all(
      validEmails.map(email =>
        prisma.invitation.create({
          data: {
            inviterId: userId,
            email: email,
            message: message || null,
            status: 'SENT'
          }
        })
      )
    );

    // TODO: Send actual email invitations
    // For now, we'll just log the invitations
    console.log('Email invitations to send:', {
      from: user.email,
      fromName: user.username,
      emails: validEmails,
      message: message,
      inviteLink: `${process.env.NEXT_PUBLIC_APP_URL}/register?ref=${Buffer.from(userId).toString('base64')}`
    });

    return NextResponse.json({
      success: true,
      data: {
        sent: validEmails.length,
        invitations: invitations.map(inv => ({
          id: inv.id,
          email: inv.email,
          status: inv.status
        }))
      }
    });
  } catch (error) {
    console.error('Error sending invitations:', error);
    return NextResponse.json(
      { error: 'Failed to send invitations' },
      { status: 500 }
    );
  }
}