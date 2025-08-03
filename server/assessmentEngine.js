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
  },
  questionTypeDistribution: {
    multiple_choice: 6,
    ranking: 2,
    text: 2
  }
};

/**
 * Get the next question type and section for the assessment
 * @param {string} sessionId - Session identifier
 * @returns {Object} Next question configuration
 */
export async function getNextQuestion(sessionId) {
  console.log(`\n=== Determining next question for session ${sessionId} ===`);
  
  try {
    const session = await getSession(sessionId);
    
    // Check if assessment is complete
    if (isAssessmentComplete(session)) {
      console.log('Assessment is complete');
      return { type: 'complete', section: 'summary' };
    }
    
    // Determine current section and required question type
    const currentSection = getCurrentSection(session);
    const requiredType = getRequiredQuestionType(session, currentSection);
    
    console.log(`Next question: ${requiredType} in ${currentSection}`);
    
    return {
      type: requiredType,
      section: currentSection,
      progress: getAssessmentProgress(session),
      sectionProgress: getSectionProgress(session, currentSection)
    };
    
  } catch (error) {
    console.error(`❌ Failed to determine next question for session ${sessionId}:`, error.message);
    throw error;
  }
}

/**
 * Record a question response and update assessment state
 * @param {string} sessionId - Session identifier
 * @param {Object} response - Question response
 * @returns {Object} Updated assessment state
 */
export async function recordResponse(sessionId, response) {
  console.log(`\n=== Recording response for session ${sessionId} ===`);
  
  try {
    const session = await getSession(sessionId);
    
    // Validate response
    if (!response.type || !['multiple_choice', 'ranking', 'text'].includes(response.type)) {
      throw new Error('Invalid response type');
    }
    
    // Update counters
    session.questionTypes[response.type]++;
    session.totalQuestions++;
    session.lastQuestionType = response.type;
    
    // Update section progress
    const currentSection = getCurrentSection(session);
    session.sections[currentSection]++;
    
    // Check if this was an open-ended question
    if (response.type === 'text') {
      session.hasOpenEndedInSection[currentSection] = true;
    }
    
    // Determine if section transition is needed
    const nextSection = determineNextSection(session, currentSection);
    if (nextSection !== currentSection) {
      session.currentSection = nextSection;
      console.log(`Transitioning from ${currentSection} to ${nextSection}`);
    }
    
    // Save updated session
    await saveSession(sessionId, session);
    
    console.log(`✓ Response recorded: ${response.type} in ${currentSection}`);
    
    return {
      currentSection: session.currentSection,
      totalQuestions: session.totalQuestions,
      sectionProgress: session.sections,
      questionTypeProgress: session.questionTypes,
      isComplete: isAssessmentComplete(session)
    };
    
  } catch (error) {
    console.error(`❌ Failed to record response for session ${sessionId}:`, error.message);
    throw error;
  }
}

/**
 * Check if the assessment is complete
 */
function isAssessmentComplete(session) {
  return session.totalQuestions >= ASSESSMENT_CONFIG.totalQuestions;
}

/**
 * Get the current section based on progress
 */
function getCurrentSection(session) {
  // If already set and not complete, continue with current section
  if (session.currentSection && !isSectionComplete(session, session.currentSection)) {
    return session.currentSection;
  }
  
  // Determine section based on progress
  if (session.sections.introduction < ASSESSMENT_CONFIG.sections.introduction.max) {
    return 'introduction';
  } else if (session.sections.interestExploration < ASSESSMENT_CONFIG.sections.interestExploration.max) {
    return 'interestExploration';
  } else if (session.sections.workStyle < ASSESSMENT_CONFIG.sections.workStyle.max) {
    return 'workStyle';
  } else if (session.sections.technicalAptitude < ASSESSMENT_CONFIG.sections.technicalAptitude.max) {
    return 'technicalAptitude';
  } else if (session.sections.careerValues < ASSESSMENT_CONFIG.sections.careerValues.max) {
    return 'careerValues';
  }
  
  return 'summary';
}

/**
 * Check if a section is complete
 */
function isSectionComplete(session, sectionName) {
  const sectionConfig = ASSESSMENT_CONFIG.sections[sectionName];
  if (!sectionConfig) return true;
  
  return session.sections[sectionName] >= sectionConfig.max;
}

/**
 * Determine the next section after completing current one
 */
function determineNextSection(session, currentSection) {
  if (!isSectionComplete(session, currentSection)) {
    return currentSection;
  }
  
  const sectionOrder = ['introduction', 'interestExploration', 'workStyle', 'technicalAptitude', 'careerValues'];
  const currentIndex = sectionOrder.indexOf(currentSection);
  
  if (currentIndex < sectionOrder.length - 1) {
    return sectionOrder[currentIndex + 1];
  }
  
  return 'summary';
}

/**
 * Get the required question type for current section and progress
 */
function getRequiredQuestionType(session, currentSection) {
  const sectionConfig = ASSESSMENT_CONFIG.sections[currentSection];
  if (!sectionConfig) return 'text';
  
  const sectionProgress = session.sections[currentSection];
  
  // Section-specific logic
  switch (currentSection) {
    case 'introduction':
      return 'text'; // Always text for introduction
      
    case 'interestExploration':
      return 'multiple_choice'; // Always multiple choice
      
    case 'workStyle':
      return sectionProgress === 0 ? 'multiple_choice' : 'ranking';
      
    case 'technicalAptitude':
      return sectionProgress === 0 ? 'multiple_choice' : 'ranking';
      
    case 'careerValues':
      if (sectionProgress < 2) return 'multiple_choice';
      return 'text'; // Final question is open-ended
      
    default:
      return 'text';
  }
}

/**
 * Get overall assessment progress
 */
function getAssessmentProgress(session) {
  return {
    questionsCompleted: session.totalQuestions,
    totalQuestions: ASSESSMENT_CONFIG.totalQuestions,
    percentComplete: Math.round((session.totalQuestions / ASSESSMENT_CONFIG.totalQuestions) * 100),
    sectionsCompleted: Object.entries(session.sections).filter(([section, count]) => 
      isSectionComplete(session, section)
    ).length,
    totalSections: Object.keys(ASSESSMENT_CONFIG.sections).length
  };
}

/**
 * Get progress for a specific section
 */
function getSectionProgress(session, sectionName) {
  const sectionConfig = ASSESSMENT_CONFIG.sections[sectionName];
  if (!sectionConfig) return null;
  
  return {
    questionsCompleted: session.sections[sectionName] || 0,
    totalQuestions: sectionConfig.max,
    percentComplete: Math.round(((session.sections[sectionName] || 0) / sectionConfig.max) * 100),
    isComplete: isSectionComplete(session, sectionName)
  };
}

/**
 * Validate assessment state consistency
 */
export function validateAssessmentState(session) {
  const errors = [];
  
  // Check total questions don't exceed limit
  if (session.totalQuestions > ASSESSMENT_CONFIG.totalQuestions) {
    errors.push('Total questions exceed maximum allowed');
  }
  
  // Check section totals match overall total
  const sectionTotal = Object.values(session.sections).reduce((sum, count) => sum + count, 0);
  if (sectionTotal !== session.totalQuestions) {
    errors.push('Section totals do not match total questions');
  }
  
  // Check question type totals match overall total
  const typeTotal = Object.values(session.questionTypes).reduce((sum, count) => sum + count, 0);
  if (typeTotal !== session.totalQuestions) {
    errors.push('Question type totals do not match total questions');
  }
  
  // Check each section doesn't exceed its maximum
  Object.entries(ASSESSMENT_CONFIG.sections).forEach(([sectionName, config]) => {
    if (session.sections[sectionName] > config.max) {
      errors.push(`Section ${sectionName} exceeds maximum questions (${config.max})`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Reset assessment state
 */
export async function resetAssessment(sessionId) {
  try {
    const session = await getSession(sessionId);
    
    // Reset all counters
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
    
    console.log(`✓ Assessment reset for session ${sessionId}`);
    
    return session;
    
  } catch (error) {
    console.error(`❌ Failed to reset assessment for session ${sessionId}:`, error.message);
    throw error;
  }
}

/**
 * Get assessment configuration
 */
export function getAssessmentConfig() {
  return ASSESSMENT_CONFIG;
}

/**
 * Get assessment engine health status
 */
export function getAssessmentEngineHealth() {
  return {
    configLoaded: !!ASSESSMENT_CONFIG,
    totalQuestions: ASSESSMENT_CONFIG.totalQuestions,
    sectionsConfigured: Object.keys(ASSESSMENT_CONFIG.sections).length,
    questionTypesConfigured: Object.keys(ASSESSMENT_CONFIG.questionTypeDistribution).length
  };
}
