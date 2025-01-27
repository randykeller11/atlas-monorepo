import fetch from 'node-fetch';

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
      console.log('=== OpenRouter API Request ===');
      console.log('Messages:', JSON.stringify(messages, null, 2));
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model: "openai/gpt-4",
          messages: messages,
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json();
      
      console.log('\n=== OpenRouter API Response ===');
      console.log('Status:', response.status);
      console.log('Headers:', JSON.stringify(Object.fromEntries(response.headers), null, 2));
      console.log('Body:', JSON.stringify(data, null, 2));

      if (!response.ok) {
        console.error('\n=== OpenRouter API Error ===');
        console.error('Status:', response.status);
        console.error('Error Data:', JSON.stringify(data, null, 2));
        if (data.error?.metadata?.raw) {
          console.error('Raw Error:', JSON.stringify(data.error.metadata.raw, null, 2));
        }
        throw new Error(`OpenRouter API error: ${response.status} - ${JSON.stringify(data)}`);
      }

      // Validate response format
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('\n=== Invalid Response Format ===');
        console.error('Received Data:', JSON.stringify(data, null, 2));
        throw new Error('Invalid response format from OpenRouter API');
      }

      console.log('\n=== Successfully Processed Response ===');
      return data;
    } catch (error) {
      console.error('\n=== Error in getChatCompletion ===');
      console.error('Error Type:', error.constructor.name);
      console.error('Error Message:', error.message);
      console.error('Stack Trace:', error.stack);
      throw error;
    }
  }
}

export default OpenRouterAPI;
