import { getSession, saveSession } from './sessionService.js';
import { aiRequest } from './aiService.js';
import logger from './logger.js';

const SUMMARIZATION_THRESHOLD = parseInt(process.env.SUMMARIZATION_THRESHOLD) || 15;
const MESSAGES_TO_PRESERVE = parseInt(process.env.MESSAGES_TO_PRESERVE) || 6;

/**
 * Check if summarization should be triggered
 */
export function shouldTriggerSummarization(session) {
  if (!session.history || session.history.length < SUMMARIZATION_THRESHOLD) {
    return false;
  }
  
  // Don't summarize if we already have a recent summary
  if (session.lastSummarizedAt) {
    const lastSummary = new Date(session.lastSummarizedAt);
    const now = new Date();
    const hoursSinceLastSummary = (now - lastSummary) / (1000 * 60 * 60);
    
    // Only summarize if it's been more than 1 hour and we have new messages
    if (hoursSinceLastSummary < 1) {
      return false;
    }
  }
  
  return true;
}

/**
 * Perform context summarization
 */
export async function performContextSummarization(sessionId) {
  console.log(`Starting context summarization for session ${sessionId}`);
  
  try {
    const session = await getSession(sessionId);
    
    if (!shouldTriggerSummarization(session)) {
      return {
        summarized: false,
        reason: 'Summarization not needed',
        messageCount: session.history?.length || 0
      };
    }
    
    // Build summarization prompt
    const messagesToSummarize = session.history.slice(0, -MESSAGES_TO_PRESERVE);
    const summaryPrompt = `Please provide a concise summary of this career coaching conversation, focusing on:
1. Key insights about the user's interests, skills, and preferences
2. Important career-related decisions or discoveries
3. Assessment progress and persona insights
4. Any specific goals, concerns, or next steps mentioned

Conversation to summarize:
${messagesToSummarize.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Provide a structured summary in 4-5 bullet points that captures the essential information for continuing the conversation.`;

    // Get AI summary (use a simple system message to avoid recursion)
    const summaryResponse = await aiRequest(sessionId, summaryPrompt, {
      systemInstructions: 'You are a helpful assistant that summarizes career coaching conversations concisely and accurately.',
      skipContextBuilding: true // Flag to avoid infinite recursion
    });
    
    if (summaryResponse.content) {
      // Update session with summary
      const previousSummary = session.summary;
      session.summary = summaryResponse.content;
      session.lastSummarizedAt = new Date().toISOString();
      
      // Keep only recent messages
      const recentMessages = session.history.slice(-MESSAGES_TO_PRESERVE);
      const messagesPruned = session.history.length - recentMessages.length;
      session.history = recentMessages;
      
      // If we had a previous summary, combine them
      if (previousSummary) {
        session.summary = `Previous context: ${previousSummary}\n\nRecent updates: ${summaryResponse.content}`;
      }
      
      await saveSession(sessionId, session);
      
      console.log(`✓ Context summarized for session ${sessionId}: ${messagesPruned} messages pruned`);
      
      return {
        summarized: true,
        messagesPruned: messagesPruned,
        messagesPreserved: recentMessages.length,
        summaryLength: summaryResponse.content.length
      };
    } else {
      throw new Error('Empty summary response');
    }
    
  } catch (error) {
    console.error(`Failed to summarize context for session ${sessionId}:`, error.message);
    return {
      summarized: false,
      error: error.message,
      messageCount: 0
    };
  }
}

/**
 * Force summarization (for admin/debug purposes)
 */
export async function forceSummarization(sessionId) {
  console.log(`Forcing context summarization for session ${sessionId}`);
  
  const session = await getSession(sessionId);
  
  // Temporarily override the threshold check
  const originalThreshold = SUMMARIZATION_THRESHOLD;
  const originalLastSummarized = session.lastSummarizedAt;
  
  // Force summarization by clearing last summarized timestamp
  session.lastSummarizedAt = null;
  
  try {
    const result = await performContextSummarization(sessionId);
    return {
      ...result,
      forced: true
    };
  } finally {
    // Restore original values if summarization failed
    if (!result?.summarized) {
      session.lastSummarizedAt = originalLastSummarized;
      await saveSession(sessionId, session);
    }
  }
}

/**
 * Get summarization statistics for a session
 */
export async function getSummarizationStats(sessionId) {
  try {
    const session = await getSession(sessionId);
    
    return {
      sessionId: sessionId,
      messageCount: session.history?.length || 0,
      hasSummary: !!session.summary,
      summaryLength: session.summary?.length || 0,
      lastSummarizedAt: session.lastSummarizedAt,
      shouldSummarize: shouldTriggerSummarization(session),
      threshold: SUMMARIZATION_THRESHOLD,
      preserveCount: MESSAGES_TO_PRESERVE
    };
  } catch (error) {
    return {
      sessionId: sessionId,
      error: error.message
    };
  }
}

/**
 * Get summarization service health
 */
export function getContextSummarizationHealth() {
  return {
    enabled: process.env.SUMMARIZATION_ENABLED !== 'false',
    threshold: SUMMARIZATION_THRESHOLD,
    preserveCount: MESSAGES_TO_PRESERVE,
    status: 'active'
  };
}
