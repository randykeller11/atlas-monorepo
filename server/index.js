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
      "http://localhost:3000",
      "https://nucoord-atlas-e99e7eee1cf6.herokuapp.com",
    ],
    credentials: true,
  })
);
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

// Add this endpoint for development
app.post("/api/reset-assistant", async (req, res) => {
  try {
    if (assistantId) {
      await openai.beta.assistants.del(assistantId);
    }
    await initializeAssistant();
    res.json({ message: "Assistant reset successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to reset assistant" });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
