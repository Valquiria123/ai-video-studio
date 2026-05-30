require('dotenv').config();
const express = require('express');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

const TMP = path.join(__dirname, '../tmp');
const OUT = path.join(__dirname, '../outputs');
[TMP, OUT].forEach(d => !fs.existsSync(d) && fs.mkdirSync(d, { recursive: true }));

// ── HELPERS ──────────────────────────────────────────────────────────────────

function getEnv(key) {
  return process.env[key] || '';
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  const buf = await res.buffer();
  fs.writeFileSync(dest, buf);
}

function cleanup(files) {
  files.forEach(f => { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {} });
}

// ── CLAUDE ───────────────────────────────────────────────────────────────────

async function callClaude(prompt, system, maxTokens = 2000) {
  const key = getEnv('CLAUDE_API_KEY');
  if (!key) throw new Error('CLAUDE_API_KEY no configurada');
  const res = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system: system || 'Respondé SOLO en JSON válido sin backticks ni texto extra.',
    messages: [{ role: 'user', content: prompt }]
  }, {
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    }
  });
  return res.data.content.map(c => c.text || '').join('');
}

// ── ELEVENLABS ───────────────────────────────────────────────────────────────

async function generateVoice(text, outputPath) {
  const key = getEnv('ELEVENLABS_API_KEY');
  const voiceId = getEnv('ELEVENLABS_VOICE_ID') || '21m00Tcm4TlvDq8ikWAM';
  if (!key) throw new Error('ELEVENLABS_API_KEY no configurada');
  const res = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    { text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } },
    { headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, responseType: 'arraybuffer' }
  );
  fs.writeFileSync(outputPath, Buffer.from(res.data));
}

// ── REPLICATE (Stable Diffusion XL) ─────────────────────────────────────────

async function generateImage(prompt, outputPath) {
  const token = getEnv('REPLICATE_API_TOKEN');
  if (!token) throw new Error('REPLICATE_API_TOKEN no configurado');

  const res = await axios.post('https://api.replicate.com/v1/models/stability-ai/sdxl/predictions', {
    input: {
      prompt: prompt + ', cinematic, high quality, 16:9, professional photography',
      negative_prompt: 'blurry, low quality, ugly, deformed, watermark, text',
      width: 1280, height: 720, num_outputs: 1, num_inference_steps: 25
    }
  }, { headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' } });

  let prediction = res.data;
  const predId = prediction.id;

  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const poll = await axios.get(`https://api.replicate.com/v1/predictions/${predId}`,
      { headers: { Authorization: `Token ${token}` } });
    prediction = poll.data;
    if (prediction.status === 'succeeded') break;
    if (prediction.status === 'failed') throw new Error('Replicate falló: ' + prediction.error);
  }

  if (!prediction.output || !prediction.output[0]) throw new Error('Replicate no devolvió imagen');
  await downloadFile(prediction.output[0], outputPath);
}

// ── PIXABAY MUSIC ────────────────────────────────────────────────────────────

async function getMusic(query, outputPath) {
  const key = getEnv('PIXABAY_API_KEY');
  if (!key) { fs.writeFileSync(outputPath, Buffer.alloc(0)); return false; }
  try {
    const res = await axios.get(`https://pixabay.com/api/music/?key=${key}&q=${encodeURIComponent(query)}&per_page=5`);
    const hits = res.data.hits || [];
    const track = hits.find(h => h.audio) || hits[0];
    if (!track || !track.audio) return false;
    await downloadFile(track.audio, outputPath);
    return true;
  } catch { return false; }
}

// ── FFMPEG VIDEO ASSEMBLY ────────────────────────────────────────────────────

async function assembleVideo(scenes, audioFiles, musicPath, hasMusic, outputPath) {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();
    const imagePaths = scenes.map(s => s.imagePath);

    // Add each image as input
    imagePaths.forEach(img => cmd.input(img).inputOptions(['-loop 1', '-t 8']));

    // Add each audio narration
    audioFiles.forEach(a => cmd.input(a));

    // Add music if available
    if (hasMusic && fs.existsSync(musicPath) && fs.statSync(musicPath).size > 0) {
      cmd.input(musicPath);
    }

    const totalScenes = scenes.length;
    const audioCount = audioFiles.length;
    const hasM = hasMusic && fs.existsSync(musicPath) && fs.statSync(musicPath).size > 0;

    // Build filtergraph
    let filterLines = [];

    // Scale and Ken Burns effect for each image
    imagePaths.forEach((_, i) => {
      filterLines.push(
        `[${i}:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,` +
        `zoompan=z='min(zoom+0.0008,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=200:s=1280x720,` +
        `setsar=1,fps=25[v${i}]`
      );
    });

    // Concatenate all video streams
    const vInputs = imagePaths.map((_, i) => `[v${i}]`).join('');
    filterLines.push(`${vInputs}concat=n=${totalScenes}:v=1:a=0[vout]`);

    // Concatenate all audio narrations
    const aInputs = audioFiles.map((_, i) => `[${totalScenes + i}:a]`).join('');
    filterLines.push(`${aInputs}concat=n=${audioCount}:v=0:a=1[narr]`);

    if (hasM) {
      // Mix narration + music (music at 20% volume)
      filterLines.push(`[narr]volume=1.0[narr_v]`);
      filterLines.push(`[${totalScenes + audioCount}:a]volume=0.2[music_v]`);
      filterLines.push(`[narr_v][music_v]amix=inputs=2:duration=first[aout]`);
    } else {
      filterLines.push(`[narr]volume=1.0[aout]`);
    }

    cmd
      .complexFilter(filterLines.join(';'))
      .outputOptions([
        '-map [vout]', '-map [aout]',
        '-c:v libx264', '-preset fast', '-crf 23',
        '-c:a aac', '-b:a 192k',
        '-movflags +faststart',
        '-pix_fmt yuv420p',
        '-shortest'
      ])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

// ── ROUTES ───────────────────────────────────────────────────────────────────

// Save config keys at runtime (stores in process.env for the session)
app.post('/api/config', (req, res) => {
  const { key, value, voiceId } = req.body;
  const map = { claude: 'CLAUDE_API_KEY', eleven: 'ELEVENLABS_API_KEY', replicate: 'REPLICATE_API_TOKEN', pixabay: 'PIXABAY_API_KEY' };
  if (map[key] && value) process.env[map[key]] = value;
  if (key === 'eleven' && voiceId) process.env.ELEVENLABS_VOICE_ID = voiceId;
  res.json({ ok: true });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    apis: {
      claude: !!getEnv('CLAUDE_API_KEY'),
      elevenlabs: !!getEnv('ELEVENLABS_API_KEY'),
      replicate: !!getEnv('REPLICATE_API_TOKEN'),
      pixabay: !!getEnv('PIXABAY_API_KEY')
    }
  });
});

// Analyze idea + get music suggestions
app.post('/api/analyze', async (req, res) => {
  const { idea, duracion, tono } = req.body;
  if (!idea) return res.status(400).json({ error: 'Falta la idea' });
  try {
    const raw = await callClaude(
      `Analiza esta idea de video para YouTube y devuelve SOLO este JSON:
{"scoreRetencion":"X%","scoreEngagement":"X%","scoreSEO":"X%","ideaOptimizada":"versión mejorada","sugerencias":[{"tipo":"retencion","titulo":"titulo","texto":"texto"},{"tipo":"engagement","titulo":"titulo","texto":"texto"},{"tipo":"retencion","titulo":"titulo","texto":"texto"},{"tipo":"seo","titulo":"titulo","texto":"texto"},{"tipo":"engagement","titulo":"titulo","texto":"texto"}],"musicaRecomendada":[{"nombre":"nombre","genero":"genero","mood":"mood","tempo":"lento/medio/rapido","porQueElegirla":"razon","tendencia":"alta/media/baja","queryPixabay":"query 2-3 palabras ingles"},{"nombre":"nombre2","genero":"genero","mood":"mood","tempo":"...","porQueElegirla":"...","tendencia":"alta/media/baja","queryPixabay":"query ingles"},{"nombre":"nombre3","genero":"genero","mood":"mood","tempo":"...","porQueElegirla":"...","tendencia":"alta/media/baja","queryPixabay":"query ingles"}]}
Idea: "${idea}" | Duración: ${duracion} | Tono: ${tono}`
    );
    const data = JSON.parse(raw.replace(/```json|```/g, '').trim());

    // Fetch Pixabay previews
    const pixKey = getEnv('PIXABAY_API_KEY');
    if (pixKey) {
      for (const m of data.musicaRecomendada || []) {
        try {
          const r = await axios.get(`https://pixabay.com/api/music/?key=${pixKey}&q=${encodeURIComponent(m.queryPixabay||'background')}&per_page=3`);
          const hits = r.data.hits || [];
          m.preview = hits.find(h => h.audio)?.audio || null;
          m.trackTitle = hits.find(h => h.audio)?.title || null;
        } catch { m.preview = null; }
      }
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Generate script
app.post('/api/script', async (req, res) => {
  const { idea, duracion, tono, musicaMood } = req.body;
  if (!idea) return res.status(400).json({ error: 'Falta la idea' });
  const durMap = { corto: '2 min, 4 escenas', medio: '4 min, 5 escenas', largo: '8 min, 7 escenas' };
  const tonMap = { educativo: 'educativo con ejemplos', motivacional: 'motivacional', entretenido: 'entretenido', profesional: 'profesional' };
  try {
    const raw = await callClaude(
      `Generá un guión completo para YouTube sobre: "${idea}"
Duración: ${durMap[duracion] || durMap.medio}. Tono: ${tonMap[tono] || 'educativo'}. ${musicaMood ? 'Música: ' + musicaMood : ''}

Devolvé ÚNICAMENTE este JSON:
{"titulo":"string max 60 chars","descripcion":"string 1 oracion","duracion":"X:XX","escenas":[{"tipo":"intro","label":"Introducción","narracion":"2-3 oraciones, empieza con pregunta o dato impactante","promptImagen":"prompt en ingles estilo fotografico"},{"tipo":"scene","label":"Escena 1: nombre","narracion":"texto, termina con gancho","promptImagen":"prompt ingles"},{"tipo":"scene","label":"Escena 2: nombre","narracion":"texto, termina con gancho","promptImagen":"prompt ingles"},{"tipo":"scene","label":"Escena 3: nombre","narracion":"texto","promptImagen":"prompt ingles"},{"tipo":"cta","label":"Cierre","narracion":"cierre motivador y pedido de suscripcion","promptImagen":"prompt ingles"}]}`,
      'Sos un experto en contenido viral para YouTube en español latino. Respondé SOLO con JSON válido sin backticks.',
      2000
    );
    const data = JSON.parse(raw.replace(/```json|```/g, '').trim());
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Generate full video — SSE stream for progress updates
app.post('/api/generate-video', async (req, res) => {
  const { guion, musicQuery, jobId: clientJobId } = req.body;
  if (!guion || !guion.escenas) return res.status(400).json({ error: 'Falta el guión' });

  const jobId = clientJobId || uuidv4();
  const jobDir = path.join(TMP, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  const escenas = guion.escenas || [];
  const tmpFiles = [];

  try {
    // 1. Generate images
    const imagePaths = [];
    for (let i = 0; i < escenas.length; i++) {
      send('progress', { step: 'imagen', current: i + 1, total: escenas.length, pct: Math.round(((i + 1) / escenas.length) * 30), msg: `Generando imagen ${i + 1} de ${escenas.length}...` });
      const imgPath = path.join(jobDir, `img_${i}.png`);
      await generateImage(escenas[i].promptImagen || 'cinematic landscape', imgPath);
      imagePaths.push(imgPath);
      tmpFiles.push(imgPath);
    }

    // 2. Generate voice per scene
    send('progress', { step: 'voz', pct: 35, msg: 'Generando voz en off...' });
    const audioPaths = [];
    for (let i = 0; i < escenas.length; i++) {
      send('progress', { step: 'voz', current: i + 1, total: escenas.length, pct: 35 + Math.round(((i + 1) / escenas.length) * 25), msg: `Sintetizando voz escena ${i + 1}...` });
      const audioPath = path.join(jobDir, `audio_${i}.mp3`);
      await generateVoice(escenas[i].narracion || '', audioPath);
      audioPaths.push(audioPath);
      tmpFiles.push(audioPath);
    }

    // 3. Get music
    send('progress', { step: 'musica', pct: 62, msg: 'Descargando música de fondo...' });
    const musicPath = path.join(jobDir, 'music.mp3');
    const hasMusic = await getMusic(musicQuery || 'background music motivational', musicPath);
    if (hasMusic) tmpFiles.push(musicPath);

    // 4. Assemble video
    send('progress', { step: 'ensamblado', pct: 70, msg: 'Ensamblando video con FFmpeg...' });
    const outputPath = path.join(OUT, `video_${jobId}.mp4`);
    const scenesWithPaths = escenas.map((e, i) => ({ ...e, imagePath: imagePaths[i] }));
    await assembleVideo(scenesWithPaths, audioPaths, musicPath, hasMusic, outputPath);

    // 5. Done
    send('progress', { step: 'done', pct: 100, msg: '¡Video listo!' });
    send('done', { url: `/api/download/${jobId}`, filename: `${(guion.titulo || 'video').replace(/[^a-z0-9]/gi, '_')}.mp4` });

    // Cleanup tmp
    cleanup(tmpFiles);
    try { fs.rmdirSync(jobDir); } catch {}

  } catch (e) {
    send('error', { msg: e.message });
    cleanup(tmpFiles);
    try { fs.rmdirSync(jobDir, { recursive: true }); } catch {}
  } finally {
    res.end();
  }
});

// Download generated video
app.get('/api/download/:jobId', (req, res) => {
  const file = path.join(OUT, `video_${req.params.jobId}.mp4`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Video no encontrado' });
  res.download(file, 'video_youtube.mp4', () => {
    try { fs.unlinkSync(file); } catch {}
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AI Video Studio corriendo en puerto ${PORT}`));
