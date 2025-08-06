'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Search, UserPlus, Users, Trophy, TrendingUp } from 'lucide-react';
import { debounce } from 'lodash';

interface SearchResult {
    id: string;
    username: string;
    email: string;
    profileImage?: string;
    level: number;
    totalSaved: number;
    currentStreak: number;
    mutualFriends: number;
    isAlreadyFriend: boolean;
    hasPendingRequest: boolean;
}

export const FriendSearch: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [sendingRequests, setSendingRequests] = useState<Set<string>>(new Set());

    // Debounced search function
    const debouncedSearch = useCallback(
        debounce(async (query: string) => {
            if (query.trim().length < 2) {
                setSearchResults([]);
                setHasSearched(false);
                return;
            }

            setLoading(true);
            try {
                const response = await fetch(`/api/social/search?q=${encodeURIComponent(query)}`);
                if (response.ok) {
                    const data = await response.json();
                    setSearchResults(data.data);
                    setHasSearched(true);
                }
            } catch (error) {
                console.error('Error searching for users:', error);
            } finally {
                setLoading(false);
            }
        }, 300),
        []
    );

    useEffect(() => {
        debouncedSearch(searchQuery);
    }, [searchQuery, debouncedSearch]);

    const handleSendFriendRequest = async (userId: string, message?: string) => {
        setSendingRequests(prev => new Set([...prev, userId]));

        try {
            const response = await fetch('/api/social/friend-requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    toUserId: userId,
                    message: message || undefined
                })
            });

            if (response.ok) {
                // Update the search result to show pending request
                setSearchResults(prev => prev.map(user =>
                    user.id === userId
                        ? { ...user, hasPendingRequest: true }
                        : user
                ));
            }
        } catch (error) {
            console.error('Error sending friend request:', error);
        } finally {
            setSendingRequests(prev => {
                const newSet = new Set(prev);
                newSet.delete(userId);
                return newSet;
            });
        }
    };

    return (
        <div className="space-y-6">
            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                    type="text"
                    placeholder="Search by username or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Search Results */}
            {loading && (
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                            <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                            <div className="flex-1">
                                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            </div>
                            <div className="w-20 h-8 bg-gray-200 rounded"></div>
                        </div>
                    ))}
                </div>
            )}

            {!loading && hasSearched && searchResults.length === 0 && (
                <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
                    <p className="text-gray-600">
                        Try searching with a different username or email address.
                    </p>
                </div>
            )}

            {!loading && searchResults.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Search Results ({searchResults.length})
                    </h3>

                    {searchResults.map((user) => (
                        <div
                            key={user.id}
                            className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-center gap-4">
                                {user.profileImage ? (
                                    <img
                                        src={user.profileImage}
                                        alt={user.username}
                                        className="w-12 h-12 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                        <span className="text-blue-600 font-semibold">
                                            {user.username.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                )}

                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-semibold text-gray-900">{user.username}</h3>
                                        <div className="flex items-center gap-1 text-yellow-600">
                                            <Trophy className="w-3 h-3" />
                                            <span className="text-xs font-medium">Level {user.level}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                        <div className="flex items-center gap-1">
                                            <TrendingUp className="w-3 h-3" />
                                            <span>${user.totalSaved.toFixed(2)} saved</span>
                                        </div>
                                        <div>
                                            {user.currentStreak} day streak
                                        </div>
                                        {user.mutualFriends > 0 && (
                                            <div className="flex items-center gap-1">
                                                <Users className="w-3 h-3" />
                                                <span>{user.mutualFriends} mutual friends</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {user.isAlreadyFriend ? (
                                    <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                        Friends
                                    </div>
                                ) : user.hasPendingRequest ? (
                                    <div className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                                        Request Sent
                                    </div>
                                ) : (
                                    <Button
                                        onClick={() => handleSendFriendRequest(user.id)}
                                        disabled={sendingRequests.has(user.id)}
                                        size="sm"
                                        className="flex items-center gap-1"
                                    >
                                        <UserPlus className="w-3 h-3" />
                                        {sendingRequests.has(user.id) ? 'Sending...' : 'Add Friend'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!hasSearched && !loading && (
                <div className="text-center py-8">
                    <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Find Your Friends</h3>
                    <p className="text-gray-600">
                        Search for friends by their username or email address to connect and save together.
                    </p>
                </div>
            )}
        </div>
    );
};