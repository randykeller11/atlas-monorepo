import { createMachine, interpret, assign } from 'xstate';
import { getSession, saveSession } from './sessionService.js';

// Assessment configuration
const ASSESSMENT_CONFIG = {
  totalQuestions: 10,
  sections: {
    introduction: { min: 1, max: 1, types: ['text'] },
    interestExploration: { min: 2, max: 2, types: ['multiple_choice'] },
    workStyle: { min: 2, max: 2, types: ['multiple_choice', 'ranking'] },
    technicalAptitude: { min: 2, max: 2, types: ['multiple_choice', 'ranking'] },
    careerValues: { min: 3, max: 3, types: ['multiple_choice', 'text'] }
  }
};

// Create the assessment state machine
export const assessmentMachine = createMachine({
  id: 'assessment',
  initial: 'introduction',
  predictableActionArguments: true,
  context: {
    totalQuestions: 0,
    sections: {
      introduction: 0,
      interestExploration: 0,
      workStyle: 0,
      technicalAptitude: 0,
      careerValues: 0
    },
    questionTypes: {
      multiple_choice: 0,
      ranking: 0,
      text: 0
    },
    lastQuestionType: null,
    hasOpenEndedInSection: {
      introduction: false,
      interestExploration: false,
      workStyle: false,
      technicalAptitude: false,
      careerValues: false
    }
  },
  states: {
    introduction: {
      on: {
        ANSWER_QUESTION: {
          target: 'interestExploration',
          cond: 'isIntroductionComplete',
          actions: ['incrementCounters', 'recordResponse']
        }
      },
      meta: {
        requiredType: 'text',
        sectionName: 'introduction'
      }
    },
    interestExploration: {
      on: {
        ANSWER_QUESTION: [
          {
            target: 'workStyle',
            cond: 'isInterestExplorationComplete',
            actions: ['incrementCounters', 'recordResponse']
          },
          {
            target: 'interestExploration',
            actions: ['incrementCounters', 'recordResponse']
          }
        ]
      },
      meta: {
        requiredType: 'multiple_choice',
        sectionName: 'interestExploration'
      }
    },
    workStyle: {
      on: {
        ANSWER_QUESTION: [
          {
            target: 'technicalAptitude',
            cond: 'isWorkStyleComplete',
            actions: ['incrementCounters', 'recordResponse']
          },
          {
            target: 'workStyle',
            actions: ['incrementCounters', 'recordResponse']
          }
        ]
      },
      meta: {
        requiredType: (context) => {
          return context.sections.workStyle === 0 ? 'multiple_choice' : 'ranking';
        },
        sectionName: 'workStyle'
      }
    },
    technicalAptitude: {
      on: {
        ANSWER_QUESTION: [
          {
            target: 'careerValues',
            cond: 'isTechnicalAptitudeComplete',
            actions: ['incrementCounters', 'recordResponse']
          },
          {
            target: 'technicalAptitude',
            actions: ['incrementCounters', 'recordResponse']
          }
        ]
      },
      meta: {
        requiredType: (context) => {
          return context.sections.technicalAptitude === 0 ? 'multiple_choice' : 'ranking';
        },
        sectionName: 'technicalAptitude'
      }
    },
    careerValues: {
      on: {
        ANSWER_QUESTION: [
          {
            target: 'summary',
            cond: 'isCareerValuesComplete',
            actions: ['incrementCounters', 'recordResponse']
          },
          {
            target: 'careerValues',
            actions: ['incrementCounters', 'recordResponse']
          }
        ]
      },
      meta: {
        requiredType: (context) => {
          if (context.sections.careerValues < 2) return 'multiple_choice';
          return 'text';
        },
        sectionName: 'careerValues'
      }
    },
    summary: {
      type: 'final',
      meta: {
        sectionName: 'summary'
      }
    }
  }
}, {
  actions: {
    incrementCounters: assign((context, event) => {
      const currentState = event.currentState;
      const questionType = event.questionType;
      
      return {
        sections: {
          ...context.sections,
          [currentState]: context.sections[currentState] + 1
        },
        questionTypes: {
          ...context.questionTypes,
          [questionType]: context.questionTypes[questionType] + 1
        },
        hasOpenEndedInSection: {
          ...context.hasOpenEndedInSection,
          [currentState]: questionType === 'text' ? true : context.hasOpenEndedInSection[currentState]
        }
      };
    }),
    recordResponse: assign({
      totalQuestions: (context) => context.totalQuestions + 1,
      lastQuestionType: (context, event) => event.questionType
    })
  },
  guards: {
    isIntroductionComplete: (context, event) => {
      const newCount = context.sections.introduction + 1;
      return newCount >= ASSESSMENT_CONFIG.sections.introduction.max;
    },
    isInterestExplorationComplete: (context, event) => {
      const newCount = context.sections.interestExploration + 1;
      return newCount >= ASSESSMENT_CONFIG.sections.interestExploration.max;
    },
    isWorkStyleComplete: (context, event) => {
      const newCount = context.sections.workStyle + 1;
      return newCount >= ASSESSMENT_CONFIG.sections.workStyle.max;
    },
    isTechnicalAptitudeComplete: (context, event) => {
      const newCount = context.sections.technicalAptitude + 1;
      return newCount >= ASSESSMENT_CONFIG.sections.technicalAptitude.max;
    },
    isCareerValuesComplete: (context, event) => {
      const newCount = context.sections.careerValues + 1;
      return newCount >= ASSESSMENT_CONFIG.sections.careerValues.max;
    },
    isAssessmentComplete: (context) => {
      return context.totalQuestions >= ASSESSMENT_CONFIG.totalQuestions;
    }
  }
});

/**
 * Assessment State Machine Service
 */
export class AssessmentStateMachineService {
  constructor() {
    this.machines = new Map(); // Store machine instances per session
  }

  /**
   * Get or create machine instance for session
   */
  async getMachine(sessionId) {
    if (this.machines.has(sessionId)) {
      return this.machines.get(sessionId);
    }

    // Load session state
    const session = await getSession(sessionId);
    
    // Create machine with persisted state
    const machineState = this.loadMachineState(session);
    const service = interpret(assessmentMachine.withContext(machineState.context));
    
    // Restore state
    service.start(machineState.value);
    
    // Store service
    this.machines.set(sessionId, service);
    
    console.log(`✓ Assessment machine created for session ${sessionId}, state: ${service.state.value}`);
    
    return service;
  }

  /**
   * Load machine state from session
   */
  loadMachineState(session) {
    // If session has machine state, use it
    if (session.machineState) {
      return session.machineState;
    }

    // Otherwise, create from legacy session data
    return {
      value: session.currentSection || 'introduction',
      context: {
        totalQuestions: session.totalQuestions || 0,
        sections: session.sections || {
          introduction: 0,
          interestExploration: 0,
          workStyle: 0,
          technicalAptitude: 0,
          careerValues: 0
        },
        questionTypes: session.questionTypes || {
          multiple_choice: 0,
          ranking: 0,
          text: 0
        },
        lastQuestionType: session.lastQuestionType || null,
        hasOpenEndedInSection: session.hasOpenEndedInSection || {
          introduction: false,
          interestExploration: false,
          workStyle: false,
          technicalAptitude: false,
          careerValues: false
        }
      }
    };
  }

  /**
   * Save machine state to session
   */
  async saveMachineState(sessionId, service) {
    const session = await getSession(sessionId);
    
    // Save machine state
    session.machineState = {
      value: service.state.value,
      context: service.state.context
    };
    
    // Also update legacy fields for backward compatibility
    session.currentSection = service.state.value;
    session.totalQuestions = service.state.context.totalQuestions;
    session.sections = service.state.context.sections;
    session.questionTypes = service.state.context.questionTypes;
    session.lastQuestionType = service.state.context.lastQuestionType;
    session.hasOpenEndedInSection = service.state.context.hasOpenEndedInSection;
    
    await saveSession(sessionId, session);
    
    console.log(`✓ Machine state saved for session ${sessionId}`);
  }

  /**
   * Process question response through state machine
   */
  async processResponse(sessionId, response) {
    console.log(`\n=== Processing response through state machine for session ${sessionId} ===`);
    
    try {
      const service = await this.getMachine(sessionId);
      const currentState = service.state.value;
      
      // Validate response type matches required type
      const requiredType = this.getRequiredQuestionType(service.state);
      if (response.type !== requiredType) {
        throw new Error(`Invalid question type. Expected: ${requiredType}, got: ${response.type}`);
      }
      
      // Send event to state machine
      const event = {
        type: 'ANSWER_QUESTION',
        questionType: response.type,
        currentState: currentState,
        response: response
      };
      
      console.log(`Sending event:`, event);
      service.send(event);
      
      // Save updated state
      await this.saveMachineState(sessionId, service);
      
      console.log(`✓ Response processed: ${currentState} -> ${service.state.value}`);
      
      return {
        currentState: service.state.value,
        context: service.state.context,
        isComplete: service.state.matches('summary'),
        nextQuestionType: this.getRequiredQuestionType(service.state),
        progress: this.getProgress(service.state.context)
      };
      
    } catch (error) {
      console.error(`❌ Failed to process response for session ${sessionId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get required question type for current state
   */
  getRequiredQuestionType(state) {
    const meta = state.meta[`assessment.${state.value}`];
    if (!meta) return 'text';
    
    if (typeof meta.requiredType === 'function') {
      return meta.requiredType(state.context);
    }
    
    return meta.requiredType || 'text';
  }

  /**
   * Get next question information
   */
  async getNextQuestion(sessionId) {
    const service = await this.getMachine(sessionId);
    const state = service.state;
    
    if (state.matches('summary')) {
      return {
        type: 'complete',
        section: 'summary',
        isComplete: true
      };
    }
    
    const requiredType = this.getRequiredQuestionType(state);
    const sectionName = state.meta[`assessment.${state.value}`]?.sectionName || state.value;
    
    return {
      type: requiredType,
      section: sectionName,
      progress: this.getProgress(state.context),
      sectionProgress: this.getSectionProgress(state.context, sectionName),
      isComplete: false
    };
  }

  /**
   * Get assessment progress
   */
  getProgress(context) {
    return {
      questionsCompleted: context.totalQuestions,
      totalQuestions: ASSESSMENT_CONFIG.totalQuestions,
      percentComplete: Math.round((context.totalQuestions / ASSESSMENT_CONFIG.totalQuestions) * 100),
      questionTypes: context.questionTypes
    };
  }

  /**
   * Get section progress
   */
  getSectionProgress(context, sectionName) {
    const sectionConfig = ASSESSMENT_CONFIG.sections[sectionName];
    if (!sectionConfig) return null;
    
    return {
      questionsCompleted: context.sections[sectionName] || 0,
      totalQuestions: sectionConfig.max,
      percentComplete: Math.round(((context.sections[sectionName] || 0) / sectionConfig.max) * 100),
      isComplete: (context.sections[sectionName] || 0) >= sectionConfig.max
    };
  }

  /**
   * Reset assessment state machine
   */
  async resetAssessment(sessionId) {
    console.log(`Resetting assessment state machine for session ${sessionId}`);
    
    // Remove existing machine
    if (this.machines.has(sessionId)) {
      const service = this.machines.get(sessionId);
      service.stop();
      this.machines.delete(sessionId);
    }
    
    // Reset session data
    const session = await getSession(sessionId);
    delete session.machineState;
    session.currentSection = 'introduction';
    session.totalQuestions = 0;
    session.sections = {
      introduction: 0,
      interestExploration: 0,
      workStyle: 0,
      technicalAptitude: 0,
      careerValues: 0
    };
    session.questionTypes = {
      multiple_choice: 0,
      ranking: 0,
      text: 0
    };
    session.hasOpenEndedInSection = {
      introduction: false,
      interestExploration: false,
      workStyle: false,
      technicalAptitude: false,
      careerValues: false
    };
    session.lastQuestionType = null;
    
    // Clear assessment-related data but preserve persona/anchors
    session.history = [];
    session.summary = null;
    
    await saveSession(sessionId, session);
    
    console.log(`✓ Assessment state machine reset for session ${sessionId}`);
    
    return session;
  }

  /**
   * Validate state machine consistency
   */
  async validateState(sessionId) {
    const service = await this.getMachine(sessionId);
    const context = service.state.context;
    const errors = [];
    
    // Check total questions don't exceed limit
    if (context.totalQuestions > ASSESSMENT_CONFIG.totalQuestions) {
      errors.push('Total questions exceed maximum allowed');
    }
    
    // Check section totals match overall total
    const sectionTotal = Object.values(context.sections).reduce((sum, count) => sum + count, 0);
    if (sectionTotal !== context.totalQuestions) {
      errors.push('Section totals do not match total questions');
    }
    
    // Check question type totals match overall total
    const typeTotal = Object.values(context.questionTypes).reduce((sum, count) => sum + count, 0);
    if (typeTotal !== context.totalQuestions) {
      errors.push('Question type totals do not match total questions');
    }
    
    // Check each section doesn't exceed its maximum
    Object.entries(ASSESSMENT_CONFIG.sections).forEach(([sectionName, config]) => {
      if (context.sections[sectionName] > config.max) {
        errors.push(`Section ${sectionName} exceeds maximum questions (${config.max})`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
      currentState: service.state.value,
      context: context
    };
  }

  /**
   * Get state machine health
   */
  getHealth() {
    return {
      activeMachines: this.machines.size,
      machineDefinition: 'loaded',
      statesConfigured: Object.keys(assessmentMachine.states).length,
      guardsConfigured: Object.keys(assessmentMachine.options.guards || {}).length,
      actionsConfigured: Object.keys(assessmentMachine.options.actions || {}).length
    };
  }

  /**
   * Cleanup inactive machines
   */
  cleanup() {
    // Remove machines that haven't been used recently
    // This would be called periodically
    console.log(`Cleaning up ${this.machines.size} active machines`);
  }
}

// Export singleton instance
export const assessmentStateMachineService = new AssessmentStateMachineService();

// Convenience functions for backward compatibility
export async function getNextQuestion(sessionId) {
  return await assessmentStateMachineService.getNextQuestion(sessionId);
}

export async function recordResponse(sessionId, response) {
  return await assessmentStateMachineService.processResponse(sessionId, response);
}

export async function resetAssessment(sessionId) {
  return await assessmentStateMachineService.resetAssessment(sessionId);
}

export function validateAssessmentState(session) {
  // For backward compatibility, create a simple validation
  const errors = [];
  
  if (session.totalQuestions > ASSESSMENT_CONFIG.totalQuestions) {
    errors.push('Total questions exceed maximum allowed');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function getAssessmentConfig() {
  return ASSESSMENT_CONFIG;
}

export function getAssessmentEngineHealth() {
  return assessmentStateMachineService.getHealth();
}
