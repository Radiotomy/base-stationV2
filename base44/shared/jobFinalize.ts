import { finalizeMashupAsset } from './mashupFinalize.ts';
import { getHarmonixPrediction, extractAudioUrl } from './harmonix.ts';
import { getSoundForgePrediction, extractSoundForgeAudioUrl } from './soundForge.ts';

// Both aimusicapi.ai providers (Sonic, Producer) share one API key.
const AIMUSICAPI_KEY    = Deno.env.get('SONIC_API_KEY');
const SONIC_API_KEY     = AIMUSICAPI_KEY;
const PRODUCER_API_KEY  = AIMUSICAPI_KEY;
const LTX_API_KEY       = Deno.env.get('LTX_API_KEY');
const TEMPCOLOR_API_KEY = Deno.env.get('TEMPCOLOR_API_KEY');

const AI_BASE = 'https://api.aimusicapi.ai/api/v1';

// Providers return different containers (SoundForge/Harmonix can emit WAV,
// Sonic/Tempolor emit MP3). Naming every persisted file ".mp3" mislabels
// lossless masters and makes them look compressed to the BASE Mark cascade,
// so keep whatever extension the source URL actually carries.
function audioExt(url, fallback = 'mp3') {
  const m = /\.(wav|flac|mp3|m4a|ogg|opus)(?:\?|#|$)/i.exec(url || '');
  return m ? m[1].toLowerCase() : fallback;
}

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

// Sonic exposes a FREE synchronous WAV conversion (POST /sonic/wav) that until
// now was only called when a user manually clicked "Download WAV". Fetching it
// at finalize time instead means every Sonic track lands with a lossless master
// in wav_url — which is what the BASE Mark cascade embeds into. Without it,
// Sonic tracks are MP3-only and silently skip the V1 spectral layer.
async function fetchSonicWavUrl(clipId) {
  if (!clipId) return null;
  try {
    const res = await fetch(`${AI_BASE}/sonic/wav`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SONIC_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ clip_id: clipId }),
    });
    const data = await res.json();
    return res.ok ? (data?.data?.wav_url || null) : null;
  } catch {
    return null;
  }
}

/**
 * Poll the provider's status endpoint for a given task_id.
 * Returns normalized: { status: 'completed'|'processing'|'failed', audio_url?, video_url?, error? }
 */
export async function pollProvider(provider, providerTaskId, job) {
  let url, headers, res, data;

  if (provider === 'sonic') {
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

    const settledClips  = clipsArr.filter(c => c.state === 'succeeded' || c.state === 'failed');
    const succeededClips = clipsArr.filter(c => c.state === 'succeeded' && c.audio_url);
    const allSettled    = clipsArr.length > 0 && settledClips.length === clipsArr.length;
    const anySucceeded  = succeededClips.length > 0;

    console.log(`Sonic clips: total=${clipsArr.length} settled=${settledClips.length} succeeded=${succeededClips.length}`);

    if (allSettled && anySucceeded) {
      const primary = succeededClips[0];
      const allAudioUrls = succeededClips.map(c => c.audio_url);
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
    return { status: 'failed', error: 'Nuro has been deprecated. Please regenerate using Sonic or Producer.' };
  }

  if (provider === 'producer') {
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
      if (!clip?.audio_url) return { status: 'processing' };
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
      const reason = data?.type === 'timeout' ? 'timed out on the provider' : 'failed';
      return { status: 'failed', error: data.message || `Producer generation ${reason}` };
    }
    return { status: 'processing' };
  }

  if (provider === 'loudly') {
    return { status: 'failed', error: 'Loudly has been discontinued. Please regenerate using Sonic, Nuro, Tempolor, or Producer.' };
  }

  if (provider === 'ltx') {
    url = `https://api.ltx.video/v1/tasks/${providerTaskId}`;
    headers = { 'Authorization': `Bearer ${LTX_API_KEY}` };
    res = await fetch(url, { headers });
    data = await res.json();
    const state = data?.status || data?.state || '';

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
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(providerTaskId);

    const queryByItemIds = async (type, ids) => {
      const r = await fetch(`https://api.tempolor.com/open-apis/v1/${type}/query`, {
        method: 'POST',
        headers: { 'Authorization': TEMPCOLOR_API_KEY, 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ item_ids: ids }),
      });
      return r.json();
    };

    if (isUUID) {
      console.log('Tempolor: UUID-format provider_job_id detected, attempting recovery via list...');
      const tryList = async (type) => {
        const r = await fetch(`https://api.tempolor.com/open-apis/v1/${type}/list?page=1&page_size=20`, {
          headers: { 'Authorization': TEMPCOLOR_API_KEY },
        });
        return r.json();
      };
      const [songList, instrList] = await Promise.all([tryList('song'), tryList('instrumental')]);
      const allItems = [
        ...(songList?.data?.songs || songList?.data?.items || []),
        ...(instrList?.data?.instrumentals || instrList?.data?.items || []),
      ];
      const jobCreatedAt = job.started_at ? new Date(job.started_at).getTime() : Date.now();
      const recovered = allItems.find(item => {
        if (!item.audio_url) return false;
        const itemTime = item.created_at ? new Date(item.created_at).getTime() : 0;
        return Math.abs(itemTime - jobCreatedAt) < 5 * 60 * 1000;
      });

      if (recovered) {
        console.log('Tempolor: recovered item via list:', recovered.id, recovered.audio_url);
        return { status: 'completed', audio_url: recovered.audio_hi_url || recovered.audio_url };
      }

      const processing = allItems.find(item => {
        if (item.audio_url) return false;
        const itemTime = item.created_at ? new Date(item.created_at).getTime() : 0;
        return Math.abs(itemTime - jobCreatedAt) < 5 * 60 * 1000;
      });
      if (processing) return { status: 'processing' };

      return { status: 'failed', error: 'Could not recover job — item ID was not stored correctly. Please regenerate.' };
    }

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
    if (st === 'succeeded' || st === 'main_succeeded' || item.audio_url) {
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

  if (provider === 'harmonix') {
    const data = await getHarmonixPrediction(providerTaskId);
    if (data.status === 'succeeded') {
      const audioUrl = extractAudioUrl(data.output);
      if (!audioUrl) {
        // Replicate purges prediction output after a retention window; if we
        // land here it means the job wasn't polled again in time.
        return { status: 'failed', error: data.data_removed ? 'BASE-Harmonix output expired before it could be retrieved — please regenerate.' : 'BASE-Harmonix returned no audio output' };
      }
      return { status: 'completed', audio_url: audioUrl };
    }
    if (data.status === 'failed' || data.status === 'canceled') {
      return { status: 'failed', error: data.error || 'BASE-Harmonix generation failed' };
    }
    return { status: 'processing' };
  }

  if (provider === 'soundforge') {
    const data = await getSoundForgePrediction(providerTaskId);
    if (data.status === 'succeeded') {
      const audioUrl = extractSoundForgeAudioUrl(data.output);
      if (!audioUrl) {
        return { status: 'failed', error: data.data_removed ? 'BASE SoundForge output expired before it could be retrieved — please regenerate.' : 'BASE SoundForge returned no audio output' };
      }
      return { status: 'completed', audio_url: audioUrl, model_version: 'BASE SoundForge (ACE-Step v1.5)' };
    }
    if (data.status === 'failed' || data.status === 'canceled') {
      return { status: 'failed', error: data.error || 'BASE SoundForge generation failed' };
    }
    return { status: 'processing' };
  }

  return null; // unknown provider
}

// Polls the provider (if needed) and fully finalizes a GenerationJob: persists
// media, deducts credits, writes usage logs, and updates the job record.
// `base44` may be a user-scoped client or `base44.asServiceRole` — both expose
// the same entities/integrations surface. Safe to call repeatedly/idempotently.
export async function finalizeJob(base44, job) {
  if (job.status === 'completed') {
    const m = job.output_metadata || {};
    return {
      status: 'completed',
      audio_url: job.job_type === 'music' || job.job_type === 'loop' ? job.output_url : undefined,
      audio_urls: m.audio_urls || undefined,
      cover_image_url: m.cover_image_url || undefined,
      cover_image_urls: m.cover_image_urls || undefined,
      video_url: job.job_type === 'video' ? job.output_url : undefined,
      video_urls: m.video_urls || undefined,
      wav_url: m.wav_url || undefined,
      bpm: m.bpm, key: m.key, duration: m.duration,
      lyrics: m.lyrics || '', title: m.title || '', tags: m.tags || '',
      genre: m.genre, mood: m.mood,
      vocal_gender: m.vocal_gender || undefined,
      vocal_timbre: m.vocal_timbre || undefined,
      model_version: m.model_version || undefined,
      clip_id: m.clip_id || undefined,
      clip_ids: m.clip_ids || undefined,
      aligned_lyrics: m.aligned_lyrics || undefined,
      ai_label: job.ai_label || (job.job_type === 'music' ? 'ai_generated' : undefined),
      mashup_asset_id: m.mashup_asset_id || undefined,
      tier: job.input_data?.tier || undefined,
      needs_basemark: m.needs_basemark || undefined,
    };
  }
  if (job.status === 'failed') {
    return { status: 'failed', error_message: job.error_message };
  }
  if (!job.provider_job_id) {
    return { status: 'processing', job_id: job.id };
  }

  let providerData = null;
  try { providerData = await pollProvider(job.provider, job.provider_job_id, job); } catch {}

  if (providerData?.status === 'completed') {
    const baseName = (providerData.title || job.job_type || 'output').slice(0, 60);
    if (providerData.audio_urls?.length) {
      providerData.audio_urls = await Promise.all(
        providerData.audio_urls.map((u, i) => persistUrl(base44, u, `${baseName}_${i + 1}.${audioExt(u)}`))
      );
      providerData.audio_url = providerData.audio_urls[0];
    } else if (providerData.audio_url) {
      providerData.audio_url = await persistUrl(base44, providerData.audio_url, `${baseName}.${audioExt(providerData.audio_url)}`);
    }
    if (providerData.video_url) providerData.video_url = await persistUrl(base44, providerData.video_url, `${baseName}.mp4`);
    // Sonic: pull the free lossless WAV so the watermark cascade gets PCM, not MP3.
    if (job.provider === 'sonic' && !providerData.wav_url && providerData.clip_id) {
      providerData.wav_url = await fetchSonicWavUrl(providerData.clip_id);
    }
    if (providerData.wav_url) providerData.wav_url = await persistUrl(base44, providerData.wav_url, `${baseName}.wav`);
    if (providerData.cover_image_url) providerData.cover_image_url = await persistUrl(base44, providerData.cover_image_url, `${baseName}_cover.jpg`);

    const outputUrl = providerData.audio_url || providerData.video_url;
    const completedAt = new Date().toISOString();

    if (job.job_type === 'music' && !providerData.cover_image_url) {
      try {
        const meta = job.input_data || {};
        const img = await base44.asServiceRole.integrations.Core.GenerateImage({
          prompt: `Album cover artwork for a ${meta.mood || 'modern'} ${meta.genre || ''} song titled "${providerData.title || meta.sound_prompt || 'Untitled'}". Professional music album cover, square composition, bold striking visual style true to the ${meta.genre || 'modern'} genre, no text or lettering.`,
        });
        if (img?.url) providerData.cover_image_url = img.url;
      } catch (e) { console.warn('Cover art fallback failed:', e.message); }
    }

    const stampedCost = job.input_data?.credit_cost;
    const cost = stampedCost ?? (job.job_type === 'video' ? Math.max(2, Math.round((job.input_data?.duration || 5) * 2)) : 10);

    const finalLyrics = (job.input_data?.lyrics && job.input_data.lyrics.trim().length > 0)
      ? job.input_data.lyrics
      : (providerData.lyrics || '');

    await base44.entities.GenerationJob.update(job.id, {
      status: 'completed',
      output_url: outputUrl,
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
        ...(job.provider === 'harmonix' && { needs_basemark: job.input_data?.tier === 'vault' }),
      },
      credits_used: cost,
      completed_at: completedAt,
    });

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

    const enc = new TextEncoder();
    const hashInput = `${job.user_id}|${job.provider}|${job.provider_job_id}|${outputUrl}|${completedAt}`;
    const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(hashInput));
    const contentHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    const modelVersionMap = {
      sonic: 'sonic-v4-5', producer: 'FUZZ-2.0',
      tempcolor: 'TemPolor v4.6', loudly: 'VEGA_2', ltx: 'ltx-video-v1',
    };
    const modelVersion = job.input_data?.model || modelVersionMap[job.provider] || job.provider;

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
          bpm: providerData.bpm, key: providerData.key,
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

    let mashupAssetId = undefined;
    if (job.input_data?.task_kind === 'mashup') {
      const asset = await finalizeMashupAsset(base44, job.id);
      mashupAssetId = asset?.id || undefined;
    }

    return {
      status: 'completed',
      audio_url: job.job_type === 'music' || job.job_type === 'loop' ? outputUrl : undefined,
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
      mashup_asset_id: mashupAssetId,
      tier: job.input_data?.tier || undefined,
      needs_basemark: (job.provider === 'harmonix' && job.input_data?.tier === 'vault') || undefined,
    };
  }

  if (providerData?.status === 'failed') {
    await base44.entities.GenerationJob.update(job.id, {
      status: 'failed', error_message: providerData.error,
    });
    return { status: 'failed', error_message: providerData.error };
  }

  return { status: 'processing', job_id: job.id };
}