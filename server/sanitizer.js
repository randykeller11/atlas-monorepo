// Legacy sanitizer - now replaced by aiService.js validation pipeline
// This file is maintained for backward compatibility only

import { z } from 'zod';

// Legacy response schemas - now handled by aiService.js
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

// Legacy validation - now handled by aiService.js with Zod schemas
const validateResponseFormat = (response) => {
  console.warn('Using legacy validateResponseFormat - consider migrating to aiService.js validation');
  
  if (!response || typeof response !== 'object') return false;
  if (!response.type || !response.content) return false;

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

// Legacy type enforcement - now handled by assessmentStateMachine.js
const enforceQuestionType = (state) => {
  console.warn('Using legacy enforceQuestionType - consider using assessmentStateMachine.js');
  
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
  return 'multiple_choice';
};

// Legacy fallback responses
const createFallbackResponse = (type) => {
  console.warn('Using legacy createFallbackResponse - consider using aiService.js fallbacks');
  
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

// Legacy main sanitization function - now replaced by aiService.js pipeline
const sanitizeResponse = async (response, state, api, messages, retryCount = 0) => {
  console.warn('Using legacy sanitizeResponse - the new aiService.js handles validation automatically');
  
  try {
    const parsed = typeof response === 'string' ? JSON.parse(response) : response;
    
    if (validateResponseFormat(parsed)) {
      const requiredType = enforceQuestionType(state);
      if (parsed.type === requiredType) {
        return parsed;
      }
    }

    if (retryCount < 2) {
      console.log(`Legacy retry attempt ${retryCount + 1}`);
      
      const updatedMessages = messages.map(msg => 
        msg.role === 'system' ? {
          ...msg,
          content: `${msg.content}\n\nIMPORTANT: Response MUST be of type "${enforceQuestionType(state)}"`
        } : msg
      );

      const retryResponse = await api.getChatCompletion(updatedMessages);
      return sanitizeResponse(
        retryResponse?.choices?.[0]?.message?.content,
        state,
        api,
        updatedMessages,
        retryCount + 1
      );
    }

    console.log('Legacy fallback response used');
    return createFallbackResponse(enforceQuestionType(state));

  } catch (error) {
    console.error('Legacy sanitization error:', error);
    return createFallbackResponse(enforceQuestionType(state));
  }
};

// Export legacy functions for backward compatibility
export {
  sanitizeResponse,
  validateResponseFormat,
  enforceQuestionType,
  MultipleChoiceSchema,
  RankingSchema,
  TextSchema
};
