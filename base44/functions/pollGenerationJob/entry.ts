import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SONIC_API_KEY     = Deno.env.get('SONIC_API_KEY');
const NURO_API_KEY      = Deno.env.get('NURO_API_KEY');
const PRODUCER_API_KEY  = Deno.env.get('PRODUCER_API_KEY');
const LTX_API_KEY       = Deno.env.get('LTX_API_KEY');
const TEMPCOLOR_API_KEY = Deno.env.get('TEMPCOLOR_API_KEY');

const AI_BASE = 'https://api.aimusicapi.ai/api/v1';

/**
 * Poll the provider's status endpoint for a given task_id.
 * Returns normalized: { status: 'completed'|'processing'|'failed', audio_url?, video_url?, error? }
 */
async function pollProvider(provider, providerTaskId) {
  let url, headers, res, data;

  if (provider === 'sonic') {
    url = `${AI_BASE}/sonic/task/${providerTaskId}`;
    headers = { 'Authorization': `Bearer ${SONIC_API_KEY}` };
    res = await fetch(url, { headers });
    data = await res.json();
    // Sonic returns array of clip objects
    const clip = Array.isArray(data) ? data[0] : data?.clips?.[0] || data;
    const state = clip?.status || clip?.state || '';
    if (state === 'succeeded' || state === 'complete' || clip?.audio_url) {
      return { status: 'completed', audio_url: clip.audio_url || clip.url };
    }
    if (state === 'error' || state === 'failed') return { status: 'failed', error: clip.error_message || 'Sonic failed' };
    return { status: 'processing' };
  }

  if (provider === 'nuro') {
    url = `${AI_BASE}/nuro/task/${providerTaskId}`;
    headers = { 'Authorization': `Bearer ${NURO_API_KEY}` };
    res = await fetch(url, { headers });
    data = await res.json();
    const state = data?.status || data?.state || '';
    if (state === 'completed' || state === 'succeeded' || data?.audio_url) {
      return { status: 'completed', audio_url: data.audio_url || data.url };
    }
    if (state === 'failed' || state === 'error') return { status: 'failed', error: data.error || 'Nuro failed' };
    return { status: 'processing' };
  }

  if (provider === 'producer') {
    url = `${AI_BASE}/producer/task/${providerTaskId}`;
    headers = { 'Authorization': `Bearer ${PRODUCER_API_KEY}` };
    res = await fetch(url, { headers });
    data = await res.json();
    const state = data?.status || data?.state || '';
    if (state === 'completed' || state === 'succeeded' || data?.audio_url) {
      return { status: 'completed', audio_url: data.audio_url || data.url, cover_image_url: data.image_url };
    }
    if (state === 'failed' || state === 'error') return { status: 'failed', error: data.error || 'Producer failed' };
    return { status: 'processing' };
  }

  if (provider === 'ltx') {
    url = `https://api.ltx.video/v1/tasks/${providerTaskId}`;
    headers = { 'Authorization': `Bearer ${LTX_API_KEY}` };
    res = await fetch(url, { headers });
    data = await res.json();
    const state = data?.status || data?.state || '';
    if (state === 'completed' || state === 'succeeded' || data?.video_url) {
      return { status: 'completed', video_url: data.video_url || data.url };
    }
    if (state === 'failed' || state === 'error') return { status: 'failed', error: data.error || 'LTX failed' };
    return { status: 'processing' };
  }

  if (provider === 'tempcolor') {
    // Determine if song or instrumental by checking what the job stored
    // Try song query first, then instrumental
    const tryQuery = async (endpoint) => {
      const r = await fetch(`https://api.tempolor.com/open-apis/v1/${endpoint}/query`, {
        method: 'POST',
        headers: { 'Authorization': TEMPCOLOR_API_KEY, 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ item_ids: [providerTaskId] }),
      });
      return r.json();
    };

    // Try song query, fall back to instrumental
    let qdata = await tryQuery('song');
    let items = qdata?.data?.songs || qdata?.data?.items || [];
    if (!items.length) {
      qdata = await tryQuery('instrumental');
      items = qdata?.data?.instrumentals || qdata?.data?.items || qdata?.data?.songs || [];
    }

    const item = items[0];
    if (!item) return { status: 'processing' };

    const itemStatus = item.status || '';
    if (itemStatus === 'succeeded' || item.audio_url || item.audio_hi_url) {
      return { status: 'completed', audio_url: item.audio_hi_url || item.audio_url };
    }
    if (itemStatus === 'failed' || itemStatus === 'error') {
      return { status: 'failed', error: item.event || 'Tempolor generation failed' };
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
      try { providerData = await pollProvider(job.provider, job.provider_job_id); } catch {}

      if (providerData?.status === 'completed') {
        const outputUrl = providerData.audio_url || providerData.video_url;
        await base44.entities.GenerationJob.update(job.id, {
          status: 'completed',
          output_url: outputUrl,
          output_metadata: {
            bpm: providerData.bpm, key: providerData.key,
            duration: job.input_data?.duration,
            cover_image_url: providerData.cover_image_url,
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