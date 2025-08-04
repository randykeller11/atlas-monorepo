import { getSession, saveSession } from './sessionService.js';
import { aiRequest } from './aiService.js';
import { knowledgeBaseService } from './knowledgeBaseService.js';
import logger from './logger.js';

/**
 * Enrich a persona with detailed career insights
 */
export async function enrichPersona(sessionId, options = {}) {
  console.log(`Enriching persona for session ${sessionId}`);
  
  try {
    const session = await getSession(sessionId);
    
    if (!session.persona) {
      throw new Error('No persona found for enrichment');
    }
    
    // Check if already enriched and not forcing refresh
    if (session.enrichedPersona && !options.forceRefresh) {
      console.log('Using existing enriched persona');
      return session.enrichedPersona;
    }
    
    // Get career insights from knowledge base
    const careerInsights = await knowledgeBaseService.getCareerInsights(
      session.persona,
      session.anchors || []
    );
    
    // Build enrichment prompt
    const enrichmentPrompt = `Based on this persona analysis, create a comprehensive career persona card:

Persona: ${session.persona.primary.name}
Confidence: ${Math.round(session.persona.primary.confidence * 100)}%
Key Traits: ${session.persona.primary.traits.join(', ')}
Career Fit: ${session.persona.primary.careerFit.join(', ')}
User Insights: ${(session.anchors || []).join(', ')}

Career Matches from Knowledge Base:
${careerInsights.map(insight => 
  `- ${insight.title} (${insight.match}% match): ${insight.description}`
).join('\n')}

Create a detailed persona card with:
1. A compelling archetype name and short description
2. An elevator pitch (2-3 sentences)
3. Top 6 strengths
4. 8 suggested roles based on the persona and career matches
5. 4 specific next steps for career development
6. A motivational insight

Format as JSON with these exact fields: archetypeName, shortDescription, elevatorPitch, topStrengths, suggestedRoles, nextSteps, motivationalInsight`;

    // Get AI enrichment
    const response = await aiRequest(sessionId, enrichmentPrompt, {
      systemInstructions: 'Generate a comprehensive career persona card based on the analysis. Return valid JSON with all required fields.',
      expectedSchema: 'json_object'
    });
    
    let enrichedData;
    try {
      enrichedData = JSON.parse(response.content);
    } catch (parseError) {
      console.warn('Failed to parse enrichment JSON, using fallback');
      enrichedData = generateFallbackEnrichment(session.persona, careerInsights);
    }
    
    // Create enriched persona card
    const enrichedPersona = {
      id: `enriched-${sessionId}-${Date.now()}`,
      sessionId: sessionId,
      basePersona: {
        key: session.persona.primary.key,
        name: session.persona.primary.name,
        confidence: session.persona.primary.confidence
      },
      archetypeName: enrichedData.archetypeName || session.persona.primary.name,
      shortDescription: enrichedData.shortDescription || 'A dedicated professional with unique strengths and capabilities.',
      elevatorPitch: enrichedData.elevatorPitch || 'I bring a unique combination of skills and passion to create meaningful impact in my work.',
      topStrengths: enrichedData.topStrengths || session.persona.primary.traits.slice(0, 6),
      suggestedRoles: enrichedData.suggestedRoles || session.persona.primary.careerFit.map(role => 
        role.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
      ),
      nextSteps: enrichedData.nextSteps || [
        'Complete a skills assessment to identify areas for growth',
        'Network with professionals in your field of interest',
        'Consider additional training or certifications',
        'Build a portfolio showcasing your capabilities'
      ],
      motivationalInsight: enrichedData.motivationalInsight || 'Your unique combination of traits positions you well for success in your chosen field.',
      careerInsights: careerInsights,
      assessmentAnchors: session.anchors || [],
      createdAt: new Date().toISOString(),
      version: '1.0'
    };
    
    // Save enriched persona
    session.enrichedPersona = enrichedPersona;
    await saveSession(sessionId, session);
    
    console.log(`✓ Persona enriched for session ${sessionId}: ${enrichedPersona.archetypeName}`);
    
    return enrichedPersona;
    
  } catch (error) {
    console.error('Error enriching persona:', error);
    throw error;
  }
}

/**
 * Get existing enriched persona
 */
export async function getEnrichedPersona(sessionId) {
  try {
    const session = await getSession(sessionId);
    return session.enrichedPersona || null;
  } catch (error) {
    console.error('Error getting enriched persona:', error);
    return null;
  }
}

/**
 * Generate fallback enrichment if AI parsing fails
 */
function generateFallbackEnrichment(persona, careerInsights) {
  return {
    archetypeName: persona.primary.name,
    shortDescription: `You are a ${persona.primary.name.toLowerCase()} who excels at ${persona.primary.traits.slice(0, 2).join(' and ')}.`,
    elevatorPitch: `I'm a results-driven professional with strong ${persona.primary.traits[0]} and ${persona.primary.traits[1]} capabilities, passionate about creating meaningful impact through my work.`,
    topStrengths: persona.primary.traits.slice(0, 6),
    suggestedRoles: careerInsights.slice(0, 8).map(insight => insight.title),
    nextSteps: [
      'Explore opportunities in your areas of strength',
      'Build relevant skills through courses or certifications',
      'Network with professionals in your target field',
      'Create a portfolio showcasing your capabilities'
    ],
    motivationalInsight: `Your ${persona.primary.name.toLowerCase()} nature gives you unique advantages in ${persona.primary.careerFit[0]} and related fields.`
  };
}
