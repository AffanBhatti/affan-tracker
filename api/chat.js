export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { system, messages } = req.body;

    // Convert messages to Gemini format
    const contents = messages.map(m => {
      if (typeof m.content === 'string') {
        return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] };
      }
      // Handle array content (text + images)
      const parts = m.content.map(c => {
        if (c.type === 'text') return { text: c.text };
        if (c.type === 'image') return {
          inline_data: { mime_type: c.source.media_type, data: c.source.data }
        };
        return null;
      }).filter(Boolean);
      return { role: m.role === 'assistant' ? 'model' : 'user', parts };
    });

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: 1000, temperature: 0.7 }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    // Normalize to Anthropic-style response so frontend works unchanged
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (err) {
    return res.status(500).json({ error: 'Proxy error', detail: err.message });
  }
}
