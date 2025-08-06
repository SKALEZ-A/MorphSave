'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { 
  Users, 
  UserPlus, 
  Search, 
  MoreVertical, 
  MessageCircle, 
  UserMinus,
  Shield,
  Trophy,
  TrendingUp
} from 'lucide-react';

interface Friend {
  id: string;
  username: string;
  email: string;
  profileImage?: string;
  status: 'active' | 'pending' | 'blocked';
  totalSaved: number;
  currentStreak: number;
  level: number;
  mutualFriends: number;
  joinedAt: Date;
  lastActive: Date;
}

interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUser: {
    username: string;
    email: string;
    profileImage?: string;
    level: number;
    totalSaved: number;
  };
  createdAt: Date;
  message?: string;
}

export const FriendsList: React.FC = () => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [showFriendMenu, setShowFriendMenu] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');

  useEffect(() => {
    loadFriendsData();
  }, []);

  const loadFriendsData = async () => {
    try {
      setLoading(true);
      
      // Load friends list
      const friendsResponse = await fetch('/api/social/friends');
      if (friendsResponse.ok) {
        const friendsData = await friendsResponse.json();
        setFriends(friendsData.data);
      }

      // Load friend requests
      const requestsResponse = await fetch('/api/social/friend-requests');
      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        setFriendRequests(requestsData.data);
      }
    } catch (error) {
      console.error('Error loading friends data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/social/friend-requests/${requestId}/accept`, {
        method: 'POST'
      });
      
      if (response.ok) {
        await loadFriendsData();
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/social/friend-requests/${requestId}/decline`, {
        method: 'POST'
      });
      
      if (response.ok) {
        setFriendRequests(prev => prev.filter(req => req.id !== requestId));
      }
    } catch (error) {
      console.error('Error declining friend request:', error);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    try {
      const response = await fetch(`/api/social/friends/${friendId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setFriends(prev => prev.filter(friend => friend.id !== friendId));
        setShowFriendMenu(null);
      }
    } catch (error) {
      console.error('Error removing friend:', error);
    }
  };

  const handleBlockFriend = async (friendId: string) => {
    try {
      const response = await fetch(`/api/social/friends/${friendId}/block`, {
        method: 'POST'
      });
      
      if (response.ok) {
        setFriends(prev => prev.map(friend => 
          friend.id === friendId 
            ? { ...friend, status: 'blocked' }
            : friend
        ));
        setShowFriendMenu(null);
      }
    } catch (error) {
      console.error('Error blocking friend:', error);
    }
  };

  const filteredFriends = friends.filter(friend =>
    friend.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatLastActive = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Friends</h2>
          </div>
          <Button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Invite Friends
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-6">
          <button
            onClick={() => setActiveTab('friends')}
            className={`pb-2 border-b-2 font-medium text-sm ${
              activeTab === 'friends'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Friends ({friends.filter(f => f.status === 'active').length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`pb-2 border-b-2 font-medium text-sm ${
              activeTab === 'requests'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Requests ({friendRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`pb-2 border-b-2 font-medium text-sm ${
              activeTab === 'search'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Find Friends
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'friends' && (
          <div>
            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Friends List */}
            {filteredFriends.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchQuery ? 'No friends found' : 'No friends yet'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {searchQuery 
                    ? 'Try adjusting your search terms'
                    : 'Start building your savings community by inviting friends!'
                  }
                </p>
                {!searchQuery && (
                  <Button onClick={() => setShowInviteModal(true)}>
                    Invite Your First Friend
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        {friend.profileImage ? (
                          <img
                            src={friend.profileImage}
                            alt={friend.username}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold">
                              {friend.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                          friend.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                        }`}></div>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{friend.username}</h3>
                          <div className="flex items-center gap-1 text-yellow-600">
                            <Trophy className="w-3 h-3" />
                            <span className="text-xs font-medium">Level {friend.level}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            <span>${friend.totalSaved.toFixed(2)} saved</span>
                          </div>
                          <div>
                            {friend.currentStreak} day streak
                          </div>
                          <div>
                            Last active: {formatLastActive(friend.lastActive)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-1"
                      >
                        <MessageCircle className="w-3 h-3" />
                        Message
                      </Button>
                      
                      <div className="relative">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowFriendMenu(
                            showFriendMenu === friend.id ? null : friend.id
                          )}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                        
                        {showFriendMenu === friend.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                            <button
                              onClick={() => handleRemoveFriend(friend.id)}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <UserMinus className="w-4 h-4" />
                              Remove Friend
                            </button>
                            <button
                              onClick={() => handleBlockFriend(friend.id)}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <Shield className="w-4 h-4" />
                              Block User
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div>
            {friendRequests.length === 0 ? (
              <div className="text-center py-8">
                <UserPlus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No friend requests</h3>
                <p className="text-gray-600">
                  When someone sends you a friend request, it will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {friendRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      {request.fromUser.profileImage ? (
                        <img
                          src={request.fromUser.profileImage}
                          alt={request.fromUser.username}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold">
                            {request.fromUser.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{request.fromUser.username}</h3>
                          <div className="flex items-center gap-1 text-yellow-600">
                            <Trophy className="w-3 h-3" />
                            <span className="text-xs font-medium">Level {request.fromUser.level}</span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">
                          ${request.fromUser.totalSaved.toFixed(2)} saved
                        </p>
                        {request.message && (
                          <p className="text-sm text-gray-700 mt-1 italic">"{request.message}"</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleAcceptRequest(request.id)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Accept
                      </Button>
                      <Button
                        onClick={() => handleDeclineRequest(request.id)}
                        variant="outline"
                        size="sm"
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <div>
            <p className="text-gray-600 mb-4">
              Search for friends by username or email address to send them a friend request.
            </p>
            {/* Friend search component would go here */}
            <div className="text-center py-8 text-gray-500">
              Friend search functionality coming soon...
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <Modal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          title="Invite Friends"
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              Invite your friends to join MorphSave and start saving together!
            </p>
            {/* Invite functionality would go here */}
            <div className="text-center py-8 text-gray-500">
              Invite functionality coming soon...
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};