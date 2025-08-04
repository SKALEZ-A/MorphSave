import { prisma } from './prisma';
import { Challenge, ChallengeParticipant, ChallengeType, ChallengeStatus, Prisma } from '@prisma/client';

export interface CreateChallengeInput {
  creatorId: string;
  title: string;
  description: string;
  type: ChallengeType;
  targetAmount?: number;
  duration: number; // in days
  startDate?: Date;
}

export interface UpdateChallengeInput {
  title?: string;
  description?: string;
  targetAmount?: number;
  duration?: number;
  status?: ChallengeStatus;
}

export interface ChallengeWithParticipants extends Challenge {
  creator: {
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
    profileImage?: string;
  };
  participants: Array<{
    id: string;
    userId: string;
    currentProgress: number;
    rank?: number;
    joinedAt: Date;
    user: {
      username: string;
      firstName?: string;
      lastName?: string;
      profileImage?: string;
    };
  }>;
  participantCount: number;
  isParticipating?: boolean;
  userProgress?: number;
}

export interface ChallengeStats {
  totalChallenges: number;
  activeChallenges: number;
  completedChallenges: number;
  totalParticipants: number;
  averageParticipants: number;
  byType: Record<ChallengeType, number>;
  popularChallenges: Array<{
    id: string;
    title: string;
    participantCount: number;
  }>;
}

/**
 * Create a new challenge
 */
export async function createChallenge(input: CreateChallengeInput): Promise<Challenge> {
  const startDate = input.startDate || new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + input.duration);

  const challenge = await prisma.challenge.create({
    data: {
      creatorId: input.creatorId,
      title: input.title,
      description: input.description,
      type: input.type,
      targetAmount: input.targetAmount,
      duration: input.duration,
      startDate,
      endDate,
      status: ChallengeStatus.ACTIVE
    }
  });

  // Automatically add creator as participant
  await joinChallenge(challenge.id, input.creatorId);

  return challenge;
}

/**
 * Get challenge by ID with participants
 */
export async function getChallengeById(
  id: string,
  userId?: string
): Promise<ChallengeWithParticipants | null> {
  const challenge = await prisma.challenge.findUnique({
    where: { id },
    include: {
      creator: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          profileImage: true
        }
      },
      participants: {
        include: {
          user: {
            select: {
              username: true,
              firstName: true,
              lastName: true,
              profileImage: true
            }
          }
        },
        orderBy: [
          { rank: 'asc' },
          { currentProgress: 'desc' },
          { joinedAt: 'asc' }
        ]
      }
    }
  });

  if (!challenge) return null;

  const userParticipation = userId 
    ? challenge.participants.find(p => p.userId === userId)
    : undefined;

  return {
    ...challenge,
    participantCount: challenge.participants.length,
    isParticipating: !!userParticipation,
    userProgress: userParticipation?.currentProgress
  };
}

/**
 * Get active challenges with pagination
 */
export async function getActiveChallenges(
  page: number = 1,
  limit: number = 20,
  userId?: string
): Promise<{
  challenges: ChallengeWithParticipants[];
  total: number;
  hasMore: boolean;
}> {
  const where: Prisma.ChallengeWhereInput = {
    status: ChallengeStatus.ACTIVE,
    endDate: { gt: new Date() }
  };

  const [challenges, total] = await Promise.all([
    prisma.challenge.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profileImage: true
          }
        },
        participants: {
          include: {
            user: {
              select: {
                username: true,
                firstName: true,
                lastName: true,
                profileImage: true
              }
            }
          },
          orderBy: { currentProgress: 'desc' },
          take: 5 // Show top 5 participants
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.challenge.count({ where })
  ]);

  const challengesWithParticipation = challenges.map(challenge => {
    const userParticipation = userId 
      ? challenge.participants.find(p => p.userId === userId)
      : undefined;

    return {
      ...challenge,
      participantCount: challenge.participants.length,
      isParticipating: !!userParticipation,
      userProgress: userParticipation?.currentProgress
    };
  });

  return {
    challenges: challengesWithParticipation,
    total,
    hasMore: total > page * limit
  };
}

/**
 * Join a challenge
 */
export async function joinChallenge(
  challengeId: string,
  userId: string
): Promise<ChallengeParticipant> {
  // Check if challenge exists and is active
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId }
  });

  if (!challenge) {
    throw new Error('Challenge not found');
  }

  if (challenge.status !== ChallengeStatus.ACTIVE) {
    throw new Error('Challenge is not active');
  }

  if (challenge.endDate < new Date()) {
    throw new Error('Challenge has ended');
  }

  // Check if user is already participating
  const existingParticipation = await prisma.challengeParticipant.findUnique({
    where: {
      userId_challengeId: {
        userId,
        challengeId
      }
    }
  });

  if (existingParticipation) {
    throw new Error('User is already participating in this challenge');
  }

  // Add user as participant
  const participant = await prisma.challengeParticipant.create({
    data: {
      userId,
      challengeId,
      currentProgress: 0
    }
  });

  // Create notification for challenge creator
  await prisma.notification.create({
    data: {
      userId: challenge.creatorId,
      type: 'CHALLENGE',
      title: 'New Challenge Participant',
      message: `Someone joined your challenge "${challenge.title}"`,
      data: {
        challengeId: challenge.id,
        participantId: userId
      }
    }
  });

  return participant;
}

/**
 * Leave a challenge
 */
export async function leaveChallenge(
  challengeId: string,
  userId: string
): Promise<boolean> {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId }
  });

  if (!challenge) {
    throw new Error('Challenge not found');
  }

  // Don't allow creator to leave their own challenge
  if (challenge.creatorId === userId) {
    throw new Error('Challenge creator cannot leave their own challenge');
  }

  const result = await prisma.challengeParticipant.delete({
    where: {
      userId_challengeId: {
        userId,
        challengeId
      }
    }
  });

  return !!result;
}

/**
 * Update participant progress
 */
export async function updateChallengeProgress(
  challengeId: string,
  userId: string,
  progress: number
): Promise<ChallengeParticipant> {
  const participant = await prisma.challengeParticipant.update({
    where: {
      userId_challengeId: {
        userId,
        challengeId
      }
    },
    data: {
      currentProgress: progress
    }
  });

  // Check if challenge is completed
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId }
  });

  if (challenge && challenge.targetAmount && progress >= challenge.targetAmount) {
    await checkChallengeCompletion(challengeId);
  }

  return participant;
}

/**
 * Get user's challenges
 */
export async function getUserChallenges(
  userId: string,
  status?: ChallengeStatus
): Promise<ChallengeWithParticipants[]> {
  const where: Prisma.ChallengeParticipantWhereInput = {
    userId,
    ...(status && {
      challenge: {
        status
      }
    })
  };

  const participations = await prisma.challengeParticipant.findMany({
    where,
    include: {
      challenge: {
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profileImage: true
            }
          },
          participants: {
            include: {
              user: {
                select: {
                  username: true,
                  firstName: true,
                  lastName: true,
                  profileImage: true
                }
              }
            },
            orderBy: { currentProgress: 'desc' }
          }
        }
      }
    },
    orderBy: { joinedAt: 'desc' }
  });

  return participations.map(participation => ({
    ...participation.challenge,
    participantCount: participation.challenge.participants.length,
    isParticipating: true,
    userProgress: participation.currentProgress
  }));
}

/**
 * Get challenges created by user
 */
export async function getUserCreatedChallenges(
  userId: string
): Promise<ChallengeWithParticipants[]> {
  const challenges = await prisma.challenge.findMany({
    where: { creatorId: userId },
    include: {
      creator: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          profileImage: true
        }
      },
      participants: {
        include: {
          user: {
            select: {
              username: true,
              firstName: true,
              lastName: true,
              profileImage: true
            }
          }
        },
        orderBy: { currentProgress: 'desc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  return challenges.map(challenge => ({
    ...challenge,
    participantCount: challenge.participants.length,
    isParticipating: challenge.participants.some(p => p.userId === userId),
    userProgress: challenge.participants.find(p => p.userId === userId)?.currentProgress
  }));
}

/**
 * Update challenge rankings
 */
export async function updateChallengeRankings(challengeId: string): Promise<void> {
  const participants = await prisma.challengeParticipant.findMany({
    where: { challengeId },
    orderBy: { currentProgress: 'desc' }
  });

  // Update rankings
  for (let i = 0; i < participants.length; i++) {
    await prisma.challengeParticipant.update({
      where: { id: participants[i].id },
      data: { rank: i + 1 }
    });
  }
}

/**
 * Check if challenge is completed and update status
 */
async function checkChallengeCompletion(challengeId: string): Promise<void> {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: {
      participants: {
        orderBy: { currentProgress: 'desc' }
      }
    }
  });

  if (!challenge) return;

  // Check if challenge should be completed
  const shouldComplete = 
    challenge.endDate < new Date() || 
    (challenge.targetAmount && 
     challenge.participants.some(p => p.currentProgress >= challenge.targetAmount));

  if (shouldComplete && challenge.status === ChallengeStatus.ACTIVE) {
    // Update challenge status
    await prisma.challenge.update({
      where: { id: challengeId },
      data: { status: ChallengeStatus.COMPLETED }
    });

    // Update final rankings
    await updateChallengeRankings(challengeId);

    // Notify participants
    const winner = challenge.participants[0];
    if (winner) {
      // Notify winner
      await prisma.notification.create({
        data: {
          userId: winner.userId,
          type: 'CHALLENGE',
          title: 'Challenge Won!',
          message: `Congratulations! You won the challenge "${challenge.title}"`,
          data: {
            challengeId: challenge.id,
            rank: 1
          }
        }
      });

      // Notify other participants
      for (let i = 1; i < challenge.participants.length; i++) {
        const participant = challenge.participants[i];
        await prisma.notification.create({
          data: {
            userId: participant.userId,
            type: 'CHALLENGE',
            title: 'Challenge Completed',
            message: `The challenge "${challenge.title}" has ended. You finished in position ${i + 1}`,
            data: {
              challengeId: challenge.id,
              rank: i + 1
            }
          }
        });
      }
    }
  }
}

/**
 * Get challenge statistics
 */
export async function getChallengeStats(): Promise<ChallengeStats> {
  const [
    totalChallenges,
    activeChallenges,
    completedChallenges,
    totalParticipants,
    challengesByType,
    popularChallenges
  ] = await Promise.all([
    prisma.challenge.count(),
    prisma.challenge.count({ where: { status: ChallengeStatus.ACTIVE } }),
    prisma.challenge.count({ where: { status: ChallengeStatus.COMPLETED } }),
    prisma.challengeParticipant.count(),
    
    prisma.challenge.groupBy({
      by: ['type'],
      _count: { id: true }
    }),
    
    prisma.challenge.findMany({
      select: {
        id: true,
        title: true,
        _count: {
          select: {
            participants: true
          }
        }
      },
      orderBy: {
        participants: {
          _count: 'desc'
        }
      },
      take: 5
    })
  ]);

  const averageParticipants = totalChallenges > 0 ? totalParticipants / totalChallenges : 0;

  const byType = challengesByType.reduce((acc, item) => {
    acc[item.type] = item._count.id;
    return acc;
  }, {} as Record<ChallengeType, number>);

  return {
    totalChallenges,
    activeChallenges,
    completedChallenges,
    totalParticipants,
    averageParticipants,
    byType,
    popularChallenges: popularChallenges.map(challenge => ({
      id: challenge.id,
      title: challenge.title,
      participantCount: challenge._count.participants
    }))
  };
}

/**
 * Update challenge
 */
export async function updateChallenge(
  id: string,
  input: UpdateChallengeInput
): Promise<Challenge> {
  const updateData: any = { ...input };
  
  // If duration is updated, recalculate end date
  if (input.duration) {
    const challenge = await prisma.challenge.findUnique({
      where: { id },
      select: { startDate: true }
    });
    
    if (challenge) {
      const endDate = new Date(challenge.startDate);
      endDate.setDate(endDate.getDate() + input.duration);
      updateData.endDate = endDate;
    }
  }

  return prisma.challenge.update({
    where: { id },
    data: updateData
  });
}

/**
 * Cancel challenge
 */
export async function cancelChallenge(id: string): Promise<Challenge> {
  const challenge = await prisma.challenge.update({
    where: { id },
    data: { status: ChallengeStatus.CANCELLED }
  });

  // Notify all participants
  const participants = await prisma.challengeParticipant.findMany({
    where: { challengeId: id },
    include: {
      user: {
        select: { id: true }
      }
    }
  });

  for (const participant of participants) {
    await prisma.notification.create({
      data: {
        userId: participant.userId,
        type: 'CHALLENGE',
        title: 'Challenge Cancelled',
        message: `The challenge "${challenge.title}" has been cancelled`,
        data: {
          challengeId: challenge.id
        }
      }
    });
  }

  return challenge;
}

/**
 * Get challenge leaderboard
 */
export async function getChallengeLeaderboard(
  challengeId: string
): Promise<Array<{
  rank: number;
  userId: string;
  username: string;
  firstName?: string;
  lastName?: string;
  profileImage?: string;
  progress: number;
  joinedAt: Date;
}>> {
  const participants = await prisma.challengeParticipant.findMany({
    where: { challengeId },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          profileImage: true
        }
      }
    },
    orderBy: [
      { rank: 'asc' },
      { currentProgress: 'desc' },
      { joinedAt: 'asc' }
    ]
  });

  return participants.map((participant, index) => ({
    rank: participant.rank || index + 1,
    userId: participant.user.id,
    username: participant.user.username,
    firstName: participant.user.firstName,
    lastName: participant.user.lastName,
    profileImage: participant.user.profileImage,
    progress: participant.currentProgress,
    joinedAt: participant.joinedAt
  }));
}

/**
 * Process expired challenges
 */
export async function processExpiredChallenges(): Promise<number> {
  const expiredChallenges = await prisma.challenge.findMany({
    where: {
      status: ChallengeStatus.ACTIVE,
      endDate: { lt: new Date() }
    }
  });

  let processedCount = 0;

  for (const challenge of expiredChallenges) {
    await checkChallengeCompletion(challenge.id);
    processedCount++;
  }

  return processedCount;
}