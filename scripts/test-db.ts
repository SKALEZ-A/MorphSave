const { createUser, getUserById, updateUser } = require('../lib/db/user');
const { createSession, getValidSession } = require('../lib/db/session');

async function testDatabase() {
  console.log('🧪 Testing database functions...');

  try {
    // Test user creation
    console.log('Creating test user...');
    const userData = {
      email: 'test@morphsave.com',
      username: 'test_user',
      firstName: 'Test',
      lastName: 'User',
      walletAddress: '0x1234567890123456789012345678901234567890',
      privateKeyEncrypted: 'encrypted_test_key'
    };

    const user = await createUser(userData);
    console.log('✅ User created:', {
      id: user.id,
      email: user.email,
      username: user.username,
      level: user.level,
      totalPoints: user.totalPoints
    });

    // Test user retrieval
    console.log('Retrieving user...');
    const retrievedUser = await getUserById(user.id);
    console.log('✅ User retrieved:', retrievedUser ? 'Success' : 'Failed');

    // Test user update
    console.log('Updating user...');
    const updatedUser = await updateUser(user.id, {
      firstName: 'Updated',
      bio: 'Test bio',
      totalSaved: 100.50
    });
    console.log('✅ User updated:', {
      firstName: updatedUser.firstName,
      bio: updatedUser.bio,
      totalSaved: updatedUser.totalSaved
    });

    // Test session creation
    console.log('Creating session...');
    const session = await createSession({
      userId: user.id,
      deviceInfo: 'Test Device',
      ipAddress: '127.0.0.1'
    });
    console.log('✅ Session created:', {
      sessionToken: session.sessionToken.substring(0, 10) + '...',
      isActive: session.isActive
    });

    // Test session validation
    console.log('Validating session...');
    const validSession = await getValidSession(session.sessionToken);
    console.log('✅ Session validated:', validSession ? 'Valid' : 'Invalid');

    console.log('\n🎉 All database tests passed!');

  } catch (error) {
    console.error('❌ Database test failed:', error);
  }
}

testDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });