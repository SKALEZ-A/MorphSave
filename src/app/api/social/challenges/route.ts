import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db/prisma';
import { verifyAuth } from '../../../../lib/middleware/auth';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.userId!;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';

    let whereClause: any = {};

    // Filter by status
    if (status === 'active') {
      whereClause.status = 'ACTIVE';
    } else if (status === 'upcoming') {
      whereClause.status = 'UPCOMING';
    } else if (status === 'completed') {
      whereClause.status = 'COMPLETED';
    } else if (status === 'my-challenges') {
      whereClause.creatorId = userId;
    }

    // Get challenges
    const challenges = await prisma.challenge.findMany({
      where: whereClause,
      include: {
        creator: {
          select: {
            username: true,
            profileImage: true
          }
        },
        participants: {
          include: {
            user: {
              select: {
                username: true,
                profileImage: true,
                level: true
              }
            }
          },
          orderBy: {
            currentProgress: 'desc'
          }
        },
        rewards: {
          orderBy: {
            position: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Format challenges data
    const formattedChallenges = challenges.map(challenge => ({
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      type: challenge.type.toLowerCase(),
      targetAmount: challenge.targetAmount,
      duration: challenge.duration,
      startDate: challenge.startDate,
      endDate: challenge.endDate,
      creatorId: challenge.creatorId,
      creator: challenge.creator,
      participants: challenge.participants.map((p, index) => ({
        id: p.id,
        userId: p.userId,
        user: p.user,
        joinedAt: p.joinedAt,
        currentProgress: p.currentProgress,
        rank: index + 1,
        isCompleted: p.isCompleted
      })),
      rewards: challenge.rewards.map(r => ({
        id: r.id,
        type: r.type.toLowerCase(),
        value: r.value,
        description: r.description,
        position: r.position
      })),
      status: challenge.status.toLowerCase(),
      isPublic: challenge.isPublic,
      maxParticipants: challenge.maxParticipants
    }));

    return NextResponse.json({
      success: true,
      data: formattedChallenges
    });
  } catch (error) {
    console.error('Error fetching challenges:', error);
    return NextResponse.json(
      { error: 'Failed to fetch challenges' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = authResult.userId!;
    const body = await request.json();
    
    const {
      title,
      description,
      type,
      targetAmount,
      duration,
      isPublic,
      maxParticipants,
      rewards
    } = body;

    // Validate required fields
    if (!title || !description || !type || !duration) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Calculate start and end dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + duration);

    // Create challenge
    const challenge = await prisma.challenge.create({
      data: {
        title,
        description,
        type: type.toUpperCase(),
        targetAmount: targetAmount || null,
        duration,
        startDate,
        endDate,
        creatorId: userId,
        status: 'ACTIVE',
        isPublic: isPublic ?? true,
        maxParticipants: maxParticipants || null,
        rewards: {
          create: [
            {
              type: 'POINTS',
              value: rewards?.first?.points || 500,
              description: 'First place reward',
              position: 1
            },
            {
              type: 'MONEY',
              value: rewards?.first?.money || 25,
              description: 'First place bonus',
              position: 1
            },
            {
              type: 'POINTS',
              value: rewards?.second?.points || 300,
              description: 'Second place reward',
              position: 2
            },
            {
              type: 'MONEY',
              value: rewards?.second?.money || 15,
              description: 'Second place bonus',
              position: 2
            },
            {
              type: 'POINTS',
              value: rewards?.third?.points || 200,
              description: 'Third place reward',
              position: 3
            },
            {
              type: 'MONEY',
              value: rewards?.third?.money || 10,
              description: 'Third place bonus',
              position: 3
            },
            {
              type: 'POINTS',
              value: rewards?.participation?.points || 50,
              description: 'Participation reward',
              position: 99
            }
          ]
        },
        participants: {
          create: {
            userId: userId,
            currentProgress: 0,
            isCompleted: false
          }
        }
      },
      include: {
        creator: {
          select: {
            username: true,
            profileImage: true
          }
        },
        participants: {
          include: {
            user: {
              select: {
                username: true,
                profileImage: true,
                level: true
              }
            }
          }
        },
        rewards: true
      }
    });

    // TODO: Send notifications to friends if public challenge
    // TODO: Award challenge creation achievement points

    return NextResponse.json({
      success: true,
      data: challenge
    });
  } catch (error) {
    console.error('Error creating challenge:', error);
    return NextResponse.json(
      { error: 'Failed to create challenge' },
      { status: 500 }
    );
  }
}