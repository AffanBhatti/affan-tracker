export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { system, messages } = req.body;

    const contents = messages.map(m => {
      if (typeof m.content === 'string') {
        return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] };
      }
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

    // Try models in order until one works
    const models = [
      'gemini-2.5-flash-preview-04-17',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ];

    let lastError = null;
    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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

      if (response.ok) {
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return res.status(200).json({ content: [{ type: 'text', text }] });
      }

      lastError = data;
      // If not 404/429, don't bother trying other models
      if (response.status !== 404 && response.status !== 429) break;
    }

    return res.status(500).json({ error: lastError });

  } catch (err) {
    return res.status(500).json({ error: 'Proxy error', detail: err.message });
  }
}
