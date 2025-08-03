import {
  assessmentStateMachineService,
  getNextQuestion,
  recordResponse,
  resetAssessment,
  validateAssessmentState,
  getAssessmentConfig,
} from "../assessmentStateMachine.js";
import { getSession, saveSession, deleteSession } from "../sessionService.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function testSection6Implementation() {
  console.log(
    "=== Testing Section 6: Formalized State Machine for Assessment Flow ===\n"
  );

  const testSessionId = "test-section6-" + Date.now();
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

  // Test 0: State Machine Configuration Validation
  await runTest('State Machine Configuration Validation', async () => {
    // Verify the machine configuration matches Section 6 requirements
    const config = getAssessmentConfig();
    
    if (config.totalQuestions !== 10) {
      throw new Error(`Expected 10 total questions, got ${config.totalQuestions}`);
    }
    
    // Verify section configuration
    const expectedSections = {
      introduction: { min: 1, max: 1, types: ['text'] },
      interestExploration: { min: 2, max: 2, types: ['multiple_choice'] },
      workStyle: { min: 2, max: 2, types: ['multiple_choice', 'ranking'] },
      technicalAptitude: { min: 2, max: 2, types: ['multiple_choice', 'ranking'] },
      careerValues: { min: 3, max: 3, types: ['multiple_choice', 'text'] }
    };
    
    Object.entries(expectedSections).forEach(([sectionName, expectedConfig]) => {
      const actualConfig = config.sections[sectionName];
      if (!actualConfig) {
        throw new Error(`Missing section configuration: ${sectionName}`);
      }
      
      if (actualConfig.max !== expectedConfig.max) {
        throw new Error(`Section ${sectionName} max mismatch: expected ${expectedConfig.max}, got ${actualConfig.max}`);
      }
    });
    
    // Verify total questions add up correctly
    const totalSectionQuestions = Object.values(config.sections).reduce((sum, section) => sum + section.max, 0);
    if (totalSectionQuestions !== config.totalQuestions) {
      throw new Error(`Section totals (${totalSectionQuestions}) don't match total questions (${config.totalQuestions})`);
    }
    
    console.log(`     ✓ Configuration valid: ${config.totalQuestions} total questions`);
    console.log(`     ✓ All ${Object.keys(config.sections).length} sections properly configured`);
  });

  // Test 1: State Machine Initialization
  await runTest("State Machine Initialization", async () => {
    const service = await assessmentStateMachineService.getMachine(
      testSessionId
    );

    if (!service) {
      throw new Error("Failed to create state machine service");
    }

    if (service.state.value !== "introduction") {
      throw new Error(
        `Expected initial state 'introduction', got '${service.state.value}'`
      );
    }

    if (service.state.context.totalQuestions !== 0) {
      throw new Error("Initial context should have 0 total questions");
    }

    console.log(`     ✓ Initial state: ${service.state.value}`);
    console.log(
      `     ✓ Initial context: ${JSON.stringify(
        service.state.context.sections
      )}`
    );
  });

  // Test 2: State Transitions
  await runTest("State Transitions", async () => {
    // Reset to ensure clean state
    await resetAssessment(testSessionId);

    // Test introduction -> interestExploration
    let result = await recordResponse(testSessionId, {
      type: "text",
      content: "Test response",
    });

    if (result.currentState !== "interestExploration") {
      throw new Error(
        `Expected transition to 'interestExploration', got '${result.currentState}'`
      );
    }

    // Test interestExploration -> workStyle (after 2 questions)
    await recordResponse(testSessionId, {
      type: "multiple_choice",
      content: "Test MC 1",
    });
    result = await recordResponse(testSessionId, {
      type: "multiple_choice",
      content: "Test MC 2",
    });

    if (result.currentState !== "workStyle") {
      throw new Error(
        `Expected transition to 'workStyle', got '${result.currentState}'`
      );
    }

    console.log(`     ✓ State transitions working correctly`);
    console.log(`     ✓ Current state: ${result.currentState}`);
  });

  // Test 3: Question Type Enforcement
  await runTest("Question Type Enforcement", async () => {
    await resetAssessment(testSessionId);

    // Introduction should require text
    let nextQuestion = await getNextQuestion(testSessionId);
    if (nextQuestion.type !== "text") {
      throw new Error(
        `Introduction should require 'text', got '${nextQuestion.type}'`
      );
    }

    // Move to interest exploration
    await recordResponse(testSessionId, { type: "text", content: "Test" });

    // Interest exploration should require multiple choice
    nextQuestion = await getNextQuestion(testSessionId);
    if (nextQuestion.type !== "multiple_choice") {
      throw new Error(
        `Interest exploration should require 'multiple_choice', got '${nextQuestion.type}'`
      );
    }

    // Move to work style
    await recordResponse(testSessionId, {
      type: "multiple_choice",
      content: "Test MC 1",
    });
    await recordResponse(testSessionId, {
      type: "multiple_choice",
      content: "Test MC 2",
    });

    // Work style first question should be multiple choice
    nextQuestion = await getNextQuestion(testSessionId);
    if (nextQuestion.type !== "multiple_choice") {
      throw new Error(
        `Work style first question should be 'multiple_choice', got '${nextQuestion.type}'`
      );
    }

    // Work style second question should be ranking
    await recordResponse(testSessionId, {
      type: "multiple_choice",
      content: "Test MC",
    });
    nextQuestion = await getNextQuestion(testSessionId);
    if (nextQuestion.type !== "ranking") {
      throw new Error(
        `Work style second question should be 'ranking', got '${nextQuestion.type}'`
      );
    }

    console.log(`     ✓ Question type enforcement working`);
  });

  // Test 3.5: Dynamic Question Type Resolution
  await runTest('Dynamic Question Type Resolution', async () => {
    await resetAssessment(testSessionId);
    
    // Move through states to test dynamic type resolution
    await recordResponse(testSessionId, { type: 'text', content: 'Introduction' });
    await recordResponse(testSessionId, { type: 'multiple_choice', content: 'Interest 1' });
    await recordResponse(testSessionId, { type: 'multiple_choice', content: 'Interest 2' });
    
    // Now in workStyle - first question should be multiple_choice
    let nextQuestion = await getNextQuestion(testSessionId);
    if (nextQuestion.type !== 'multiple_choice') {
      throw new Error(`Work style first question should be 'multiple_choice', got '${nextQuestion.type}'`);
    }
    
    // Answer first work style question
    await recordResponse(testSessionId, { type: 'multiple_choice', content: 'Work style MC' });
    
    // Second work style question should be ranking (dynamic resolution)
    nextQuestion = await getNextQuestion(testSessionId);
    if (nextQuestion.type !== 'ranking') {
      throw new Error(`Work style second question should be 'ranking', got '${nextQuestion.type}'`);
    }
    
    // Move to technical aptitude
    await recordResponse(testSessionId, { type: 'ranking', content: 'Work style ranking' });
    
    // First technical question should be multiple_choice
    nextQuestion = await getNextQuestion(testSessionId);
    if (nextQuestion.type !== 'multiple_choice') {
      throw new Error(`Technical first question should be 'multiple_choice', got '${nextQuestion.type}'`);
    }
    
    await recordResponse(testSessionId, { type: 'multiple_choice', content: 'Technical MC' });
    
    // Second technical question should be ranking
    nextQuestion = await getNextQuestion(testSessionId);
    if (nextQuestion.type !== 'ranking') {
      throw new Error(`Technical second question should be 'ranking', got '${nextQuestion.type}'`);
    }
    
    console.log(`     ✓ Dynamic question type resolution working correctly`);
  });

  // Test 4: Guards and Conditions
  await runTest("Guards and Conditions", async () => {
    await resetAssessment(testSessionId);

    const service = await assessmentStateMachineService.getMachine(
      testSessionId
    );

    // Test section completion guards
    const guards = service.machine.options.guards;

    if (!guards.isIntroductionComplete) {
      throw new Error("Missing isIntroductionComplete guard");
    }

    if (!guards.isInterestExplorationComplete) {
      throw new Error("Missing isInterestExplorationComplete guard");
    }

    if (!guards.isWorkStyleComplete) {
      throw new Error("Missing isWorkStyleComplete guard");
    }

    // Test guard logic - guards check if section WILL be complete after processing
    const initialContext = service.state.context;
    const mockEvent = { currentState: 'introduction', questionType: 'text' };
    
    // With 0 questions in introduction, processing 1 more WILL complete it (0 + 1 >= 1)
    if (!guards.isIntroductionComplete(initialContext, mockEvent)) {
      throw new Error("Introduction should be complete after processing 1 question");
    }

    // Test with a context that already has 1 introduction question
    const completedIntroContext = {
      sections: { introduction: 1, interestExploration: 0, workStyle: 0, technicalAptitude: 0, careerValues: 0 }
    };
    
    // With 1 question already, processing 1 more would exceed the max (1 + 1 > 1)
    if (!guards.isIntroductionComplete(completedIntroContext, mockEvent)) {
      throw new Error("Introduction guard should return true when section would be complete");
    }

    console.log(`     ✓ Guards configured and working`);
  });

  // Test 4.5: Comprehensive Guard Logic Testing
  await runTest('Comprehensive Guard Logic Testing', async () => {
    await resetAssessment(testSessionId);
    
    const service = await assessmentStateMachineService.getMachine(testSessionId);
    const guards = service.machine.options.guards;
    
    // Create mock events for testing guards
    const mockEvents = [
      { currentState: 'introduction', questionType: 'text' },
      { currentState: 'interestExploration', questionType: 'multiple_choice' },
      { currentState: 'workStyle', questionType: 'multiple_choice' },
      { currentState: 'technicalAptitude', questionType: 'multiple_choice' },
      { currentState: 'careerValues', questionType: 'text' }
    ];
    
    // Test introduction completion guard
    // Context with 0 introduction questions - processing 1 more will complete it (0 + 1 >= 1)
    const emptyIntroContext = { sections: { introduction: 0 } };
    if (!guards.isIntroductionComplete(emptyIntroContext, mockEvents[0])) {
      throw new Error('Introduction should be complete after processing 1 question');
    }
    
    // Test interest exploration completion guard
    // Context with 1 interest question - processing 1 more will complete it (1 + 1 >= 2)
    const oneInterestContext = { sections: { interestExploration: 1 } };
    if (!guards.isInterestExplorationComplete(oneInterestContext, mockEvents[1])) {
      throw new Error('Interest exploration should be complete after processing 2nd question');
    }
    
    // Context with 0 interest questions - processing 1 more will NOT complete it (0 + 1 < 2)
    const zeroInterestContext = { sections: { interestExploration: 0 } };
    if (guards.isInterestExplorationComplete(zeroInterestContext, mockEvents[1])) {
      throw new Error('Interest exploration should not be complete after processing 1st question');
    }
    
    // Test work style completion guard
    // Context with 1 work style question - processing 1 more will complete it (1 + 1 >= 2)
    const oneWorkStyleContext = { sections: { workStyle: 1 } };
    if (!guards.isWorkStyleComplete(oneWorkStyleContext, mockEvents[2])) {
      throw new Error('Work style should be complete after processing 2nd question');
    }
    
    // Context with 0 work style questions - processing 1 more will NOT complete it (0 + 1 < 2)
    const zeroWorkStyleContext = { sections: { workStyle: 0 } };
    if (guards.isWorkStyleComplete(zeroWorkStyleContext, mockEvents[2])) {
      throw new Error('Work style should not be complete after processing 1st question');
    }
    
    // Test technical aptitude completion guard
    const oneTechnicalContext = { sections: { technicalAptitude: 1 } };
    if (!guards.isTechnicalAptitudeComplete(oneTechnicalContext, mockEvents[3])) {
      throw new Error('Technical aptitude should be complete after processing 2nd question');
    }
    
    const zeroTechnicalContext = { sections: { technicalAptitude: 0 } };
    if (guards.isTechnicalAptitudeComplete(zeroTechnicalContext, mockEvents[3])) {
      throw new Error('Technical aptitude should not be complete after processing 1st question');
    }
    
    // Test career values completion guard
    // Context with 2 career values questions - processing 1 more will complete it (2 + 1 >= 3)
    const twoCareerValuesContext = { sections: { careerValues: 2 } };
    if (!guards.isCareerValuesComplete(twoCareerValuesContext, mockEvents[4])) {
      throw new Error('Career values should be complete after processing 3rd question');
    }
    
    // Context with 1 career values question - processing 1 more will NOT complete it (1 + 1 < 3)
    const oneCareerValuesContext = { sections: { careerValues: 1 } };
    if (guards.isCareerValuesComplete(oneCareerValuesContext, mockEvents[4])) {
      throw new Error('Career values should not be complete after processing 2nd question');
    }
    
    // Test assessment completion guard
    const completeContext = { totalQuestions: 10 };
    const incompleteContext = { totalQuestions: 5 };
    
    if (!guards.isAssessmentComplete(completeContext)) {
      throw new Error('Assessment should be complete after 10 questions');
    }
    if (guards.isAssessmentComplete(incompleteContext)) {
      throw new Error('Assessment should not be complete after 5 questions');
    }
    
    console.log(`     ✓ All guard functions working correctly`);
  });

  // Test 5: Actions and Side Effects
  await runTest("Actions and Side Effects", async () => {
    await resetAssessment(testSessionId);

    const service = await assessmentStateMachineService.getMachine(
      testSessionId
    );
    const actions = service.machine.options.actions;

    if (!actions.recordResponse) {
      throw new Error("Missing recordResponse action");
    }

    if (!actions.incrementCounters) {
      throw new Error("Missing incrementCounters action");
    }

    // Test that actions are executed
    const initialQuestions = service.state.context.totalQuestions;

    await recordResponse(testSessionId, {
      type: "text",
      content: "Test response",
    });

    const updatedService = await assessmentStateMachineService.getMachine(
      testSessionId
    );

    if (updatedService.state.context.totalQuestions !== initialQuestions + 1) {
      throw new Error("recordResponse action did not increment totalQuestions");
    }

    if (updatedService.state.context.sections.introduction !== 1) {
      throw new Error("incrementCounters action did not update section count");
    }

    console.log(`     ✓ Actions executing correctly`);
  });

  // Test 5.5: Action Context Mutations
  await runTest('Action Context Mutations', async () => {
    await resetAssessment(testSessionId);
    
    const service = await assessmentStateMachineService.getMachine(testSessionId);
    const initialContext = { ...service.state.context };
    
    // Test recordResponse action
    await recordResponse(testSessionId, { type: 'text', content: 'Test response' });
    
    const updatedService = await assessmentStateMachineService.getMachine(testSessionId);
    const updatedContext = updatedService.state.context;
    
    // Verify recordResponse action effects
    if (updatedContext.totalQuestions !== initialContext.totalQuestions + 1) {
      throw new Error('recordResponse action did not increment totalQuestions correctly');
    }
    
    if (updatedContext.lastQuestionType !== 'text') {
      throw new Error('recordResponse action did not set lastQuestionType correctly');
    }
    
    // Verify incrementCounters action effects
    if (updatedContext.sections.introduction !== initialContext.sections.introduction + 1) {
      throw new Error('incrementCounters action did not update section count');
    }
    
    if (updatedContext.questionTypes.text !== initialContext.questionTypes.text + 1) {
      throw new Error('incrementCounters action did not update question type count');
    }
    
    if (!updatedContext.hasOpenEndedInSection.introduction) {
      throw new Error('incrementCounters action did not update hasOpenEndedInSection for text question');
    }
    
    // Test with multiple choice question
    await recordResponse(testSessionId, { type: 'multiple_choice', content: 'Test MC' });
    
    const mcService = await assessmentStateMachineService.getMachine(testSessionId);
    const mcContext = mcService.state.context;
    
    if (mcContext.questionTypes.multiple_choice !== 1) {
      throw new Error('Multiple choice question type not tracked correctly');
    }
    
    console.log(`     ✓ Action context mutations working correctly`);
    console.log(`     ✓ Question types: ${JSON.stringify(mcContext.questionTypes)}`);
    console.log(`     ✓ Sections: ${JSON.stringify(mcContext.sections)}`);
  });

  // Test 6: State Persistence
  await runTest("State Persistence", async () => {
    await resetAssessment(testSessionId);

    // Make some progress
    await recordResponse(testSessionId, {
      type: "text",
      content: "Introduction",
    });
    await recordResponse(testSessionId, {
      type: "multiple_choice",
      content: "Interest 1",
    });

    // Get current state
    const service1 = await assessmentStateMachineService.getMachine(
      testSessionId
    );
    const state1 = service1.state.value;
    const context1 = service1.state.context;

    // Simulate "restart" by removing from memory and reloading
    assessmentStateMachineService.machines.delete(testSessionId);

    // Load again - should restore state
    const service2 = await assessmentStateMachineService.getMachine(
      testSessionId
    );
    const state2 = service2.state.value;
    const context2 = service2.state.context;

    if (state1 !== state2) {
      throw new Error(`State not persisted: ${state1} !== ${state2}`);
    }

    if (context1.totalQuestions !== context2.totalQuestions) {
      throw new Error("Context not persisted correctly");
    }

    console.log(`     ✓ State persisted across restarts`);
    console.log(
      `     ✓ Restored state: ${state2}, questions: ${context2.totalQuestions}`
    );
  });

  // Test 7: Complete Assessment Flow
  await runTest("Complete Assessment Flow", async () => {
    await resetAssessment(testSessionId);

    const responses = [
      { type: "text", content: "Introduction response" },
      { type: "multiple_choice", content: "Interest 1" },
      { type: "multiple_choice", content: "Interest 2" },
      { type: "multiple_choice", content: "Work style 1" },
      { type: "ranking", content: "Work style ranking" },
      { type: "multiple_choice", content: "Technical 1" },
      { type: "ranking", content: "Technical ranking" },
      { type: "multiple_choice", content: "Values 1" },
      { type: "multiple_choice", content: "Values 2" },
      { type: "text", content: "Values final" },
    ];

    let currentState = "introduction";

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const nextQuestion = await getNextQuestion(testSessionId);

      if (nextQuestion.type !== response.type) {
        throw new Error(
          `Question ${i + 1}: Expected ${response.type}, got ${
            nextQuestion.type
          }`
        );
      }

      const result = await recordResponse(testSessionId, response);
      currentState = result.currentState;

      console.log(
        `     Question ${i + 1}: ${response.type} -> ${currentState}`
      );
    }

    if (currentState !== "summary") {
      throw new Error(`Expected final state 'summary', got '${currentState}'`);
    }

    const finalQuestion = await getNextQuestion(testSessionId);
    if (!finalQuestion.isComplete) {
      throw new Error("Assessment should be marked as complete");
    }

    console.log(`     ✓ Complete assessment flow successful`);
  });

  // Test 8: State Validation
  await runTest("State Validation", async () => {
    const validation = await assessmentStateMachineService.validateState(
      testSessionId
    );

    if (!validation.valid) {
      throw new Error(
        `State validation failed: ${validation.errors.join(", ")}`
      );
    }

    if (validation.context.totalQuestions !== 10) {
      throw new Error(
        `Expected 10 total questions, got ${validation.context.totalQuestions}`
      );
    }

    // Check question type distribution
    const expectedTypes = { multiple_choice: 6, ranking: 2, text: 2 };
    Object.entries(expectedTypes).forEach(([type, expected]) => {
      if (validation.context.questionTypes[type] !== expected) {
        throw new Error(
          `Expected ${expected} ${type} questions, got ${validation.context.questionTypes[type]}`
        );
      }
    });

    console.log(`     ✓ State validation passed`);
    console.log(
      `     ✓ Question distribution: ${JSON.stringify(
        validation.context.questionTypes
      )}`
    );
  });

  // Test 8.5: Edge Case Validation
  await runTest('Edge Case Validation', async () => {
    // Test validation with corrupted state
    const corruptedSessionId = testSessionId + '-corrupted';
    const session = await getSession(corruptedSessionId);
    
    // Create intentionally invalid state
    session.machineState = {
      value: 'introduction',
      context: {
        totalQuestions: 15, // Exceeds maximum
        sections: {
          introduction: 5, // Exceeds section maximum
          interestExploration: 0,
          workStyle: 0,
          technicalAptitude: 0,
          careerValues: 0
        },
        questionTypes: {
          multiple_choice: 10, // Doesn't match total
          ranking: 0,
          text: 0
        }
      }
    };
    
    await saveSession(corruptedSessionId, session);
    
    const validation = await assessmentStateMachineService.validateState(corruptedSessionId);
    
    if (validation.valid) {
      throw new Error('Validation should fail for corrupted state');
    }
    
    if (validation.errors.length === 0) {
      throw new Error('Validation should return error messages');
    }
    
    // Check for specific error types
    const hasExceedsMaxError = validation.errors.some(err => err.includes('exceed'));
    const hasMismatchError = validation.errors.some(err => err.includes('do not match'));
    
    if (!hasExceedsMaxError) {
      throw new Error('Validation should detect exceeded maximums');
    }
    
    if (!hasMismatchError) {
      throw new Error('Validation should detect count mismatches');
    }
    
    await deleteSession(corruptedSessionId);
    
    console.log(`     ✓ Edge case validation working`);
    console.log(`     ✓ Detected ${validation.errors.length} validation errors`);
  });

  // Test 9: Error Handling
  await runTest("Error Handling", async () => {
    await resetAssessment(testSessionId);

    // Try to submit wrong question type
    try {
      await recordResponse(testSessionId, {
        type: "multiple_choice",
        content: "Wrong type",
      });
      throw new Error("Should have rejected wrong question type");
    } catch (error) {
      if (!error.message.includes("Invalid question type")) {
        throw new Error(`Unexpected error: ${error.message}`);
      }
    }

    // Submit correct type
    await recordResponse(testSessionId, {
      type: "text",
      content: "Correct type",
    });

    console.log(`     ✓ Error handling working correctly`);
  });

  // Test 10: Backward Compatibility
  await runTest("Backward Compatibility", async () => {
    // Test that legacy functions still work
    const config = getAssessmentConfig();
    if (!config.totalQuestions || config.totalQuestions !== 10) {
      throw new Error("getAssessmentConfig not working");
    }

    const session = await getSession(testSessionId);
    const legacyValidation = validateAssessmentState(session);
    if (!legacyValidation.valid) {
      throw new Error("Legacy validateAssessmentState not working");
    }

    console.log(`     ✓ Backward compatibility maintained`);
  });

  // Cleanup
  console.log("=== Cleanup ===");
  try {
    await deleteSession(testSessionId);
    assessmentStateMachineService.machines.delete(testSessionId);
    console.log("✓ Test sessions cleaned up\n");
  } catch (error) {
    console.warn("⚠ Cleanup warning:", error.message);
  }

  // Summary
  console.log("=== Section 6 Test Summary ===");
  console.log(`Tests passed: ${testsPassed}/${testsTotal}`);
  console.log(`Success rate: ${Math.round((testsPassed / testsTotal) * 100)}%`);

  if (testsPassed === testsTotal) {
    console.log(
      "🎉 Section 6 (Formalized State Machine for Assessment Flow) is fully implemented!"
    );
    console.log("\n✅ Verified Features:");
    console.log("   • XState machine with proper states and transitions");
    console.log("   • Question type enforcement through guards");
    console.log("   • State persistence across server restarts");
    console.log("   • Actions and side-effects for counter management");
    console.log("   • Complete assessment flow validation");
    console.log("   • Error handling for invalid transitions");
    console.log("   • Backward compatibility with existing code");
    console.log("   • State machine health monitoring");
  } else {
    console.log(
      "⚠ Some Section 6 features need attention. Check the errors above."
    );

    const failedTests = testsTotal - testsPassed;
    console.log(`\n❌ ${failedTests} test(s) failed:`);
    console.log(
      "   Review the error messages above to identify missing components."
    );
  }

  process.exit(testsPassed === testsTotal ? 0 : 1);
}

// Run the tests
testSection6Implementation().catch((error) => {
  console.error("❌ Section 6 test suite failed:", error);
  process.exit(1);
});
