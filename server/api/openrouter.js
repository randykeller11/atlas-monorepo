const fetch = require('node-fetch');

class OpenRouterAPI {
  constructor(config) {
    this.apiKey = config.apiKey;
    this.headers = {
      'Authorization': `Bearer ${config.apiKey}`,
      'HTTP-Referer': config.headers.referer,
      'X-Title': config.headers.title,
      'Content-Type': 'application/json'
    };
  }

  async getChatCompletion(messages) {
    try {
      console.log('Sending request to OpenRouter API...');
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model: "openai/gpt-4",
          messages: messages,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('OpenRouter API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(`OpenRouter API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      console.log('OpenRouter API response received');
      return data;
    } catch (error) {
      console.error('Error in getChatCompletion:', error);
      throw error;
    }
  }
}

module.exports = OpenRouterAPI;
