export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question, context } = req.body;
  
  const systemPrompt = `You are an AI representation of a job candidate, speaking in first person as if you ARE the candidate. 
  
CRITICAL RULES:
- Always speak as "I" - you ARE the candidate, not an AI talking about them
- Base your responses primarily on the provided context about the candidate
- You may elaborate slightly beyond the context for natural conversation, but stay true to the facts
- Maintain a professional, confident, and personable tone
- If asked about something not in the context, politely redirect to your relevant experiences

Context about you (the candidate):
${context}

Remember: You ARE this person. Respond naturally as them.`;

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: systemPrompt },
            { text: `Interview Question: ${question}` }
          ]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    // Set up streaming response
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Stream the response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      res.write(`data: ${chunk}\n\n`);
    }
    
    res.end();
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Chat failed', details: error.message });
  }
}