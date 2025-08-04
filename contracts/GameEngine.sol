// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title GameEngine
 * @dev Smart contract for managing gamification mechanics including achievements,
 * streaks, challenges, and reward distribution
 */
contract GameEngine is ReentrancyGuard, Pausable, Ownable {
    
    // Events
    event AchievementUnlocked(address indexed user, uint256 indexed achievementId, uint256 points, uint256 timestamp);
    event StreakUpdated(address indexed user, uint256 newStreak, uint256 timestamp);
    event ChallengeCreated(bytes32 indexed challengeId, address indexed creator, uint256 targetAmount, uint256 duration);
    event ChallengeJoined(bytes32 indexed challengeId, address indexed participant, uint256 timestamp);
    event ChallengeCompleted(bytes32 indexed challengeId, address indexed winner, uint256 reward);
    event RewardDistributed(address indexed user, uint256 amount, string reason);
    event LevelUp(address indexed user, uint256 newLevel, uint256 timestamp);

    // Enums
    enum AchievementType { SAVINGS, SOCIAL, STREAK, SPECIAL }
    enum ChallengeStatus { ACTIVE, COMPLETED, CANCELLED }
    enum ChallengeType { SAVINGS_AMOUNT, STREAK_DAYS, SOCIAL_REFERRALS }

    // Structs
    struct Achievement {
        uint256 id;
        string name;
        string description;
        AchievementType achievementType;
        uint256 pointsReward;
        uint256 requirement; // Amount, days, or count needed
        bool isActive;
    }

    struct UserStats {
        uint256 totalPoints;
        uint256 level;
        uint256 currentStreak;
        uint256 longestStreak;
        uint256 lastActivityDate;
        uint256 totalSaved;
        uint256 challengesWon;
        uint256 referrals;
        mapping(uint256 => bool) unlockedAchievements;
    }

    struct Challenge {
        bytes32 id;
        address creator;
        string title;
        string description;
        ChallengeType challengeType;
        uint256 targetAmount;
        uint256 duration; // in days
        uint256 startTime;
        uint256 endTime;
        uint256 entryFee;
        uint256 totalPrizePool;
        ChallengeStatus status;
        address[] participants;
        mapping(address => uint256) participantProgress;
        address winner;
    }

    struct Leaderboard {
        address[] topSavers;
        address[] topStreakers;
        address[] topReferrers;
        uint256 lastUpdated;
    }

    // State variables
    mapping(address => UserStats) public userStats;
    mapping(uint256 => Achievement) public achievements;
    mapping(bytes32 => Challenge) public challenges;
    mapping(address => bytes32[]) public userChallenges;
    
    uint256 public nextAchievementId = 1;
    uint256 public totalUsers;
    uint256 public totalChallenges;
    
    // Level thresholds (points required for each level)
    uint256[] public levelThresholds = [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500];
    
    // Reward token (could be native ETH or ERC20)
    IERC20 public rewardToken;
    
    // Leaderboard
    Leaderboard public leaderboard;
    uint256 public constant LEADERBOARD_SIZE = 10;

    constructor() Ownable(msg.sender) {
        _initializeAchievements();
    }

    /**
     * @dev Initialize default achievements
     */
    function _initializeAchievements() internal {
        // Savings achievements
        _createAchievement("First Save", "Make your first deposit", AchievementType.SAVINGS, 100, 1);
        _createAchievement("Century Club", "Save $100", AchievementType.SAVINGS, 500, 100);
        _createAchievement("Thousand Club", "Save $1000", AchievementType.SAVINGS, 1000, 1000);
        
        // Streak achievements
        _createAchievement("Week Warrior", "7-day saving streak", AchievementType.STREAK, 200, 7);
        _createAchievement("Month Master", "30-day saving streak", AchievementType.STREAK, 1000, 30);
        _createAchievement("Year Champion", "365-day saving streak", AchievementType.STREAK, 5000, 365);
        
        // Social achievements
        _createAchievement("Social Butterfly", "Refer 5 friends", AchievementType.SOCIAL, 300, 5);
        _createAchievement("Community Builder", "Refer 25 friends", AchievementType.SOCIAL, 1500, 25);
        
        // Special achievements
        _createAchievement("Early Adopter", "Join in first 1000 users", AchievementType.SPECIAL, 1000, 1000);
        _createAchievement("Challenge Champion", "Win 10 challenges", AchievementType.SPECIAL, 2000, 10);
    }

    /**
     * @dev Record achievement unlock for a user
     * @param user User address
     * @param achievementId Achievement ID to unlock
     */
    function recordAchievement(address user, uint256 achievementId) external onlyOwner nonReentrant {
        require(achievements[achievementId].isActive, "Achievement not active");
        require(!userStats[user].unlockedAchievements[achievementId], "Achievement already unlocked");
        
        Achievement memory achievement = achievements[achievementId];
        UserStats storage stats = userStats[user];
        
        // Check if user meets requirements
        bool meetsRequirement = false;
        
        if (achievement.achievementType == AchievementType.SAVINGS) {
            meetsRequirement = stats.totalSaved >= achievement.requirement;
        } else if (achievement.achievementType == AchievementType.STREAK) {
            meetsRequirement = stats.longestStreak >= achievement.requirement;
        } else if (achievement.achievementType == AchievementType.SOCIAL) {
            meetsRequirement = stats.referrals >= achievement.requirement;
        } else if (achievement.achievementType == AchievementType.SPECIAL) {
            if (achievementId == 9) { // Early Adopter
                meetsRequirement = totalUsers <= achievement.requirement;
            } else if (achievementId == 10) { // Challenge Champion
                meetsRequirement = stats.challengesWon >= achievement.requirement;
            }
        }
        
        require(meetsRequirement, "User does not meet achievement requirements");
        
        // Unlock achievement
        stats.unlockedAchievements[achievementId] = true;
        stats.totalPoints += achievement.pointsReward;
        
        // Check for level up
        uint256 newLevel = _calculateLevel(stats.totalPoints);
        if (newLevel > stats.level) {
            stats.level = newLevel;
            emit LevelUp(user, newLevel, block.timestamp);
        }
        
        emit AchievementUnlocked(user, achievementId, achievement.pointsReward, block.timestamp);
    }

    /**
     * @dev Update user's saving streak
     * @param user User address
     */
    function updateStreak(address user) external onlyOwner nonReentrant {
        UserStats storage stats = userStats[user];
        uint256 today = block.timestamp / 1 days;
        uint256 lastActivity = stats.lastActivityDate / 1 days;
        
        if (lastActivity == 0) {
            // First activity
            stats.currentStreak = 1;
            stats.longestStreak = 1;
        } else if (today == lastActivity + 1) {
            // Consecutive day
            stats.currentStreak += 1;
            if (stats.currentStreak > stats.longestStreak) {
                stats.longestStreak = stats.currentStreak;
            }
        } else if (today > lastActivity + 1) {
            // Streak broken
            stats.currentStreak = 1;
        }
        // If today == lastActivity, no change (same day activity)
        
        stats.lastActivityDate = block.timestamp;
        
        emit StreakUpdated(user, stats.currentStreak, block.timestamp);
        
        // Check for streak achievements
        _checkStreakAchievements(user);
    }

    /**
     * @dev Create a new challenge
     * @param title Challenge title
     * @param description Challenge description
     * @param challengeType Type of challenge
     * @param targetAmount Target amount or count
     * @param duration Duration in days
     * @param entryFee Entry fee in wei
     */
    function createChallenge(
        string memory title,
        string memory description,
        ChallengeType challengeType,
        uint256 targetAmount,
        uint256 duration,
        uint256 entryFee
    ) external payable nonReentrant whenNotPaused returns (bytes32) {
        require(duration > 0 && duration <= 365, "Invalid duration");
        require(msg.value >= entryFee, "Insufficient entry fee");
        
        bytes32 challengeId = keccak256(abi.encodePacked(msg.sender, block.timestamp, totalChallenges));
        
        Challenge storage newChallenge = challenges[challengeId];
        newChallenge.id = challengeId;
        newChallenge.creator = msg.sender;
        newChallenge.title = title;
        newChallenge.description = description;
        newChallenge.challengeType = challengeType;
        newChallenge.targetAmount = targetAmount;
        newChallenge.duration = duration;
        newChallenge.startTime = block.timestamp;
        newChallenge.endTime = block.timestamp + (duration * 1 days);
        newChallenge.entryFee = entryFee;
        newChallenge.totalPrizePool = msg.value;
        newChallenge.status = ChallengeStatus.ACTIVE;
        
        // Creator automatically joins
        newChallenge.participants.push(msg.sender);
        newChallenge.participantProgress[msg.sender] = 0;
        userChallenges[msg.sender].push(challengeId);
        
        totalChallenges++;
        
        emit ChallengeCreated(challengeId, msg.sender, targetAmount, duration);
        
        return challengeId;
    }

    /**
     * @dev Join an existing challenge
     * @param challengeId Challenge ID to join
     */
    function joinChallenge(bytes32 challengeId) external payable nonReentrant {
        Challenge storage challenge = challenges[challengeId];
        
        require(challenge.status == ChallengeStatus.ACTIVE, "Challenge not active");
        require(block.timestamp < challenge.endTime, "Challenge ended");
        require(msg.value >= challenge.entryFee, "Insufficient entry fee");
        require(challenge.participantProgress[msg.sender] == 0, "Already joined");
        
        challenge.participants.push(msg.sender);
        challenge.participantProgress[msg.sender] = 1; // Mark as joined (0 means not joined)
        challenge.totalPrizePool += msg.value;
        userChallenges[msg.sender].push(challengeId);
        
        emit ChallengeJoined(challengeId, msg.sender, block.timestamp);
    }

    /**
     * @dev Update participant progress in a challenge
     * @param challengeId Challenge ID
     * @param participant Participant address
     * @param progress New progress value
     */
    function updateChallengeProgress(
        bytes32 challengeId,
        address participant,
        uint256 progress
    ) external onlyOwner nonReentrant {
        Challenge storage challenge = challenges[challengeId];
        
        require(challenge.status == ChallengeStatus.ACTIVE, "Challenge not active");
        require(challenge.participantProgress[participant] > 0, "Not a participant");
        
        challenge.participantProgress[participant] = progress;
        
        // Check if challenge is completed
        if (progress >= challenge.targetAmount) {
            _completeChallenge(challengeId, participant);
        }
    }

    /**
     * @dev Distribute rewards to users
     * @param users Array of user addresses
     * @param amounts Array of reward amounts
     * @param reason Reason for reward distribution
     */
    function distributeRewards(
        address[] memory users,
        uint256[] memory amounts,
        string memory reason
    ) external onlyOwner nonReentrant {
        require(users.length == amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < users.length; i++) {
            if (amounts[i] > 0) {
                (bool success, ) = payable(users[i]).call{value: amounts[i]}("");
                require(success, "Transfer failed");
                
                emit RewardDistributed(users[i], amounts[i], reason);
            }
        }
    }

    /**
     * @dev Update user's total saved amount
     * @param user User address
     * @param amount New total saved amount
     */
    function updateUserSavings(address user, uint256 amount) external onlyOwner {
        UserStats storage stats = userStats[user];
        
        if (stats.totalPoints == 0) {
            // New user
            totalUsers++;
        }
        
        stats.totalSaved = amount;
        
        // Check for savings achievements
        _checkSavingsAchievements(user);
    }

    /**
     * @dev Update user referral count
     * @param user User address
     */
    function addReferral(address user) external onlyOwner {
        UserStats storage stats = userStats[user];
        stats.referrals += 1;
        
        // Check for social achievements
        _checkSocialAchievements(user);
    }

    /**
     * @dev Get user statistics
     * @param user User address
     * @return totalPoints Total points earned
     * @return level Current level
     * @return currentStreak Current saving streak
     * @return longestStreak Longest saving streak
     * @return totalSaved Total amount saved
     * @return challengesWon Number of challenges won
     */
    function getUserStats(address user) external view returns (
        uint256 totalPoints,
        uint256 level,
        uint256 currentStreak,
        uint256 longestStreak,
        uint256 totalSaved,
        uint256 challengesWon
    ) {
        UserStats storage stats = userStats[user];
        return (
            stats.totalPoints,
            stats.level,
            stats.currentStreak,
            stats.longestStreak,
            stats.totalSaved,
            stats.challengesWon
        );
    }

    /**
     * @dev Check if user has unlocked an achievement
     * @param user User address
     * @param achievementId Achievement ID
     * @return True if unlocked
     */
    function hasAchievement(address user, uint256 achievementId) external view returns (bool) {
        return userStats[user].unlockedAchievements[achievementId];
    }

    /**
     * @dev Get challenge details
     * @param challengeId Challenge ID
     * @return creator Challenge creator address
     * @return title Challenge title
     * @return challengeType Type of challenge
     * @return targetAmount Target amount or count
     * @return endTime Challenge end time
     * @return totalPrizePool Total prize pool
     * @return status Challenge status
     * @return participantCount Number of participants
     */
    function getChallenge(bytes32 challengeId) external view returns (
        address creator,
        string memory title,
        ChallengeType challengeType,
        uint256 targetAmount,
        uint256 endTime,
        uint256 totalPrizePool,
        ChallengeStatus status,
        uint256 participantCount
    ) {
        Challenge storage challenge = challenges[challengeId];
        return (
            challenge.creator,
            challenge.title,
            challenge.challengeType,
            challenge.targetAmount,
            challenge.endTime,
            challenge.totalPrizePool,
            challenge.status,
            challenge.participants.length
        );
    }

    /**
     * @dev Get user's challenge progress
     * @param challengeId Challenge ID
     * @param user User address
     * @return Progress value
     */
    function getChallengeProgress(bytes32 challengeId, address user) external view returns (uint256) {
        return challenges[challengeId].participantProgress[user];
    }

    // Internal functions

    /**
     * @dev Create a new achievement
     */
    function _createAchievement(
        string memory name,
        string memory description,
        AchievementType achievementType,
        uint256 pointsReward,
        uint256 requirement
    ) internal {
        achievements[nextAchievementId] = Achievement({
            id: nextAchievementId,
            name: name,
            description: description,
            achievementType: achievementType,
            pointsReward: pointsReward,
            requirement: requirement,
            isActive: true
        });
        nextAchievementId++;
    }

    /**
     * @dev Calculate user level based on points
     */
    function _calculateLevel(uint256 points) internal view returns (uint256) {
        for (uint256 i = levelThresholds.length - 1; i > 0; i--) {
            if (points >= levelThresholds[i]) {
                return i;
            }
        }
        return 0;
    }

    /**
     * @dev Complete a challenge
     */
    function _completeChallenge(bytes32 challengeId, address winner) internal {
        Challenge storage challenge = challenges[challengeId];
        challenge.status = ChallengeStatus.COMPLETED;
        challenge.winner = winner;
        
        // Update winner stats
        UserStats storage winnerStats = userStats[winner];
        winnerStats.challengesWon += 1;
        
        // Distribute prize
        uint256 prize = challenge.totalPrizePool;
        if (prize > 0) {
            (bool success, ) = payable(winner).call{value: prize}("");
            require(success, "Prize transfer failed");
        }
        
        emit ChallengeCompleted(challengeId, winner, prize);
    }

    /**
     * @dev Check and unlock savings achievements
     */
    function _checkSavingsAchievements(address user) internal {
        UserStats storage stats = userStats[user];
        
        // Check each savings achievement
        for (uint256 i = 1; i <= 3; i++) {
            if (!stats.unlockedAchievements[i] && stats.totalSaved >= achievements[i].requirement) {
                // Auto-unlock achievement (simplified for demo)
                stats.unlockedAchievements[i] = true;
                stats.totalPoints += achievements[i].pointsReward;
                emit AchievementUnlocked(user, i, achievements[i].pointsReward, block.timestamp);
            }
        }
    }

    /**
     * @dev Check and unlock streak achievements
     */
    function _checkStreakAchievements(address user) internal {
        UserStats storage stats = userStats[user];
        
        // Check streak achievements (IDs 4-6)
        for (uint256 i = 4; i <= 6; i++) {
            if (!stats.unlockedAchievements[i] && stats.longestStreak >= achievements[i].requirement) {
                stats.unlockedAchievements[i] = true;
                stats.totalPoints += achievements[i].pointsReward;
                emit AchievementUnlocked(user, i, achievements[i].pointsReward, block.timestamp);
            }
        }
    }

    /**
     * @dev Check and unlock social achievements
     */
    function _checkSocialAchievements(address user) internal {
        UserStats storage stats = userStats[user];
        
        // Check social achievements (IDs 7-8)
        for (uint256 i = 7; i <= 8; i++) {
            if (!stats.unlockedAchievements[i] && stats.referrals >= achievements[i].requirement) {
                stats.unlockedAchievements[i] = true;
                stats.totalPoints += achievements[i].pointsReward;
                emit AchievementUnlocked(user, i, achievements[i].pointsReward, block.timestamp);
            }
        }
    }

    // Admin functions

    /**
     * @dev Add new achievement
     */
    function addAchievement(
        string memory name,
        string memory description,
        AchievementType achievementType,
        uint256 pointsReward,
        uint256 requirement
    ) external onlyOwner {
        _createAchievement(name, description, achievementType, pointsReward, requirement);
    }

    /**
     * @dev Update level thresholds
     */
    function updateLevelThresholds(uint256[] memory newThresholds) external onlyOwner {
        levelThresholds = newThresholds;
    }

    /**
     * @dev Emergency function to cancel a challenge
     */
    function cancelChallenge(bytes32 challengeId) external onlyOwner {
        Challenge storage challenge = challenges[challengeId];
        require(challenge.status == ChallengeStatus.ACTIVE, "Challenge not active");
        
        challenge.status = ChallengeStatus.CANCELLED;
        
        // Refund participants
        for (uint256 i = 0; i < challenge.participants.length; i++) {
            address participant = challenge.participants[i];
            (bool success, ) = payable(participant).call{value: challenge.entryFee}("");
            require(success, "Refund failed");
        }
    }

    /**
     * @dev Withdraw contract balance (emergency only)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {}
}