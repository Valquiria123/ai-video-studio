# AI Video Studio

Genera videos MP4 completos listos para YouTube desde una idea de texto.

## Stack
- **Backend**: Node.js + Express + FFmpeg
- **IA guión**: Claude (Anthropic)
- **Imágenes**: Replicate (Stable Diffusion XL)
- **Voz**: ElevenLabs Multilingual v2
- **Música**: Pixabay Music API (gratis)
- **Ensamblado**: fluent-ffmpeg

## Deploy en Railway (paso a paso)

1. Subí esta carpeta a un repo de GitHub
2. Entrá a railway.app → New Project → Deploy from GitHub
3. Seleccioná tu repo
4. En Variables de entorno agregá:
   - CLAUDE_API_KEY
   - ELEVENLABS_API_KEY
   - ELEVENLABS_VOICE_ID
   - REPLICATE_API_TOKEN
   - PIXABAY_API_KEY
5. Railway detecta nixpacks.toml e instala FFmpeg automáticamente
6. Tu app queda en: https://tu-app.railway.app

## Costo estimado por video
- Claude: ~$0.04
- ElevenLabs: ~$0.18
- Replicate: ~$0.05
- Música: $0
- **Total: ~$0.27/video**
