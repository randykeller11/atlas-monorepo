// Re-export everything from the state machine for backward compatibility
export {
  getNextQuestion,
  recordResponse,
  resetAssessment,
  validateAssessmentState,
  getAssessmentConfig,
  getAssessmentEngineHealth,
  assessmentStateMachineService
} from './assessmentStateMachine.js';

// Legacy compatibility layer
import { assessmentStateMachineService } from './assessmentStateMachine.js';

/**
 * Legacy function - now delegates to state machine
 */
export async function getCurrentSection(sessionId) {
  const nextQuestion = await assessmentStateMachineService.getNextQuestion(sessionId);
  return nextQuestion.section;
}

/**
 * Legacy function - now delegates to state machine
 */
export async function getAssessmentProgress(sessionId) {
  const service = await assessmentStateMachineService.getMachine(sessionId);
  return assessmentStateMachineService.getProgress(service.state.context);
}

/**
 * Legacy function - now delegates to state machine
 */
export async function getSectionProgress(sessionId, sectionName) {
  const service = await assessmentStateMachineService.getMachine(sessionId);
  return assessmentStateMachineService.getSectionProgress(service.state.context, sectionName);
}
