import OpenRouterAPI from './api/openrouter.js';
import { getSession, saveSession } from './sessionService.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { z } from 'zod';
import { loadPromptTemplate, interpolateTemplate } from './promptService.js';
import { shouldTriggerSummarization, performContextSummarization } from './contextSummarizationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize OpenRouter API
const api = new OpenRouterAPI({
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    referer: process.env.APP_URL || "http://localhost:3000",
    title: "Atlas Career Coach"
  }
});

// Configuration
const MAX_CONTEXT_MESSAGES = parseInt(process.env.MAX_CONTEXT_MESSAGES) || 20;
const SUMMARIZATION_THRESHOLD = parseInt(process.env.SUMMARIZATION_THRESHOLD) || 15;
const MAX_TOKENS_PER_REQUEST = parseInt(process.env.MAX_TOKENS_PER_REQUEST) || 4000;

// Response schemas
const TextResponseSchema = z.object({
  type: z.literal('text'),
  content: z.string().min(1)
});

const MultipleChoiceResponseSchema = z.object({
  type: z.literal('multiple_choice'),
  content: z.string(),
  question: z.string().min(1),
  options: z.array(z.object({
    id: z.string(),
    text: z.string().min(1)
  })).min(2).max(4)
});

const RankingResponseSchema = z.object({
  type: z.literal('ranking'),
  content: z.string(),
  question: z.string().min(1),
  items: z.array(z.object({
    id: z.string(),
    text: z.string().min(1)
  })).length(4),
  totalRanks: z.number().int().positive()
});

/**
 * Main AI request handler with context management
 * @param {string} sessionId - Session identifier
 * @param {string} userInput - User's message
 * @param {Object} options - Additional options
 * @returns {Object} AI response with metadata
 */
export async function aiRequest(sessionId, userInput, options = {}) {
  console.log(`\n=== Enhanced AI Request for session ${sessionId} ===`);
  
  try {
    // Load session
    const session = await getSession(sessionId);
    
    // Check if summarization is needed
    if (shouldSummarize(session)) {
      console.log('Triggering context summarization...');
      await summarizeContextWithTemplate(session);
    }
    
    // Build message context using templates
    const messages = await buildMessageContextWithTemplates(session, userInput, options);
    
    // Make API call with retry logic
    let response;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        response = await api.getChatCompletion(messages);
        
        if (!response?.choices?.[0]?.message?.content) {
          throw new Error('Invalid API response format');
        }
        
        const aiResponse = response.choices[0].message.content;
        
        // Validate response schema
        const validationResult = await validateResponseWithSchema(aiResponse, options.expectedSchema);
        
        if (validationResult.valid) {
          // Update session history
          session.history.push(
            { role: 'user', content: userInput, timestamp: new Date().toISOString() },
            { role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() }
          );
          
          // Save updated session
          await saveSession(sessionId, session);
          
          console.log(`✓ AI request completed for session ${sessionId} (attempt ${attempts + 1})`);
          
          return {
            content: aiResponse,
            tokensUsed: response.usage?.total_tokens || 0,
            model: response.model || 'unknown',
            sessionUpdated: true,
            validationPassed: true
          };
        } else {
          console.warn(`Response validation failed (attempt ${attempts + 1}):`, validationResult.error);
          
          if (attempts < maxAttempts - 1) {
            // Try correction with template
            const correctionMessages = await buildCorrectionMessages(aiResponse, validationResult.error, options);
            messages.splice(-1, 1, ...correctionMessages); // Replace last message with correction
          }
        }
        
      } catch (error) {
        console.error(`API call failed (attempt ${attempts + 1}):`, error.message);
        if (attempts === maxAttempts - 1) throw error;
      }
      
      attempts++;
    }
    
    throw new Error(`Failed to get valid response after ${maxAttempts} attempts`);
    
  } catch (error) {
    console.error(`❌ Enhanced AI request failed for session ${sessionId}:`, error.message);
    throw error;
  }
}

/**
 * Check if context summarization is needed
 */
function shouldSummarize(session) {
  return shouldTriggerSummarization(session);
}

/**
 * Summarize conversation context using templates
 */
async function summarizeContextWithTemplate(session) {
  const result = await performContextSummarization(session.id);
  
  if (result.summarized) {
    console.log(`✓ Context summarized: ${result.messagesPruned} messages pruned, ${result.messagesPreserved} preserved`);
  } else {
    console.warn(`Context summarization failed: ${result.reason || result.error}`);
  }
  
  return result;
}

/**
 * Summarize conversation context (fallback method)
 */
async function summarizeContext(session) {
  try {
    console.log(`Summarizing context for session ${session.id}...`);
    
    // Build summarization prompt
    const summaryPrompt = `Please provide a concise summary of this career coaching conversation, focusing on:
1. Key insights about the user's interests and preferences
2. Important career-related decisions or discoveries
3. Any specific goals or concerns mentioned

Conversation history:
${session.history.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Provide a structured summary in 3-4 bullet points.`;

    const messages = [
      {
        role: 'system',
        content: 'You are a helpful assistant that summarizes career coaching conversations concisely.'
      },
      {
        role: 'user',
        content: summaryPrompt
      }
    ];
    
    const response = await api.getChatCompletion(messages);
    
    if (response?.choices?.[0]?.message?.content) {
      // Store summary and prune old messages
      session.summary = response.choices[0].message.content;
      
      // Keep only recent messages (last 6)
      const recentMessages = session.history.slice(-6);
      session.history = recentMessages;
      
      console.log(`✓ Context summarized and pruned for session ${session.id}`);
    }
    
  } catch (error) {
    console.error(`Failed to summarize context for session ${session.id}:`, error.message);
    // Don't throw - summarization failure shouldn't break the main flow
  }
}

/**
 * Build message context using templates
 */
async function buildMessageContextWithTemplates(session, userInput, options) {
  const messages = [];
  
  try {
    // Load system prompt template
    const template = await loadPromptTemplate('careerCoachSystem');
    
    // Prepare template variables
    const templateVars = {
      persona: session.persona ? JSON.stringify(session.persona) : null,
      anchors: session.anchors ? session.anchors.join(', ') : null,
      currentSection: session.currentSection || 'introduction',
      questionsCompleted: session.totalQuestions || 0,
      totalQuestions: 10
    };
    
    // Interpolate system message
    const systemContent = interpolateTemplate(template, templateVars);
    messages.push({ role: 'system', content: systemContent });
    
  } catch (error) {
    console.warn('Failed to load system template, using fallback:', error.message);
    // Fallback to original system message
    const systemMessage = await buildSystemMessage(session, options);
    messages.push(systemMessage);
  }
  
  // Add summary if available
  if (session.summary) {
    messages.push({
      role: 'assistant',
      content: `Previous conversation summary: ${session.summary}`
    });
  }
  
  // Add recent conversation history
  if (session.history && session.history.length > 0) {
    const recentHistory = session.history.slice(-6);
    messages.push(...recentHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    })));
  }
  
  // Add current user input
  messages.push({ role: 'user', content: userInput });
  
  return messages;
}

/**
 * Build message context for API call (fallback method)
 */
async function buildMessageContext(session, userInput, options) {
  const messages = [];
  
  // System message with persona and context
  const systemMessage = await buildSystemMessage(session, options);
  messages.push(systemMessage);
  
  // Add summary if available
  if (session.summary) {
    messages.push({
      role: 'assistant',
      content: `Previous conversation summary: ${session.summary}`
    });
  }
  
  // Add recent conversation history
  if (session.history && session.history.length > 0) {
    const recentHistory = session.history.slice(-6); // Last 6 messages
    messages.push(...recentHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    })));
  }
  
  // Add current user input
  messages.push({
    role: 'user',
    content: userInput
  });
  
  return messages;
}

/**
 * Build system message with persona, anchors, and assessment state
 */
async function buildSystemMessage(session, options) {
  try {
    // Import assessment functions
    const { getNextQuestion } = await import('./assessmentStateMachine.js');
    
    // Get current assessment state
    const nextQuestion = await getNextQuestion(session.id);
    
    let systemContent = `You are Atlas, a career guidance AI assistant. You help users explore career paths through thoughtful questions and personalized advice.`;
    
    // Add persona information if available
    if (session.persona) {
      systemContent += `\n\nUser Persona: ${session.persona.primary.name} (${Math.round(session.persona.primary.confidence * 100)}% confidence)`;
      systemContent += `\nKey Traits: ${session.persona.primary.traits.join(', ')}`;
      systemContent += `\nCareer Fit: ${session.persona.primary.careerFit.join(', ')}`;
    }
    
    // Add anchors (key insights) if available
    if (session.anchors && session.anchors.length > 0) {
      systemContent += `\n\nKey User Insights: ${session.anchors.join(', ')}`;
    }
    
    // Add assessment state
    if (!nextQuestion.isComplete) {
      systemContent += `\n\nAssessment Progress:`;
      systemContent += `\n- Current Section: ${nextQuestion.section}`;
      systemContent += `\n- Questions Completed: ${nextQuestion.progress?.questionsCompleted || 0}/${nextQuestion.progress?.totalQuestions || 10}`;
      systemContent += `\n- Next Question Type: ${nextQuestion.type}`;
      
      // Add section-specific guidance
      const sectionGuidance = getSectionGuidance(nextQuestion.section);
      if (sectionGuidance) {
        systemContent += `\n- Section Focus: ${sectionGuidance}`;
      }
    } else {
      systemContent += `\n\nAssessment Status: Complete - Focus on providing career guidance and insights based on the user's responses.`;
    }
    
    // Add response format instructions
    systemContent += `\n\nResponse Format: Always respond with valid JSON in one of these formats:
    
    For text responses:
    {"type": "text", "content": "Your response with a question"}
    
    For multiple choice:
    {"type": "multiple_choice", "content": "Lead-in text", "question": "Your question?", "options": [{"id": "a", "text": "Option A"}, {"id": "b", "text": "Option B"}]}
    
    For ranking:
    {"type": "ranking", "content": "Lead-in text", "question": "Rank these items:", "items": [{"id": "1", "text": "Item 1"}], "totalRanks": 4}`;
    
    // Add any custom instructions from options
    if (options.systemInstructions) {
      systemContent += `\n\n${options.systemInstructions}`;
    }
    
    return {
      role: 'system',
      content: systemContent
    };
    
  } catch (error) {
    console.warn('Error building system message:', error.message);
    // Fallback to basic system message
    return {
      role: 'system',
      content: 'You are Atlas, a career guidance AI assistant. Respond with valid JSON.'
    };
  }
}

function getSectionGuidance(section) {
  const guidance = {
    introduction: 'Welcome the user and begin exploring their background',
    interestExploration: 'Focus on personal hobbies, academic subjects, and innate curiosities',
    workStyle: 'Evaluate ideal working environment and communication preferences',
    technicalAptitude: 'Gauge comfort with coding, design, data, or IT tasks',
    careerValues: 'Understand motivations and desired work-life balance',
    summary: 'Provide comprehensive career guidance based on all responses'
  };
  
  return guidance[section] || null;
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text) {
  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Validate AI response format
 */
export function validateResponse(response, expectedSchema = null) {
  if (!response || typeof response !== 'string') {
    return { valid: false, error: 'Response is empty or not a string' };
  }
  
  // Basic validation - can be extended with Zod schemas
  if (expectedSchema) {
    // TODO: Implement schema validation with Zod
    console.log('Schema validation not yet implemented');
  }
  
  return { valid: true };
}

/**
 * Validate AI response against schema
 */
async function validateResponseWithSchema(response, expectedSchema) {
  try {
    // Try to parse as JSON first
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(response);
    } catch {
      // If not JSON, treat as text response
      parsedResponse = { type: 'text', content: response };
    }
    
    // Validate against appropriate schema
    switch (parsedResponse.type) {
      case 'multiple_choice':
        MultipleChoiceResponseSchema.parse(parsedResponse);
        break;
      case 'ranking':
        RankingResponseSchema.parse(parsedResponse);
        break;
      case 'text':
      default:
        TextResponseSchema.parse(parsedResponse);
        break;
    }
    
    return { valid: true, parsedResponse };
    
  } catch (error) {
    return { 
      valid: false, 
      error: error.message,
      originalResponse: response
    };
  }
}

/**
 * Build correction messages using templates
 */
async function buildCorrectionMessages(originalResponse, validationError, options) {
  try {
    const template = await loadPromptTemplate('responseCorrection');
    
    const correctionPrompt = interpolateTemplate(template, {
      originalResponse,
      expectedFormat: validationError,
      expectedSchema: JSON.stringify(options.expectedSchema || {}, null, 2)
    });
    
    return [{ role: 'user', content: correctionPrompt }];
    
  } catch (error) {
    console.warn('Failed to load correction template:', error.message);
    return [{
      role: 'user',
      content: `Please reformat your previous response. Error: ${validationError}`
    }];
  }
}

/**
 * Enhanced AI request with assessment integration
 */
export async function aiRequestWithAssessment(sessionId, userInput, options = {}) {
  console.log(`\n=== AI Request with Assessment Integration ===`);
  
  try {
    // Get current assessment state
    const { getNextQuestion, recordResponse } = await import('./assessmentStateMachine.js');
    const nextQuestion = await getNextQuestion(sessionId);
    const session = await getSession(sessionId);
    
    // Add assessment context to options
    const enhancedOptions = {
      ...options,
      assessmentContext: {
        currentSection: nextQuestion.section,
        progress: nextQuestion.progress,
        isComplete: nextQuestion.isComplete,
        requiredType: nextQuestion.type
      },
      systemInstructions: `${options.systemInstructions || ''}\n\nAssessment Context:
        - Current section: ${nextQuestion.section}
        - Progress: ${nextQuestion.progress?.questionsCompleted || 0}/${nextQuestion.progress?.totalQuestions || 10}
        - Next question should be: ${nextQuestion.type}
        - Assessment complete: ${nextQuestion.isComplete}
        
        ${nextQuestion.isComplete ? 
          'The assessment is complete. Focus on providing career guidance and insights.' :
          `Continue the assessment by asking a ${nextQuestion.type} question about ${nextQuestion.section}.`
        }`
    };
    
    // Make the AI request
    const response = await aiRequest(sessionId, userInput, enhancedOptions);
    
    // If this was a user response to an assessment question, record it
    if (isUserResponse(userInput) && !nextQuestion.isComplete) {
      try {
        const responseData = parseUserResponse(userInput, nextQuestion.type);
        await recordResponse(sessionId, responseData);
        console.log(`✓ Recorded assessment response: ${responseData.type}`);
      } catch (recordError) {
        console.warn('Failed to record assessment response:', recordError.message);
      }
    }
    
    return response;
    
  } catch (error) {
    console.error('Error in AI request with assessment:', error);
    // Fallback to regular AI request
    return await aiRequest(sessionId, userInput, options);
  }
}

// Helper functions
function isUserResponse(input) {
  // Detect if this is a user answering a question vs asking a new question
  const questionIndicators = ['what', 'how', 'why', 'when', 'where', 'tell me', 'explain'];
  const lowerInput = input.toLowerCase();
  
  // If it contains question indicators, it's likely a question
  if (questionIndicators.some(indicator => lowerInput.includes(indicator))) {
    return false;
  }
  
  // If it's short and doesn't end with a question mark, likely an answer
  return input.length < 200 && !input.includes('?');
}

function parseUserResponse(input, expectedType) {
  return {
    type: expectedType,
    content: input,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get AI service health status
 */
export function getAIServiceHealth() {
  return {
    apiKeyConfigured: !!process.env.OPENROUTER_API_KEY,
    maxContextMessages: MAX_CONTEXT_MESSAGES,
    summarizationThreshold: SUMMARIZATION_THRESHOLD,
    maxTokensPerRequest: MAX_TOKENS_PER_REQUEST
  };
}
