import express from 'express';
import cors from 'cors';
import OpenRouterAPI from "./api/openrouter.js";
import { instructions } from "./instructions.js";
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { users } from "./users.js";
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeResponse } from './sanitizer.js';
import { getSession, saveSession, deleteSession, checkRedisHealth, getSessionStats } from './sessionService.js';
import { analyzePersona, updatePersonaAnchors, getPersonaRecommendations } from './personaService.js';
import { getNextQuestion, recordResponse, validateAssessmentState, resetAssessment } from './assessmentStateMachine.js';
import { aiRequest } from './aiService.js';
import { generateResume, generateCareerSummary, getResumeTemplates } from './resumeService.js';
import { enrichPersona, getEnrichedPersona } from './personaEnrichmentService.js';
import { 
  getAvailableTemplates, 
  loadPromptTemplate, 
  updateTemplate, 
  clearTemplateCache,
  saveTemplateVersion,
  getTemplateVersionHistory,
  rollbackTemplate,
  getCurrentTemplateVersion
} from './promptService.js';
import { 
  performContextSummarization, 
  getSummarizationStats, 
  forceSummarization,
  getContextSummarizationHealth 
} from './contextSummarizationService.js';
import yaml from 'js-yaml';
import logger, { 
  logSessionActivity, 
  logError,
  logAIRequest,
  logAIResponse 
} from './logger.js';

const getConversationState = async (sessionId) => {
  return await getSession(sessionId);
};

const updateConversationState = async (sessionId, response) => {
  const state = await getSession(sessionId);
  
  if (response.type && ['multiple_choice', 'ranking', 'text'].includes(response.type)) {
    state.questionTypes[response.type]++;
    state.totalQuestions++;
    state.lastQuestionType = response.type;
    
    // Update section counts and manage transitions
    state.sections[state.currentSection]++;
    
    // Section transition logic with strict question type enforcement
    if (state.currentSection === 'introduction' && state.totalQuestions === 1) {
      // First question was text (name response), next must be multiple choice
      state.currentSection = 'interestExploration';
      state.hasOpenEndedInSection.introduction = true;
      state.lastQuestionType = 'text'; // Force next question to be multiple choice
    } 
    else if (state.currentSection === 'interestExploration') {
      // Interest Exploration: must be 2 multiple choice questions
      if (state.sections.interestExploration === 2) {
        state.currentSection = 'workStyle';
      }
      state.lastQuestionType = 'multiple_choice'; // Force multiple choice
    } 
    else if (state.currentSection === 'workStyle') {
      // Work Style: first multiple choice, then ranking
      if (state.sections.workStyle === 1) {
        state.lastQuestionType = 'ranking'; // Force second question to be ranking
      } else if (state.sections.workStyle === 2) {
        state.currentSection = 'technicalAptitude';
      }
    } 
    else if (state.currentSection === 'technicalAptitude') {
      // Technical Aptitude: first multiple choice, then ranking
      if (state.sections.technicalAptitude === 1) {
        state.lastQuestionType = 'ranking'; // Force second question to be ranking
      } else if (state.sections.technicalAptitude === 2) {
        state.currentSection = 'careerValues';
      }
    }
    else if (state.currentSection === 'careerValues') {
      // Career Values: two multiple choice, then one text
      if (state.sections.careerValues < 2) {
        state.lastQuestionType = 'multiple_choice'; // Force first two to be multiple choice
      } else if (state.sections.careerValues === 2) {
        state.lastQuestionType = 'text'; // Force last question to be text
      }
    }
  }

  await saveSession(sessionId, state);
  return state;
};

// Initialize dotenv
dotenv.config();

// Set up __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const api = new OpenRouterAPI({
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    referer: process.env.APP_URL || "http://localhost:3000",
    title: "Atlas Career Coach"
  }
});

const app = express();
const PORT = process.env.PORT || 5001;

app.use(
  cors({
    origin: [
      "https://nucoord-atlas-e99e7eee1cf6.herokuapp.com",
      "http://localhost:3000",
      "http://localhost:5001",
    ],
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "session-id"],
  })
);
app.use((req, res, next) => {
  const allowedOrigins = [
    "https://nucoord-atlas-e99e7eee1cf6.herokuapp.com",
    "http://localhost:3000",
  ];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, session-id"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});
app.use(express.json());
app.use(express.static(path.join(__dirname, "../client/build")));

// Initialize OpenAI API

// Add helper functions for response parsing and formatting
const isMultipleChoice = (text) => {
  const choiceIndicators = [
    // Question patterns
    /(?:select|choose|pick)\s+(?:one|an option)/i,
    /which\s+(?:of the following|option|best describes|approach|method)/i,
    /would you (?:prefer|like|rather)/i,
    /how would you/i,
    /what (?:would|do) you/i,
    /what'?s your/i,
    
    // Format patterns
    /\b(?:A|B|C|D)\)[\s\w]/i,
    /\b(?:option|choice)\s*(?:[A-D]|\d+):/i,
    /(?:\d+\.|\([A-D]\)|\b[A-D]\))\s+\w+/i,
    
    // List indicators
    /(?:•|-|\*)\s+[\w\s]+(?:\n|$)/,
    /(?:\d+\.)\s+[\w\s]+(?:\n|$)/
  ];

  // Check for question mark and any of the indicators
  const hasQuestion = text.includes('?');
  const hasIndicators = choiceIndicators.some(pattern => pattern.test(text));
  
  // Also check for list-like structure with multiple items
  const listItems = text.match(/(?:^|\n)(?:•|-|\*|\d+\.|[A-D]\))\s+.+/gm);
  const hasMultipleListItems = listItems && listItems.length >= 2;

  return hasQuestion && (hasIndicators || hasMultipleListItems);
};

const detectQuestionType = (text) => {
  // First check for explicit lettered options (A), B), etc.)
  const hasLetterOptions = /(?:[A-D]\)|\([A-D]\))[\s\w]/.test(text);
  
  // Then check for question markers
  const hasQuestion = text.includes('?');
  
  // Check for common multiple choice indicators
  const choiceIndicators = [
    /(?:select|choose|pick)\s+(?:one|an option)/i,
    /which\s+(?:of the following|option|approach|method)/i,
    /would you (?:prefer|handle|approach)/i,
    /how would you/i,
    /what (?:would|do) you/i
  ];

  return hasQuestion && (hasLetterOptions || choiceIndicators.some(pattern => pattern.test(text)));
};

const extractOptions = (text) => {
  // Try different option formats in order of preference
  const patterns = [
    // A) or (A) format
    {
      pattern: /(?:[A-D]\)|\([A-D]\))\s*([^A-D\n]+?)(?=(?:\s*(?:[A-D]\)|\([A-D]\))|$))/g,
      transform: matches => matches.map((m, i) => ({
        id: String.fromCharCode(97 + i),
        text: m[1].trim()
      }))
    },
    // Numbered format (1., 2., etc)
    {
      pattern: /(?:\d+\.)\s*([^\d\n]+?)(?=(?:\s*\d+\.|$))/g,
      transform: matches => matches.map((m, i) => ({
        id: String.fromCharCode(97 + i),
        text: m[1].trim()
      }))
    },
    // Bullet points or dashes
    {
      pattern: /(?:•|-|\*)\s*([^\n•\-\*]+?)(?=(?:\s*(?:•|-|\*)|$))/g,
      transform: matches => matches.map((m, i) => ({
        id: String.fromCharCode(97 + i),
        text: m[1].trim()
      }))
    },
    // Options with labels (Option 1:, Choice A:, etc)
    {
      pattern: /(?:option|choice)\s*(?:[A-D]|\d+):\s*([^\n]+)/gi,
      transform: matches => matches.map((m, i) => ({
        id: String.fromCharCode(97 + i),
        text: m[1].trim()
      }))
    }
  ];

  for (const {pattern, transform} of patterns) {
    const matches = Array.from(text.matchAll(pattern));
    if (matches.length >= 2) {
      const options = transform(matches);
      
      // Validate and clean the options
      const validOptions = options.filter(opt => 
        opt.text && 
        opt.text.length > 0 && 
        !opt.text.match(/^\s*$/)
      );

      if (validOptions.length >= 2) {
        return validOptions;
      }
    }
  }

  // If no matches found with patterns, try splitting on newlines
  const lines = text.split('\n');
  const options = [];
  let foundStart = false;

  for (const line of lines) {
    const trimmed = line.trim();
    // Look for lines that start with any kind of list marker
    if (/^(?:[A-D]\)|\([A-D]\)|\d+\.|•|-|\*)\s+\w/.test(trimmed)) {
      foundStart = true;
      const optionText = trimmed.replace(/^(?:[A-D]\)|\([A-D]\)|\d+\.|•|-|\*)\s+/, '').trim();
      if (optionText) {
        options.push({
          id: String.fromCharCode(97 + options.length),
          text: optionText
        });
      }
    } else if (foundStart && trimmed && !trimmed.endsWith('?')) {
      // Continue previous option if it's a wrapped line
      if (options.length > 0) {
        options[options.length - 1].text += ' ' + trimmed;
      }
    }
  }

  return options.length >= 2 ? options : null;
};

const extractQuestion = (text) => {
  // Look for the last question before options
  const parts = text.split(/(?:[A-D]\)|\([A-D]\)|\d+\.|•|-)/)[0];
  const questions = parts.match(/[^.!?]+\?/g);
  
  if (questions) {
    return questions[questions.length - 1].trim();
  }
  
  // Fallback to looking for question-like phrases
  const questionIndicators = [
    /how would you[^?]*\??/i,
    /what would you[^?]*\??/i,
    /which (?:option|approach)[^?]*\??/i,
    /do you prefer[^?]*\??/i
  ];
  
  for (const pattern of questionIndicators) {
    const match = text.match(pattern);
    if (match) {
      return match[0].trim();
    }
  }
  
  return text.split('\n')[0].trim();
};

// Add helper function to log response format issues
const logFormatError = (response, context = {}) => {
  console.error("\n=== Response Format Error ===");
  console.error(`Timestamp: ${new Date().toISOString()}`);
  console.error("Context:", context);
  console.error("Raw Response:", response);

  // Try to identify specific formatting issues
  const formatIssues = [];

  if (response.includes("<mc>") && !response.includes("</mc>")) {
    formatIssues.push("Unclosed <mc> tag");
  }
  if (response.includes("<rank>") && !response.includes("</rank>")) {
    formatIssues.push("Unclosed <rank> tag");
  }

  try {
    // Check for valid JSON within tags
    const mcMatch = response.match(/<mc>([\s\S]*?)<\/mc>/);
    if (mcMatch) {
      JSON.parse(mcMatch[1]);
    }
    const rankMatch = response.match(/<rank>([\s\S]*?)<\/rank>/);
    if (rankMatch) {
      JSON.parse(rankMatch[1]);
    }
  } catch (error) {
    formatIssues.push(`Invalid JSON: ${error.message}`);
  }

  console.error(
    "Format Issues:",
    formatIssues.length ? formatIssues : "Unknown format issue"
  );
  console.error("==================\n");
};

// Update parseResponse to include format error logging
const smartSanitize = (response) => {
  if (!response || typeof response !== 'string') {
    return createFallbackResponse();
  }

  try {
    // First check for explicitly formatted responses with tags
    const mcMatch = response.match(/<mc>([\s\S]*?)<\/mc>/);
    const rankMatch = response.match(/<rank>([\s\S]*?)<\/rank>/);

    // Handle multiple choice format
    if (mcMatch) {
      try {
        const mcContent = JSON.parse(mcMatch[1]);
        const conversationalText = response.split('<mc>')[0].trim();
        
        // Validate the structure
        if (!mcContent.question || !Array.isArray(mcContent.options) || mcContent.options.length < 2) {
          throw new Error('Invalid multiple choice structure');
        }

        return {
          text: conversationalText,
          type: "multiple_choice",
          question: mcContent.question,
          options: mcContent.options.map(opt => ({
            id: opt.id.toLowerCase(),
            text: opt.text.trim()
          }))
        };
      } catch (error) {
        console.error('MC parsing error:', error);
      }
    }

    // Handle ranking format
    if (rankMatch) {
      try {
        const rankContent = JSON.parse(rankMatch[1]);
        const conversationalText = response.split('<rank>')[0].trim();
        
        // Validate the structure
        if (!rankContent.question || !Array.isArray(rankContent.items) || rankContent.items.length !== 4) {
          throw new Error('Invalid ranking structure');
        }

        return {
          text: conversationalText,
          type: "ranking",
          question: rankContent.question,
          items: rankContent.items.map(item => ({
            id: item.id,
            text: item.text.trim()
          })),
          totalRanks: 4
        };
      } catch (error) {
        console.error('Ranking parsing error:', error);
      }
    }

    const extractQuestion = (text) => {
      const questions = text.match(/[^.!?]+\?/g);
      if (questions) {
        return questions[questions.length - 1].trim();
      }
      return text.split('\n')[0].trim();
    };

    const extractOptions = (text) => {
      const optionsPatterns = [
        {
          pattern: /([A-D])\)\s*([^A-D\n]+)(?=\s*(?:[A-D]\)|$))/g,
          transform: (matches) => matches.map(m => ({
            id: m[1].toLowerCase(),
            text: m[2].trim()
          }))
        },
        {
          pattern: /(\d+)\.\s*([^\d\n]+)(?=\s*(?:\d+\.|$))/g,
          transform: (matches) => matches.map((m, i) => ({
            id: String.fromCharCode(97 + i),
            text: m[2].trim()
          }))
        },
        {
          pattern: /[•-]\s*([^\n•-]+)(?=\s*(?:[•-]|$))/g,
          transform: (matches) => matches.map((m, i) => ({
            id: String.fromCharCode(97 + i),
            text: m[1].trim()
          }))
        }
      ];

      for (const {pattern, transform} of optionsPatterns) {
        const matches = Array.from(text.matchAll(pattern));
        if (matches.length >= 2) {
          return transform(matches);
        }
      }
      return null;
    };

    const isMultipleChoice = (text) => {
      const choiceIndicators = [
        /(?:select|choose|pick)\s+(?:one|an option)/i,
        /which\s+(?:of the following|option)/i,
        /would you prefer/i,
        /which\s+(?:best describes|approach|method)/i,
        /how would you/i,
        /what (?:would|do) you/i,
        /\b(?:A|B|C|D)\)[\s\w]/i,
        /\b(?:option|choice)\s*(?:[A-D]|\d+):/i,
        /(?:\d+\.|\([A-D]\)|\b[A-D]\))\s+\w+/i
      ];

      return (
        text.includes('?') && 
        (choiceIndicators.some(pattern => pattern.test(text)) ||
         /(?:[A-D]\)|\d+\.|•|-)\s+\w+/.test(text))
      );
    };

    const isRanking = (text) => {
      const rankingIndicators = [
        /rank.*(?:following|these|options)/i,
        /order.*(?:preference|importance)/i,
        /prioritize.*(?:following|these|options)/i,
        /arrange.*(?:from most to least|in order)/i
      ];

      return (
        rankingIndicators.some(pattern => pattern.test(text)) &&
        extractOptions(text) !== null
      );
    };

    try {
      if (isMultipleChoice(response)) {
        const options = extractOptions(response);
        const question = extractQuestion(response);
        
        if (options && question) {
          return {
            text: response.split(question)[0].trim(),
            type: "multiple_choice",
            question: question,
            options: options
          };
        }
      }

      if (isRanking(response)) {
        const items = extractOptions(response);
        const question = extractQuestion(response);
        
        if (items && question) {
          return {
            text: response.split(question)[0].trim(),
            type: "ranking",
            question: question,
            items: items,
            totalRanks: items.length
          };
        }
      }

      return {
        text: response,
        type: "text"
      };

    } catch (error) {
      console.error('Inner sanitization error:', error);
      return createFallbackResponse();
    }
  } catch (error) {
    console.error('Outer sanitization error:', error);
    return createFallbackResponse();
  }
};

const createFormattedPrompt = (originalResponse) => {
  // Extract any question-like content
  const questionMatch = originalResponse.match(/[^.!?]+\?/g);
  const question = questionMatch ? questionMatch[questionMatch.length - 1].trim() : originalResponse;

  // Check if it seems like it should be multiple choice
  if (/\b(select|choose|pick|which|prefer)\b/i.test(question)) {
    return `Please rephrase the following as a clear multiple choice question with 3-4 distinct options:
    "${question}"
    
    Format the response as:
    [Conversational lead-in]
    
    [Clear question]
    A) [First option]
    B) [Second option]
    C) [Third option]
    D) [Optional fourth option]`;
  }

  // Check if it seems like it should be ranking
  if (/\b(rank|order|prioritize|arrange)\b/i.test(question)) {
    return `Please rephrase the following as a ranking question with 4 distinct items:
    "${question}"
    
    Format the response as:
    [Conversational lead-in]
    
    Please rank these options in order of preference:
    • [First item]
    • [Second item]
    • [Third item]
    • [Fourth item]`;
  }

  // If we can't determine the type, ask for a simple conversational question
  return `Please rephrase the following as a simple, open-ended question:
  "${question}"
  
  Format the response as a conversational question that encourages detailed sharing.`;
};

const hybridSanitize = async (response, threadId) => {
  console.log("\n=== Starting Response Sanitization ===");
  console.log("Original response:", response);

  // First check for explicit MC/rank tags
  if (response.includes('<mc>') || response.includes('<rank>')) {
    try {
      const mcMatch = response.match(/<mc>([\s\S]*?)<\/mc>/);
      if (mcMatch) {
        try {
          const mcContent = JSON.parse(mcMatch[1]);
          const conversationalText = response.split('<mc>')[0].trim();
          return {
            text: conversationalText,
            type: "multiple_choice",
            question: mcContent.question,
            options: mcContent.options
          };
        } catch (jsonError) {
          console.warn("Failed to parse MC JSON:", jsonError);
        }
      }

      const rankMatch = response.match(/<rank>([\s\S]*?)<\/rank>/);
      if (rankMatch) {
        try {
          const rankContent = JSON.parse(rankMatch[1]);
          const conversationalText = response.split('<rank>')[0].trim();
          return {
            text: conversationalText,
            type: "ranking",
            question: rankContent.question,
            items: rankContent.items,
            totalRanks: rankContent.totalRanks
          };
        } catch (jsonError) {
          console.warn("Failed to parse rank JSON:", jsonError);
        }
      }
    } catch (error) {
      console.warn("Failed to parse explicit format:", error);
    }
  }

  // Then check for implicit multiple choice format
  if (isMultipleChoice(response)) {
    const options = extractOptions(response);
    const question = extractQuestion(response);
    
    if (options && question) {
      const conversationalText = response.split(question)[0].trim();
      const sanitized = {
        text: conversationalText,
        type: "multiple_choice",
        question: question,
        options: options
      };

      // Validate the response before returning
      if (validateMultipleChoiceResponse(sanitized)) {
        console.log("Successfully sanitized multiple choice response:", sanitized);
        return sanitized;
      }
    }
  }

  // If no special formatting is detected, return as text
  console.log("No special formatting detected, returning as text");

  // If we get here, try to improve the format through the API
  const potentiallyInteractive = (
    response.includes('?') && 
    /\b(?:select|choose|pick|rank|order|prioritize|how|what|which)\b/i.test(response)
  );

  if (potentiallyInteractive) {
    try {
      console.log("Attempting format improvement...");
      const formattedPrompt = createFormattedPrompt(response);
      
      const retryResponse = await openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: formattedPrompt
      });

      const run = await openai.beta.threads.runs.create(threadId, {
        assistant_id: assistantId
      });

      let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      while (runStatus.status !== "completed") {
        await new Promise(resolve => setTimeout(resolve, 1000));
        runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      }

      const messages = await openai.beta.threads.messages.list(threadId);
      const newResponse = messages.data[0].content[0].text.value;
      
      // Try sanitizing the new response
      if (newResponse.includes('<mc>')) {
        const mcMatch = newResponse.match(/<mc>([\s\S]*?)<\/mc>/);
        if (mcMatch) {
          const mcContent = JSON.parse(mcMatch[1]);
          const conversationalText = newResponse.split('<mc>')[0].trim();
          return {
            text: conversationalText,
            type: "multiple_choice",
            question: mcContent.question,
            options: mcContent.options
          };
        }
      }

      // If still no explicit format, try parsing as regular multiple choice
      if (isMultipleChoice(newResponse)) {
        const options = extractOptions(newResponse);
        const question = extractQuestion(newResponse);
        
        if (options && question) {
          const conversationalText = newResponse.split(question)[0].trim();
          return {
            text: conversationalText,
            type: "multiple_choice",
            question: question,
            options: options
          };
        }
      }
    } catch (error) {
      console.warn("Format improvement failed:", error);
    }
  }

  // Fallback to text response
  console.log("Falling back to text response");
  return {
    text: response,
    type: "text"
  };
};

// Add a function to detect if response needs formatting
const needsFormatting = (text) => {
  // Check if this is a question that should be multiple choice
  const questionPatterns = [
    /what (?:would|do) you|which|choose|select|prefer/i,
    /how would you like to|what interests you/i,
    /tell me (about|more)/i,
  ];

  // Check if this is a conversational response that doesn't need formatting
  const conversationalPatterns = [
    /^(hi|hello|thanks|thank you|great|awesome)/i,
    /^it'?s (great|nice|wonderful|amazing)/i,
    /^(i see|interesting|got it)/i,
  ];

  // If it matches conversational patterns and doesn't contain a question, skip formatting
  if (conversationalPatterns.some((pattern) => pattern.test(text.trim()))) {
    const hasQuestion = text.includes("?");
    if (!hasQuestion) {
      console.log("Detected conversational response, skipping formatting");
      return false;
    }
  }

  // Check if the response contains a question that should be formatted
  return questionPatterns.some((pattern) => pattern.test(text));
};


const containsUnformattedList = (text) => {
  // Check for numbered lists, bullet points, or lettered lists
  return /(?:\d+\.|[A-Z]\)|•|-)\s+.+/gm.test(text);
};

const validateRankingResponse = (response) => {
  if (
    !response.items ||
    !Array.isArray(response.items) ||
    response.items.length !== 4
  ) {
    throw new Error("Invalid ranking response structure");
  }

  if (!response.totalRanks || response.totalRanks !== 4) {
    response.totalRanks = 4;
  }

  // Ensure all items have required properties
  response.items.forEach((item, index) => {
    if (!item.id || !item.text) {
      item.id = `item${index + 1}`;
      item.text = item.text || `Option ${index + 1}`;
    }
  });
};

const validateMultipleChoiceResponse = (response) => {
  if (!response.options || !Array.isArray(response.options)) {
    return false;
  }

  // Ensure we have at least 2 options and no more than 4
  if (response.options.length < 2 || response.options.length > 4) {
    return false;
  }

  // Validate each option has required properties and non-empty text
  return response.options.every(opt => 
    opt.id && 
    opt.text && 
    typeof opt.text === 'string' && 
    opt.text.trim().length > 0
  );
};

const convertToRankingFormat = (text) => {
  // Extract items from numbered, lettered, or bulleted list
  const items = text.match(/(?:\d+\.|[A-Z]\)|•|-)\s+(.+)/gm) || [];
  // Split on any list marker
  const conversationalText = text.split(/\d+\.|[A-Z]\)|•|-/)[0].trim();

  // If we don't have enough items, try to extract from the text
  if (items.length < 4) {
    console.warn("Not enough list items found, attempting to parse text");
    return createFallbackResponse();
  }

  // Create properly formatted ranking response
  return {
    text: conversationalText,
    type: "ranking",
    question: "Please rank these options in order of preference:",
    items: items.slice(0, 4).map((item, index) => ({
      id: `item${index + 1}`,
      text: item.replace(/^\d+\.\s+|[A-Z]\)\s+|•\s+|-\s+/, "").trim(),
    })),
    totalRanks: 4,
  };
};

const createFallbackResponse = () => {
  return {
    text: "I ran into an issue processing your response. How would you like me to proceed?",
    type: "multiple_choice",
    question: "How would you like to proceed?",
    options: [
      {
        id: "retry",
        text: "Please try asking your question again",
      },
      {
        id: "rephrase",
        text: "Let me rephrase my response differently",
      },
      {
        id: "continue",
        text: "Continue with our previous discussion",
      },
    ],
  };
};

// Add new function to convert unformatted multiple choice to proper format
const convertToMultipleChoiceFormat = (text) => {
  const options = text.match(/[A-Z]\)\s+(.+?)(?=\n[A-Z]\)|\n*$)/gs) || [];
  const conversationalText = text.split(/[A-Z]\)/)[0].trim();

  if (options.length < 2) {
    console.warn("Not enough multiple choice options found");
    return createFallbackResponse();
  }

  return {
    text: conversationalText,
    type: "multiple_choice",
    question: "Please select your preferred option:",
    options: options.map((option, index) => ({
      id: String.fromCharCode(97 + index), // converts 0 -> 'a', 1 -> 'b', etc.
      text: option.replace(/^[A-Z]\)\s+/, "").trim(),
    })),
  };
};

// Add helper function to check and cancel active runs
const checkAndCancelActiveRuns = async (threadId) => {
  try {
    const runs = await openai.beta.threads.runs.list(threadId);
    const activeRuns = runs.data.filter((run) =>
      ["in_progress", "queued"].includes(run.status)
    );

    for (const run of activeRuns) {
      try {
        await openai.beta.threads.runs.cancel(threadId, run.id);
        console.log(`Cancelled active run ${run.id} for thread ${threadId}`);
      } catch (error) {
        console.error(`Error cancelling run ${run.id}:`, error);
      }
    }
  } catch (error) {
    console.error(`Error checking active runs for thread ${threadId}:`, error);
  }
};

// Add logging helpers
const logResponse = (context, response, formattedResponse) => {
  console.log("\n=== Response Details ===");
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log("Context:", context);
  console.log("\nRaw API Response:");
  console.log(JSON.stringify(response, null, 2));
  console.log("\nFormatted Response:");
  console.log(JSON.stringify(formattedResponse, null, 2));
  console.log("==================\n");
};

const logError = (context, error, details = {}) => {
  console.error("=== Error Details ===");
  console.error(`Context: ${context}`);
  console.error(`Timestamp: ${new Date().toISOString()}`);
  console.error(`Error Message: ${error.message}`);
  console.error(`Error Name: ${error.name}`);
  console.error("Additional Details:", details);
  console.error("Stack Trace:", error.stack);
  console.error("==================\n");
};

// Update message endpoint with better logging
const parseSummaryResponse = (text) => {
  try {
    const sections = {
      summaryOfResponses: {
        interestExploration: '',
        technicalAptitude: '',
        workStyle: '',
        careerValues: ''
      },
      careerMatches: [],
      salaryInformation: [],
      educationPath: {
        courses: [],
        certifications: []
      },
      portfolioRecommendations: [],
      networkingSuggestions: [],
      careerRoadmap: {
        highSchool: '',
        college: '',
        earlyCareer: '',
        longTerm: ''
      }
    };

    // Parse Summary of Responses section
    const summaryMatch = text.match(/\*\*Summary of Responses:\*\*([\s\S]*?)(?=\*\*Career Matches)/);
    if (summaryMatch) {
      const summaryLines = summaryMatch[1].split('\n').filter(line => line.trim());
      summaryLines.forEach(line => {
        if (line.includes('Interest Exploration:')) sections.summaryOfResponses.interestExploration = line.split(':')[1].trim();
        if (line.includes('Technical Aptitude:')) sections.summaryOfResponses.technicalAptitude = line.split(':')[1].trim();
        if (line.includes('Work Style:')) sections.summaryOfResponses.workStyle = line.split(':')[1].trim();
        if (line.includes('Career Values:')) sections.summaryOfResponses.careerValues = line.split(':')[1].trim();
      });
    }

    // Parse Career Matches section
    const matchesMatch = text.match(/\*\*Career Matches:\*\*([\s\S]*?)(?=\*\*Salary)/);
    if (matchesMatch) {
      sections.careerMatches = matchesMatch[1].split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => {
          const [role, explanation] = line.split(':');
          const matchPercentage = role.match(/\((\d+)%\s+match\)/);
          return {
            role: role.split('(')[0].replace('-', '').trim(),
            match: matchPercentage ? parseInt(matchPercentage[1]) : null,
            explanation: explanation ? explanation.trim() : ''
          };
        });
    }

    // Parse Salary Information
    const salaryMatch = text.match(/\*\*Salary Information:\*\*([\s\S]*?)(?=\*\*Education)/);
    if (salaryMatch) {
      sections.salaryInformation = salaryMatch[1].split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => {
          const [role, salary] = line.replace('-', '').split(':');
          return {
            role: role.trim(),
            salary: salary.trim()
          };
        });
    }

    // Parse Education Path
    const educationMatch = text.match(/\*\*Education Path:\*\*([\s\S]*?)(?=\*\*Portfolio)/);
    if (educationMatch) {
      const eduText = educationMatch[1];
      
      // Initialize arrays
      sections.educationPath = {
        courses: [],
        certifications: []
      };

      // Split the text into courses and certifications sections
      const parts = eduText.split(/Certifications:/);
      
      // Parse Courses
      if (parts[0].includes('Courses:')) {
        const coursesText = parts[0].split('Courses:')[1];
        sections.educationPath.courses = coursesText
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('-'))
          .map(line => line.substring(1).trim())
          .filter(Boolean);
      }
      
      // Parse Certifications
      if (parts[1]) {
        sections.educationPath.certifications = parts[1]
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('-'))
          .map(line => line.substring(1).trim())
          .filter(Boolean);
      }

      // Additional validation and cleanup
      if (!Array.isArray(sections.educationPath.courses)) {
        sections.educationPath.courses = [];
      }
      if (!Array.isArray(sections.educationPath.certifications)) {
        sections.educationPath.certifications = [];
      }

      // Remove any empty or invalid entries
      sections.educationPath.courses = sections.educationPath.courses.filter(course => 
        course && typeof course === 'string' && course.length > 0
      );
      sections.educationPath.certifications = sections.educationPath.certifications.filter(cert => 
        cert && typeof cert === 'string' && cert.length > 0
      );
    }

    // Parse Portfolio Recommendations
    const portfolioMatch = text.match(/\*\*Portfolio Recommendations:\*\*([\s\S]*?)(?=\*\*Networking)/);
    if (portfolioMatch) {
      sections.portfolioRecommendations = portfolioMatch[1].split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace('-', '').trim());
    }

    // Parse Networking Suggestions
    const networkingMatch = text.match(/\*\*Networking Suggestions:\*\*([\s\S]*?)(?=\*\*Career)/);
    if (networkingMatch) {
      sections.networkingSuggestions = networkingMatch[1].split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace('-', '').trim());
    }

    // Parse Career Roadmap
    const roadmapMatch = text.match(/\*\*Career Roadmap:\*\*([\s\S]*?)(?=$)/);
    if (roadmapMatch) {
      const roadmapText = roadmapMatch[1];
      sections.careerRoadmap.highSchool = roadmapText.match(/High School:(.*?)(?=College:|$)/s)?.[1].trim();
      sections.careerRoadmap.college = roadmapText.match(/College:(.*?)(?=Early Career:|$)/s)?.[1].trim();
      sections.careerRoadmap.earlyCareer = roadmapText.match(/Early Career:(.*?)(?=Long-term|$)/s)?.[1].trim();
      sections.careerRoadmap.longTerm = roadmapText.match(/Long-term Development:(.*?)(?=$)/s)?.[1].trim();
    }

    return sections;
  } catch (error) {
    console.error('Error parsing summary:', error);
    return null;
  }
};

app.post("/api/message", async (req, res) => {
  const { message, conversation } = req.body;
  const sessionId = req.headers['session-id'] || uuidv4();
  
  console.log('\n=== Processing Message Through New Engine ===');
  console.log('Session ID:', sessionId);
  console.log('Message:', message);
  
  try {
    // Check if this is a results request
    if (message.includes('[GENERATE_RESULTS]')) {
      return await handleResultsRequest(req, res, sessionId, message, conversation);
    }

    // Use the new AI service pipeline
    const aiResponse = await aiRequest(sessionId, message, {
      conversation: Array.isArray(conversation) ? conversation : [],
      systemInstructions: 'Focus on career guidance and assessment progression.'
    });

    // Get current session state for response metadata
    const session = await getSession(sessionId);
    
    // Update persona and anchors based on response
    await updatePersonaFromResponse(sessionId, message, aiResponse.content);
    
    // Record assessment response if applicable
    await recordAssessmentResponse(sessionId, aiResponse.content);
    
    // Add state information to response
    const responseWithState = {
      ...aiResponse,
      _state: {
        questionsAsked: session.totalQuestions || 0,
        currentSection: session.currentSection || 'introduction',
        sectionsCompleted: session.sections || {},
        questionTypes: session.questionTypes || {},
        persona: session.persona,
        anchors: session.anchors || []
      }
    };
    
    console.log('\n=== Response from New Engine ===');
    console.log('Content length:', aiResponse.content.length);
    console.log('Tokens used:', aiResponse.tokensUsed);
    console.log('Session updated:', aiResponse.sessionUpdated);
    
    res.json(responseWithState);

  } catch (error) {
    console.error('Error in new message pipeline:', error);
    res.status(500).json({
      content: "I apologize, but I'm having trouble processing your request. Could you please try again?",
      type: "text",
      error: true
    });
  }
});

// Helper function for results requests
async function handleResultsRequest(req, res, sessionId, message, conversation) {
  console.log('=== Handling Results Request ===');
  
  try {
    // Generate career summary using the resume service
    const careerSummary = await generateCareerSummary(sessionId);
    
    // Get persona recommendations
    const session = await getSession(sessionId);
    const personaRecommendations = session.persona ? getPersonaRecommendations(session.persona) : [];
    
    // Use AI service to generate comprehensive results
    const resultsResponse = await aiRequest(sessionId, message, {
      conversation: Array.isArray(conversation) ? conversation : [],
      systemInstructions: `Generate comprehensive career assessment results. Include:
        1. Summary of user responses across all sections
        2. Career matches with percentages
        3. Salary information
        4. Education path recommendations
        5. Portfolio suggestions
        6. Networking advice
        7. Career roadmap
        
        Format as structured JSON with all required sections.`,
      expectedSchema: 'json_object'
    });

    // Parse and validate the results
    let parsedResults;
    try {
      parsedResults = JSON.parse(resultsResponse.content);
    } catch (parseError) {
      console.error('Error parsing results JSON:', parseError);
      // Fallback to structured results
      parsedResults = {
        summaryOfResponses: careerSummary,
        careerMatches: personaRecommendations,
        salaryInformation: [],
        educationPath: { courses: [], certifications: [] },
        portfolioRecommendations: [],
        networkingSuggestions: [],
        careerRoadmap: {
          highSchool: "Complete foundational courses",
          college: "Pursue relevant degree",
          earlyCareer: "Gain practical experience",
          longTerm: "Advance to leadership roles"
        }
      };
    }
    
    console.log('Results generated successfully');
    res.json(parsedResults);
    
  } catch (error) {
    console.error('Error generating results:', error);
    res.status(500).json({
      error: "Failed to generate assessment results",
      message: error.message
    });
  }
}

// Helper function to update persona from AI response
async function updatePersonaFromResponse(sessionId, userMessage, aiResponse) {
  try {
    // Extract potential anchors from user message
    const anchors = extractAnchorsFromMessage(userMessage);
    
    if (anchors.length > 0) {
      await updatePersonaAnchors(sessionId, anchors);
      console.log(`Updated anchors for session ${sessionId}:`, anchors);
    }
    
    // Trigger persona analysis if we have enough conversation
    const session = await getSession(sessionId);
    if (session.history && session.history.length >= 6 && !session.persona) {
      const persona = await analyzePersona(sessionId);
      console.log(`Generated persona for session ${sessionId}:`, persona?.primary?.name);
    }
    
  } catch (error) {
    console.warn('Error updating persona:', error.message);
    // Don't throw - persona updates shouldn't break the main flow
  }
}

// Helper function to extract anchors from user messages
function extractAnchorsFromMessage(message) {
  const anchors = [];
  const lowerMessage = message.toLowerCase();
  
  // Interest indicators
  const interests = ['love', 'enjoy', 'passionate', 'interested', 'fascinated', 'excited'];
  interests.forEach(interest => {
    if (lowerMessage.includes(interest)) {
      // Extract context around the interest word
      const words = message.split(' ');
      const interestIndex = words.findIndex(word => word.toLowerCase().includes(interest));
      if (interestIndex !== -1 && interestIndex < words.length - 1) {
        const context = words.slice(Math.max(0, interestIndex - 1), interestIndex + 3).join(' ');
        anchors.push(context.replace(/[^\w\s]/g, '').trim());
      }
    }
  });
  
  // Skill indicators
  const skills = ['good at', 'skilled', 'experienced', 'proficient', 'expert', 'talented'];
  skills.forEach(skill => {
    if (lowerMessage.includes(skill)) {
      const words = message.split(' ');
      const skillIndex = words.findIndex(word => word.toLowerCase().includes(skill.split(' ')[0]));
      if (skillIndex !== -1) {
        const context = words.slice(skillIndex, skillIndex + 4).join(' ');
        anchors.push(context.replace(/[^\w\s]/g, '').trim());
      }
    }
  });
  
  return anchors.filter(anchor => anchor.length > 3 && anchor.length < 50);
}

// Helper function to record assessment responses
async function recordAssessmentResponse(sessionId, aiResponse) {
  try {
    // Parse the AI response to determine if it contains a structured question
    const parsedResponse = parseAIResponse(aiResponse);
    
    if (parsedResponse.type && ['multiple_choice', 'ranking', 'text'].includes(parsedResponse.type)) {
      // This is a question, so we don't record it as a response
      // The response will be recorded when the user answers
      return;
    }
    
    // If this is a user response to a previous question, it would have been
    // handled by the assessment state machine in the aiRequest pipeline
    
  } catch (error) {
    console.warn('Error recording assessment response:', error.message);
    // Don't throw - assessment recording shouldn't break the main flow
  }
}

// Helper function to parse AI response format
function parseAIResponse(response) {
  try {
    // Try to parse as JSON first
    return JSON.parse(response);
  } catch {
    // If not JSON, analyze the text structure
    if (response.includes('?') && (response.includes('A)') || response.includes('1.'))) {
      return { type: 'multiple_choice', content: response };
    }
    if (response.includes('rank') && response.includes('order')) {
      return { type: 'ranking', content: response };
    }
    return { type: 'text', content: response };
  }
}


// Update the /api/update-instructions endpoint
app.post("/api/update-instructions", async (req, res) => {
  try {
    const { instructions } = req.body;
    console.log("Updating instructions to:", instructions);

    // Update the instructions file
    const fs = require("fs").promises; // Use promises version
    const path = require("path");
    const filePath = path.join(__dirname, "instructions.js");

    // Format the content with proper escaping for backticks
    const escapedInstructions = instructions.replace(/`/g, "\\`");
    const content = `const instructions = \`${escapedInstructions}\`;\n\nmodule.exports = { instructions };`;

    // Write file synchronously to ensure it's complete before continuing
    await fs.writeFile(filePath, content, "utf8");
    console.log("Instructions file updated successfully");

    // Clear the require cache for the instructions file
    delete require.cache[require.resolve("./instructions")];

    // Reset the assistant with new instructions
    if (assistantId) {
      console.log("Deleting old assistant:", assistantId);
      await openai.beta.assistants.del(assistantId);
      assistantId = null; // Clear the old ID
    }

    // Clear all active sessions
    cleanupSessions();

    // Reinitialize the assistant
    await initializeAssistant();
    console.log("New assistant created with ID:", assistantId);

    // Verify the new instructions
    const newInstructions = require("./instructions").instructions;
    console.log("Verified new instructions:", newInstructions);

    res.json({
      message: "Instructions updated successfully",
      newInstructions, // Send back the new instructions for verification
    });
  } catch (error) {
    console.error("Error updating instructions:", error);
    res.status(500).json({ error: "Failed to update instructions" });
  }
});

// Also update the reset-assistant endpoint to clear sessions
app.post("/api/reset-assistant", async (req, res) => {
  try {
    if (assistantId) {
      await openai.beta.assistants.del(assistantId);
    }

    // Clear all active sessions
    cleanupSessions();

    await initializeAssistant();
    res.json({ message: "Assistant reset successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to reset assistant" });
  }
});

// Update the get instructions endpoint
app.get("/api/instructions", (req, res) => {
  try {
    // Clear the require cache to ensure we get the latest version
    delete require.cache[require.resolve("./instructions")];
    const { instructions } = require("./instructions");
    console.log("Fetching current instructions:", instructions);
    res.json({ instructions });
  } catch (error) {
    console.error("Error fetching instructions:", error);
    res.status(500).json({ error: "Failed to fetch instructions" });
  }
});

app.post("/api/auth", (req, res) => {
  const { username, password } = req.body;

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (user) {
    res.json({ authenticated: true });
  } else {
    res.status(401).json({
      authenticated: false,
      message: "Invalid username or password",
    });
  }
});

app.get("/api/initial-message", (req, res) => {
  try {
    const appPath = path.join(__dirname, "../client/src/App.js");
    fs.readFile(appPath, "utf8")
      .then((content) => {
        const match = content.match(/content:\s*"([^"]+)"/);
        if (match) {
          res.json({ message: match[1] });
        } else {
          throw new Error("Initial message not found in App.js");
        }
      })
      .catch((error) => {
        console.error("Error reading initial message:", error);
        res.status(500).json({ error: "Failed to read initial message" });
      });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Failed to get initial message" });
  }
});

app.post("/api/initial-message", async (req, res) => {
  try {
    const { message } = req.body;
    const appPath = path.join(__dirname, "../client/src/App.js");

    let content = await fs.readFile(appPath, "utf8");
    content = content.replace(/(content:\s*)"([^"]+)"/, `$1"${message}"`);

    await fs.writeFile(appPath, content, "utf8");

    res.json({
      message: "Initial message updated successfully",
      newMessage: message,
    });
  } catch (error) {
    console.error("Error updating initial message:", error);
    res.status(500).json({ error: "Failed to update initial message" });
  }
});

app.post("/api/reset-session", async (req, res) => {
  const sessionId = req.headers['session-id'];
  if (sessionId) {
    await deleteSession(sessionId);
  }
  res.json({ message: "Session reset successfully" });
});

// Add Redis health check endpoint
app.get('/api/health/redis', async (req, res) => {
  try {
    const isHealthy = await checkRedisHealth();
    res.json({ 
      redis: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      redis: 'error', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// === SERVICE ENDPOINTS ===

// Persona endpoints
app.get('/api/persona/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const persona = await analyzePersona(sessionId);
    res.json(persona);
  } catch (error) {
    console.error('Error getting persona:', error);
    res.status(500).json({ error: 'Failed to get persona' });
  }
});

// Assessment endpoints
app.get('/api/assessment/:sessionId/progress', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await getSession(sessionId);
    const progress = {
      questionsCompleted: session.totalQuestions,
      totalQuestions: 10,
      percentComplete: Math.round((session.totalQuestions / 10) * 100),
      currentSection: session.currentSection,
      sectionsCompleted: session.sections,
      questionTypes: session.questionTypes
    };
    res.json(progress);
  } catch (error) {
    console.error('Error getting assessment progress:', error);
    res.status(500).json({ error: 'Failed to get assessment progress' });
  }
});

app.get('/api/assessment/:sessionId/state', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const nextQuestion = await getNextQuestion(sessionId);
    res.json(nextQuestion);
  } catch (error) {
    console.error('Error getting assessment state:', error);
    res.status(500).json({ error: 'Failed to get assessment state' });
  }
});

app.post('/api/assessment/:sessionId/response', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { response } = req.body;
    const result = await recordResponse(sessionId, response);
    res.json(result);
  } catch (error) {
    console.error('Error recording assessment response:', error);
    res.status(500).json({ error: 'Failed to record response' });
  }
});

app.post('/api/assessment/:sessionId/reset', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await resetAssessment(sessionId);
    res.json({ message: 'Assessment reset successfully', session: result });
  } catch (error) {
    console.error('Error resetting assessment:', error);
    res.status(500).json({ error: 'Failed to reset assessment' });
  }
});

// Resume endpoints (placeholder)
app.post('/api/resume/:sessionId/generate', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { template } = req.body;
    const resume = await generateResume(sessionId, { template });
    res.json(resume);
  } catch (error) {
    console.error('Error generating resume:', error);
    res.status(500).json({ error: 'Failed to generate resume' });
  }
});

app.get('/api/resume/templates', async (req, res) => {
  try {
    const templates = await getResumeTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error getting resume templates:', error);
    res.status(500).json({ error: 'Failed to get resume templates' });
  }
});

// Career summary endpoint
app.get('/api/career-summary/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const summary = await generateCareerSummary(sessionId);
    res.json(summary);
  } catch (error) {
    console.error('Error generating career summary:', error);
    res.status(500).json({ error: 'Failed to generate career summary' });
  }
});

// Persona card endpoints
app.get('/api/persona-card/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const enrichedPersona = await getEnrichedPersona(sessionId);
    
    if (!enrichedPersona) {
      return res.status(404).json({ 
        error: 'No enriched persona found',
        message: 'Complete the assessment and persona analysis first'
      });
    }
    
    res.json(enrichedPersona);
  } catch (error) {
    console.error('Error getting persona card:', error);
    res.status(500).json({ error: 'Failed to get persona card' });
  }
});

app.post('/api/persona-card/:sessionId/enrich', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { userGoals, forceRefresh } = req.body;
    
    const enrichedPersona = await enrichPersona(sessionId, {
      userGoals,
      forceRefresh
    });
    
    res.json({
      message: 'Persona enriched successfully',
      personaCard: enrichedPersona
    });
  } catch (error) {
    console.error('Error enriching persona:', error);
    res.status(500).json({ 
      error: 'Failed to enrich persona',
      message: error.message
    });
  }
});

// Service health check endpoint
app.get('/api/services/health', async (req, res) => {
  try {
    const health = {
      timestamp: new Date().toISOString(),
      services: {
        persona: { status: 'active', archetypes: 6 },
        assessment: { status: 'active', totalQuestions: 10 },
        ai: { status: 'active', apiConfigured: !!process.env.OPENROUTER_API_KEY },
        resume: { status: 'placeholder', templates: 3 },
        redis: await checkRedisHealth() ? 'healthy' : 'unhealthy'
      }
    };
    res.json(health);
  } catch (error) {
    console.error('Error checking service health:', error);
    res.status(500).json({ error: 'Failed to check service health' });
  }
});

// Admin endpoints for prompt management
app.get('/api/admin/prompts', async (req, res) => {
  try {
    const templates = await getAvailableTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error getting prompt templates:', error);
    res.status(500).json({ error: 'Failed to get prompt templates' });
  }
});

app.get('/api/admin/prompts/:templateName', async (req, res) => {
  try {
    const { templateName } = req.params;
    const template = await loadPromptTemplate(templateName);
    res.json(template);
  } catch (error) {
    console.error('Error getting prompt template:', error);
    res.status(404).json({ error: 'Template not found' });
  }
});

app.post('/api/admin/prompts/:templateName', async (req, res) => {
  try {
    const { templateName } = req.params;
    const { content } = req.body;
    await updateTemplate(templateName, content);
    res.json({ message: 'Template updated successfully' });
  } catch (error) {
    console.error('Error updating prompt template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

app.post('/api/admin/prompts/cache/clear', (req, res) => {
  try {
    clearTemplateCache();
    res.json({ message: 'Template cache cleared successfully' });
  } catch (error) {
    console.error('Error clearing template cache:', error);
    res.status(500).json({ error: 'Failed to clear template cache' });
  }
});

// Enhanced admin endpoints for prompt versioning

// Get version history for a template
app.get('/api/admin/prompts/:templateName/versions', async (req, res) => {
  try {
    const { templateName } = req.params;
    const history = await getTemplateVersionHistory(templateName);
    res.json({
      templateName,
      versions: history,
      currentVersion: await getCurrentTemplateVersion(templateName)
    });
  } catch (error) {
    console.error('Error getting template version history:', error);
    res.status(500).json({ error: 'Failed to get version history' });
  }
});

// Update template with version tracking
app.put('/api/admin/prompts/:templateName', async (req, res) => {
  try {
    const { templateName } = req.params;
    const { content, metadata } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Template content is required' });
    }
    
    const result = await saveTemplateVersion(templateName, content, metadata || {});
    res.json({
      message: 'Template updated successfully',
      ...result
    });
  } catch (error) {
    console.error('Error updating template with versioning:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Rollback template to previous version
app.post('/api/admin/prompts/:templateName/rollback', async (req, res) => {
  try {
    const { templateName } = req.params;
    const { targetVersion } = req.body;
    
    if (!targetVersion) {
      return res.status(400).json({ error: 'Target version is required' });
    }
    
    const result = await rollbackTemplate(templateName, targetVersion);
    res.json({
      message: `Template rolled back to version ${targetVersion}`,
      ...result
    });
  } catch (error) {
    console.error('Error rolling back template:', error);
    res.status(500).json({ error: 'Failed to rollback template' });
  }
});

// Get template diff between versions
app.get('/api/admin/prompts/:templateName/diff/:version1/:version2', async (req, res) => {
  try {
    const { templateName, version1, version2 } = req.params;
    
    // This is a placeholder - you could implement actual diff logic
    // For now, just return the two versions for comparison
    const history = await getTemplateVersionHistory(templateName);
    const v1Entry = history.find(h => h.version === version1);
    const v2Entry = history.find(h => h.version === version2);
    
    if (!v1Entry || !v2Entry) {
      return res.status(404).json({ error: 'One or both versions not found' });
    }
    
    res.json({
      templateName,
      version1: { version: version1, entry: v1Entry },
      version2: { version: version2, entry: v2Entry },
      message: 'Use client-side diff tool to compare versions'
    });
  } catch (error) {
    console.error('Error getting template diff:', error);
    res.status(500).json({ error: 'Failed to get template diff' });
  }
});

// Bulk template operations
app.post('/api/admin/prompts/bulk', async (req, res) => {
  try {
    const { operation, templates } = req.body;
    
    if (!operation || !Array.isArray(templates)) {
      return res.status(400).json({ error: 'Invalid bulk operation request' });
    }
    
    const results = [];
    
    for (const template of templates) {
      try {
        let result;
        switch (operation) {
          case 'backup':
            const currentTemplate = await loadPromptTemplate(template.name);
            result = await saveTemplateVersion(template.name, yaml.dump(currentTemplate), {
              action: 'bulk_backup',
              timestamp: new Date().toISOString()
            });
            break;
          case 'clear_cache':
            templateCache.delete(template.name);
            result = { success: true, templateName: template.name };
            break;
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
        results.push({ templateName: template.name, success: true, ...result });
      } catch (error) {
        results.push({ templateName: template.name, success: false, error: error.message });
      }
    }
    
    res.json({
      operation,
      results,
      summary: {
        total: templates.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
  } catch (error) {
    console.error('Error in bulk template operation:', error);
    res.status(500).json({ error: 'Failed to perform bulk operation' });
  }
});

// Template validation endpoint
app.post('/api/admin/prompts/:templateName/validate', async (req, res) => {
  try {
    const { templateName } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Template content is required' });
    }
    
    // Validate YAML syntax
    let parsedTemplate;
    try {
      parsedTemplate = yaml.load(content);
    } catch (yamlError) {
      return res.json({
        valid: false,
        errors: [`Invalid YAML syntax: ${yamlError.message}`],
        warnings: []
      });
    }
    
    // Validate template structure
    const errors = [];
    const warnings = [];
    
    if (!parsedTemplate.version) {
      errors.push('Template missing version field');
    }
    
    if (!parsedTemplate.name) {
      warnings.push('Template missing name field');
    }
    
    if (!parsedTemplate.template) {
      errors.push('Template missing template content field');
    }
    
    // Validate template variables
    if (parsedTemplate.template) {
      const variables = parsedTemplate.template.match(/\{\{(\w+)\}\}/g) || [];
      const uniqueVars = [...new Set(variables)];
      
      if (uniqueVars.length > 0) {
        warnings.push(`Template uses ${uniqueVars.length} variables: ${uniqueVars.join(', ')}`);
      }
    }
    
    res.json({
      valid: errors.length === 0,
      errors,
      warnings,
      templateName,
      parsedTemplate: errors.length === 0 ? parsedTemplate : null
    });
  } catch (error) {
    console.error('Error validating template:', error);
    res.status(500).json({ error: 'Failed to validate template' });
  }
});

// Summarization endpoints
app.get('/api/summarization/:sessionId/stats', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const stats = await getSummarizationStats(sessionId);
    res.json(stats);
  } catch (error) {
    console.error('Error getting summarization stats:', error);
    res.status(500).json({ error: 'Failed to get summarization stats' });
  }
});

app.post('/api/summarization/:sessionId/trigger', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await performContextSummarization(sessionId);
    res.json(result);
  } catch (error) {
    console.error('Error triggering summarization:', error);
    res.status(500).json({ error: 'Failed to trigger summarization' });
  }
});

app.post('/api/summarization/:sessionId/force', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await forceSummarization(sessionId);
    res.json(result);
  } catch (error) {
    console.error('Error forcing summarization:', error);
    res.status(500).json({ error: 'Failed to force summarization' });
  }
});

app.get('/api/summarization/health', (req, res) => {
  try {
    const health = getContextSummarizationHealth();
    res.json(health);
  } catch (error) {
    console.error('Error checking summarization health:', error);
    res.status(500).json({ error: 'Failed to check summarization health' });
  }
});

// Debug endpoints (admin-only)
app.get('/api/admin/debug/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await getSession(sessionId);
    
    // Get session statistics
    const stats = await getSessionStats(sessionId);
    
    // Get summarization stats
    const summarizationStats = await getSummarizationStats(sessionId);
    
    // Get assessment progress
    const nextQuestion = await getNextQuestion(sessionId);
    
    const debugInfo = {
      sessionId,
      timestamp: new Date().toISOString(),
      session: {
        id: session.id,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        currentSection: session.currentSection,
        totalQuestions: session.totalQuestions,
        sections: session.sections,
        questionTypes: session.questionTypes
      },
      persona: session.persona,
      anchors: session.anchors || [],
      history: {
        messageCount: session.history ? session.history.length : 0,
        recentMessages: session.history ? session.history.slice(-5) : []
      },
      summary: {
        hasSummary: !!session.summary,
        summaryLength: session.summary ? session.summary.length : 0,
        lastSummarizedAt: session.lastSummarizedAt
      },
      assessment: {
        currentState: nextQuestion.section,
        nextQuestionType: nextQuestion.type,
        isComplete: nextQuestion.isComplete,
        progress: nextQuestion.progress
      },
      sessionStats: stats,
      summarizationStats: summarizationStats
    };
    
    logSessionActivity(sessionId, 'debug_access', { 
      endpoint: '/api/admin/debug/session',
      dataSize: JSON.stringify(debugInfo).length 
    });
    
    res.json(debugInfo);
  } catch (error) {
    logError(req.params.sessionId, error, { endpoint: '/api/admin/debug/session' });
    res.status(500).json({ error: 'Failed to get debug information' });
  }
});

// Get recent logs for a session
app.get('/api/admin/debug/logs/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 50 } = req.query;
    
    // This is a placeholder - in a real implementation, you'd query your log storage
    // For now, we'll return a sample structure
    const logs = {
      sessionId,
      timestamp: new Date().toISOString(),
      message: 'Log querying not implemented - logs are written to files',
      logFiles: [
        '../logs/combined.log',
        '../logs/error.log'
      ],
      recentActivity: {
        aiRequests: 'Check combined.log for ai_request entries',
        templateUsage: 'Check combined.log for template_usage entries',
        errors: 'Check error.log for error entries'
      }
    };
    
    res.json(logs);
  } catch (error) {
    logError(req.params.sessionId, error, { endpoint: '/api/admin/debug/logs' });
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

// Get system health and logging status
app.get('/api/admin/debug/health', async (req, res) => {
  try {
    const health = {
      timestamp: new Date().toISOString(),
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        transports: ['console', 'file'],
        logDirectory: '../logs'
      },
      services: {
        redis: await checkRedisHealth(),
        openrouter: !!process.env.OPENROUTER_API_KEY,
        templates: (await getAvailableTemplates()).length,
        assessmentEngine: 'active'
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        port: process.env.PORT,
        summarizationEnabled: process.env.SUMMARIZATION_ENABLED !== 'false'
      }
    };
    
    logger.info('Health check accessed', { 
      type: 'health_check',
      services: Object.keys(health.services)
    });
    
    res.json(health);
  } catch (error) {
    logError(null, error, { endpoint: '/api/admin/debug/health' });
    res.status(500).json({ error: 'Failed to get health information' });
  }
});

// Get token usage statistics
app.get('/api/admin/debug/tokens', async (req, res) => {
  try {
    // This would typically query your log storage for token usage
    // For now, return a placeholder structure
    const tokenStats = {
      timestamp: new Date().toISOString(),
      message: 'Token statistics would be aggregated from logs',
      structure: {
        totalTokensUsed: 'Sum of tokensUsed from ai_response logs',
        averageTokensPerRequest: 'Average tokensUsed from ai_response logs',
        requestCount: 'Count of ai_request logs',
        costEstimate: 'Based on OpenRouter pricing'
      },
      note: 'Implement log aggregation to get real statistics'
    };
    
    res.json(tokenStats);
  } catch (error) {
    logError(null, error, { endpoint: '/api/admin/debug/tokens' });
    res.status(500).json({ error: 'Failed to get token statistics' });
  }
});

// Demo endpoint for Randy Keller
app.get('/api/demo/randy-keller', async (req, res) => {
  try {
    const demoSessionId = 'demo-randy-keller-' + Date.now();
    
    const demoData = {
      sessionId: demoSessionId,
      userName: 'Randy Keller',
      assessmentProgress: {
        questionsCompleted: 10,
        totalQuestions: 10,
        currentSection: 'summary',
        sections: {
          introduction: 1,
          interestExploration: 2,
          workStyle: 2,
          technicalAptitude: 2,
          careerValues: 3
        }
      },
      persona: {
        primary: {
          key: 'builder',
          name: 'The Builder',
          confidence: 0.87,
          traits: ['practical', 'hands-on', 'results-oriented', 'problem-solving', 'systematic', 'reliable'],
          careerFit: ['software-engineering', 'systems-architecture', 'technical-leadership', 'product-development']
        },
        summary: [
          'Primary archetype: The Builder',
          'Key traits: practical, hands-on, results-oriented, problem-solving, systematic, reliable',
          'Career alignment: software-engineering, systems-architecture, technical-leadership, product-development',
          'Confidence level: 87%'
        ]
      },
      personaCard: {
        id: 'demo-persona-randy',
        sessionId: 'demo-randy-keller',
        basePersona: {
          key: 'builder',
          name: 'The Builder',
          confidence: 0.87
        },
        archetypeName: 'The Builder',
        shortDescription: 'You are a natural problem-solver who thrives on creating tangible solutions. Your systematic approach and hands-on mentality make you excel at turning complex challenges into well-structured, practical outcomes.',
        elevatorPitch: 'I\'m a results-driven professional who combines technical expertise with practical problem-solving. I excel at building robust systems and leading teams to deliver high-quality solutions that make a real impact.',
        topStrengths: [
          'Systems Thinking',
          'Technical Leadership',
          'Problem Solving',
          'Project Management',
          'Team Collaboration',
          'Quality Focus'
        ],
        suggestedRoles: [
          'Senior Software Engineer',
          'Technical Lead',
          'Systems Architect',
          'Engineering Manager',
          'Product Development Lead',
          'DevOps Engineer',
          'Solutions Architect',
          'Technical Project Manager'
        ],
        nextSteps: [
          'Explore advanced system design patterns and architectural principles',
          'Develop leadership skills through mentoring junior developers',
          'Consider pursuing cloud architecture certifications (AWS, Azure, GCP)',
          'Build a portfolio showcasing complex systems you\'ve designed and implemented'
        ],
        motivationalInsight: 'Your unique combination of technical depth and practical leadership makes you invaluable in bridging the gap between complex technical challenges and business solutions.',
        assessmentAnchors: ['problem solving', 'building systems', 'technical leadership', 'team collaboration'],
        createdAt: new Date().toISOString(),
        version: '1.0'
      },
      conversationHistory: [
        {
          role: 'assistant',
          content: 'Hi Randy! I\'m Atlas, your career guidance AI. I can see you\'ve completed your assessment and your Builder persona is ready. What would you like to explore about your career path today?',
          type: 'text'
        }
      ]
    };
    
    res.json(demoData);
  } catch (error) {
    console.error('Error generating demo data:', error);
    res.status(500).json({ error: 'Failed to generate demo data' });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build", "index.html"));
});

const startServer = (port) => {
  try {
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} is busy, trying ${port + 1}...`);
        startServer(port + 1);
      } else {
        console.error('Server error:', err);
      }
    });
  } catch (err) {
    console.error('Failed to start server:', err);
  }
};

startServer(PORT);

