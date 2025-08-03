import { z } from 'zod';

// Response schemas for validation
const MultipleChoiceSchema = z.object({
  type: z.literal('multiple_choice'),
  content: z.string(),
  question: z.string(),
  options: z.array(z.object({
    id: z.string(),
    text: z.string()
  })).min(2).max(4)
});

const RankingSchema = z.object({
  type: z.literal('ranking'),
  content: z.string(),
  question: z.string(),
  items: z.array(z.object({
    id: z.string(),
    text: z.string()
  })).length(4),
  totalRanks: z.number().min(4).max(4)
});

const TextSchema = z.object({
  type: z.literal('text'),
  content: z.string()
});

// Response sanitization and validation layer
const validateResponseFormat = (response) => {
  // Basic structure check
  if (!response || typeof response !== 'object') return false;
  if (!response.type || !response.content) return false;

  // Validate based on type
  switch (response.type) {
    case 'multiple_choice':
      return (
        response.question &&
        Array.isArray(response.options) &&
        response.options.length >= 2 &&
        response.options.length <= 4 &&
        response.options.every(opt => opt.id && opt.text)
      );

    case 'ranking':
      return (
        response.question &&
        Array.isArray(response.items) &&
        response.items.length === 4 &&
        response.items.every(item => item.id && item.text) &&
        response.totalRanks === 4
      );

    case 'text':
      return typeof response.content === 'string' && response.content.includes('?');

    default:
      return false;
  }
};

const enforceQuestionType = (state) => {
  // Determine required question type based on section and progress
  if (state.currentSection === 'workStyle' && state.sections.workStyle === 1) {
    return 'ranking';
  }
  if (state.currentSection === 'technicalAptitude' && state.sections.technicalAptitude === 1) {
    return 'ranking';
  }
  if (state.currentSection === 'careerValues' && state.sections.careerValues === 2) {
    return 'text';
  }
  if (state.currentSection === 'careerValues' && state.sections.careerValues < 2) {
    return 'multiple_choice';
  }
  return 'multiple_choice'; // Default to multiple choice
};

const createFallbackResponse = (type) => {
  switch (type) {
    case 'multiple_choice':
      return {
        type: 'multiple_choice',
        content: 'I need to better understand your preferences.',
        question: 'Which option best describes your interest?',
        options: [
          { id: 'a', text: 'Tell me more about your interests' },
          { id: 'b', text: 'Let\'s explore a different topic' },
          { id: 'c', text: 'Move on to the next question' }
        ]
      };

    case 'ranking':
      return {
        type: 'ranking',
        content: 'Let\'s prioritize these aspects.',
        question: 'Please rank these items in order of importance to you:',
        items: [
          { id: 'item1', text: 'Learning new technologies' },
          { id: 'item2', text: 'Solving complex problems' },
          { id: 'item3', text: 'Working with others' },
          { id: 'item4', text: 'Building practical solutions' }
        ],
        totalRanks: 4
      };

    default:
      return {
        type: 'text',
        content: 'Could you tell me more about your career goals and aspirations?'
      };
  }
};

const sanitizeResponse = async (response, state, api, messages, retryCount = 0) => {
  try {
    // Parse response if it's a string
    const parsed = typeof response === 'string' ? JSON.parse(response) : response;
    
    // Validate format
    if (validateResponseFormat(parsed)) {
      // Check if type matches required type
      const requiredType = enforceQuestionType(state);
      if (parsed.type === requiredType) {
        return parsed;
      }
    }

    // Retry with explicit type requirement if attempts remain
    if (retryCount < 2) {
      console.log(`Retrying response generation (attempt ${retryCount + 1})`);
      
      // Add explicit type requirement to system message
      const updatedMessages = messages.map(msg => 
        msg.role === 'system' ? {
          ...msg,
          content: `${msg.content}\n\nIMPORTANT: Response MUST be of type "${enforceQuestionType(state)}"`
        } : msg
      );

      // Retry API call
      const retryResponse = await api.getChatCompletion(updatedMessages);
      return sanitizeResponse(
        retryResponse?.choices?.[0]?.message?.content,
        state,
        api,
        updatedMessages,
        retryCount + 1
      );
    }

    // Return type-appropriate fallback if all retries fail
    console.log('All retries failed, using fallback response');
    return createFallbackResponse(enforceQuestionType(state));

  } catch (error) {
    console.error('Sanitization error:', error);
    return createFallbackResponse(enforceQuestionType(state));
  }
};

export {
  sanitizeResponse,
  validateResponseFormat,
  enforceQuestionType
};
