import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// All aimusicapi.ai providers share one API key
const API_KEY           = Deno.env.get('SONIC_API_KEY') || Deno.env.get('NURO_API_KEY') || Deno.env.get('PRODUCER_API_KEY');
const SONIC_API_KEY     = API_KEY;
const NURO_API_KEY      = API_KEY;
const PRODUCER_API_KEY  = API_KEY;
const LTX_API_KEY       = Deno.env.get('LTX_API_KEY');
const TEMPCOLOR_API_KEY = Deno.env.get('TEMPCOLOR_API_KEY');

const AI_BASE = 'https://api.aimusicapi.ai/api/v1';

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
    const state = clip?.state || '';

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

    if (state === 'succeeded') {
      // Sonic returns 2 clips per generation — expose all audio URLs
      const allAudioUrls = clipsArr.filter(c => c.state === 'succeeded' && c.audio_url).map(c => c.audio_url);
      return {
        status: 'completed',
        audio_url: allAudioUrls[0],
        audio_urls: allAudioUrls,
        cover_image_url: clip.image_url,
        cover_image_urls: clipsArr.map(c => c.image_url).filter(Boolean),
      };
    }
    if (state === 'failed') return { status: 'failed', error: clip.error_message || 'Sonic generation failed' };
    return { status: 'processing' };
  }

  if (provider === 'nuro') {
    // Docs: GET /api/v1/nuro/task/{task_id}
    // Response: { task_id, status: "pending"|"running"|"succeeded", progress(0-100), audio_url, ... }
    // Note: "error" is NOT a valid status value per the docs. Only pending/running/succeeded.
    url = `${AI_BASE}/nuro/task/${providerTaskId}`;
    headers = { 'Authorization': `Bearer ${NURO_API_KEY}` };
    res = await fetch(url, { headers });
    data = await res.json();
    console.log('Nuro poll response:', JSON.stringify(data));
    const state = data?.status || '';

    if (res.status === 404 || !data?.task_id) {
      console.log('Nuro: task not found, attempting recovery...');
      const histRes = await fetch(`${AI_BASE}/nuro/list?page_size=20`, { headers: { 'Authorization': `Bearer ${NURO_API_KEY}` } });
      const histData = await histRes.json();
      const histItems = Array.isArray(histData?.data) ? histData.data : [];
      const jobCreatedAt = job.started_at ? new Date(job.started_at).getTime() : Date.now();
      const recovered = histItems.find(item => {
        if (item.status !== 'succeeded' || !item.audio_url) return false;
        const t = item.created_at ? new Date(item.created_at).getTime() : 0;
        return Math.abs(t - jobCreatedAt) < 10 * 60 * 1000;
      });
      if (recovered) {
        console.log('Nuro: recovered via list:', recovered.task_id);
        return { status: 'completed', audio_url: recovered.audio_url };
      }
    }

    // Only "succeeded" signals completion per the official docs
    if (state === 'succeeded') {
      return { status: 'completed', audio_url: data.audio_url };
    }
    // No explicit "failed" status in Nuro docs — timeout after 10 mins
    const elapsed = Date.now() - (job.started_at ? new Date(job.started_at).getTime() : Date.now());
    if (elapsed > 10 * 60 * 1000) {
      return { status: 'failed', error: 'Nuro generation timed out. Please regenerate.' };
    }
    return { status: 'processing' };
  }

  if (provider === 'producer') {
    // Docs: GET /api/v1/producer/task/{task_id}
    // Response: { code: 200, status: "PENDING"|"RUNNING"|"SUCCESS"|"FAILED", data: [] }
    // data[] is EMPTY while PENDING/RUNNING — only populated on SUCCESS
    // Per-clip shape: { clip_id, audio_url (m4a), wav_url, image_url, state: "succeeded"|"failed", ... }
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
      return { status: 'completed', audio_url: clip.audio_url, cover_image_url: clip.image_url };
    }
    if (state === 'FAILED') return { status: 'failed', error: data.message || 'Producer generation failed' };
    // PENDING or RUNNING — keep polling
    return { status: 'processing' };
  }

  if (provider === 'loudly') {
    // Loudly AI songs are synchronous — the result (music_file_path) is returned immediately.
    // If a job somehow landed here, the output_url should already be set on the job.
    // As a fallback, try to fetch the song by ID from soundtracks.loudly.com/api/ai/songs/{id}
    const LOUDLY_KEY = Deno.env.get('LOUDLY_API_KEY');
    try {
      const songRes = await fetch(`https://soundtracks.loudly.com/api/ai/songs/${providerTaskId}`, {
        headers: { 'API-KEY': LOUDLY_KEY, 'Accept': 'application/json' },
      });
      const songData = await songRes.json();
      console.log('Loudly poll response:', JSON.stringify(songData));
      const audioUrl = songData?.music_file_path || songData?.audio_url;
      if (audioUrl) {
        return { status: 'completed', audio_url: audioUrl, bpm: songData.bpm, key: songData.key?.name || songData.key };
      }
      if (songData?.error || songRes.status === 404) {
        return { status: 'failed', error: songData?.error || 'Loudly song not found' };
      }
    } catch (e) {
      console.warn('Loudly poll error:', e.message);
    }
    // Loudly is synchronous — if it still has no result after 5 mins, fail it
    const elapsed = Date.now() - (job.started_at ? new Date(job.started_at).getTime() : Date.now());
    if (elapsed > 5 * 60 * 1000) {
      return { status: 'failed', error: 'Loudly generation timed out. Please regenerate.' };
    }
    return { status: 'processing' };
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
    if (st === 'succeeded' || st === 'main_succeeded' || item.audio_url) {
      return { status: 'completed', audio_url: item.audio_hi_url || item.audio_url };
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
      return Response.json({
        status: 'completed',
        audio_url: job.job_type === 'music' ? job.output_url : undefined,
        audio_urls: job.output_metadata?.audio_urls || undefined,
        cover_image_url: job.output_metadata?.cover_image_url || undefined,
        video_url: job.job_type === 'video' ? job.output_url : undefined,
        bpm: job.output_metadata?.bpm,
        key: job.output_metadata?.key,
        duration: job.output_metadata?.duration,
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
        const outputUrl = providerData.audio_url || providerData.video_url;
        await base44.entities.GenerationJob.update(job.id, {
          status: 'completed',
          output_url: outputUrl,
          output_metadata: {
            bpm: providerData.bpm, key: providerData.key,
            duration: job.input_data?.duration,
            cover_image_url: providerData.cover_image_url,
            audio_urls: providerData.audio_urls || null,
            cover_image_urls: providerData.cover_image_urls || null,
          },
          credits_used: 10,
          completed_at: new Date().toISOString(),
        });

        await base44.asServiceRole.entities.APIUsageLog.create({
          user_id: job.user_id, user_email: job.user_email,
          provider: job.provider, task: `generate_${job.job_type}`,
          credits_used: 10, status: 'success',
          timestamp: new Date().toISOString(), job_id: job.id,
        }).catch(() => {});

        return Response.json({
          status: 'completed',
          audio_url: job.job_type === 'music' ? outputUrl : undefined,
          audio_urls: providerData.audio_urls || undefined,
          cover_image_url: providerData.cover_image_url || undefined,
          cover_image_urls: providerData.cover_image_urls || undefined,
          video_url: job.job_type === 'video' ? outputUrl : undefined,
          bpm: providerData.bpm, key: providerData.key,
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