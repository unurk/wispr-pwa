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
    const baseMime = String(mimeType).split(';')[0].trim(); // 'audio/mp4;codecs=..' → 'audio/mp4'
    const ext = baseMime.includes('webm') ? 'webm'
              : baseMime.includes('ogg')  ? 'ogg'
              : baseMime.includes('wav')  ? 'wav'
              : baseMime.includes('mpeg') ? 'mp3'
              : 'm4a';
    const blob = new Blob([audioBuffer], { type: baseMime });

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
      return res.status(502).json({
        error: 'Groq API Fehler: ' + err,
        diag: `mime=${baseMime} ext=${ext} bytes=${audioBuffer.length}`,
      });
    }

    const data = await groqRes.json();
    const rawText = (data.text ?? '').trim();

    // LLM-Feinschliff: Satzzeichen, Groß/Kleinschreibung, Füllwörter raus.
    const polished = rawText ? await polishText(rawText, apiKey, lang) : '';

    return res.status(200).json({ text: polished || rawText, raw: rawText });

  } catch (e) {
    console.error('Handler Fehler:', e);
    return res.status(500).json({ error: e.message });
  }
}

// Schickt den Roh-Transkript-Text durch ein schnelles LLM zur Bereinigung.
// Bei jedem Fehler wird einfach der Originaltext zurückgegeben (nie blockieren).
async function polishText(text, apiKey, lang) {
  try {
    const system =
      'Du bist ein Korrektor für diktierten Text. Du bekommst eine rohe ' +
      'Sprachtranskription und gibst sie sauber zurück. Regeln: ' +
      '1) Korrigiere Zeichensetzung und Groß-/Kleinschreibung. ' +
      '2) Entferne Füllwörter und Versprecher (ähm, äh, also, halt, ne, sozusagen). ' +
      '3) Verbessere offensichtliche Erkennungsfehler aus dem Kontext. ' +
      '4) Ändere NIEMALS den Inhalt, füge nichts hinzu, kürze nicht den Sinn. ' +
      '5) Behalte die Originalsprache bei, übersetze nicht. ' +
      '6) Gib AUSSCHLIESSLICH den bereinigten Text zurück, ohne Anführungszeichen, ' +
      'ohne Erklärung, ohne Einleitung.';

    const llmRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: text },
        ],
      }),
    });

    if (!llmRes.ok) return text;
    const out = await llmRes.json();
    const cleaned = out?.choices?.[0]?.message?.content?.trim();
    return cleaned || text;
  } catch {
    return text;
  }
}
