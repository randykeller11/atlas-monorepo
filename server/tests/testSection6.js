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

    // Test guard logic
    const initialContext = service.state.context;
    if (guards.isIntroductionComplete(initialContext)) {
      throw new Error("Introduction should not be complete initially");
    }

    // Simulate completing introduction
    const contextAfterIntro = {
      ...initialContext,
      sections: { ...initialContext.sections, introduction: 1 },
    };

    if (!guards.isIntroductionComplete(contextAfterIntro)) {
      throw new Error("Introduction should be complete after 1 question");
    }

    console.log(`     ✓ Guards configured and working`);
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
