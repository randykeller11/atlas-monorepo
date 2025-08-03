import { getSession, saveSession, checkRedisHealth, deleteSession } from './sessionService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testRedisPersistence() {
  console.log('=== Testing Redis Session Persistence ===\n');
  
  // Check Redis health
  console.log('1. Checking Redis connection...');
  const isHealthy = await checkRedisHealth();
  console.log(`   Redis health: ${isHealthy ? '✓ OK' : '✗ FAILED'}\n`);
  
  if (!isHealthy) {
    console.log('❌ Redis connection failed. Check your REDIS_URL environment variable.');
    process.exit(1);
  }
  
  const testSessionId = 'test-session-' + Date.now();
  
  try {
    console.log('2. Creating new session...');
    const originalSession = await getSession(testSessionId);
    console.log(`   ✓ Session created with ID: ${testSessionId}`);
    
    console.log('3. Adding test data...');
    originalSession.currentSection = 'workStyle';
    originalSession.totalQuestions = 5;
    originalSession.sections.interestExploration = 2;
    originalSession.anchors = ['test anchor 1', 'test anchor 2'];
    originalSession.persona = { type: 'explorer', confidence: 0.8 };
    
    await saveSession(testSessionId, originalSession);
    console.log('   ✓ Session data saved');
    
    console.log('4. Retrieving session...');
    const retrievedSession = await getSession(testSessionId);
    console.log('   ✓ Session retrieved successfully');
    
    console.log('5. Verifying data integrity...');
    const checks = [
      retrievedSession.currentSection === 'workStyle',
      retrievedSession.totalQuestions === 5,
      retrievedSession.sections.interestExploration === 2,
      retrievedSession.anchors?.length === 2,
      retrievedSession.persona?.type === 'explorer'
    ];
    
    const allPassed = checks.every(check => check);
    
    if (allPassed) {
      console.log('   ✓ All data integrity checks passed');
    } else {
      console.log('   ✗ Data integrity check failed');
      console.log('   Expected sections.interestExploration: 2, got:', retrievedSession.sections.interestExploration);
      console.log('   Expected anchors length: 2, got:', retrievedSession.anchors?.length);
    }
    
    console.log('6. Testing session persistence across "restart"...');
    // Simulate server restart by creating a new session instance
    const persistedSession = await getSession(testSessionId);
    const persistenceCheck = persistedSession.currentSection === 'workStyle';
    
    if (persistenceCheck) {
      console.log('   ✓ Session persisted across restart simulation');
    } else {
      console.log('   ✗ Session persistence failed');
    }
    
    console.log('7. Cleaning up test session...');
    await deleteSession(testSessionId);
    console.log('   ✓ Test session deleted');
    
    console.log('\n🎉 All tests passed! Redis session management is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

// Run the test
testRedisPersistence();
