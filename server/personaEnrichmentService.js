import { v4 as uuidv4 } from 'uuid';
import { aiRequest } from './aiService.js';
import { getSession, saveSession } from './sessionService.js';
import { loadPromptTemplate, interpolateTemplate } from './promptService.js';
import { PersonaCardSchema, validatePersonaCard } from './schemas/personaCardSchema.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PERSONA_CARDS_DIR = path.join(__dirname, 'persona-cards');

// Ensure persona cards directory exists
await fs.mkdir(PERSONA_CARDS_DIR, { recursive: true });

// In-memory cache for persona cards
const personaCardCache = new Map();

/**
 * Enrich a base persona with detailed, personalized content
 */
export async function enrichPersona(sessionId, options = {}) {
  console.log(`\n=== Enriching Persona for session ${sessionId} ===`);
  
  try {
    const session = await getSession(sessionId);
    
    // Validate we have the required data
    if (!session.persona || !session.persona.primary) {
      throw new Error('No base persona found - run persona analysis first');
    }
    
    // Check cache first
    const cacheKey = `${sessionId}-${session.persona.primary.key}-v1.0`;
    if (personaCardCache.has(cacheKey) && !options.forceRefresh) {
      console.log('✓ Using cached enriched persona');
      return personaCardCache.get(cacheKey);
    }
    
    // Load enrichment template
    const template = await loadPromptTemplate('personaEnrichment');
    
    // Prepare template variables
    const templateVars = {
      basePersona: JSON.stringify(session.persona.primary),
      assessmentAnchors: (session.anchors || []).join(', '),
      userGoals: options.userGoals || 'Explore career options and find fulfilling work'
    };
    
    // Generate enrichment prompt
    const enrichmentPrompt = interpolateTemplate(template, templateVars);
    
    console.log('Calling AI service for persona enrichment...');
    
    // Make AI request for enrichment
    const aiResponse = await aiRequest(sessionId, enrichmentPrompt, {
      systemInstructions: 'You are a career counselor creating personalized career guidance. Respond with valid JSON only.',
      expectedSchema: 'json_object'
    });
    
    // Parse and validate the response
    let enrichedData;
    try {
      enrichedData = JSON.parse(aiResponse.content);
    } catch (parseError) {
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
    }
    
    // Validate against schema
    const validation = validatePersonaCard(enrichedData);
    if (!validation.success) {
      throw new Error(`Persona card validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }
    
    // Create enriched persona card
    const enrichedPersonaCard = {
      id: uuidv4(),
      sessionId: sessionId,
      basePersona: {
        key: session.persona.primary.key,
        name: session.persona.primary.name,
        confidence: session.persona.primary.confidence
      },
      assessmentAnchors: session.anchors || [],
      createdAt: new Date().toISOString(),
      version: "1.0",
      ...validation.data
    };
    
    // Cache the result
    personaCardCache.set(cacheKey, enrichedPersonaCard);
    
    // Persist to file system
    await savePersonaCardToFile(enrichedPersonaCard);
    
    // Update session with enriched persona
    session.enrichedPersona = enrichedPersonaCard;
    await saveSession(sessionId, session);
    
    logger.info('Persona enrichment completed', {
      sessionId,
      personaType: enrichedPersonaCard.basePersona.key,
      strengthsCount: enrichedPersonaCard.topStrengths.length,
      rolesCount: enrichedPersonaCard.suggestedRoles.length
    });
    
    console.log('✓ Persona enrichment completed');
    console.log(`  - Archetype: ${enrichedPersonaCard.archetypeName}`);
    console.log(`  - Strengths: ${enrichedPersonaCard.topStrengths.length}`);
    console.log(`  - Suggested roles: ${enrichedPersonaCard.suggestedRoles.length}`);
    console.log(`  - Next steps: ${enrichedPersonaCard.nextSteps.length}`);
    
    return enrichedPersonaCard;
    
  } catch (error) {
    logger.error('Persona enrichment failed', {
      sessionId,
      error: error.message,
      stack: error.stack
    });
    
    console.error(`❌ Persona enrichment failed: ${error.message}`);
    throw error;
  }
}

/**
 * Get enriched persona card for a session
 */
export async function getEnrichedPersona(sessionId) {
  try {
    const session = await getSession(sessionId);
    
    // Check session first
    if (session.enrichedPersona) {
      return session.enrichedPersona;
    }
    
    // Check cache
    if (session.persona?.primary?.key) {
      const cacheKey = `${sessionId}-${session.persona.primary.key}-v1.0`;
      if (personaCardCache.has(cacheKey)) {
        return personaCardCache.get(cacheKey);
      }
    }
    
    // Try to load from file
    const personaCard = await loadPersonaCardFromFile(sessionId);
    if (personaCard) {
      // Update cache
      const cacheKey = `${sessionId}-${personaCard.basePersona.key}-v1.0`;
      personaCardCache.set(cacheKey, personaCard);
      return personaCard;
    }
    
    return null;
    
  } catch (error) {
    logger.error('Failed to get enriched persona', {
      sessionId,
      error: error.message
    });
    return null;
  }
}

/**
 * Save persona card to file system
 */
async function savePersonaCardToFile(personaCard) {
  try {
    const filename = `${personaCard.sessionId}-${personaCard.basePersona.key}.json`;
    const filepath = path.join(PERSONA_CARDS_DIR, filename);
    
    await fs.writeFile(filepath, JSON.stringify(personaCard, null, 2), 'utf8');
    console.log(`✓ Persona card saved to ${filename}`);
    
  } catch (error) {
    console.warn(`Failed to save persona card to file: ${error.message}`);
    // Don't throw - file saving is not critical
  }
}

/**
 * Load persona card from file system
 */
async function loadPersonaCardFromFile(sessionId) {
  try {
    const files = await fs.readdir(PERSONA_CARDS_DIR);
    const matchingFile = files.find(file => file.startsWith(sessionId));
    
    if (!matchingFile) {
      return null;
    }
    
    const filepath = path.join(PERSONA_CARDS_DIR, matchingFile);
    const content = await fs.readFile(filepath, 'utf8');
    const personaCard = JSON.parse(content);
    
    // Validate loaded data
    const validation = validatePersonaCard(personaCard);
    if (!validation.success) {
      console.warn(`Invalid persona card file ${matchingFile}: ${validation.errors.map(e => e.message).join(', ')}`);
      return null;
    }
    
    return personaCard;
    
  } catch (error) {
    console.warn(`Failed to load persona card from file: ${error.message}`);
    return null;
  }
}

/**
 * Clear persona card cache
 */
export function clearPersonaCardCache() {
  personaCardCache.clear();
  console.log('✓ Persona card cache cleared');
}

/**
 * Get persona enrichment service health
 */
export function getPersonaEnrichmentHealth() {
  return {
    cacheSize: personaCardCache.size,
    storageDirectory: PERSONA_CARDS_DIR,
    templateAvailable: true,
    schemaValidation: true
  };
}
