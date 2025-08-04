import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { updateUser } from '@/lib/db/user';

export async function PUT(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const body = await req.json();
      const { 
        firstName, 
        lastName, 
        bio, 
        profileImage, 
        dateOfBirth, 
        phoneNumber, 
        country, 
        timezone,
        savingsGoal,
        monthlyTarget,
        riskTolerance,
        roundUpEnabled,
        roundUpAmount,
        notificationsEnabled,
        autoInvestEnabled,
        autoCompoundEnabled,
        privacyLevel,
        currency,
        language,
        theme
      } = body;

      // Validate input
      if (roundUpAmount && (roundUpAmount < 0.5 || roundUpAmount > 5.0)) {
        return NextResponse.json(
          { error: 'Round up amount must be between $0.50 and $5.00' },
          { status: 400 }
        );
      }

      if (riskTolerance && !['LOW', 'MEDIUM', 'HIGH'].includes(riskTolerance)) {
        return NextResponse.json(
          { error: 'Invalid risk tolerance level' },
          { status: 400 }
        );
      }

      // Update user profile
      const updatedUser = await updateUser(req.user!.id, {
        firstName,
        lastName,
        bio,
        profileImage,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        phoneNumber,
        country,
        timezone,
        savingsGoal,
        monthlyTarget,
        riskTolerance,
        roundUpEnabled,
        roundUpAmount,
        notificationsEnabled,
        autoInvestEnabled,
        autoCompoundEnabled,
        privacyLevel,
        currency,
        language,
        theme
      });

      // Return updated user data (excluding sensitive information)
      const userData = {
        id: updatedUser.id,
        email: updatedUser.email,
        username: updatedUser.username,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        bio: updatedUser.bio,
        profileImage: updatedUser.profileImage,
        dateOfBirth: updatedUser.dateOfBirth,
        phoneNumber: updatedUser.phoneNumber,
        country: updatedUser.country,
        timezone: updatedUser.timezone,
        savingsGoal: updatedUser.savingsGoal,
        monthlyTarget: updatedUser.monthlyTarget,
        riskTolerance: updatedUser.riskTolerance,
        roundUpEnabled: updatedUser.roundUpEnabled,
        roundUpAmount: updatedUser.roundUpAmount,
        notificationsEnabled: updatedUser.notificationsEnabled,
        autoInvestEnabled: updatedUser.autoInvestEnabled,
        autoCompoundEnabled: updatedUser.autoCompoundEnabled,
        privacyLevel: updatedUser.privacyLevel,
        currency: updatedUser.currency,
        language: updatedUser.language,
        theme: updatedUser.theme,
        updatedAt: updatedUser.updatedAt
      };

      return NextResponse.json({
        success: true,
        user: userData,
        message: 'Profile updated successfully'
      });

    } catch (error) {
      console.error('Profile update error:', error);
      
      if (error instanceof Error) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  });
}