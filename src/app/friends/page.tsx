'use client';

import React, { useState } from 'react';
import { MainLayout } from '../../components/layout/MainLayout';
import { FriendsList } from '../../components/social/FriendsList';
import { FriendSearch } from '../../components/social/FriendSearch';
import { FriendInvite } from '../../components/social/FriendInvite';
import { Button } from '../../components/ui/Button';
import { Users, UserPlus, Search } from 'lucide-react';

export default function FriendsPage() {
  const [activeView, setActiveView] = useState<'list' | 'search' | 'invite'>('list');
  const [showInviteModal, setShowInviteModal] = useState(false);

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Friends & Social</h1>
                <p className="text-gray-600 mt-2">
                  Connect with friends, compete in challenges, and save together
                </p>
              </div>
              <Button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Invite Friends
              </Button>
            </div>

            {/* View Toggle */}
            <div className="flex space-x-1 bg-white p-1 rounded-lg border shadow-sm">
              <button
                onClick={() => setActiveView('list')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeView === 'list'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Users className="w-4 h-4" />
                My Friends
              </button>
              <button
                onClick={() => setActiveView('search')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeView === 'search'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Search className="w-4 h-4" />
                Find Friends
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {activeView === 'list' && <FriendsList />}
            {activeView === 'search' && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Find Friends</h2>
                <FriendSearch />
              </div>
            )}
          </div>

          {/* Invite Modal */}
          <FriendInvite
            isOpen={showInviteModal}
            onClose={() => setShowInviteModal(false)}
          />
        </div>
      </div>
    </MainLayout>
  );
}