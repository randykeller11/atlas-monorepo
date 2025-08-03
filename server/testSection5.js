import { 
  performContextSummarization, 
  shouldTriggerSummarization, 
  getSummarizationStats,
  forceSummarization,
  estimateTokenCount,
  getContextSummarizationHealth
} from './contextSummarizationService.js';
import { getSession, saveSession, deleteSession } from './sessionService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testSection5Implementation() {
  console.log('=== Testing Section 5: Context Summarization Logic ===\n');
  
  const testSessionId = 'test-section5-' + Date.now();
  let testsPassed = 0;
  let testsTotal = 0;
  
  // Helper function to run a test
  const runTest = async (testName, testFn) => {
    testsTotal++;
    try {
      console.log(`${testsTotal}. Testing ${testName}...`);
      await testFn();
      console.log(`   ✓ ${testName} passed\n`);
      testsPassed++;
    } catch (error) {
      console.error(`   ✗ ${testName} failed:`, error.message);
      console.error(`     Stack: ${error.stack}\n`);
    }
  };

  // Test 1: Summarization Threshold Detection
  await runTest('Summarization Threshold Detection', async () => {
    // Create session with few messages (below threshold)
    const session = await getSession(testSessionId);
    session.history = [
      { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Hi there!', timestamp: new Date().toISOString() }
    ];
    await saveSession(testSessionId, session);
    
    // Should not trigger summarization
    if (shouldTriggerSummarization(session)) {
      throw new Error('Summarization triggered with too few messages');
    }
    
    // Add many messages to exceed threshold
    for (let i = 0; i < 20; i++) {
      session.history.push(
        { role: 'user', content: `Test message ${i}`, timestamp: new Date().toISOString() },
        { role: 'assistant', content: `Response ${i}`, timestamp: new Date().toISOString() }
      );
    }
    await saveSession(testSessionId, session);
    
    // Should now trigger summarization
    if (!shouldTriggerSummarization(session)) {
      throw new Error('Summarization not triggered with many messages');
    }
    
    console.log(`     ✓ Threshold detection working (${session.history.length} messages)`);
  });

  // Test 2: Token Count Estimation
  await runTest('Token Count Estimation', async () => {
    const testMessages = [
      { role: 'user', content: 'This is a test message for token counting' },
      { role: 'assistant', content: 'This is a response message for testing' }
    ];
    
    const tokenCount = estimateTokenCount(testMessages);
    
    if (tokenCount <= 0) {
      throw new Error('Token count estimation returned invalid result');
    }
    
    // Should be roughly 20-25 tokens for the test messages
    if (tokenCount < 10 || tokenCount > 50) {
      throw new Error(`Token count seems unrealistic: ${tokenCount}`);
    }
    
    console.log(`     ✓ Estimated ${tokenCount} tokens for test messages`);
  });

  // Test 3: Summarization Statistics
  await runTest('Summarization Statistics', async () => {
    const stats = await getSummarizationStats(testSessionId);
    
    if (!stats.sessionId || stats.sessionId !== testSessionId) {
      throw new Error('Invalid session ID in stats');
    }
    
    if (typeof stats.currentMessageCount !== 'number') {
      throw new Error('Invalid message count in stats');
    }
    
    if (!stats.configuration || typeof stats.configuration.threshold !== 'number') {
      throw new Error('Invalid configuration in stats');
    }
    
    console.log(`     ✓ Stats: ${stats.currentMessageCount} messages, threshold: ${stats.configuration.threshold}`);
  });

  // Test 4: Context Summarization Process
  await runTest('Context Summarization Process', async () => {
    if (!process.env.OPENROUTER_API_KEY) {
      console.log('     Skipping summarization test - no API key configured');
      return;
    }
    
    // Ensure we have enough messages to trigger summarization
    const session = await getSession(testSessionId);
    
    // Add conversation history that tells a story
    const conversationHistory = [
      { role: 'user', content: 'I am interested in technology and programming', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'That\'s great! What aspects of technology interest you most?', timestamp: new Date().toISOString() },
      { role: 'user', content: 'I love building web applications and solving complex problems', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Web development is a fantastic field. Do you prefer frontend or backend work?', timestamp: new Date().toISOString() },
      { role: 'user', content: 'I enjoy both, but I think I lean more towards backend development', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Backend development offers great career opportunities. What programming languages do you know?', timestamp: new Date().toISOString() },
      { role: 'user', content: 'I know JavaScript, Python, and I am learning Go', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Excellent choices! Those languages are in high demand.', timestamp: new Date().toISOString() }
    ];
    
    // Add enough messages to trigger summarization
    session.history = conversationHistory;
    for (let i = 0; i < 15; i++) {
      session.history.push(
        { role: 'user', content: `Additional context message ${i} about career interests`, timestamp: new Date().toISOString() },
        { role: 'assistant', content: `Response ${i} providing career guidance`, timestamp: new Date().toISOString() }
      );
    }
    
    await saveSession(testSessionId, session);
    
    const originalMessageCount = session.history.length;
    
    // Perform summarization
    const result = await performContextSummarization(testSessionId);
    
    if (!result.summarized) {
      throw new Error(`Summarization failed: ${result.reason || result.error}`);
    }
    
    // Verify results
    const updatedSession = await getSession(testSessionId);
    
    if (!updatedSession.summary) {
      throw new Error('No summary was created');
    }
    
    if (updatedSession.history.length >= originalMessageCount) {
      throw new Error('Message history was not pruned');
    }
    
    if (updatedSession.history.length === 0) {
      throw new Error('All messages were pruned (should preserve recent context)');
    }
    
    console.log(`     ✓ Summarized ${result.messagesPruned} messages`);
    console.log(`     ✓ Preserved ${result.messagesPreserved} recent messages`);
    console.log(`     ✓ Summary length: ${result.summaryLength} characters`);
    console.log(`     ✓ Summary preview: ${updatedSession.summary.substring(0, 100)}...`);
  });

  // Test 5: Summary Preservation and Chaining
  await runTest('Summary Preservation and Chaining', async () => {
    if (!process.env.OPENROUTER_API_KEY) {
      console.log('     Skipping summary chaining test - no API key configured');
      return;
    }
    
    const session = await getSession(testSessionId);
    
    // Verify we have a summary from previous test
    if (!session.summary) {
      throw new Error('No existing summary to test chaining with');
    }
    
    const originalSummary = session.summary;
    
    // Add more messages to trigger another summarization
    for (let i = 0; i < 20; i++) {
      session.history.push(
        { role: 'user', content: `New conversation message ${i} about career planning`, timestamp: new Date().toISOString() },
        { role: 'assistant', content: `Career planning response ${i}`, timestamp: new Date().toISOString() }
      );
    }
    
    await saveSession(testSessionId, session);
    
    // Perform second summarization
    const result = await performContextSummarization(testSessionId);
    
    if (!result.summarized) {
      throw new Error('Second summarization failed');
    }
    
    const updatedSession = await getSession(testSessionId);
    
    // Verify summary was updated but previous context preserved
    if (updatedSession.summary === originalSummary) {
      throw new Error('Summary was not updated after second summarization');
    }
    
    if (updatedSession.summarizationCount < 2) {
      throw new Error('Summarization count not properly tracked');
    }
    
    console.log(`     ✓ Second summarization completed`);
    console.log(`     ✓ Summarization count: ${updatedSession.summarizationCount}`);
  });

  // Test 6: Force Summarization
  await runTest('Force Summarization', async () => {
    if (!process.env.OPENROUTER_API_KEY) {
      console.log('     Skipping force summarization test - no API key configured');
      return;
    }
    
    // Create a new session with few messages
    const forceTestSessionId = testSessionId + '-force';
    const session = await getSession(forceTestSessionId);
    session.history = [
      { role: 'user', content: 'Short conversation', timestamp: new Date().toISOString() },
      { role: 'assistant', content: 'Short response', timestamp: new Date().toISOString() }
    ];
    await saveSession(forceTestSessionId, session);
    
    // Force summarization despite low message count
    const result = await forceSummarization(forceTestSessionId);
    
    if (!result.forced) {
      throw new Error('Force flag not set in result');
    }
    
    if (!result.summarized) {
      throw new Error('Forced summarization failed');
    }
    
    const updatedSession = await getSession(forceTestSessionId);
    
    if (!updatedSession.summary) {
      throw new Error('No summary created by forced summarization');
    }
    
    // Cleanup
    await deleteSession(forceTestSessionId);
    
    console.log(`     ✓ Forced summarization completed`);
  });

  // Test 7: Service Health Check
  await runTest('Service Health Check', async () => {
    const health = getContextSummarizationHealth();
    
    if (typeof health.enabled !== 'boolean') {
      throw new Error('Health check missing enabled status');
    }
    
    if (typeof health.threshold !== 'number') {
      throw new Error('Health check missing threshold configuration');
    }
    
    if (typeof health.apiConfigured !== 'boolean') {
      throw new Error('Health check missing API configuration status');
    }
    
    console.log(`     ✓ Service enabled: ${health.enabled}`);
    console.log(`     ✓ Threshold: ${health.threshold}`);
    console.log(`     ✓ API configured: ${health.apiConfigured}`);
  });

  // Test 8: Integration with AI Service
  await runTest('Integration with AI Service', async () => {
    const session = await getSession(testSessionId);
    
    // Verify that summarization has been integrated
    if (!session.summary) {
      throw new Error('Session should have summary from previous tests');
    }
    
    if (!session.lastSummarizedAt) {
      throw new Error('Session missing summarization timestamp');
    }
    
    if (!session.summarizationCount || session.summarizationCount < 1) {
      throw new Error('Session missing summarization count');
    }
    
    // Verify recent messages are preserved
    if (!session.history || session.history.length === 0) {
      throw new Error('No recent messages preserved');
    }
    
    console.log(`     ✓ Summary integration verified`);
    console.log(`     ✓ Recent context preserved: ${session.history.length} messages`);
  });

  // Cleanup
  console.log('=== Cleanup ===');
  try {
    await deleteSession(testSessionId);
    console.log('✓ Test sessions cleaned up\n');
  } catch (error) {
    console.warn('⚠ Cleanup warning:', error.message);
  }

  // Summary
  console.log('=== Section 5 Test Summary ===');
  console.log(`Tests passed: ${testsPassed}/${testsTotal}`);
  console.log(`Success rate: ${Math.round((testsPassed / testsTotal) * 100)}%`);
  
  if (testsPassed === testsTotal) {
    console.log('🎉 Section 5 (Context Summarization Logic) is fully implemented!');
    console.log('\n✅ Verified Features:');
    console.log('   • Automatic summarization threshold detection');
    console.log('   • Template-based summarization with OpenRouter API');
    console.log('   • Message history pruning with recent context preservation');
    console.log('   • Summary chaining for multiple summarization cycles');
    console.log('   • Token count estimation and optimization');
    console.log('   • Force summarization for admin/testing purposes');
    console.log('   • Integration with existing AI service pipeline');
    console.log('   • Comprehensive health monitoring and statistics');
  } else {
    console.log('⚠ Some Section 5 features need attention. Check the errors above.');
    
    const failedTests = testsTotal - testsPassed;
    console.log(`\n❌ ${failedTests} test(s) failed:`);
    console.log('   Review the error messages above to identify missing components.');
  }
  
  process.exit(testsPassed === testsTotal ? 0 : 1);
}

// Run the tests
testSection5Implementation().catch(error => {
  console.error('❌ Section 5 test suite failed:', error);
  process.exit(1);
});
