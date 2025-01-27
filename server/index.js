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

// Conversation state management
const conversationStates = new Map();

const getConversationState = (sessionId) => {
  if (!conversationStates.has(sessionId)) {
    conversationStates.set(sessionId, {
      currentSection: 'introduction',
      questionsAsked: 0,
      sectionsCompleted: {
        interestExploration: 0,
        workStyle: 0,
        technicalAptitude: 0,
        careerValues: 0
      },
      currentSectionQuestions: 0
    });
  }
  return conversationStates.get(sessionId);
};

const updateConversationState = (sessionId, response) => {
  const state = getConversationState(sessionId);
  
  if (response.type && ['multiple_choice', 'ranking', 'text'].includes(response.type)) {
    state.questionsAsked++;
    state.currentSectionQuestions++;
  }

  if (state.currentSection === 'introduction' && state.questionsAsked === 1) {
    state.currentSection = 'interestExploration';
  } else if (state.currentSection === 'interestExploration' && state.currentSectionQuestions === 3) {
    state.currentSection = 'workStyle';
    state.currentSectionQuestions = 0;
    state.sectionsCompleted.interestExploration = 3;
  } else if (state.currentSection === 'workStyle' && state.currentSectionQuestions === 2) {
    state.currentSection = 'technicalAptitude';
    state.currentSectionQuestions = 0;
    state.sectionsCompleted.workStyle = 2;
  } else if (state.currentSection === 'technicalAptitude' && state.currentSectionQuestions === 2) {
    state.currentSection = 'careerValues';
    state.currentSectionQuestions = 0;
    state.sectionsCompleted.technicalAptitude = 2;
  }

  state.sectionsCompleted[state.currentSection]++;
  conversationStates.set(sessionId, state);
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

// Update sanitizeResponse with smarter handling
const sanitizeResponse = async (rawResponse, threadId, timeoutMs = 45000) => {
  try {
    // First try to parse any structured content
    const parsedResponse = parseResponse(rawResponse);

    // If it's not a properly formatted response, attempt to fix it
    if (parsedResponse.type === 'text') {
      const detectedType = detectQuestionType(rawResponse);
      
      if (detectedType === 'multiple_choice') {
        const options = extractOptions(rawResponse);
        const question = extractQuestion(rawResponse);
        
        if (options.length > 0) {
          return {
            text: rawResponse.split('?')[0] + '?',
            type: 'multiple_choice',
            question: question,
            options: options
          };
        }
      } else if (detectedType === 'ranking') {
        const items = extractOptions(rawResponse);
        if (items.length >= 2) {
          return {
            text: rawResponse.split(/(?:rank|order|prioritize)/i)[0].trim(),
            type: 'ranking',
            question: 'Please rank these options in order of preference:',
            items: items,
            totalRanks: items.length
          };
        }
      }

      // If we still need formatting, try to get a new response
      if (needsFormatting(rawResponse)) {
        console.log('Attempting to get properly formatted response from API');
        const retryResponse = await retryAssistantResponse(threadId, 2, timeoutMs);
        if (retryResponse) return retryResponse;
      }
    }

    return parsedResponse;
  } catch (error) {
    console.error('Sanitization error:', error);
    return createFallbackResponse();
  }
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
  
  console.log('\n=== Processing Message ===');
  console.log('Message:', message);
  console.log('Conversation:', conversation);
  
  try {
    const state = getConversationState(sessionId);
    
    // Add state information to system message
    const systemMessage = {
      role: "system",
      content: `You are Atlas, a career guidance AI. Current section: ${state.currentSection}. Questions asked: ${state.questionsAsked}/10. 
                Section progress: Interest Exploration (${state.sectionsCompleted.interestExploration}/3), 
                Work Style (${state.sectionsCompleted.workStyle}/2), 
                Technical Aptitude (${state.sectionsCompleted.technicalAptitude}/2), 
                Career Values (${state.sectionsCompleted.careerValues}/3).
                You must respond with JSON in this format for different types of responses:\n\nFor text responses:\n{\n  \"type\": \"text\",\n  \"content\": \"string\"\n}\n\nFor multiple choice:\n{\n  \"type\": \"multiple_choice\",\n  \"content\": \"string\",\n  \"question\": \"string\",\n  \"options\": [\n    {\n      \"id\": \"string\",\n      \"text\": \"string\"\n    }\n  ]\n}\n\nFor ranking:\n{\n  \"type\": \"ranking\",\n  \"content\": \"string\",\n  \"question\": \"string\",\n  \"items\": [\n    {\n      \"id\": \"string\",\n      \"text\": \"string\"\n    }\n  ],\n  \"totalRanks\": number\n}. Please respond with JSON.`
    };
    
    // Check if this is a summary request
    if (message.includes('Please provide a comprehensive summary')) {
      const completion = await api.getChatCompletion([
        {
          role: "system",
          content: instructions + ". Please respond with JSON."
        },
        ...conversationArray,
        {
          role: "user",
          content: message + ". Please respond with JSON."
        }
      ]);

      if (!completion?.choices?.[0]?.message?.content) {
        throw new Error('Invalid API response format');
      }

      const response = JSON.parse(completion.choices[0].message.content);
      res.json(response);
      return;
    }

    // Regular message handling
    const completion = await api.getChatCompletion([
      ...conversationArray,
      {
        role: "user",
        content: message + ". Please respond with JSON."
      }
    ]);

    if (!completion?.choices?.[0]?.message?.content) {
      throw new Error('Invalid API response format');
    }

    const response = JSON.parse(completion.choices[0].message.content);
    res.json(response);

  } catch (error) {
    console.error('Error processing message:', error);
    res.json({
      type: "text",
      content: "I apologize, but I'm having trouble processing your request. Could you please try again?"
    });
  }
});


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

app.post("/api/reset-session", (req, res) => {
  const sessionId = req.headers['session-id'];
  if (sessionId) {
    conversationStates.delete(sessionId);
  }
  res.json({ message: "Session reset successfully" });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

