import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Public, read-only feed for external integrations (Telegram bot "BASE Buddy").
// Returns the Listen Live URL, the current now-playing track, and the live queue.
// No auth required — it serves the same public data as the /radio page.

const LISTEN_URL = 'https://basestation.live/radio';

const CHANNELS = [
  'Hip Hop & Trap', 'EDM', 'House', 'Soul/R&B', 'Lo-Fi',
  'Pop', 'Cinematic', 'Rock', 'Jazz',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Accept params via JSON body (POST) or query string (GET)
    let genre = null, limit = 10;
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      genre = body.genre || null;
      limit = Math.min(Number(body.limit) || 10, 25);
    } else {
      const url = new URL(req.url);
      genre = url.searchParams.get('genre') || null;
      limit = Math.min(Number(url.searchParams.get('limit')) || 10, 25);
    }

    // Reuse the existing radio queue builder (same queue the web player uses)
    const res = await base44.asServiceRole.functions.invoke('radioQueue', { genre, limit });
    const queue = (res?.data?.queue || []).map((t) => ({
      title: t.track_title,
      artist: t.artist_name,
      genre: t.genre || '',
      source: t.source,
      duration_seconds: t.duration_seconds || 0,
      cover_image_url: t.cover_image_url || '',
      ai_label: t.ai_label || null,
    }));

    const nowPlaying = queue[0] || null;

    return Response.json({
      station: 'BASE Station Radio',
      listen_url: LISTEN_URL + (genre ? `?channel=${encodeURIComponent(genre)}` : ''),
      channel: genre || 'Discover',
      channels: CHANNELS,
      now_playing: nowPlaying,
      // Telegram-ready one-liner the bot can post directly
      now_playing_text: nowPlaying
        ? `🎵 Now on BASE Station Radio: "${nowPlaying.title}" by ${nowPlaying.artist} — tune in: ${LISTEN_URL}`
        : `📻 BASE Station Radio is live — tune in: ${LISTEN_URL}`,
      queue,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});