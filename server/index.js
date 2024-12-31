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

// Add this helper function
const parseResponse = (text) => {
  // Check for ranking question
  const rankRegex = /<rank>([\s\S]*?)<\/rank>/;
  const rankMatch = text.match(rankRegex);

  if (rankMatch) {
    try {
      const rankJson = JSON.parse(rankMatch[1]);
      return {
        text: text.replace(rankMatch[0], "").trim(),
        type: "ranking",
        question: rankJson.question,
        items: rankJson.items,
        totalRanks: rankJson.totalRanks,
      };
    } catch (error) {
      console.error("Error parsing ranking JSON:", error);
    }
  }

  // Check for multiple choice
  const mcRegex = /<mc>([\s\S]*?)<\/mc>/;
  const mcMatch = text.match(mcRegex);

  if (mcMatch) {
    try {
      const mcJson = JSON.parse(mcMatch[1]);
      return {
        text: text.replace(mcMatch[0], "").trim(),
        type: "multiple_choice",
        question: mcJson.question,
        options: mcJson.options,
      };
    } catch (error) {
      console.error("Error parsing multiple choice JSON:", error);
    }
  }

  return { text, type: "text" };
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

// Update sanitizeResponse to use 30 second timeout
const sanitizeResponse = async (rawResponse, threadId) => {
  try {
    // First try to parse any structured content
    const parsedResponse = parseResponse(rawResponse);

    // If it's not a properly formatted response, attempt to fix it
    if (parsedResponse.type === "text") {
      if (containsUnformattedList(rawResponse)) {
        return convertToRankingFormat(rawResponse);
      }
      if (rawResponse.includes("A)") || rawResponse.includes("B)")) {
        return convertToMultipleChoiceFormat(rawResponse);
      }

      // If we still don't have a proper format, try to get a new response
      console.log("Attempting to get a new response from the API...");
      const retryResponse = await retryAssistantResponse(threadId, 2, 30000); // Increased to 30 seconds
      if (retryResponse) {
        return retryResponse;
      }
    }

    // Validate the parsed response
    if (parsedResponse.type === "ranking") {
      validateRankingResponse(parsedResponse);
    } else if (parsedResponse.type === "multiple_choice") {
      validateMultipleChoiceResponse(parsedResponse);
    }

    return parsedResponse;
  } catch (error) {
    console.error("Response sanitization failed:", error);
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

// Endpoint to handle messages from the client
app.post("/api/message", async (req, res) => {
  const sessionId = req.headers["session-id"];

  // Set response timeout to avoid Heroku H12 error
  res.setTimeout(25000, () => {
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
    // Create new thread if one doesn't exist for this session
    if (!sessions.has(sessionId)) {
      const thread = await openai.beta.threads.create();
      sessions.set(sessionId, thread.id);
      console.log(`Created new thread ${thread.id} for session ${sessionId}`);
    }

    const threadId = sessions.get(sessionId);
    const { message } = req.body;

    // Set a shorter timeout for the OpenAI operations
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Operation timed out")), 20000)
    );

    const responsePromise = (async () => {
      const threadMessage = await openai.beta.threads.messages.create(
        threadId,
        {
          role: "user",
          content: message,
        }
      );

      const run = await openai.beta.threads.runs.create(threadId, {
        assistant_id: assistantId,
      });

      let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      const startTime = Date.now();

      while (runStatus.status !== "completed") {
        if (Date.now() - startTime > 15000) {
          // 15 second limit for the loop
          throw new Error("Run timed out");
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
        runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      }

      const messages = await openai.beta.threads.messages.list(threadId);
      return messages.data[0].content[0].text.value;
    })();

    // Race between timeout and response
    const assistantResponse = await Promise.race([
      responsePromise,
      timeoutPromise,
    ]);

    // Use the sanitizer with a shorter timeout
    const sanitizedResponse = await sanitizeResponse(
      assistantResponse,
      threadId,
      15000 // 15 second timeout for sanitization
    );

    res.json(sanitizedResponse);
  } catch (error) {
    console.error("Error handling message:", error.message, error.stack);

    // Send a specific response for timeouts
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
