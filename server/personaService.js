import { getSession, saveSession } from './sessionService.js';

// Persona archetypes and their characteristics
const PERSONA_ARCHETYPES = {
  explorer: {
    name: 'The Explorer',
    description: 'Curious and adaptable, thrives on variety and new experiences',
    traits: ['curious', 'adaptable', 'variety-seeking', 'open-minded'],
    careerFit: ['research', 'consulting', 'travel', 'entrepreneurship']
  },
  builder: {
    name: 'The Builder',
    description: 'Practical and results-oriented, enjoys creating tangible outcomes',
    traits: ['practical', 'results-oriented', 'hands-on', 'problem-solving'],
    careerFit: ['engineering', 'construction', 'manufacturing', 'project-management']
  },
  connector: {
    name: 'The Connector',
    description: 'People-focused and collaborative, energized by helping others',
    traits: ['empathetic', 'collaborative', 'communication-focused', 'service-oriented'],
    careerFit: ['education', 'healthcare', 'social-work', 'human-resources']
  },
  analyst: {
    name: 'The Analyst',
    description: 'Detail-oriented and systematic, enjoys working with data and patterns',
    traits: ['analytical', 'detail-oriented', 'systematic', 'data-driven'],
    careerFit: ['finance', 'data-science', 'research', 'quality-assurance']
  },
  creator: {
    name: 'The Creator',
    description: 'Imaginative and expressive, driven by artistic and innovative pursuits',
    traits: ['creative', 'expressive', 'innovative', 'aesthetic-focused'],
    careerFit: ['design', 'marketing', 'arts', 'content-creation']
  },
  leader: {
    name: 'The Leader',
    description: 'Strategic and influential, motivated by guiding teams and organizations',
    traits: ['strategic', 'influential', 'decisive', 'vision-oriented'],
    careerFit: ['management', 'executive', 'consulting', 'politics']
  }
};

/**
 * Analyze user responses and determine persona
 * @param {string} sessionId - Session identifier
 * @returns {Object} Persona analysis result
 */
export async function analyzePersona(sessionId) {
  console.log(`\n=== Analyzing persona for session ${sessionId} ===`);
  
  try {
    const session = await getSession(sessionId);
    
    if (!session.history || session.history.length === 0) {
      console.log('No conversation history available for persona analysis');
      return null;
    }
    
    // Extract user responses from history
    const userResponses = session.history
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content);
    
    // Analyze responses for persona indicators
    const personaScores = calculatePersonaScores(userResponses);
    
    // Determine primary persona
    const primaryPersona = determinePrimaryPersona(personaScores);
    
    // Generate persona summary
    const personaSummary = generatePersonaSummary(primaryPersona, personaScores);
    
    // Update session with persona
    session.persona = {
      primary: primaryPersona,
      scores: personaScores,
      summary: personaSummary,
      analyzedAt: new Date().toISOString()
    };
    
    await saveSession(sessionId, session);
    
    console.log(`✓ Persona analysis completed: ${primaryPersona.name}`);
    
    return session.persona;
    
  } catch (error) {
    console.error(`❌ Persona analysis failed for session ${sessionId}:`, error.message);
    throw error;
  }
}

/**
 * Calculate scores for each persona archetype
 */
function calculatePersonaScores(userResponses) {
  const scores = {};
  
  // Initialize scores
  Object.keys(PERSONA_ARCHETYPES).forEach(key => {
    scores[key] = 0;
  });
  
  // Analyze each response
  userResponses.forEach(response => {
    const lowerResponse = response.toLowerCase();
    
    // Explorer indicators
    if (containsKeywords(lowerResponse, ['explore', 'travel', 'variety', 'new', 'different', 'curious', 'learn'])) {
      scores.explorer += 1;
    }
    
    // Builder indicators
    if (containsKeywords(lowerResponse, ['build', 'create', 'make', 'practical', 'hands-on', 'solve', 'fix'])) {
      scores.builder += 1;
    }
    
    // Connector indicators
    if (containsKeywords(lowerResponse, ['help', 'people', 'team', 'collaborate', 'support', 'teach', 'care'])) {
      scores.connector += 1;
    }
    
    // Analyst indicators
    if (containsKeywords(lowerResponse, ['analyze', 'data', 'research', 'detail', 'systematic', 'numbers', 'study'])) {
      scores.analyst += 1;
    }
    
    // Creator indicators
    if (containsKeywords(lowerResponse, ['creative', 'design', 'art', 'innovative', 'express', 'imagine', 'aesthetic'])) {
      scores.creator += 1;
    }
    
    // Leader indicators
    if (containsKeywords(lowerResponse, ['lead', 'manage', 'strategy', 'decision', 'influence', 'guide', 'vision'])) {
      scores.leader += 1;
    }
  });
  
  return scores;
}

/**
 * Check if text contains any of the given keywords
 */
function containsKeywords(text, keywords) {
  return keywords.some(keyword => text.includes(keyword));
}

/**
 * Determine primary persona from scores
 */
function determinePrimaryPersona(scores) {
  let maxScore = 0;
  let primaryPersonaKey = 'explorer'; // default
  
  Object.entries(scores).forEach(([key, score]) => {
    if (score > maxScore) {
      maxScore = score;
      primaryPersonaKey = key;
    }
  });
  
  return {
    key: primaryPersonaKey,
    ...PERSONA_ARCHETYPES[primaryPersonaKey],
    confidence: maxScore / Math.max(1, Object.values(scores).reduce((a, b) => a + b, 0))
  };
}

/**
 * Generate persona summary with bullet points
 */
function generatePersonaSummary(primaryPersona, scores) {
  const summary = [
    `Primary archetype: ${primaryPersona.name}`,
    `Key traits: ${primaryPersona.traits.join(', ')}`,
    `Career alignment: ${primaryPersona.careerFit.join(', ')}`,
    `Confidence level: ${Math.round(primaryPersona.confidence * 100)}%`
  ];
  
  // Add secondary personas if they have significant scores
  const sortedScores = Object.entries(scores)
    .sort(([,a], [,b]) => b - a)
    .slice(1, 3); // Get top 2 secondary personas
  
  const secondaryPersonas = sortedScores
    .filter(([, score]) => score > 0)
    .map(([key]) => PERSONA_ARCHETYPES[key].name);
  
  if (secondaryPersonas.length > 0) {
    summary.push(`Secondary influences: ${secondaryPersonas.join(', ')}`);
  }
  
  return summary;
}

/**
 * Get persona recommendations for career paths
 */
export function getPersonaRecommendations(persona) {
  if (!persona || !persona.primary) {
    return [];
  }
  
  const archetype = PERSONA_ARCHETYPES[persona.primary.key];
  if (!archetype) {
    return [];
  }
  
  return archetype.careerFit.map(career => ({
    field: career,
    match: persona.primary.confidence,
    reason: `Aligns with ${archetype.name} characteristics`
  }));
}

/**
 * Update persona with new insights
 */
export async function updatePersonaAnchors(sessionId, newAnchors) {
  try {
    const session = await getSession(sessionId);
    
    if (!session.anchors) {
      session.anchors = [];
    }
    
    // Add new anchors, avoiding duplicates
    newAnchors.forEach(anchor => {
      if (!session.anchors.includes(anchor)) {
        session.anchors.push(anchor);
      }
    });
    
    // Keep only the most recent 10 anchors
    if (session.anchors.length > 10) {
      session.anchors = session.anchors.slice(-10);
    }
    
    await saveSession(sessionId, session);
    
    console.log(`✓ Updated anchors for session ${sessionId}: ${newAnchors.join(', ')}`);
    
    return session.anchors;
    
  } catch (error) {
    console.error(`❌ Failed to update anchors for session ${sessionId}:`, error.message);
    throw error;
  }
}

/**
 * Get all available persona archetypes
 */
export function getPersonaArchetypes() {
  return PERSONA_ARCHETYPES;
}

/**
 * Get persona service health status
 */
export function getPersonaServiceHealth() {
  return {
    archetypesLoaded: Object.keys(PERSONA_ARCHETYPES).length,
    availableArchetypes: Object.keys(PERSONA_ARCHETYPES)
  };
}
