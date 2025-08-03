import { getSession, saveSession, checkRedisHealth } from './sessionService.js';
import { analyzePersona, updatePersonaAnchors, getPersonaRecommendations } from './personaService.js';
import { getNextQuestion, recordResponse, validateAssessmentState, resetAssessment } from './assessmentEngine.js';
import { aiRequest, validateResponse, getAIServiceHealth } from './aiService.js';
import { generateResume, generateCareerSummary, getResumeTemplates } from './resumeService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testModularServices() {
  console.log('=== Testing Modular Services Implementation ===\n');
  
  const testSessionId = 'test-services-' + Date.now();
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
  
  // Test 1: Session Service
  await runTest('Session Service', async () => {
    const session = await getSession(testSessionId);
    if (!session || !session.id) throw new Error('Failed to create session');
    
    session.testData = 'test value';
    await saveSession(testSessionId, session);
    
    const retrievedSession = await getSession(testSessionId);
    if (retrievedSession.testData !== 'test value') {
      throw new Error('Session data not persisted correctly');
    }
    
    const isHealthy = await checkRedisHealth();
    console.log(`     Redis health: ${isHealthy ? 'OK' : 'FALLBACK'}`);
  });
  
  // Test 2: Assessment Engine
  await runTest('Assessment Engine', async () => {
    // Reset assessment first
    await resetAssessment(testSessionId);
    
    // Get next question
    const nextQuestion = await getNextQuestion(testSessionId);
    if (!nextQuestion.type || !nextQuestion.section) {
      throw new Error('Invalid next question format');
    }
    
    // Record a response
    const response = { type: 'text', content: 'Test response' };
    const result = await recordResponse(testSessionId, response);
    if (!result.totalQuestions || result.totalQuestions !== 1) {
      throw new Error('Response not recorded correctly');
    }
    
    // Validate state
    const session = await getSession(testSessionId);
    const validation = validateAssessmentState(session);
    if (!validation.valid) {
      throw new Error(`Assessment state invalid: ${validation.errors.join(', ')}`);
    }
    
    console.log(`     Assessment progress: ${result.totalQuestions}/10 questions`);
  });
  
  // Test 3: Persona Service
  await runTest('Persona Service', async () => {
    // Add some conversation history for persona analysis
    const session = await getSession(testSessionId);
    session.history = [
      { role: 'user', content: 'I love building things and solving technical problems' },
      { role: 'user', content: 'I prefer working with data and analyzing patterns' },
      { role: 'user', content: 'I enjoy helping people and working in teams' }
    ];
    await saveSession(testSessionId, session);
    
    // Analyze persona
    const persona = await analyzePersona(testSessionId);
    if (!persona || !persona.primary || !persona.scores) {
      throw new Error('Persona analysis failed');
    }
    
    // Update anchors
    const anchors = await updatePersonaAnchors(testSessionId, ['technical skills', 'teamwork']);
    if (!Array.isArray(anchors) || anchors.length === 0) {
      throw new Error('Anchor update failed');
    }
    
    // Get recommendations
    const recommendations = getPersonaRecommendations(persona);
    if (!Array.isArray(recommendations)) {
      throw new Error('Recommendations generation failed');
    }
    
    console.log(`     Primary persona: ${persona.primary.name}`);
    console.log(`     Confidence: ${Math.round(persona.primary.confidence * 100)}%`);
  });
  
  // Test 4: AI Service
  await runTest('AI Service', async () => {
    if (!process.env.OPENROUTER_API_KEY) {
      console.log('     Skipping AI Service test - no API key configured');
      return;
    }
    
    try {
      const aiResponse = await aiRequest(testSessionId, 'Hello, I am testing the AI service');
      if (!aiResponse || !aiResponse.content) {
        throw new Error('AI request failed');
      }
      
      // Test response validation
      const validation = validateResponse(aiResponse.content);
      if (!validation.valid) {
        throw new Error(`Response validation failed: ${validation.error}`);
      }
      
      console.log(`     AI response length: ${aiResponse.content.length} chars`);
      console.log(`     Tokens used: ${aiResponse.tokensUsed || 'unknown'}`);
    } catch (error) {
      if (error.message.includes('API key') || error.message.includes('401')) {
        console.log('     Skipping AI Service test - API authentication issue');
        return;
      }
      throw error;
    }
  });
  
  // Test 5: Resume Service
  await runTest('Resume Service', async () => {
    const templates = await getResumeTemplates();
    if (!Array.isArray(templates)) {
      throw new Error('Resume templates not returned as array');
    }
    
    const resume = await generateResume(testSessionId, { template: 'student' });
    if (!resume) {
      throw new Error('Resume generation failed');
    }
    
    const careerSummary = await generateCareerSummary(testSessionId);
    if (!careerSummary) {
      throw new Error('Career summary generation failed');
    }
    
    console.log(`     Available templates: ${templates.length}`);
    console.log(`     Resume status: ${resume.status || 'OK'}`);
  });
  
  // Test 6: Service Health Checks
  await runTest('Service Health Checks', async () => {
    const aiHealth = getAIServiceHealth();
    if (!aiHealth || typeof aiHealth.apiKeyConfigured !== 'boolean') {
      throw new Error('AI service health check failed');
    }
    
    console.log(`     AI Service: API key ${aiHealth.apiKeyConfigured ? 'configured' : 'missing'}`);
    console.log(`     Max context messages: ${aiHealth.maxContextMessages}`);
    console.log(`     Summarization threshold: ${aiHealth.summarizationThreshold}`);
  });
  
  // Test 7: Integration Test
  await runTest('Service Integration', async () => {
    // Test that services work together
    const session = await getSession(testSessionId);
    
    // Verify session has data from all services
    if (!session.persona) throw new Error('Persona not integrated with session');
    if (!session.anchors || session.anchors.length === 0) throw new Error('Anchors not integrated');
    if (!session.history || session.history.length === 0) throw new Error('History not maintained');
    if (session.totalQuestions === undefined) throw new Error('Assessment state not integrated');
    
    console.log(`     Session integration: All services connected`);
    console.log(`     Session data size: ${JSON.stringify(session).length} bytes`);
  });
  
  // Cleanup
  console.log('=== Cleanup ===');
  try {
    await resetAssessment(testSessionId);
    console.log('✓ Test session cleaned up\n');
  } catch (error) {
    console.warn('⚠ Cleanup warning:', error.message);
  }
  
  // Summary
  console.log('=== Test Summary ===');
  console.log(`Tests passed: ${testsPassed}/${testsTotal}`);
  console.log(`Success rate: ${Math.round((testsPassed / testsTotal) * 100)}%`);
  
  if (testsPassed === testsTotal) {
    console.log('🎉 All modular services are working correctly!');
  } else {
    console.log('⚠ Some services need attention. Check the errors above.');
  }
  
  process.exit(testsPassed === testsTotal ? 0 : 1);
}

// Run the tests
testModularServices().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
