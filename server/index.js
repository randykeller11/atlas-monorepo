const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const { instructions } = require("./instructions");
const { formatting } = require("./formatting");
require("dotenv").config();
const path = require("path");
const { users } = require("./users");
const fs = require("fs").promises;

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
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Global variables for assistant and thread
let assistantId = null;

// Add a Map to store assistant IDs for different environments
const assistants = new Map();

// Add session management
const sessions = new Map();

// Initialize Assistant and Thread
async function initializeAssistant() {
  try {
    // Force reload both modules to get the latest version
    delete require.cache[require.resolve("./instructions")];
    delete require.cache[require.resolve("./formatting")];
    const { instructions } = require("./instructions");
    const { formatting } = require("./formatting");

    // Combine instructions with formatting
    const combinedInstructions = instructions + formatting;
    console.log(
      "Initializing assistant with instructions:",
      combinedInstructions
    );

    // Create an Assistant
    const assistant = await openai.beta.assistants.create({
      name: "Atlas Career Coach",
      instructions: combinedInstructions,
      tools: [{ type: "code_interpreter" }],
      model: "gpt-4",
    });

    assistantId = assistant.id;
    console.log("Assistant created with ID:", assistantId);
  } catch (error) {
    console.error("Error initializing assistant:", error);
  }
}

initializeAssistant();

// Add helper functions for response parsing and formatting
const detectQuestionType = (text) => {
  // Check for explicit formatting first
  if (text.includes('<mc>')) return 'multiple_choice';
  if (text.includes('<rank>')) return 'ranking';

  // Check for common multiple choice patterns
  const mcPatterns = [
    /[A-Z]\)\s+.+/gm,  // A) Option
    /[A-Z]\.\s+.+/gm,  // A. Option
    /Option [A-Z]:/gm,  // Option A:
    /\d+\)\s+.+/gm,    // 1) Option
    /\(\s*[A-Z]\s*\)/gm // (A)
  ];

  // Check for ranking patterns
  const rankPatterns = [
    /rank.*following/i,
    /order.*preference/i,
    /prioritize.*following/i,
    /from most to least/i
  ];

  // Look for bullet points or numbered lists
  const listPatterns = [
    /(?:\d+\.|[A-Z]\)|•|-)\s+.+/gm,
    /^\s*[-•]\s+.+/gm
  ];

  // Check if it contains a question
  const hasQuestion = text.includes('?');
  
  // If it has multiple choice patterns and a question
  if (mcPatterns.some(pattern => pattern.test(text)) && hasQuestion) {
    return 'multiple_choice';
  }

  // If it has ranking patterns and lists
  if (rankPatterns.some(pattern => pattern.test(text)) && 
      listPatterns.some(pattern => pattern.test(text))) {
    return 'ranking';
  }

  return 'text';
};

const extractOptions = (text) => {
  // First try to match lettered options (A) B) C) format)
  const letterPattern = /([A-D])\)\s*([^A-D\n]+?)(?=(?:\s*[A-D]\)|$))/g;
  const matches = Array.from(text.matchAll(letterPattern));
  
  if (matches.length >= 2) {
    return matches.map(match => ({
      id: match[1].toLowerCase(),
      text: match[2].trim()
    }));
  }

  return null;
};

const extractQuestion = (text) => {
  // Look for the last question before options
  const parts = text.split(/[A-D]\)/)[0];
  const questions = parts.match(/[^.!?]+\?/g);
  
  if (questions) {
    return questions[questions.length - 1].trim();
  }
  
  // Fallback to looking for the question-like phrase
  const questionIndicators = [
    /how would you/i,
    /what would you/i,
    /which (?:option|approach)/i
  ];
  
  for (const pattern of questionIndicators) {
    const match = text.match(new RegExp(`[^.!?]*${pattern.source}[^.!?]*\\??`));
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
    // Check for <mc> tags first
    const mcMatch = response.match(/<mc>([\s\S]*?)<\/mc>/);
    if (mcMatch) {
      const mcContent = JSON.parse(mcMatch[1]);
      const conversationalText = response.split('<mc>')[0].trim();
      
      return {
        text: conversationalText,
        type: "multiple_choice",
        question: mcContent.question,
        options: mcContent.options
      };
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
        /how would you/i,  // Add pattern for "how would you" questions
        /\b(?:A|B|C|D)\)[\s\w]/i  // Add pattern for A) B) C) D) format
      ];

      return (
        text.includes('?') && 
        (choiceIndicators.some(pattern => pattern.test(text)) ||
         /(?:[A-D]\)|\d+\.)[\s\w]/.test(text))  // Add pattern for lettered/numbered options
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
  
  // First try direct sanitization
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
      console.log("Successfully sanitized multiple choice response:", sanitized);
      return sanitized;
    }
  }

  // Only proceed with retries if really necessary
  let retryCount = 0;
  const maxRetries = 1; // Reduce max retries since we improved first-pass detection
  
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
      if (isMultipleChoice(newResponse)) {
        const options = extractOptions(newResponse);
        const question = extractQuestion(newResponse);
        
        if (options && question) {
          const conversationalText = newResponse.split(question)[0].trim();
          const sanitized = {
            text: conversationalText,
            type: "multiple_choice",
            question: question,
            options: options
          };
          console.log("Successfully sanitized after format improvement:", sanitized);
          return sanitized;
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

// Add timeout utility function
const waitWithTimeout = async (ms, timeoutMs = 10000) => {
  return Promise.race([
    new Promise((resolve) => setTimeout(resolve, ms)),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Operation timed out")), timeoutMs)
    ),
  ]);
};

// Update retry function with timeout
const retryAssistantResponse = async (
  threadId,
  maxRetries = 2,
  timeoutMs = 10000
) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`Starting retry attempt ${i + 1}/${maxRetries}`);

      // Create a new run
      const run = await openai.beta.threads.runs.create(threadId, {
        assistant_id: assistantId,
      });

      let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      const startTime = Date.now();

      while (runStatus.status !== "completed") {
        if (Date.now() - startTime > timeoutMs) {
          throw new Error("Run timed out");
        }

        try {
          await waitWithTimeout(1000, timeoutMs - (Date.now() - startTime));
          runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
        } catch (error) {
          if (error.message === "Operation timed out") {
            throw new Error("Run timed out");
          }
          throw error;
        }
      }

      const messages = await openai.beta.threads.messages.list(threadId);
      const newResponse = messages.data[0].content[0].text.value;

      // Try to parse the new response
      const parsedResponse = parseResponse(newResponse);
      if (parsedResponse.type !== "text") {
        return parsedResponse; // Return if we got a properly formatted response
      }

      console.log(
        `Retry attempt ${i + 1} failed to get properly formatted response`
      );
    } catch (error) {
      console.error(`Retry attempt ${i + 1} failed:`, error);
      if (error.message === "Run timed out") {
        console.error("Retry attempt timed out, moving to next attempt");
        continue;
      }
    }
  }
  return null; // Return null if all retries failed
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
  if (
    !response.options ||
    !Array.isArray(response.options) ||
    response.options.length < 1
  ) {
    throw new Error("Invalid multiple choice response structure");
  }

  // Ensure all options have required properties
  response.options.forEach((option, index) => {
    if (!option.id || !option.text) {
      option.id = `option${index + 1}`;
      option.text = option.text || `Option ${index + 1}`;
    }
  });
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
      roleMatches: [],
      salaryRanges: [],
      recommendedCourses: [],
      portfolioSuggestions: [],
      networkingOpportunities: [],
      careerRoadmap: '',
    };
    
    // Extract role matches
    const roleMatchRegex = /(\d+)%\s+match:\s+([\w\s]+)/g;
    let match;
    while ((match = roleMatchRegex.exec(text)) !== null) {
      sections.roleMatches.push({
        match: parseInt(match[1]),
        title: match[2].trim()
      });
    }

    // Extract salary ranges
    const salaryRegex = /([\w\s]+):\s+\$[\d,]+\s*-\s*\$[\d,]+/g;
    while ((match = salaryRegex.exec(text)) !== null) {
      sections.salaryRanges.push({
        role: match[1].trim(),
        range: match[0].split(':')[1].trim()
      });
    }

    // Extract courses
    const coursesMatch = text.match(/Recommended courses:(.*?)(?=Portfolio|$)/s);
    if (coursesMatch) {
      sections.recommendedCourses = coursesMatch[1].trim().split('\n')
        .map(course => course.trim())
        .filter(course => course.length > 0);
    }

    // Extract portfolio suggestions
    const portfolioMatch = text.match(/Portfolio suggestions:(.*?)(?=Networking|$)/s);
    if (portfolioMatch) {
      sections.portfolioSuggestions = portfolioMatch[1].trim().split('\n')
        .map(suggestion => suggestion.trim())
        .filter(suggestion => suggestion.length > 0);
    }

    // Extract networking opportunities
    const networkingMatch = text.match(/Networking opportunities:(.*?)(?=Career|$)/s);
    if (networkingMatch) {
      sections.networkingOpportunities = networkingMatch[1].trim().split('\n')
        .map(opportunity => opportunity.trim())
        .filter(opportunity => opportunity.length > 0);
    }

    // Extract career roadmap
    const roadmapMatch = text.match(/Career roadmap:(.*?)$/s);
    if (roadmapMatch) {
      sections.careerRoadmap = roadmapMatch[1].trim();
    }

    return sections;
  } catch (error) {
    console.error('Error parsing summary:', error);
    return null;
  }
};

app.post("/api/message", async (req, res) => {
  const sessionId = req.headers["session-id"];
  const { message } = req.body;
  
  console.log(
    `\n[${new Date().toISOString()}] New message request from session ${sessionId}`
  );

  // Check if this is a summary request
  if (message.includes('Please provide a comprehensive summary')) {
    try {
      // Get the threadId from the sessions map
      const threadId = sessions.get(sessionId);
      if (!threadId) {
        throw new Error('No thread found for session');
      }

      // Create the message in the thread
      await openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: message,
      });

      // Create and wait for the run to complete
      const run = await openai.beta.threads.runs.create(threadId, {
        assistant_id: assistantId,
      });

      let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      while (runStatus.status !== "completed") {
        await new Promise(resolve => setTimeout(resolve, 1000));
        runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      }

      // Get the response
      const messages = await openai.beta.threads.messages.list(threadId);
      const response = messages.data[0].content[0].text.value;

      const parsedSummary = parseSummaryResponse(response);
      res.json(parsedSummary);
      return;
    } catch (error) {
      console.error('Error generating summary:', error);
      res.status(500).json({ error: 'Failed to generate summary' });
      return;
    }
  }

  // Set response timeout to avoid Heroku H12 error
  res.setTimeout(55000, () => {
    res.status(503).json({
      error: "Operation timed out",
      type: "multiple_choice",
      text: "I'm taking longer than expected to process your request.",
      question: "How would you like to proceed?",
      options: [
        {
          id: "retry",
          text: "Try sending your message again",
        },
        {
          id: "rephrase",
          text: "Rephrase your message",
        },
        {
          id: "continue",
          text: "Start a new conversation",
        },
      ],
    });
  });

  try {
    if (!sessions.has(sessionId)) {
      console.log(`Creating new thread for session ${sessionId}`);
      const thread = await openai.beta.threads.create();
      sessions.set(sessionId, thread.id);
      console.log(`Created new thread ${thread.id} for session ${sessionId}`);
    }

    const threadId = sessions.get(sessionId);
    const { message } = req.body;
    console.log(`Processing message in thread ${threadId}:`, message);

    // Check and cancel any active runs before proceeding
    await checkAndCancelActiveRuns(threadId);

    // Set a longer timeout for the OpenAI operations
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Operation timed out")), 45000)
    );

    const responsePromise = (async () => {
      try {
        console.log(`Creating message in thread ${threadId}`);
        const threadMessage = await openai.beta.threads.messages.create(
          threadId,
          {
            role: "user",
            content: message,
          }
        );
        console.log(`Message created with ID: ${threadMessage.id}`);

        console.log(`Starting new run in thread ${threadId}`);
        const run = await openai.beta.threads.runs.create(threadId, {
          assistant_id: assistantId,
        });
        console.log(`Run created with ID: ${run.id}`);

        let runStatus = await openai.beta.threads.runs.retrieve(
          threadId,
          run.id
        );
        const startTime = Date.now();
        console.log(`Initial run status: ${runStatus.status}`);

        while (runStatus.status !== "completed") {
          const elapsedTime = Date.now() - startTime;
          console.log(
            `Run ${run.id} status: ${runStatus.status}, elapsed time: ${elapsedTime}ms`
          );

          if (Date.now() - startTime > 40000) {
            console.log(
              `Run ${run.id} exceeded time limit, attempting cancellation`
            );
            try {
              await openai.beta.threads.runs.cancel(threadId, run.id);
              console.log(`Successfully cancelled run ${run.id}`);
            } catch (cancelError) {
              logError("Run Cancellation", cancelError, {
                runId: run.id,
                threadId,
              });
            }
            throw new Error("Run timed out");
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
          runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);

          if (["failed", "cancelled", "expired"].includes(runStatus.status)) {
            logError(
              "Run Status Error",
              new Error(`Run ended with status: ${runStatus.status}`),
              {
                runId: run.id,
                threadId,
                status: runStatus.status,
                lastError: runStatus.last_error,
              }
            );
            throw new Error(
              `Run ${run.id} ended with status: ${runStatus.status}`
            );
          }
        }

        console.log(`Run ${run.id} completed successfully`);
        const messages = await openai.beta.threads.messages.list(threadId);
        console.log(`Retrieved ${messages.data.length} messages from thread`);
        return messages.data[0].content[0].text.value;
      } catch (error) {
        logError("Response Promise", error, { threadId });
        throw error;
      }
    })();

    const assistantResponse = await Promise.race([
      responsePromise,
      timeoutPromise,
    ]);
    console.log("Got response from assistant, sanitizing...");
    logResponse("API Response", assistantResponse, null);

    const sanitizedResponse = await hybridSanitize(assistantResponse, threadId);
    console.log("Response sanitized successfully");
    logResponse("Sanitized Response", assistantResponse, sanitizedResponse);

    res.json(sanitizedResponse);
  } catch (error) {
    logError("Request Handler", error, {
      sessionId,
      threadId: sessions.get(sessionId),
      messageType:
        error.message === "Operation timed out" ? "timeout" : "error",
    });

    if (error.message === "Operation timed out") {
      res.status(503).json({
        type: "multiple_choice",
        text: "I'm taking longer than expected to process your request.",
        question: "How would you like to proceed?",
        options: [
          {
            id: "retry",
            text: "Try sending your message again",
          },
          {
            id: "rephrase",
            text: "Rephrase your message",
          },
          {
            id: "continue",
            text: "Start a new conversation",
          },
        ],
      });
    } else {
      res.json(createFallbackResponse());
    }
  }
});

// Add a function to cleanup existing sessions
const cleanupSessions = async () => {
  try {
    for (const [sessionId, threadId] of sessions) {
      try {
        await openai.beta.threads.del(threadId);
        console.log(`Cleaned up thread ${threadId} for session ${sessionId}`);
      } catch (error) {
        console.error(`Error cleaning up thread ${threadId}:`, error);
      }
    }
    sessions.clear();
    console.log("Cleared all active sessions");
  } catch (error) {
    console.error("Error in cleanup:", error);
  }
};

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

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Add reset endpoint
app.post("/api/reset-session", async (req, res) => {
  const sessionId = req.headers["session-id"];

  try {
    if (sessions.has(sessionId)) {
      // Create a new thread for the session
      const thread = await openai.beta.threads.create();
      sessions.set(sessionId, thread.id);

      console.log(`Reset session ${sessionId} with new thread ${thread.id}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error resetting session:", error);
    res.status(500).json({ error: "Failed to reset session" });
  }
});
