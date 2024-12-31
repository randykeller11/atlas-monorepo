const testFormatting = `

When providing responses, follow these formatting rules:

1. For regular multiple choice questions, use this format:
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

2. For ranking questions, use this format:
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

Remember to maintain a conversational tone while ensuring every response includes a ranking element.`;

module.exports = { testFormatting };
