const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const { instructions } = require("./instructions");
require("dotenv").config();
const path = require("path");

const app = express();
const port = process.env.PORT || 5001;

app.use(cors());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
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

// Initialize Assistant and Thread
async function initializeAssistant() {
  try {
    // Step 1: Create an Assistant
    const assistant = await openai.beta.assistants.create({
      name: "Atlas Career Coach",
      instructions,
      tools: [{ type: "code_interpreter" }],
      model: "gpt-4",
    });
    assistantId = assistant.id;

    // Step 2: Create a Thread
    const thread = await openai.beta.threads.create();
    threadId = thread.id;

    console.log("Assistant and thread initialized successfully.");
  } catch (error) {
    console.error("Error initializing assistant:", error);
  }
}

initializeAssistant();

// Endpoint to handle messages from the client
app.post("/api/message", async (req, res) => {
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
    const assistantResponse = messages.data[0].content[0].text.value;

    console.log("Run completed successfully");
    res.json({ response: assistantResponse });
  } catch (error) {
    console.error("Error handling message:", error.message, error.stack);
    res.status(500).json({
      error: "Failed to process the message.",
      details: error.message,
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build", "index.html"));
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
