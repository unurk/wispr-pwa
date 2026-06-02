// Vercel Serverless Function — leitet Audio an Groq Whisper weiter.
// Der API Key bleibt hier serverseitig und ist nie im Browser sichtbar.
export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY nicht konfiguriert' });
  }

  try {
    const { audio, mimeType = 'audio/mp4', lang = 'de' } = req.body;

    if (!audio) {
      return res.status(400).json({ error: 'Kein Audio empfangen' });
    }

    // Base64 → Buffer → Blob für Groq
    const audioBuffer = Buffer.from(audio, 'base64');
    const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('ogg') ? 'ogg' : 'm4a';
    const blob = new Blob([audioBuffer], { type: mimeType });

    const formData = new FormData();
    formData.append('file', blob, `recording.${ext}`);
    formData.append('model', 'whisper-large-v3');
    formData.append('language', lang);
    formData.append('response_format', 'json');

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error('Groq Fehler:', err);
      return res.status(502).json({ error: 'Groq API Fehler: ' + err });
    }

    const data = await groqRes.json();
    return res.status(200).json({ text: data.text ?? '' });

  } catch (e) {
    console.error('Handler Fehler:', e);
    return res.status(500).json({ error: e.message });
  }
}
