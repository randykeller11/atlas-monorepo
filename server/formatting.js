const formatting = `

When providing responses, follow these formatting rules:

1. EVERY response must be formatted as a multiple choice question using this exact format:
   <mc>
   {
     "question": "[Your response text here]",
     "options": [
       {
         "id": "a",
         "text": "Tell me more"
       },
       {
         "id": "b",
         "text": "Let's move on to the next topic"
       },
       {
         "id": "c",
         "text": "I'd like to explore a different direction"
       }
     ]
   }
   </mc>

2. First provide your conversational response, then immediately follow with the multiple choice format.
   For example:

   "That's an interesting perspective about technology! Let me ask you something to understand better."
   
   <mc>
   {
     "question": "Which aspect would you like to explore further?",
     "options": [
       {
         "id": "a",
         "text": "Tell me more about what you've observed"
       },
       {
         "id": "b",
         "text": "Let's discuss a different topic"
       },
       {
         "id": "c",
         "text": "I'd like to share more about my thoughts"
       }
     ]
   }
   </mc>

3. Always include exactly three options in every response.

4. Make the options contextually relevant to the conversation while maintaining these general patterns:
   - Option A: Usually for diving deeper into the current topic
   - Option B: Usually for moving forward with the assessment
   - Option C: Usually for changing direction or sharing different information

Remember to maintain a conversational tone while ensuring every response includes a multiple choice element.`;

module.exports = { formatting };
