const formatting = `

When providing responses, follow these formatting rules:

1. For regular multiple choice questions, use this exact format with no deviations:
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

2. For ranking questions, use this exact format with no deviations:
   <rank>
   {
     "question": "[Your ranking question here]",
     "items": [
       {
         "id": "item1",
         "text": "First item to rank"
       },
       {
         "id": "item2",
         "text": "Second item to rank"
       },
       {
         "id": "item3",
         "text": "Third item to rank"
       },
       {
         "id": "item4",
         "text": "Fourth item to rank"
       }
     ],
     "totalRanks": 4
   }
   </rank>

3. IMPORTANT FORMATTING RULES:
   - Always wrap JSON in either <mc> or <rank> tags
   - Never provide numbered lists or alternative formats
   - Use the exact JSON structure shown above
   - For ranking questions, always include exactly 4 items
   - First provide your conversational response, then the formatted question

Example of correct format:
"That's interesting! Let me understand your preferences better."
<rank>
{
  "question": "Please rank these activities based on your interest:",
  "items": [
    {
      "id": "item1",
      "text": "Coding a new feature for a web application"
    },
    {
      "id": "item2",
      "text": "Designing an AI-generated animation"
    },
    {
      "id": "item3",
      "text": "Debugging a complex software issue"
    },
    {
      "id": "item4",
      "text": "Organizing a project plan for a tech project"
    }
  ],
  "totalRanks": 4
}
</rank>

Remember to maintain a conversational tone while ensuring responses use appropriate question formats.`;

module.exports = { formatting };
