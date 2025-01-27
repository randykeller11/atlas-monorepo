const OpenAI = require("openai");

class OpenRouterAPI {
  constructor(config) {
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: config.apiKey,
      defaultHeaders: {
        "HTTP-Referer": config.headers?.referer || "",
        "X-Title": config.headers?.title || ""
      }
    });

    this.defaultSchema = {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["text", "multiple_choice", "ranking"]
        },
        content: { type: "string" },
        question: { type: "string" },
        options: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              text: { type: "string" }
            },
            required: ["id", "text"]
          }
        }
      },
      required: ["type", "content"]
    };

    this.modelPreferences = {
      models: [
        "openai/gpt-4",
        "anthropic/claude-2",
        "google/palm-2-chat-bison"
      ],
      route: "fallback"
    };

    this.providerPreferences = {
      provider: {
        openai: {
          require_parameters: ["response_format"],
          weight: 1
        },
        anthropic: {
          weight: 0.5
        }
      }
    };
  }

  async getChatCompletion(messages, options = {}) {
    try {
      return await this.client.chat.completions.create({
        ...this.modelPreferences,
        ...this.providerPreferences,
        ...options,
        messages,
        model: options.model || "openai/gpt-4",
        response_format: { 
          type: "json_object",
          schema: options.schema || this.defaultSchema
        }
      });
    } catch (error) {
      if (error.status === 429) {
        // Rate limit hit, try fallback model
        return this.client.chat.completions.create({
          ...options,
          messages,
          model: "anthropic/claude-2",
          response_format: { 
            type: "json_object",
            schema: options.schema || this.defaultSchema
          }
        });
      }
      throw error;
    }
  }

  async getStructuredResponse(messages, schema) {
    return this.getChatCompletion(messages, { schema });
  }
}

module.exports = OpenRouterAPI;
