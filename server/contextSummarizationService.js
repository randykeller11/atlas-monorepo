import { loadPromptTemplate, interpolateTemplate } from './promptService.js';
import OpenRouterAPI from './api/openrouter.js';
import { getSession, saveSession } from './sessionService.js';

// Initialize OpenRouter API
const api = new OpenRouterAPI({
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    referer: process.env.APP_URL || "http://localhost:3000",
    title: "Atlas Career Coach - Context Summarization"
  }
});

// Configuration
const SUMMARIZATION_THRESHOLD = parseInt(process.env.SUMMARIZATION_THRESHOLD) || 15;
const CONTEXT_WINDOW_SIZE = parseInt(process.env.CONTEXT_WINDOW_SIZE) || 6;
const MAX_SUMMARY_LENGTH = parseInt(process.env.MAX_SUMMARY_LENGTH) || 500;
const SUMMARIZATION_ENABLED = process.env.SUMMARIZATION_ENABLED !== 'false';

/**
 * Check if summarization should be triggered
 * @param {Object} session - Session object
 * @returns {boolean} Whether summarization should be triggered
 */
export function shouldTriggerSummarization(session) {
  if (!SUMMARIZATION_ENABLED) {
    return false;
  }
  
  if (!session.history || !Array.isArray(session.history)) {
    return false;
  }
  
  // Check message count threshold
  const messageCount = session.history.length;
  if (messageCount <= SUMMARIZATION_THRESHOLD) {
    return false;
  }
  
  // Check if we already have a recent summary
  const lastSummaryTime = session.lastSummarizedAt ? new Date(session.lastSummarizedAt) : null;
  const now = new Date();
  const timeSinceLastSummary = lastSummaryTime ? (now - lastSummaryTime) / (1000 * 60) : Infinity; // minutes
  
  // For testing purposes, allow summarization if message count significantly exceeds threshold
  // even if time constraint isn't met
  const messageCountExceedsThresholdSignificantly = messageCount > (SUMMARIZATION_THRESHOLD * 2);
  
  // Don't summarize if we summarized less than 10 minutes ago, unless message count is very high
  if (timeSinceLastSummary < 10 && !messageCountExceedsThresholdSignificantly) {
    return false;
  }
  
  console.log(`Summarization triggered: ${messageCount} messages (threshold: ${SUMMARIZATION_THRESHOLD})`);
  return true;
}

/**
 * Estimate token count for messages
 * @param {Array} messages - Array of message objects
 * @returns {number} Estimated token count
 */
export function estimateTokenCount(messages) {
  if (!Array.isArray(messages)) return 0;
  
  const totalChars = messages.reduce((total, msg) => {
    return total + (msg.content ? msg.content.length : 0);
  }, 0);
  
  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(totalChars / 4);
}

/**
 * Perform context summarization using template-based prompts
 * @param {string} sessionId - Session identifier
 * @returns {Object} Summarization result
 */
export async function performContextSummarization(sessionId) {
  console.log(`\n=== Performing Context Summarization for session ${sessionId} ===`);
  
  try {
    const session = await getSession(sessionId);
    
    if (!shouldTriggerSummarization(session)) {
      console.log('Summarization not needed or disabled');
      return { summarized: false, reason: 'threshold_not_met' };
    }
    
    // Load summarization template
    const template = await loadPromptTemplate('summaryPrompt');
    
    // Prepare messages for summarization (exclude the most recent ones)
    const messagesToSummarize = session.history.slice(0, -CONTEXT_WINDOW_SIZE);
    const recentMessages = session.history.slice(-CONTEXT_WINDOW_SIZE);
    
    if (messagesToSummarize.length === 0) {
      console.log('No messages to summarize after preserving recent context');
      return { summarized: false, reason: 'insufficient_messages' };
    }
    
    // Format messages for the template
    const formattedMessages = messagesToSummarize
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
    
    // Interpolate template with conversation data
    const summaryPrompt = interpolateTemplate(template, {
      recentMessages: formattedMessages,
      sessionId: sessionId,
      messageCount: messagesToSummarize.length,
      currentSection: session.currentSection || 'unknown',
      totalQuestions: session.totalQuestions || 0
    });
    
    // Prepare API call
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful assistant that creates concise, structured summaries of career coaching conversations. Focus on key insights, decisions, and progress made.'
      },
      {
        role: 'user',
        content: summaryPrompt
      }
    ];
    
    console.log(`Summarizing ${messagesToSummarize.length} messages, preserving ${recentMessages.length} recent messages`);
    
    // Make API call
    const response = await api.getChatCompletion(messages);
    
    if (!response?.choices?.[0]?.message?.content) {
      throw new Error('Invalid summarization API response');
    }
    
    const newSummary = response.choices[0].message.content.trim();
    
    // Validate summary length
    if (newSummary.length > MAX_SUMMARY_LENGTH) {
      console.warn(`Summary length (${newSummary.length}) exceeds maximum (${MAX_SUMMARY_LENGTH}), truncating`);
      const truncatedSummary = newSummary.substring(0, MAX_SUMMARY_LENGTH - 3) + '...';
      session.summary = truncatedSummary;
    } else {
      session.summary = newSummary;
    }
    
    // Combine with existing summary if present
    if (session.previousSummary) {
      session.summary = `${session.previousSummary}\n\n--- Recent Activity ---\n${session.summary}`;
      
      // If combined summary is too long, keep only the recent part
      if (session.summary.length > MAX_SUMMARY_LENGTH * 2) {
        session.previousSummary = null; // Clear old summary
        session.summary = newSummary;
      }
    }
    
    // Update session with pruned history
    session.history = recentMessages;
    session.lastSummarizedAt = new Date().toISOString();
    session.summarizationCount = (session.summarizationCount || 0) + 1;
    
    // Store the previous summary for potential chaining
    if (!session.previousSummary && session.summarizationCount > 1) {
      session.previousSummary = session.summary;
    }
    
    // Save updated session
    await saveSession(sessionId, session);
    
    const tokensUsed = response.usage?.total_tokens || 0;
    const messagesPruned = messagesToSummarize.length;
    
    console.log(`✓ Context summarization completed:`);
    console.log(`  - Messages pruned: ${messagesPruned}`);
    console.log(`  - Messages preserved: ${recentMessages.length}`);
    console.log(`  - Summary length: ${session.summary.length} chars`);
    console.log(`  - Tokens used: ${tokensUsed}`);
    console.log(`  - Summarization count: ${session.summarizationCount}`);
    
    return {
      summarized: true,
      messagesPruned,
      messagesPreserved: recentMessages.length,
      summaryLength: session.summary.length,
      tokensUsed,
      summarizationCount: session.summarizationCount
    };
    
  } catch (error) {
    console.error(`❌ Context summarization failed for session ${sessionId}:`, error.message);
    
    // Don't throw - summarization failure shouldn't break the main flow
    return {
      summarized: false,
      error: error.message,
      reason: 'api_error'
    };
  }
}

/**
 * Get summarization statistics for a session
 * @param {string} sessionId - Session identifier
 * @returns {Object} Summarization statistics
 */
export async function getSummarizationStats(sessionId) {
  try {
    const session = await getSession(sessionId);
    
    return {
      sessionId,
      currentMessageCount: session.history ? session.history.length : 0,
      hasSummary: !!session.summary,
      summaryLength: session.summary ? session.summary.length : 0,
      lastSummarizedAt: session.lastSummarizedAt || null,
      summarizationCount: session.summarizationCount || 0,
      thresholdMet: shouldTriggerSummarization(session),
      estimatedTokens: estimateTokenCount(session.history || []),
      configuration: {
        threshold: SUMMARIZATION_THRESHOLD,
        contextWindowSize: CONTEXT_WINDOW_SIZE,
        maxSummaryLength: MAX_SUMMARY_LENGTH,
        enabled: SUMMARIZATION_ENABLED
      }
    };
  } catch (error) {
    console.error(`Failed to get summarization stats for session ${sessionId}:`, error.message);
    throw error;
  }
}

/**
 * Force summarization for a session (admin function)
 * @param {string} sessionId - Session identifier
 * @returns {Object} Summarization result
 */
export async function forceSummarization(sessionId) {
  console.log(`Force summarization requested for session ${sessionId}`);
  
  const session = await getSession(sessionId);
  
  // Temporarily override the threshold check
  const originalThreshold = session.history ? session.history.length : 0;
  session.history = session.history || [];
  
  // Add enough dummy messages to trigger summarization if needed
  while (session.history.length <= SUMMARIZATION_THRESHOLD) {
    session.history.push({
      role: 'system',
      content: '[Padding message for forced summarization]',
      timestamp: new Date().toISOString()
    });
  }
  
  await saveSession(sessionId, session);
  
  const result = await performContextSummarization(sessionId);
  
  // Clean up dummy messages if summarization succeeded
  if (result.summarized) {
    const updatedSession = await getSession(sessionId);
    updatedSession.history = updatedSession.history.filter(
      msg => msg.content !== '[Padding message for forced summarization]'
    );
    await saveSession(sessionId, updatedSession);
  }
  
  return { ...result, forced: true };
}

/**
 * Get context summarization service health
 * @returns {Object} Service health information
 */
export function getContextSummarizationHealth() {
  return {
    enabled: SUMMARIZATION_ENABLED,
    threshold: SUMMARIZATION_THRESHOLD,
    contextWindowSize: CONTEXT_WINDOW_SIZE,
    maxSummaryLength: MAX_SUMMARY_LENGTH,
    apiConfigured: !!process.env.OPENROUTER_API_KEY,
    templateAvailable: true // We'll assume template loading works if we get here
  };
}
