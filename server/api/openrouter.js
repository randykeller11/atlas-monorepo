import axios from 'axios';

class OpenRouterAPI {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.headers = {
      Authorization: `Bearer ${config.apiKey}`,
      "HTTP-Referer": config.headers.referer,
      "X-Title": config.headers.title,
      "Content-Type": "application/json",
    };
  }

  async getChatCompletion(messages, options = {}) {
    try {
      console.log("=== OpenRouter API Request ===");
      console.log("Messages:", JSON.stringify(messages, null, 2));

      const requestBody = {
        model: "gpt-4o",
        messages: messages,
      };

      // Only add response_format if explicitly requested and messages contain "json"
      if (options.responseFormat === 'json_object') {
        const messagesText = JSON.stringify(messages).toLowerCase();
        if (messagesText.includes('json')) {
          requestBody.response_format = { type: "json_object" };
        } else {
          console.warn("JSON response format requested but messages don't contain 'json' - using default format");
        }
      }

      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        requestBody,
        {
          headers: this.headers,
        }
      );

      const data = response.data;

      console.log("\n=== OpenRouter API Response ===");
      console.log("Status:", response.status);
      console.log("Headers:", JSON.stringify(response.headers, null, 2));
      console.log("Body:", JSON.stringify(data, null, 2));
      console.log("Raw content:", data?.choices?.[0]?.message?.content);

      // Return the entire response data
      return data;
    } catch (error) {
      console.error("\n=== OpenRouter API Error ===");
      if (error.response) {
        console.error("Status:", error.response.status);
        console.error("Error Data:", JSON.stringify(error.response.data, null, 2));
        throw new Error(
          `OpenRouter API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`
        );
      }
      console.error("Error Type:", error.constructor.name);
      console.error("Error Message:", error.message);
      console.error("Stack Trace:", error.stack);
      throw error;
    }
  }
}

export default OpenRouterAPI;
