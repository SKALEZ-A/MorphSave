import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChallengeManager } from '../src/components/social/ChallengeManager';
import { ChallengeCreateWizard } from '../src/components/social/ChallengeCreateWizard';
import { ChallengeDetails } from '../src/components/social/ChallengeDetails';

// Mock fetch globally
global.fetch = jest.fn();

const mockChallenges = [
  {
    id: '1',
    title: 'Save $500 in 30 Days',
    description: 'A month-long challenge to save $500 together!',
    type: 'savings_amount',
    targetAmount: 500,
    duration: 30,
    startDate: new Date('2024-03-01'),
    endDate: new Date('2024-03-31'),
    creatorId: 'user1',
    creator: {
      username: 'john_doe',
      profileImage: null
    },
    participants: [
      {
        id: 'p1',
        userId: 'user1',
        user: {
          username: 'john_doe',
          profileImage: null,
          level: 3
        },
        joinedAt: new Date('2024-03-01'),
        currentProgress: 250.75,
        rank: 1,
        isCompleted: false
      },
      {
        id: 'p2',
        userId: 'user2',
        user: {
          username: 'jane_smith',
          profileImage: null,
          level: 2
        },
        joinedAt: new Date('2024-03-02'),
        currentProgress: 180.50,
        rank: 2,
        isCompleted: false
      }
    ],
    rewards: [
      {
        id: 'r1',
        type: 'points',
        value: 500,
        description: 'First place reward',
        position: 1
      },
      {
        id: 'r2',
        type: 'money',
        value: 25,
        description: 'First place bonus',
        position: 1
      }
    ],
    status: 'active',
    isPublic: true,
    maxParticipants: 10
  },
  {
    id: '2',
    title: '30-Day Savings Streak',
    description: 'Save something every day for 30 days straight!',
    type: 'streak',
    targetAmount: null,
    duration: 30,
    startDate: new Date('2024-03-15'),
    endDate: new Date('2024-04-14'),
    creatorId: 'user3',
    creator: {
      username: 'alice_wonder',
      profileImage: null
    },
    participants: [
      {
        id: 'p3',
        userId: 'user3',
        user: {
          username: 'alice_wonder',
          profileImage: null,
          level: 4
        },
        joinedAt: new Date('2024-03-15'),
        currentProgress: 15,
        rank: 1,
        isCompleted: false
      }
    ],
    rewards: [
      {
        id: 'r3',
        type: 'points',
        value: 300,
        description: 'Streak master reward',
        position: 1
      }
    ],
    status: 'active',
    isPublic: true,
    maxParticipants: null
  }
];

describe('ChallengeManager', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
  });

  it('renders loading state initially', () => {
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    
    render(<ChallengeManager />);
    
    expect(screen.getByText('Savings Challenges')).toBeInTheDocument();
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('loads and displays challenges', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockChallenges })
    });

    render(<ChallengeManager />);

    await waitFor(() => {
      expect(screen.getByText('Save $500 in 30 Days')).toBeInTheDocument();
      expect(screen.getByText('30-Day Savings Streak')).toBeInTheDocument();
      expect(screen.getByText('$500')).toBeInTheDocument();
      expect(screen.getByText('1 month')).toBeInTheDocument();
    });
  });

  it('handles tab navigation', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockChallenges.filter(c => c.status === 'active') })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      });

    render(<ChallengeManager />);

    await waitFor(() => {
      expect(screen.getByText('Active (2)')).toBeInTheDocument();
    });

    // Click on Upcoming tab
    fireEvent.click(screen.getByText('Upcoming (0)'));
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/social/challenges?status=upcoming');
    });
  });

  it('opens create challenge modal', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockChallenges })
    });

    render(<ChallengeManager />);

    await waitFor(() => {
      expect(screen.getByText('Create Challenge')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Create Challenge'));
    
    await waitFor(() => {
      expect(screen.getByText('Challenge creation form coming soon...')).toBeInTheDocument();
    });
  });

  it('handles joining a challenge', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockChallenges })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockChallenges })
      });

    render(<ChallengeManager />);

    await waitFor(() => {
      expect(screen.getAllByText('Join')[0]).toBeInTheDocument();
    });

    // Join first challenge
    const joinButtons = screen.getAllByText('Join');
    fireEvent.click(joinButtons[0]);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/social/challenges/1/join', {
        method: 'POST'
      });
    });
  });

  it('shows empty state when no challenges', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] })
    });

    render(<ChallengeManager />);

    await waitFor(() => {
      expect(screen.getByText('No active challenges')).toBeInTheDocument();
      expect(screen.getByText('Join a challenge to compete with other savers and earn rewards!')).toBeInTheDocument();
    });
  });

  it('displays challenge cards with correct information', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: mockChallenges })
    });

    render(<ChallengeManager />);

    await waitFor(() => {
      // Check first challenge details
      expect(screen.getByText('Save $500 in 30 Days')).toBeInTheDocument();
      expect(screen.getByText('A month-long challenge to save $500 together!')).toBeInTheDocument();
      expect(screen.getByText('by john_doe')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // participant count
      
      // Check second challenge details
      expect(screen.getByText('30-Day Savings Streak')).toBeInTheDocument();
      expect(screen.getByText('by alice_wonder')).toBeInTheDocument();
    });
  });
});

describe('ChallengeCreateWizard', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSuccess.mockClear();
    (fetch as jest.Mock).mockClear();
  });

  it('renders wizard steps', () => {
    render(
      <ChallengeCreateWizard 
        isOpen={true} 
        onClose={mockOnClose} 
        onSuccess={mockOnSuccess} 
      />
    );
    
    expect(screen.getByText('Create New Challenge')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
    expect(screen.getByText("Let's create your challenge!")).toBeInTheDocument();
  });

  it('handles step navigation', () => {
    render(
      <ChallengeCreateWizard 
        isOpen={true} 
        onClose={mockOnClose} 
        onSuccess={mockOnSuccess} 
      />
    );

    // Fill in required fields for step 1
    const titleInput = screen.getByPlaceholderText('e.g., Save $500 in 30 Days');
    const descriptionInput = screen.getByPlaceholderText('Describe your challenge and motivate others to join...');
    
    fireEvent.change(titleInput, { target: { value: 'Test Challenge' } });
    fireEvent.change(descriptionInput, { target: { value: 'Test description' } });

    // Next button should be enabled
    const nextButton = screen.getByText('Next');
    expect(nextButton).not.toBeDisabled();
    
    fireEvent.click(nextButton);
    
    // Should move to step 2
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument();
    expect(screen.getByText('Choose Challenge Type')).toBeInTheDocument();
  });

  it('validates form fields', () => {
    render(
      <ChallengeCreateWizard 
        isOpen={true} 
        onClose={mockOnClose} 
        onSuccess={mockOnSuccess} 
      />
    );

    // Next button should be disabled initially
    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDisabled();

    // Fill in title only
    const titleInput = screen.getByPlaceholderText('e.g., Save $500 in 30 Days');
    fireEvent.change(titleInput, { target: { value: 'Test Challenge' } });
    
    // Should still be disabled without description
    expect(nextButton).toBeDisabled();

    // Fill in description
    const descriptionInput = screen.getByPlaceholderText('Describe your challenge and motivate others to join...');
    fireEvent.change(descriptionInput, { target: { value: 'Test description' } });
    
    // Should now be enabled
    expect(nextButton).not.toBeDisabled();
  });

  it('handles challenge type selection', () => {
    render(
      <ChallengeCreateWizard 
        isOpen={true} 
        onClose={mockOnClose} 
        onSuccess={mockOnSuccess} 
      />
    );

    // Navigate to step 2
    const titleInput = screen.getByPlaceholderText('e.g., Save $500 in 30 Days');
    const descriptionInput = screen.getByPlaceholderText('Describe your challenge and motivate others to join...');
    
    fireEvent.change(titleInput, { target: { value: 'Test Challenge' } });
    fireEvent.change(descriptionInput, { target: { value: 'Test description' } });
    fireEvent.click(screen.getByText('Next'));

    // Should show challenge types
    expect(screen.getByText('Savings Goal')).toBeInTheDocument();
    expect(screen.getByText('Savings Streak')).toBeInTheDocument();
    expect(screen.getByText('Social Challenge')).toBeInTheDocument();

    // Select savings goal type
    fireEvent.click(screen.getByText('Savings Goal'));
    
    // Should show target amount input
    expect(screen.getByPlaceholderText('500')).toBeInTheDocument();
  });

  it('submits challenge creation', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { id: 'new-challenge' } })
    });

    render(
      <ChallengeCreateWizard 
        isOpen={true} 
        onClose={mockOnClose} 
        onSuccess={mockOnSuccess} 
      />
    );

    // Navigate through all steps
    // Step 1: Basic info
    fireEvent.change(screen.getByPlaceholderText('e.g., Save $500 in 30 Days'), { 
      target: { value: 'Test Challenge' } 
    });
    fireEvent.change(screen.getByPlaceholderText('Describe your challenge and motivate others to join...'), { 
      target: { value: 'Test description' } 
    });
    fireEvent.click(screen.getByText('Next'));

    // Step 2: Challenge type (savings_amount is default)
    fireEvent.change(screen.getByPlaceholderText('500'), { 
      target: { value: '1000' } 
    });
    fireEvent.click(screen.getByText('Next'));

    // Step 3: Settings (defaults should be fine)
    fireEvent.click(screen.getByText('Next'));

    // Step 4: Review and submit
    const createButton = screen.getByText('Create Challenge');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/social/challenges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('"title":"Test Challenge"')
      });
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });
});

describe('ChallengeDetails', () => {
  const mockOnClose = jest.fn();
  const mockOnJoin = jest.fn();
  const mockOnLeave = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnJoin.mockClear();
    mockOnLeave.mockClear();
  });

  it('renders challenge details', () => {
    render(
      <ChallengeDetails 
        challenge={mockChallenges[0]} 
        onClose={mockOnClose}
        onJoin={mockOnJoin}
        onLeave={mockOnLeave}
      />
    );

    expect(screen.getByText('Save $500 in 30 Days')).toBeInTheDocument();
    expect(screen.getByText('A month-long challenge to save $500 together!')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // participants
    expect(screen.getByText('$500')).toBeInTheDocument(); // target amount
  });

  it('shows different tabs', () => {
    render(
      <ChallengeDetails 
        challenge={mockChallenges[0]} 
        onClose={mockOnClose}
        onJoin={mockOnJoin}
        onLeave={mockOnLeave}
      />
    );

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Leaderboard')).toBeInTheDocument();
    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('Chat')).toBeInTheDocument();

    // Click on Leaderboard tab
    fireEvent.click(screen.getByText('Leaderboard'));
    expect(screen.getByText('Current Rankings')).toBeInTheDocument();
    expect(screen.getByText('john_doe')).toBeInTheDocument();
    expect(screen.getByText('jane_smith')).toBeInTheDocument();
  });

  it('handles join action', () => {
    render(
      <ChallengeDetails 
        challenge={mockChallenges[0]} 
        onClose={mockOnClose}
        onJoin={mockOnJoin}
        onLeave={mockOnLeave}
      />
    );

    const joinButton = screen.getByText('Join Challenge');
    fireEvent.click(joinButton);

    expect(mockOnJoin).toHaveBeenCalled();
  });

  it('shows leaderboard with rankings', () => {
    render(
      <ChallengeDetails 
        challenge={mockChallenges[0]} 
        onClose={mockOnClose}
        onJoin={mockOnJoin}
        onLeave={mockOnLeave}
      />
    );

    // Switch to leaderboard tab
    fireEvent.click(screen.getByText('Leaderboard'));

    // Should show participants in order
    expect(screen.getByText('john_doe')).toBeInTheDocument();
    expect(screen.getByText('jane_smith')).toBeInTheDocument();
    expect(screen.getByText('$250.75')).toBeInTheDocument();
    expect(screen.getByText('$180.50')).toBeInTheDocument();
  });

  it('shows rewards information', () => {
    render(
      <ChallengeDetails 
        challenge={mockChallenges[0]} 
        onClose={mockOnClose}
        onJoin={mockOnJoin}
        onLeave={mockOnLeave}
      />
    );

    expect(screen.getByText('Rewards')).toBeInTheDocument();
    expect(screen.getByText('1st Place')).toBeInTheDocument();
    expect(screen.getByText('500 points')).toBeInTheDocument();
    expect(screen.getByText('$25')).toBeInTheDocument();
  });

  it('calculates time remaining correctly', () => {
    const futureChallenge = {
      ...mockChallenges[0],
      endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
    };

    render(
      <ChallengeDetails 
        challenge={futureChallenge} 
        onClose={mockOnClose}
        onJoin={mockOnJoin}
        onLeave={mockOnLeave}
      />
    );

    expect(screen.getByText('5')).toBeInTheDocument(); // days remaining
    expect(screen.getByText('Days Left')).toBeInTheDocument();
  });
});