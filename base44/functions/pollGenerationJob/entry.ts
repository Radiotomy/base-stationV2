import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Both aimusicapi.ai providers (Sonic, Producer) share one API key.
// We only require SONIC_API_KEY to be set — it's used as the bearer token for both endpoints.
// Note: Nuro has been deprecated by aimusicapi.ai. Any legacy in-flight Nuro jobs fail gracefully.
const AIMUSICAPI_KEY    = Deno.env.get('SONIC_API_KEY');
const SONIC_API_KEY     = AIMUSICAPI_KEY;
const PRODUCER_API_KEY  = AIMUSICAPI_KEY;
const LTX_API_KEY       = Deno.env.get('LTX_API_KEY');
const TEMPCOLOR_API_KEY = Deno.env.get('TEMPCOLOR_API_KEY');

const AI_BASE = 'https://api.aimusicapi.ai/api/v1';

// Copy an external provider URL into Base44 storage so files persist
// (provider CDN links expire and block CORS). Falls back to original URL.
async function persistUrl(base44, url, filename) {
  try {
    if (!url || /base44/i.test(url)) return url;
    const r = await fetch(url);
    if (!r.ok) return url;
    const blob = await r.blob();
    const safeName = (filename || 'file').replace(/[^\w.\-]/g, '_');
    const file = new File([blob], safeName, { type: blob.type || 'application/octet-stream' });
    const up = await base44.integrations.Core.UploadFile({ file });
    return up?.file_url || url;
  } catch {
    return url;
  }
}

/**
 * Poll the provider's status endpoint for a given task_id.
 * Returns normalized: { status: 'completed'|'processing'|'failed', audio_url?, video_url?, error? }
 */
async function pollProvider(provider, providerTaskId, job) {
  let url, headers, res, data;

  if (provider === 'sonic') {
    // Docs: GET /api/v1/sonic/task/{task_id}
    // Response: { code: 200, data: [ { clip_id, state: "pending"|"running"|"succeeded"|"failed", audio_url, image_url, ... } ], message }
    url = `${AI_BASE}/sonic/task/${providerTaskId}`;
    headers = { 'Authorization': `Bearer ${SONIC_API_KEY}` };
    res = await fetch(url, { headers });
    data = await res.json();
    console.log('Sonic poll response:', JSON.stringify(data));

    const clipsArr = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
    const clip = clipsArr[0];

    if (!clip || res.status === 404 || data?.code === 404) {
      console.log('Sonic: task not found, attempting recovery via feed...');
      const feedRes = await fetch(`${AI_BASE}/sonic/feed?page_size=20`, { headers: { 'Authorization': `Bearer ${SONIC_API_KEY}` } });
      const feedData = await feedRes.json();
      const feedItems = Array.isArray(feedData?.data) ? feedData.data : [];
      const jobCreatedAt = job.started_at ? new Date(job.started_at).getTime() : Date.now();
      const recovered = feedItems.find(item => {
        if (item.state !== 'succeeded' || !item.audio_url) return false;
        const t = item.created_at ? new Date(item.created_at).getTime() : 0;
        return Math.abs(t - jobCreatedAt) < 10 * 60 * 1000;
      });
      if (recovered) {
        console.log('Sonic: recovered via feed:', recovered.clip_id);
        return { status: 'completed', audio_url: recovered.audio_url, cover_image_url: recovered.image_url };
      }
    }

    // Sonic returns 2 clips — wait until ALL non-failed clips have settled (succeeded or failed)
    // A clip is "settled" if its state is succeeded or failed (not pending/running)
    const settledClips  = clipsArr.filter(c => c.state === 'succeeded' || c.state === 'failed');
    const succeededClips = clipsArr.filter(c => c.state === 'succeeded' && c.audio_url);
    const allSettled    = clipsArr.length > 0 && settledClips.length === clipsArr.length;
    const anySucceeded  = succeededClips.length > 0;

    console.log(`Sonic clips: total=${clipsArr.length} settled=${settledClips.length} succeeded=${succeededClips.length}`);

    if (allSettled && anySucceeded) {
      const primary = succeededClips[0];
      const allAudioUrls = succeededClips.map(c => c.audio_url);
      // Sonic returns: title, tags, lyrics, image_url, audio_url, video_url, mv, duration, clip_id
      return {
        status: 'completed',
        audio_url: allAudioUrls[0],
        audio_urls: allAudioUrls,
        cover_image_url: primary?.image_url,
        cover_image_urls: succeededClips.map(c => c.image_url).filter(Boolean),
        video_urls: succeededClips.map(c => c.video_url).filter(Boolean),
        lyrics: primary?.lyrics || '',
        title: primary?.title || '',
        tags: primary?.tags || '',
        duration: primary?.duration ? Number(primary.duration) : undefined,
        model_version: primary?.mv,
        clip_id: primary?.clip_id,
        clip_ids: succeededClips.map(c => c.clip_id).filter(Boolean),
      };
    }
    if (allSettled && !anySucceeded) {
      return { status: 'failed', error: clip?.error_message || 'Sonic generation failed' };
    }
    return { status: 'processing' };
  }

  if (provider === 'nuro') {
    // Nuro deprecated by aimusicapi.ai — endpoint returns HTTP 410 Gone.
    // Any legacy in-flight jobs fail with a helpful message.
    return { status: 'failed', error: 'Nuro has been deprecated. Please regenerate using Sonic or Producer.' };
  }

  if (provider === 'producer') {
    // Docs: GET /api/v1/producer/task/{task_id}
    // Response: { code, status: "PENDING"|"RUNNING"|"SUCCESS"|"FAILED", message, type?: "failed"|"timeout", data: [...] }
    // data[] is EMPTY while PENDING/RUNNING — only populated on SUCCESS
    // Per-clip shape: { clip_id, title, sound, lyrics, audio_url (m4a), wav_url, image_url,
    //                   video_url, duration, mv, seed, state: "pending"|"running"|"succeeded"|"failed", created_at }
    // On FAILED: credits are auto-refunded by the provider — message indicates refund status.
    url = `${AI_BASE}/producer/task/${providerTaskId}`;
    headers = { 'Authorization': `Bearer ${PRODUCER_API_KEY}` };
    res = await fetch(url, { headers });
    data = await res.json();
    console.log('Producer poll response:', JSON.stringify(data));
    const state = data?.status || '';

    if (res.status === 404) {
      console.log('Producer: task not found (404)');
      return { status: 'failed', error: 'Producer task not found. Please regenerate.' };
    }

    if (state === 'SUCCESS') {
      const clip = Array.isArray(data?.data) && data.data.length > 0 ? data.data[0] : null;
      if (!clip?.audio_url) return { status: 'processing' }; // data array not yet populated
      // Producer returns: clip_id, audio_url, wav_url, image_url, video_url, title, lyrics, sound, duration, mv, seed, state, created_at
      return {
        status: 'completed',
        audio_url: clip.audio_url,
        cover_image_url: clip.image_url,
        wav_url: clip.wav_url,
        video_url: clip.video_url || null,
        lyrics: clip.lyrics || clip.lyric || '',
        title: clip.title || '',
        tags: clip.tags || clip.sound || '',
        duration: clip.duration,
        model_version: clip.mv || null,
        clip_id: clip.clip_id || null,
        seed: clip.seed || null,
      };
    }
    if (state === 'FAILED') {
      // Spec: data.type === "timeout" or "failed"; credits auto-refunded by provider
      const reason = data?.type === 'timeout' ? 'timed out on the provider' : 'failed';
      return { status: 'failed', error: data.message || `Producer generation ${reason}` };
    }
    // PENDING or RUNNING — keep polling
    return { status: 'processing' };
  }

  // Loudly provider has been discontinued — any legacy jobs flagged with it will fail gracefully
  if (provider === 'loudly') {
    return { status: 'failed', error: 'Loudly has been discontinued. Please regenerate using Sonic, Nuro, Tempolor, or Producer.' };
  }

  if (provider === 'ltx') {
    url = `https://api.ltx.video/v1/tasks/${providerTaskId}`;
    headers = { 'Authorization': `Bearer ${LTX_API_KEY}` };
    res = await fetch(url, { headers });
    data = await res.json();
    const state = data?.status || data?.state || '';

    // Recovery: task not found — list recent LTX tasks
    if (!state || data?.error?.includes('not found') || res.status === 404) {
      console.log('LTX: task not found, attempting recovery via list...');
      const listRes = await fetch('https://api.ltx.video/v1/tasks?limit=20', { headers: { 'Authorization': `Bearer ${LTX_API_KEY}` } });
      const listData = await listRes.json();
      const listItems = listData?.tasks || listData?.data || listData || [];
      const jobCreatedAt = job.started_at ? new Date(job.started_at).getTime() : Date.now();
      const recovered = (Array.isArray(listItems) ? listItems : []).find(item => {
        if (!item.video_url && !item.url) return false;
        const t = item.created_at ? new Date(item.created_at).getTime() : 0;
        return Math.abs(t - jobCreatedAt) < 10 * 60 * 1000;
      });
      if (recovered) {
        console.log('LTX: recovered via list:', recovered.id);
        return { status: 'completed', video_url: recovered.video_url || recovered.url };
      }
    }

    if (state === 'completed' || state === 'succeeded' || data?.video_url) {
      return { status: 'completed', video_url: data.video_url || data.url };
    }
    if (state === 'failed' || state === 'error') return { status: 'failed', error: data.error || 'LTX failed' };
    return { status: 'processing' };
  }

  if (provider === 'tempcolor') {
    // Detect UUID-format IDs (old jobs that stored request_id instead of item_id)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(providerTaskId);

    const queryByItemIds = async (type, ids) => {
      const r = await fetch(`https://api.tempolor.com/open-apis/v1/${type}/query`, {
        method: 'POST',
        headers: { 'Authorization': TEMPCOLOR_API_KEY, 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ item_ids: ids }),
      });
      return r.json();
    };

    // For UUID-format (old request_id), try listing recent items to recover
    if (isUUID) {
      console.log('Tempolor: UUID-format provider_job_id detected, attempting recovery via list...');
      // Try to list recent songs/instrumentals and find one that matches our job timeframe
      // Tempolor list endpoint: GET /open-apis/v1/song/list or /instrumental/list
      const tryList = async (type) => {
        const r = await fetch(`https://api.tempolor.com/open-apis/v1/${type}/list?page=1&page_size=20`, {
          headers: { 'Authorization': TEMPCOLOR_API_KEY },
        });
        return r.json();
      };
      const [songList, instrList] = await Promise.all([tryList('song'), tryList('instrumental')]);
      console.log('Tempolor song list:', JSON.stringify(songList?.data?.total), 'instr list:', JSON.stringify(instrList?.data?.total));

      // Look for items that are completed and match the job's creation time (within 5 mins)
      const allItems = [
        ...(songList?.data?.songs || songList?.data?.items || []),
        ...(instrList?.data?.instrumentals || instrList?.data?.items || []),
      ];
      // Find completed item closest to job creation time
      const jobCreatedAt = job.started_at ? new Date(job.started_at).getTime() : Date.now();
      const recovered = allItems.find(item => {
        if (!item.audio_url) return false;
        const itemTime = item.created_at ? new Date(item.created_at).getTime() : 0;
        return Math.abs(itemTime - jobCreatedAt) < 5 * 60 * 1000; // within 5 minutes
      });

      if (recovered) {
        console.log('Tempolor: recovered item via list:', recovered.id, recovered.audio_url);
        return { status: 'completed', audio_url: recovered.audio_hi_url || recovered.audio_url };
      }

      // Check if any recent item is still processing
      const processing = allItems.find(item => {
        if (item.audio_url) return false;
        const itemTime = item.created_at ? new Date(item.created_at).getTime() : 0;
        return Math.abs(itemTime - jobCreatedAt) < 5 * 60 * 1000;
      });
      if (processing) return { status: 'processing' };

      // Can't recover — too old or not found
      return { status: 'failed', error: 'Could not recover job — item ID was not stored correctly. Please regenerate.' };
    }

    // Normal path: query by item_id
    // Song query:         POST /open-apis/v1/song/query         { item_ids: [...] }
    // Instrumental query: POST /open-apis/v1/instrumental/query { item_ids: [...] }
    // Status values: running | main_succeeded | succeeded | part_failed | failed
    const [songData, instrData] = await Promise.all([
      queryByItemIds('song', [providerTaskId]),
      queryByItemIds('instrumental', [providerTaskId]),
    ]);

    const item =
      songData?.data?.songs?.[0] ||
      instrData?.data?.instrumentals?.[0];

    if (!item) return { status: 'processing' };

    const st = item.status || '';
    console.log('Tempolor item status:', st, '| audio_url:', item.audio_url, '| audio_hi_url:', item.audio_hi_url);

    if (st === 'failed' || st === 'part_failed') {
      return { status: 'failed', error: item.err_msg || 'Tempolor generation failed' };
    }
    // succeeded or main_succeeded both mean audio is ready
    // Tempolor item fields: audio_url, audio_hi_url, lyrics, lyrics_sections, title, duration, image_url, style, model
    if (st === 'succeeded' || st === 'main_succeeded' || item.audio_url) {
      // Normalize Tempolor's lyrics_sections (line-level) into our generic aligned_lyrics format
      // ({ word, start_s, end_s }) so editID3Tags can embed SYLT karaoke timing.
      const aligned = Array.isArray(item.lyrics_sections)
        ? item.lyrics_sections.map(s => ({ word: s.text || '', start_s: Number(s.start), end_s: Number(s.end) })).filter(s => Number.isFinite(s.start_s))
        : null;
      return {
        status: 'completed',
        audio_url: item.audio_url || item.audio_hi_url,
        wav_url: item.audio_hi_url || null,
        cover_image_url: item.image_url || item.cover_url || null,
        lyrics: item.lyrics || item.lyric || '',
        title: item.title || item.song_name || '',
        tags: item.style || '',
        duration: item.duration,
        model_version: item.model || null,
        aligned_lyrics: aligned,
      };
    }
    return { status: 'processing' };
  }

  return null; // unknown provider
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { job_id } = await req.json();
    if (!job_id) return Response.json({ error: 'Missing job_id' }, { status: 400 });

    const jobs = await base44.entities.GenerationJob.filter({ id: job_id });
    const job = jobs[0];
    if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });
    if (job.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Already settled
    if (job.status === 'completed') {
      const m = job.output_metadata || {};
      return Response.json({
        status: 'completed',
        audio_url: job.job_type === 'music' ? job.output_url : undefined,
        audio_urls: m.audio_urls || undefined,
        cover_image_url: m.cover_image_url || undefined,
        cover_image_urls: m.cover_image_urls || undefined,
        video_url: job.job_type === 'video' ? job.output_url : undefined,
        video_urls: m.video_urls || undefined,
        wav_url: m.wav_url || undefined,
        bpm: m.bpm,
        key: m.key,
        duration: m.duration,
        lyrics: m.lyrics || '',
        title: m.title || '',
        tags: m.tags || '',
        genre: m.genre,
        mood: m.mood,
        vocal_gender: m.vocal_gender || undefined,
        vocal_timbre: m.vocal_timbre || undefined,
        model_version: m.model_version || undefined,
        clip_id: m.clip_id || undefined,
        clip_ids: m.clip_ids || undefined,
        aligned_lyrics: m.aligned_lyrics || undefined,
        ai_label: job.ai_label || (job.job_type === 'music' ? 'ai_generated' : undefined),
      });
    }
    if (job.status === 'failed') {
      return Response.json({ status: 'failed', error_message: job.error_message });
    }

    // Poll provider
    if (job.provider_job_id) {
      let providerData = null;
      try { providerData = await pollProvider(job.provider, job.provider_job_id, job); } catch {}

      if (providerData?.status === 'completed') {
        // Persist all generated files to Base44 storage upon creation
        const baseName = (providerData.title || job.job_type || 'output').slice(0, 60);
        if (providerData.audio_urls?.length) {
          providerData.audio_urls = await Promise.all(
            providerData.audio_urls.map((u, i) => persistUrl(base44, u, `${baseName}_${i + 1}.mp3`))
          );
          providerData.audio_url = providerData.audio_urls[0];
        } else if (providerData.audio_url) {
          providerData.audio_url = await persistUrl(base44, providerData.audio_url, `${baseName}.mp3`);
        }
        if (providerData.video_url) providerData.video_url = await persistUrl(base44, providerData.video_url, `${baseName}.mp4`);
        if (providerData.wav_url) providerData.wav_url = await persistUrl(base44, providerData.wav_url, `${baseName}.wav`);
        if (providerData.cover_image_url) providerData.cover_image_url = await persistUrl(base44, providerData.cover_image_url, `${baseName}_cover.jpg`);

        const outputUrl = providerData.audio_url || providerData.video_url;
        const completedAt = new Date().toISOString();

        // ── Cover art fallback ────────────────────────────────────────────────
        // Sonic & Producer return image_url with each clip; Tempolor models
        // (v4.6/v3.5/Lyria/Mureka/MiniMax + instrumentals) usually don't.
        // Auto-generate album artwork so every completed track has a cover.
        if (job.job_type === 'music' && !providerData.cover_image_url) {
          try {
            const meta = job.input_data || {};
            const img = await base44.asServiceRole.integrations.Core.GenerateImage({
              prompt: `Album cover artwork for a ${meta.mood || 'modern'} ${meta.genre || ''} song titled "${providerData.title || meta.sound_prompt || 'Untitled'}". Professional music album cover, square composition, bold striking visual style true to the ${meta.genre || 'modern'} genre, no text or lettering.`,
            });
            if (img?.url) providerData.cover_image_url = img.url;
          } catch (e) { console.warn('Cover art fallback failed:', e.message); }
        }

        // Use cost stamped on input_data at generation start; fallback to defaults
        const stampedCost = job.input_data?.credit_cost;
        const cost = stampedCost ?? (job.job_type === 'video' ? Math.max(2, Math.round((job.input_data?.duration || 5) * 2)) : 10);

        // Merge provider-returned lyrics with user-provided lyrics (prefer user's if both exist).
        // This is critical: Sonic/Nuro/Tempolor can auto-generate lyrics when none were supplied
        // — we want those preserved for ID3 tagging and library metadata.
        const finalLyrics = (job.input_data?.lyrics && job.input_data.lyrics.trim().length > 0)
          ? job.input_data.lyrics
          : (providerData.lyrics || '');

        await base44.entities.GenerationJob.update(job.id, {
          status: 'completed',
          output_url: outputUrl,
          // RIAA GenAI label — stamp legacy music jobs created before labeling rollout
          ...(job.job_type === 'music' && { ai_label: job.ai_label || 'ai_generated' }),
          output_metadata: {
            bpm: providerData.bpm, key: providerData.key,
            duration: providerData.duration || job.input_data?.duration,
            cover_image_url: providerData.cover_image_url,
            audio_urls: providerData.audio_urls || null,
            cover_image_urls: providerData.cover_image_urls || null,
            video_urls: providerData.video_urls || null,
            wav_url: providerData.wav_url || null,
            lyrics: finalLyrics,
            title: job.input_data?.title || providerData.title || '',
            tags: providerData.tags || '',
            genre: providerData.genre || job.input_data?.genre,
            mood: providerData.mood || job.input_data?.mood,
            vocal_gender: providerData.vocal_gender || null,
            vocal_timbre: providerData.vocal_timbre || null,
            model_version: providerData.model_version || job.input_data?.model || null,
            clip_id: providerData.clip_id || null,
            clip_ids: providerData.clip_ids || null,
            aligned_lyrics: providerData.aligned_lyrics || null,
          },
          credits_used: cost,
          completed_at: completedAt,
        });

        // Deduct credits once per job. Guard: only if not already deducted (credits_used was 0 before).
        if (!job.credits_used || job.credits_used === 0) {
          try {
            const recs = await base44.asServiceRole.entities.UserCredit.filter({ user_id: job.user_id });
            let record = recs[0];
            if (!record) {
              record = await base44.asServiceRole.entities.UserCredit.create({
                user_id: job.user_id, user_email: job.user_email,
                balance: 0, lifetime_earned: 0, lifetime_spent: 0,
              });
            }
            const newBalance = (record.balance || 0) - cost;
            await base44.asServiceRole.entities.UserCredit.update(record.id, {
              balance: Math.max(0, newBalance),
              lifetime_spent: (record.lifetime_spent || 0) + cost,
              monthly_used: (record.monthly_used || 0) + cost,
            });
            await base44.asServiceRole.entities.CreditLog.create({
              user_id: job.user_id, user_email: job.user_email,
              transaction_type: 'generation',
              amount: -cost,
              balance_before: record.balance,
              balance_after: Math.max(0, newBalance),
              related_job_id: job.id, provider: job.provider,
              description: `${job.provider} ${job.job_type} generation`,
            });
          } catch (e) { console.warn('Credit deduction failed:', e.message); }
        }

        // Compute content hash for legal provenance
        const enc = new TextEncoder();
        const hashInput = `${job.user_id}|${job.provider}|${job.provider_job_id}|${outputUrl}|${completedAt}`;
        const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(hashInput));
        const contentHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

        // Determine model version from job input_data or provider defaults
        const modelVersionMap = {
          sonic: 'sonic-v4-5', producer: 'FUZZ-2.0',
          tempcolor: 'TemPolor v4.6', loudly: 'VEGA_2', ltx: 'ltx-video-v1',
        };
        const modelVersion = job.input_data?.model || modelVersionMap[job.provider] || job.provider;

        // Find and update the pending log created at generation start, or create a new one
        const existingLogs = await base44.asServiceRole.entities.APIUsageLog.filter({ job_id: job.id }).catch(() => []);
        const pendingLog = existingLogs.find(l => l.status === 'pending');

        const logPayload = {
          status: 'success',
          credits_used: cost,
          timestamp: completedAt,
          metadata: {
            model_version: modelVersion,
            input_parameters: job.input_data || {},
            output_details: {
              audio_url: job.job_type === 'music' ? outputUrl : undefined,
              video_url: job.job_type === 'video' ? outputUrl : undefined,
              audio_urls: providerData.audio_urls || null,
              cover_image_url: providerData.cover_image_url || null,
              bpm: providerData.bpm,
              key: providerData.key,
              duration: job.input_data?.duration,
            },
            provider_job_id: job.provider_job_id,
            base44_job_id: job.id,
            generated_timestamp: completedAt,
            content_hash: contentHash,
          },
        };

        if (pendingLog) {
          await base44.asServiceRole.entities.APIUsageLog.update(pendingLog.id, logPayload).catch(() => {});
        } else {
          await base44.asServiceRole.entities.APIUsageLog.create({
            user_id: job.user_id, user_email: job.user_email,
            provider: job.provider, task: `generate_${job.job_type}`,
            job_id: job.id,
            ...logPayload,
          }).catch(() => {});
        }

        return Response.json({
          status: 'completed',
          audio_url: job.job_type === 'music' ? outputUrl : undefined,
          audio_urls: providerData.audio_urls || undefined,
          cover_image_url: providerData.cover_image_url || undefined,
          cover_image_urls: providerData.cover_image_urls || undefined,
          video_url: job.job_type === 'video' ? outputUrl : undefined,
          video_urls: providerData.video_urls || undefined,
          wav_url: providerData.wav_url || undefined,
          bpm: providerData.bpm, key: providerData.key,
          duration: providerData.duration || job.input_data?.duration,
          lyrics: finalLyrics,
          title: job.input_data?.title || providerData.title || '',
          tags: providerData.tags || '',
          genre: providerData.genre || job.input_data?.genre,
          mood: providerData.mood || job.input_data?.mood,
          vocal_gender: providerData.vocal_gender || undefined,
          vocal_timbre: providerData.vocal_timbre || undefined,
          model_version: providerData.model_version || job.input_data?.model || undefined,
          clip_id: providerData.clip_id || undefined,
          clip_ids: providerData.clip_ids || undefined,
          aligned_lyrics: providerData.aligned_lyrics || undefined,
          ai_label: job.ai_label || (job.job_type === 'music' ? 'ai_generated' : undefined),
          content_hash: contentHash,
        });
      }

      if (providerData?.status === 'failed') {
        await base44.entities.GenerationJob.update(job.id, {
          status: 'failed', error_message: providerData.error,
        });
        return Response.json({ status: 'failed', error_message: providerData.error });
      }
    }

    return Response.json({ status: 'processing', job_id: job.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});