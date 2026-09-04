// api/generate.js
//
// Vercel Serverless Function — Groq version.
// Groq's API is OpenAI-compatible, so this is nearly identical to the
// OpenAI version — just a different base URL, model name, and API key.
// Free tier: no credit card required, ~14,400 requests/day (per Groq's
// published limits — check console.groq.com for current numbers).
//
// REQUIRED SETUP:
// 1. Sign up free at https://console.groq.com (email, GitHub, or Google — no card)
// 2. Go to "API Keys" in the sidebar → Create API Key → copy it immediately
//    (it's only shown once).
// 3. In your Vercel project: Settings → Environment Variables →
//    add GROQ_API_KEY with that key. Redeploy after adding it.
// 4. Frontend calls this at fetch('/api/generate', {...}) — unchanged.

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { input, tone } = req.body || {};
  if (!input || typeof input !== 'string' || !input.trim()) {
    res.status(400).json({ error: 'Missing "input" text' });
    return;
  }

  const toneLabel = ['professional', 'casual', 'funny'].includes(tone) ? tone : 'professional';

  const systemPrompt = `You are PRISM, a viral content generator. Your mission is to take a single idea and transform it into 5 distinct social media formats: an X/Twitter thread, a LinkedIn post, an Instagram caption, a short-form video script, and a newsletter blurb.

Rules:
- NEVER repeat the same structure or literal phrasing across formats, or across separate requests — even for the exact same input, each generation must read differently.
- Vary your angle every time: use an analogy in one version, a hypothetical statistic in another, a metaphor, a provocative take, or a short narrative/story framing. Rotate which angle you use.
- Match the requested tone: "${toneLabel}" (professional = clear, credible, no fluff; casual = relaxed and conversational; funny = witty, playful, light humor).
- Detect the language of the user's input automatically and respond ENTIRELY in that same language — including slang, idioms, and platform-native jargon appropriate to that language and tone. Do not translate into English if the input isn't in English.
- Each format must be ready to paste and publish as-is, following that platform's real conventions: numbered thread for X, arrow/bullet points and an engagement question for LinkedIn, emoji-forward caption with a hashtag placeholder for Instagram, timestamped hook/beats/CTA for the video script, and a subject line + recap for the newsletter.
- Output ONLY valid JSON with exactly these keys: "twitter", "linkedin", "instagram", "video", "newsletter". Each value is a single string (use \\n for line breaks inside it). No markdown fences, no extra commentary, no keys other than those five.`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // free-tier model, good quality for this task
        temperature: 0.88,                 // high creative variance, per spec
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ error: 'Upstream API error', details: errText });
      return;
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '{}';

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      res.status(502).json({ error: 'Model did not return valid JSON', raw });
      return;
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
  }
};
