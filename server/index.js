const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const { instructions } = require("./instructions");
require("dotenv").config();
const path = require("path");

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
let threadId = null;

// Add session management
const sessions = new Map();

// Generate a unique session ID for each new connection
function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Initialize Assistant and Thread
async function initializeAssistant() {
  try {
    // Force reload the instructions module to get the latest version
    delete require.cache[require.resolve("./instructions")];
    const { instructions } = require("./instructions");
    console.log("Initializing assistant with instructions:", instructions);

    // Step 1: Create an Assistant
    const assistant = await openai.beta.assistants.create({
      name: "Atlas Career Coach",
      instructions,
      tools: [{ type: "code_interpreter" }],
      model: "gpt-4",
    });
    assistantId = assistant.id;
    console.log("Assistant created with ID:", assistantId);

    // Step 2: Create a Thread
    const thread = await openai.beta.threads.create();
    threadId = thread.id;
    console.log("Thread created with ID:", threadId);

    console.log("Assistant and thread initialized successfully.");
  } catch (error) {
    console.error("Error initializing assistant:", error);
  }
}

initializeAssistant();

// Add this helper function at the top of your file
function sanitizeMultipleChoice(text) {
  // Check if it's already in the correct format
  if (text.includes("<mc>") && text.includes("</mc>")) {
    return text;
  }

  // Updated regex to optionally match D) option
  const mcRegex =
    /(?:.*?)\n\s*(?:A\)|[A]\))\s*(.*?)\n\s*(?:B\)|[B]\))\s*(.*?)\n\s*(?:C\)|[C]\))\s*(.*?)(?:\n\s*(?:D\)|[D]\))\s*(.*?))?(?:\n|$)/s;
  const match = text.match(mcRegex);

  if (match) {
    // Extract the question (text before the options)
    const questionText = text.substring(0, match.index).trim();

    // Create options array with first 3 required options
    const options = [
      { id: "a", text: match[1].trim() },
      { id: "b", text: match[2].trim() },
      { id: "c", text: match[3].trim() },
    ];

    // Add fourth option if it exists
    if (match[4]) {
      options.push({ id: "d", text: match[4].trim() });
    }

    // Create the properly formatted multiple choice structure
    const mcObject = {
      question: questionText,
      options: options,
    };

    // Replace the old format with the new format
    const newFormat = `${questionText}\n\n<mc>${JSON.stringify(
      mcObject,
      null,
      2
    )}</mc>`;
    return newFormat;
  }

  return text;
}

// Endpoint to handle messages from the client
app.post("/api/message", async (req, res) => {
  const sessionId = req.headers["session-id"];

  if (!sessions.has(sessionId)) {
    // Create new thread for this session
    const thread = await openai.beta.threads.create();
    sessions.set(sessionId, thread.id);
  }

  const threadId = sessions.get(sessionId);
  const { message } = req.body;
  console.log("Received message:", message);
  console.log("Using threadId:", threadId, "and assistantId:", assistantId);

  try {
    // Step 3: Add a Message to the Thread
    const threadMessage = await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message,
    });
    console.log("Message added to thread:", threadMessage.id);

    // Step 4: Create a Run
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });
    console.log("Created run:", run.id);

    // Wait for run to complete
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);

    while (runStatus.status !== "completed") {
      console.log(
        "Waiting for run to complete. Current status:",
        runStatus.status
      );
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    }

    // Get messages
    const messages = await openai.beta.threads.messages.list(threadId);
    let assistantResponse = messages.data[0].content[0].text.value;

    // Sanitize the response
    assistantResponse = sanitizeMultipleChoice(assistantResponse);

    // Parse multiple choice questions
    const mcRegex = /<mc>([\s\S]*?)<\/mc>/;
    const match = assistantResponse.match(mcRegex);

    let response;
    if (match) {
      try {
        const mcJson = JSON.parse(match[1]);
        response = {
          text: assistantResponse.replace(match[0], "").trim(), // Regular conversation text
          type: "multiple_choice",
          question: mcJson.question,
          options: mcJson.options,
        };
      } catch (error) {
        console.error("Error parsing multiple choice JSON:", error);
        response = {
          text: assistantResponse,
          type: "text",
        };
      }
    } else {
      response = {
        text: assistantResponse,
        type: "text",
      };
    }

    console.log("Final response:", response);
    res.json(response);
  } catch (error) {
    console.error("Error handling message:", error.message, error.stack);
    res.status(500).json({
      error: "Failed to process the message.",
      details: error.message,
    });
  }
});

// Add a function to cleanup existing sessions
const cleanupSessions = () => {
  sessions.clear();
  console.log("Cleared all active sessions");
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

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
