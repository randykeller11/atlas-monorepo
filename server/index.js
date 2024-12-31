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
let threadId = null;

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

    // Step 1: Create an Assistant
    const assistant = await openai.beta.assistants.create({
      name: "Atlas Career Coach",
      instructions: combinedInstructions,
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

// Add this helper function
const parseMultipleChoice = (text) => {
  const mcRegex = /<mc>([\s\S]*?)<\/mc>/;
  const match = text.match(mcRegex);

  if (match) {
    try {
      const mcJson = JSON.parse(match[1]);
      return {
        text: text.replace(match[0], "").trim(),
        type: "multiple_choice",
        question: mcJson.question,
        options: mcJson.options,
      };
    } catch (error) {
      console.error("Error parsing multiple choice JSON:", error);
      return { text, type: "text" };
    }
  }
  return { text, type: "text" };
};

// Endpoint to handle messages from the client
app.post("/api/message", async (req, res) => {
  const sessionId = req.headers["session-id"];

  if (!sessions.has(sessionId)) {
    const thread = await openai.beta.threads.create();
    sessions.set(sessionId, thread.id);
  }

  const threadId = sessions.get(sessionId);
  const { message } = req.body;

  try {
    const threadMessage = await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message,
    });

    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId,
    });

    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);

    while (runStatus.status !== "completed") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    }

    const messages = await openai.beta.threads.messages.list(threadId);
    const assistantResponse = messages.data[0].content[0].text.value;

    // Parse and format the response
    const formattedResponse = parseMultipleChoice(assistantResponse);
    res.json(formattedResponse);
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
