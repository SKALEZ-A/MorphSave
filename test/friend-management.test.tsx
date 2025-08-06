import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FriendsList } from '../src/components/social/FriendsList';
import { FriendSearch } from '../src/components/social/FriendSearch';
import { FriendInvite } from '../src/components/social/FriendInvite';

// Mock fetch globally
global.fetch = jest.fn();

// Mock lodash debounce
jest.mock('lodash', () => ({
  debounce: (fn: any) => fn
}));

const mockFriends = [
  {
    id: '1',
    username: 'john_doe',
    email: 'john@example.com',
    profileImage: null,
    status: 'active',
    totalSaved: 250.75,
    currentStreak: 15,
    level: 3,
    mutualFriends: 2,
    joinedAt: new Date('2024-01-15'),
    lastActive: new Date('2024-03-10')
  },
  {
    id: '2',
    username: 'jane_smith',
    email: 'jane@example.com',
    profileImage: 'https://example.com/avatar.jpg',
    status: 'active',
    totalSaved: 500.00,
    currentStreak: 30,
    level: 5,
    mutualFriends: 1,
    joinedAt: new Date('2024-02-01'),
    lastActive: new Date('2024-03-11')
  }
];

const mockFriendRequests = [
  {
    id: 'req1',
    fromUserId: '3',
    fromUser: {
      username: 'alice_wonder',
      email: 'alice@example.com',
      profileImage: null,
      level: 2,
      totalSaved: 150.25
    },
    createdAt: new Date('2024-03-08'),
    message: 'Hey! Let\'s save together!'
  }
];

const mockSearchResults = [
  {
    id: '4',
    username: 'bob_builder',
    email: 'bob@example.com',
    profileImage: null,
    level: 4,
    totalSaved: 300.50,
    currentStreak: 20,
    mutualFriends: 0,
    isAlreadyFriend: false,
    hasPendingRequest: false
  },
  {
    id: '5',
    username: 'charlie_brown',
    email: 'charlie@example.com',
    profileImage: null,
    level: 1,
    totalSaved: 75.00,
    currentStreak: 5,
    mutualFriends: 1,
    isAlreadyFriend: true,
    hasPendingRequest: false
  }
];

describe('FriendsList', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  it('renders loading state initially', () => {
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    
    render(<FriendsList />);
    
    expect(screen.getByText('Friends')).toBeInTheDocument();
    // Should show loading skeleton
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('loads and displays friends data', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockFriends })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockFriendRequests })
      });

    render(<FriendsList />);

    await waitFor(() => {
      expect(screen.getByText('john_doe')).toBeInTheDocument();
      expect(screen.getByText('jane_smith')).toBeInTheDocument();
      expect(screen.getByText('$250.75 saved')).toBeInTheDocument();
      expect(screen.getByText('15 day streak')).toBeInTheDocument();
    });
  });

  it('handles tab navigation', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockFriends })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockFriendRequests })
      });

    render(<FriendsList />);

    await waitFor(() => {
      expect(screen.getByText('Friends (2)')).toBeInTheDocument();
    });

    // Click on Requests tab
    fireEvent.click(screen.getByText('Requests (1)'));
    
    await waitFor(() => {
      expect(screen.getByText('alice_wonder')).toBeInTheDocument();
      expect(screen.getByText('Hey! Let\'s save together!')).toBeInTheDocument();
    });
  });

  it('handles friend request acceptance', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockFriends })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockFriendRequests })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [...mockFriends] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

    render(<FriendsList />);

    // Switch to requests tab
    await waitFor(() => {
      fireEvent.click(screen.getByText('Requests (1)'));
    });

    // Accept friend request
    const acceptButton = screen.getByText('Accept');
    fireEvent.click(acceptButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/social/friend-requests/req1/accept',
        { method: 'POST' }
      );
    });
  });

  it('handles friend search', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockFriends })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockFriendRequests })
      });

    render(<FriendsList />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search friends...')).toBeInTheDocument();
    });

    // Search for a friend
    const searchInput = screen.getByPlaceholderText('Search friends...');
    fireEvent.change(searchInput, { target: { value: 'john' } });

    // Should filter friends
    await waitFor(() => {
      expect(screen.getByText('john_doe')).toBeInTheDocument();
      expect(screen.queryByText('jane_smith')).not.toBeInTheDocument();
    });
  });

  it('handles friend removal', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockFriends })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockFriendRequests })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

    render(<FriendsList />);

    await waitFor(() => {
      expect(screen.getByText('john_doe')).toBeInTheDocument();
    });

    // Click on friend menu
    const menuButtons = screen.getAllByRole('button');
    const friendMenuButton = menuButtons.find(button => 
      button.querySelector('svg')?.classList.contains('lucide-more-vertical')
    );
    
    if (friendMenuButton) {
      fireEvent.click(friendMenuButton);
      
      await waitFor(() => {
        const removeButton = screen.getByText('Remove Friend');
        fireEvent.click(removeButton);
      });

      expect(fetch).toHaveBeenCalledWith('/api/social/friends/1', {
        method: 'DELETE'
      });
    }
  });

  it('shows empty state when no friends', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

    render(<FriendsList />);

    await waitFor(() => {
      expect(screen.getByText('No friends yet')).toBeInTheDocument();
      expect(screen.getByText('Start building your savings community by inviting friends!')).toBeInTheDocument();
    });
  });
});

describe('FriendSearch', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  it('renders search interface', () => {
    render(<FriendSearch />);
    
    expect(screen.getByPlaceholderText('Search by username or email...')).toBeInTheDocument();
    expect(screen.getByText('Find Your Friends')).toBeInTheDocument();
  });

  it('performs search and displays results', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockSearchResults })
    });

    render(<FriendSearch />);

    const searchInput = screen.getByPlaceholderText('Search by username or email...');
    fireEvent.change(searchInput, { target: { value: 'bob' } });

    await waitFor(() => {
      expect(screen.getByText('Search Results (2)')).toBeInTheDocument();
      expect(screen.getByText('bob_builder')).toBeInTheDocument();
      expect(screen.getByText('charlie_brown')).toBeInTheDocument();
    });
  });

  it('shows different states for users', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockSearchResults })
    });

    render(<FriendSearch />);

    const searchInput = screen.getByPlaceholderText('Search by username or email...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    await waitFor(() => {
      // Should show "Add Friend" button for non-friends
      expect(screen.getByText('Add Friend')).toBeInTheDocument();
      // Should show "Friends" status for existing friends
      expect(screen.getByText('Friends')).toBeInTheDocument();
    });
  });

  it('handles sending friend requests', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockSearchResults })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

    render(<FriendSearch />);

    const searchInput = screen.getByPlaceholderText('Search by username or email...');
    fireEvent.change(searchInput, { target: { value: 'bob' } });

    await waitFor(() => {
      const addFriendButton = screen.getByText('Add Friend');
      fireEvent.click(addFriendButton);
    });

    expect(fetch).toHaveBeenCalledWith('/api/social/friend-requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        toUserId: '4',
        message: undefined
      })
    });
  });

  it('shows no results message', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    });

    render(<FriendSearch />);

    const searchInput = screen.getByPlaceholderText('Search by username or email...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    await waitFor(() => {
      expect(screen.getByText('No users found')).toBeInTheDocument();
      expect(screen.getByText('Try searching with a different username or email address.')).toBeInTheDocument();
    });
  });
});

describe('FriendInvite', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    (fetch as jest.Mock).mockClear();
    
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined)
      }
    });
    
    // Mock window.open
    global.open = jest.fn();
  });

  it('renders invite modal', () => {
    render(<FriendInvite isOpen={true} onClose={mockOnClose} />);
    
    expect(screen.getByText('Invite Friends to MorphSave')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Link')).toBeInTheDocument();
    expect(screen.getByText('Social')).toBeInTheDocument();
  });

  it('handles email invitations', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        success: true, 
        data: { sent: 2, invitations: [] } 
      })
    });

    render(<FriendInvite isOpen={true} onClose={mockOnClose} />);

    // Enter email addresses
    const emailInput = screen.getByPlaceholderText('Enter email addresses separated by commas');
    fireEvent.change(emailInput, { 
      target: { value: 'friend1@example.com, friend2@example.com' } 
    });

    // Send invitations
    const sendButton = screen.getByText('Send Email Invites');
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/social/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emails: ['friend1@example.com', 'friend2@example.com'],
          message: undefined
        })
      });
    });
  });

  it('handles link copying', async () => {
    render(<FriendInvite isOpen={true} onClose={mockOnClose} />);

    // Switch to Link tab
    fireEvent.click(screen.getByText('Link'));

    // Copy link
    const copyButton = screen.getByText('Copy');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('handles social sharing', () => {
    render(<FriendInvite isOpen={true} onClose={mockOnClose} />);

    // Switch to Social tab
    fireEvent.click(screen.getByText('Social'));

    // Share on Twitter
    const twitterButton = screen.getByText('Share on Twitter');
    fireEvent.click(twitterButton);

    expect(global.open).toHaveBeenCalledWith(
      expect.stringContaining('twitter.com/intent/tweet'),
      '_blank',
      'width=600,height=400'
    );
  });

  it('shows referral rewards information', () => {
    render(<FriendInvite isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('Referral Rewards')).toBeInTheDocument();
    expect(screen.getByText('• You earn $5 bonus when a friend signs up')).toBeInTheDocument();
    expect(screen.getByText('• Your friend gets $5 welcome bonus')).toBeInTheDocument();
  });

  it('validates email input', () => {
    render(<FriendInvite isOpen={true} onClose={mockOnClose} />);

    const sendButton = screen.getByText('Send Email Invites');
    
    // Button should be disabled when no emails entered
    expect(sendButton).toBeDisabled();

    // Enter invalid email
    const emailInput = screen.getByPlaceholderText('Enter email addresses separated by commas');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });

    // Button should still be enabled (validation happens on server)
    expect(sendButton).not.toBeDisabled();
  });
});