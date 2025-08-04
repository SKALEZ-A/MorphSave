import { prisma } from './prisma';
import { Friendship, FriendshipStatus, Prisma } from '@prisma/client';

export interface FriendshipWithUser extends Friendship {
    friend: {
        id: string;
        username: string;
        firstName?: string;
        lastName?: string;
        profileImage?: string;
        level: number;
        totalPoints: number;
        currentStreak: number;
    };
}

export interface FriendRequest extends Friendship {
    user: {
        id: string;
        username: string;
        firstName?: string;
        lastName?: string;
        profileImage?: string;
        level: number;
        totalPoints: number;
    };
}

export interface SocialStats {
    totalFriends: number;
    pendingRequests: number;
    sentRequests: number;
    mutualFriends: number;
    friendsThisMonth: number;
    topFriends: Array<{
        userId: string;
        username: string;
        totalPoints: number;
        sharedChallenges: number;
    }>;
}

/**
 * Send friend request
 */
export async function sendFriendRequest(
    userId: string,
    friendId: string
): Promise<Friendship> {
    // Validate users exist
    const [user, friend] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.user.findUnique({ where: { id: friendId } })
    ]);

    if (!user || !friend) {
        throw new Error('User not found');
    }

    if (userId === friendId) {
        throw new Error('Cannot send friend request to yourself');
    }

    // Check if friendship already exists
    const existingFriendship = await prisma.friendship.findFirst({
        where: {
            OR: [
                { userId, friendId },
                { userId: friendId, friendId: userId }
            ]
        }
    });

    if (existingFriendship) {
        if (existingFriendship.status === FriendshipStatus.ACCEPTED) {
            throw new Error('Users are already friends');
        }
        if (existingFriendship.status === FriendshipStatus.PENDING) {
            throw new Error('Friend request already sent');
        }
        if (existingFriendship.status === FriendshipStatus.BLOCKED) {
            throw new Error('Cannot send friend request to blocked user');
        }
    }

    // Create friendship
    const friendship = await prisma.friendship.create({
        data: {
            userId,
            friendId,
            status: FriendshipStatus.PENDING
        }
    });

    // Create notification for recipient
    await prisma.notification.create({
        data: {
            userId: friendId,
            type: 'SOCIAL',
            title: 'New Friend Request',
            message: `${user.username} sent you a friend request`,
            data: {
                friendshipId: friendship.id,
                fromUserId: userId
            }
        }
    });

    return friendship;
}

/**
 * Accept friend request
 */
export async function acceptFriendRequest(
    userId: string,
    friendshipId: string
): Promise<Friendship> {
    const friendship = await prisma.friendship.findUnique({
        where: { id: friendshipId },
        include: {
            user: {
                select: {
                    id: true,
                    username: true
                }
            }
        }
    });

    if (!friendship) {
        throw new Error('Friend request not found');
    }

    if (friendship.friendId !== userId) {
        throw new Error('Not authorized to accept this friend request');
    }

    if (friendship.status !== FriendshipStatus.PENDING) {
        throw new Error('Friend request is not pending');
    }

    // Update friendship status
    const updatedFriendship = await prisma.friendship.update({
        where: { id: friendshipId },
        data: {
            status: FriendshipStatus.ACCEPTED,
            acceptedAt: new Date()
        }
    });

    // Create notification for requester
    await prisma.notification.create({
        data: {
            userId: friendship.userId,
            type: 'SOCIAL',
            title: 'Friend Request Accepted',
            message: `${friendship.user.username} accepted your friend request`,
            data: {
                friendshipId: friendship.id,
                fromUserId: userId
            }
        }
    });

    return updatedFriendship;
}

/**
 * Decline friend request
 */
export async function declineFriendRequest(
    userId: string,
    friendshipId: string
): Promise<boolean> {
    const friendship = await prisma.friendship.findUnique({
        where: { id: friendshipId }
    });

    if (!friendship) {
        throw new Error('Friend request not found');
    }

    if (friendship.friendId !== userId) {
        throw new Error('Not authorized to decline this friend request');
    }

    if (friendship.status !== FriendshipStatus.PENDING) {
        throw new Error('Friend request is not pending');
    }

    // Delete the friendship record
    await prisma.friendship.delete({
        where: { id: friendshipId }
    });

    return true;
}

/**
 * Remove friend
 */
export async function removeFriend(
    userId: string,
    friendId: string
): Promise<boolean> {
    const friendship = await prisma.friendship.findFirst({
        where: {
            OR: [
                { userId, friendId, status: FriendshipStatus.ACCEPTED },
                { userId: friendId, friendId: userId, status: FriendshipStatus.ACCEPTED }
            ]
        }
    });

    if (!friendship) {
        throw new Error('Friendship not found');
    }

    // Delete the friendship
    await prisma.friendship.delete({
        where: { id: friendship.id }
    });

    return true;
}

/**
 * Block user
 */
export async function blockUser(
    userId: string,
    userToBlockId: string
): Promise<Friendship> {
    if (userId === userToBlockId) {
        throw new Error('Cannot block yourself');
    }

    // Remove existing friendship if any
    await prisma.friendship.deleteMany({
        where: {
            OR: [
                { userId, friendId: userToBlockId },
                { userId: userToBlockId, friendId: userId }
            ]
        }
    });

    // Create blocked relationship
    return prisma.friendship.create({
        data: {
            userId,
            friendId: userToBlockId,
            status: FriendshipStatus.BLOCKED
        }
    });
}

/**
 * Unblock user
 */
export async function unblockUser(
    userId: string,
    userToUnblockId: string
): Promise<boolean> {
    const result = await prisma.friendship.deleteMany({
        where: {
            userId,
            friendId: userToUnblockId,
            status: FriendshipStatus.BLOCKED
        }
    });

    return result.count > 0;
}

/**
 * Get user's friends
 */
export async function getUserFriends(userId: string): Promise<FriendshipWithUser[]> {
    const friendships = await prisma.friendship.findMany({
        where: {
            OR: [
                { userId, status: FriendshipStatus.ACCEPTED },
                { friendId: userId, status: FriendshipStatus.ACCEPTED }
            ]
        },
        include: {
            user: {
                select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    profileImage: true,
                    level: true,
                    totalPoints: true,
                    currentStreak: true
                }
            },
            friend: {
                select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    profileImage: true,
                    level: true,
                    totalPoints: true,
                    currentStreak: true
                }
            }
        },
        orderBy: { acceptedAt: 'desc' }
    });

    // Map to consistent format (always show the other user as 'friend')
    return friendships.map(friendship => ({
        ...friendship,
        friend: friendship.userId === userId ? friendship.friend : friendship.user
    }));
}

/**
 * Get pending friend requests (received)
 */
export async function getPendingFriendRequests(userId: string): Promise<FriendRequest[]> {
    return prisma.friendship.findMany({
        where: {
            friendId: userId,
            status: FriendshipStatus.PENDING
        },
        include: {
            user: {
                select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    profileImage: true,
                    level: true,
                    totalPoints: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
}

/**
 * Get sent friend requests
 */
export async function getSentFriendRequests(userId: string): Promise<FriendRequest[]> {
    return prisma.friendship.findMany({
        where: {
            userId,
            status: FriendshipStatus.PENDING
        },
        include: {
            friend: {
                select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    profileImage: true,
                    level: true,
                    totalPoints: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    }) as any; // Type assertion needed due to include structure
}

/**
 * Get blocked users
 */
export async function getBlockedUsers(userId: string): Promise<FriendshipWithUser[]> {
    return prisma.friendship.findMany({
        where: {
            userId,
            status: FriendshipStatus.BLOCKED
        },
        include: {
            friend: {
                select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    profileImage: true,
                    level: true,
                    totalPoints: true,
                    currentStreak: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    }) as any;
}

/**
 * Check friendship status between two users
 */
export async function getFriendshipStatus(
    userId: string,
    otherUserId: string
): Promise<{
    status: FriendshipStatus | 'none';
    canSendRequest: boolean;
    friendship?: Friendship;
}> {
    const friendship = await prisma.friendship.findFirst({
        where: {
            OR: [
                { userId, friendId: otherUserId },
                { userId: otherUserId, friendId: userId }
            ]
        }
    });

    if (!friendship) {
        return {
            status: 'none',
            canSendRequest: true
        };
    }

    const canSendRequest = friendship.status === FriendshipStatus.BLOCKED ? false :
        friendship.status === FriendshipStatus.ACCEPTED ? false :
            friendship.status === FriendshipStatus.PENDING ? false : true;

    return {
        status: friendship.status,
        canSendRequest,
        friendship
    };
}

/**
 * Get mutual friends between two users
 */
export async function getMutualFriends(
    userId: string,
    otherUserId: string
): Promise<Array<{
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
    profileImage?: string;
}>> {
    // Get friends of both users
    const [userFriends, otherUserFriends] = await Promise.all([
        getUserFriends(userId),
        getUserFriends(otherUserId)
    ]);

    const userFriendIds = new Set(userFriends.map(f => f.friend.id));
    const mutualFriends = otherUserFriends
        .filter(f => userFriendIds.has(f.friend.id))
        .map(f => ({
            id: f.friend.id,
            username: f.friend.username,
            firstName: f.friend.firstName,
            lastName: f.friend.lastName,
            profileImage: f.friend.profileImage
        }));

    return mutualFriends;
}

/**
 * Get friend suggestions for user
 */
export async function getFriendSuggestions(
    userId: string,
    limit: number = 10
): Promise<Array<{
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
    profileImage?: string;
    level: number;
    totalPoints: number;
    mutualFriends: number;
    reason: string;
}>> {
    // Get user's current friends and blocked users
    const [friends, blocked] = await Promise.all([
        getUserFriends(userId),
        getBlockedUsers(userId)
    ]);

    const excludeIds = new Set([
        userId,
        ...friends.map(f => f.friend.id),
        ...blocked.map(b => b.friend.id)
    ]);

    // Get users with mutual friends
    const suggestions = await prisma.user.findMany({
        where: {
            id: { notIn: Array.from(excludeIds) },
            isActive: true
        },
        select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            level: true,
            totalPoints: true
        },
        take: limit * 2, // Get more to filter and rank
        orderBy: { totalPoints: 'desc' }
    });

    // Calculate mutual friends and add reasons
    const suggestionsWithMutuals = await Promise.all(
        suggestions.map(async (user) => {
            const mutualFriends = await getMutualFriends(userId, user.id);

            let reason = 'Active saver';
            if (mutualFriends.length > 0) {
                reason = `${mutualFriends.length} mutual friend${mutualFriends.length > 1 ? 's' : ''}`;
            } else if (user.level >= 5) {
                reason = 'High level saver';
            } else if (user.totalPoints > 1000) {
                reason = 'Top performer';
            }

            return {
                ...user,
                mutualFriends: mutualFriends.length,
                reason
            };
        })
    );

    // Sort by mutual friends first, then by points
    return suggestionsWithMutuals
        .sort((a, b) => {
            if (a.mutualFriends !== b.mutualFriends) {
                return b.mutualFriends - a.mutualFriends;
            }
            return b.totalPoints - a.totalPoints;
        })
        .slice(0, limit);
}

/**
 * Get user's social statistics
 */
export async function getUserSocialStats(userId: string): Promise<SocialStats> {
    const [
        friends,
        pendingRequests,
        sentRequests,
        friendsThisMonth
    ] = await Promise.all([
        getUserFriends(userId),
        getPendingFriendRequests(userId),
        getSentFriendRequests(userId),
        prisma.friendship.count({
            where: {
                OR: [
                    { userId, status: FriendshipStatus.ACCEPTED },
                    { friendId: userId, status: FriendshipStatus.ACCEPTED }
                ],
                acceptedAt: {
                    gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                }
            }
        })
    ]);

    // Get mutual friends count (approximate)
    let mutualFriendsCount = 0;
    if (friends.length > 0) {
        const randomFriend = friends[Math.floor(Math.random() * friends.length)];
        const mutualFriends = await getMutualFriends(userId, randomFriend.friend.id);
        mutualFriendsCount = mutualFriends.length;
    }

    // Get top friends (by shared challenges)
    const topFriends = await prisma.challengeParticipant.groupBy({
        by: ['userId'],
        where: {
            challenge: {
                participants: {
                    some: {
                        userId
                    }
                }
            },
            userId: { not: userId }
        },
        _count: {
            challengeId: true
        },
        orderBy: {
            _count: {
                challengeId: 'desc'
            }
        },
        take: 5
    });

    const topFriendsWithDetails = await Promise.all(
        topFriends.map(async (tf) => {
            const user = await prisma.user.findUnique({
                where: { id: tf.userId },
                select: {
                    id: true,
                    username: true,
                    totalPoints: true
                }
            });

            return {
                userId: tf.userId,
                username: user?.username || 'Unknown',
                totalPoints: user?.totalPoints || 0,
                sharedChallenges: tf._count.challengeId
            };
        })
    );

    return {
        totalFriends: friends.length,
        pendingRequests: pendingRequests.length,
        sentRequests: sentRequests.length,
        mutualFriends: mutualFriendsCount,
        friendsThisMonth,
        topFriends: topFriendsWithDetails
    };
}

/**
 * Search for users to add as friends
 */
export async function searchUsersForFriends(
    userId: string,
    query: string,
    limit: number = 20
): Promise<Array<{
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
    profileImage?: string;
    level: number;
    totalPoints: number;
    friendshipStatus: FriendshipStatus | 'none';
    mutualFriends: number;
}>> {
    // Get current friends and blocked users to exclude
    const [friends, blocked] = await Promise.all([
        getUserFriends(userId),
        getBlockedUsers(userId)
    ]);

    const excludeIds = new Set([
        userId,
        ...friends.map(f => f.friend.id),
        ...blocked.map(b => b.friend.id)
    ]);

    // Search users
    const users = await prisma.user.findMany({
        where: {
            id: { notIn: Array.from(excludeIds) },
            isActive: true,
            OR: [
                { username: { contains: query, mode: 'insensitive' } },
                { firstName: { contains: query, mode: 'insensitive' } },
                { lastName: { contains: query, mode: 'insensitive' } }
            ]
        },
        select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            level: true,
            totalPoints: true
        },
        take: limit,
        orderBy: { totalPoints: 'desc' }
    });

    // Add friendship status and mutual friends
    const usersWithStatus = await Promise.all(
        users.map(async (user) => {
            const [friendshipStatus, mutualFriends] = await Promise.all([
                getFriendshipStatus(userId, user.id),
                getMutualFriends(userId, user.id)
            ]);

            return {
                ...user,
                friendshipStatus: friendshipStatus.status,
                mutualFriends: mutualFriends.length
            };
        })
    );

    return usersWithStatus;
}

/**
 * Get friendship activity feed
 */
export async function getFriendshipActivityFeed(
    userId: string,
    limit: number = 20
): Promise<Array<{
    type: 'friend_joined' | 'achievement_unlocked' | 'challenge_completed' | 'savings_milestone';
    userId: string;
    username: string;
    profileImage?: string;
    message: string;
    timestamp: Date;
    data?: any;
}>> {
    const friends = await getUserFriends(userId);
    const friendIds = friends.map(f => f.friend.id);

    if (friendIds.length === 0) {
        return [];
    }

    // Get recent activities from friends
    const [recentAchievements, recentChallenges] = await Promise.all([
        // Recent achievements
        prisma.userAchievement.findMany({
            where: {
                userId: { in: friendIds },
                unlockedAt: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        profileImage: true
                    }
                },
                achievement: {
                    select: {
                        name: true,
                        icon: true
                    }
                }
            },
            orderBy: { unlockedAt: 'desc' },
            take: limit / 2
        }),

        // Recent challenge completions
        prisma.challengeParticipant.findMany({
            where: {
                userId: { in: friendIds },
                rank: 1, // Winners only
                challenge: {
                    status: 'COMPLETED',
                    endDate: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        profileImage: true
                    }
                },
                challenge: {
                    select: {
                        title: true
                    }
                }
            },
            orderBy: { challenge: { endDate: 'desc' } },
            take: limit / 2
        })
    ]);

    const activities = [
        ...recentAchievements.map(ua => ({
            type: 'achievement_unlocked' as const,
            userId: ua.user.id,
            username: ua.user.username,
            profileImage: ua.user.profileImage,
            message: `unlocked "${ua.achievement.name}" ${ua.achievement.icon}`,
            timestamp: ua.unlockedAt,
            data: { achievementName: ua.achievement.name }
        })),
        ...recentChallenges.map(cp => ({
            type: 'challenge_completed' as const,
            userId: cp.user.id,
            username: cp.user.username,
            profileImage: cp.user.profileImage,
            message: `won the challenge "${cp.challenge.title}"`,
            timestamp: cp.challenge.endDate,
            data: { challengeTitle: cp.challenge.title }
        }))
    ];

    return activities
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);
}

/**
 * Get friendship statistics for admin
 */
export async function getFriendshipStats() {
    const [
        totalFriendships,
        activeFriendships,
        pendingRequests,
        blockedUsers,
        friendshipsByMonth
    ] = await Promise.all([
        prisma.friendship.count(),
        prisma.friendship.count({ where: { status: FriendshipStatus.ACCEPTED } }),
        prisma.friendship.count({ where: { status: FriendshipStatus.PENDING } }),
        prisma.friendship.count({ where: { status: FriendshipStatus.BLOCKED } }),

        prisma.friendship.groupBy({
            by: ['createdAt'],
            where: {
                status: FriendshipStatus.ACCEPTED,
                createdAt: {
                    gte: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000) // Last 12 months
                }
            },
            _count: { id: true }
        })
    ]);

    return {
        totalFriendships,
        activeFriendships,
        pendingRequests,
        blockedUsers,
        acceptanceRate: totalFriendships > 0 ? (activeFriendships / totalFriendships) * 100 : 0,
        friendshipsByMonth: friendshipsByMonth.length
    };
}