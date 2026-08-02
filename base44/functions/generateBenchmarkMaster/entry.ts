import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { startHarmonix, getHarmonixPrediction, extractAudioUrl, resolveTier } from '../../shared/harmonix.ts';

// Admin-only: generate a CLEAN, UNMARKED PCM master for forensic benchmarking.
//
// Deliberately separate from generateMusicHarmonix rather than a flag on it.
// The vault tier embeds the V1 spectral mark inline at generation time, which
// is exactly right for production and exactly wrong here: a benchmark master
// that already carries V1 measures the CASCADE, not the layer under test. Runs
// 1 and 2 were standalone V4 on unmarked audio, so a third run has to start
// from unmarked audio too or it is not comparable to them.
//
// No credits are charged and no GenerationJob/UserAsset is written — this
// output is test material, not a creative work, and should not appear in
// anyone's library or provenance chain.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'start';

    if (action === 'start') {
      const tier = resolveTier(body.tier || 'pro');
      const pred = await startHarmonix({
        prompt: String(body.prompt || '').slice(0, 1000),
        lyrics: '[Instrumental]',
        duration: Math.min(Math.max(Number(body.duration) || 90, 30), tier.max_duration),
        inference_steps: tier.inference_steps,
        seed: Number.isInteger(body.seed) ? body.seed : -1,
        batch_size: 1,
        // The whole point: PCM, so the file reaching audiowmark has never been
        // through a lossy codec.
        audio_format: 'wav',
      });

      if (pred.status === 'succeeded') {
        const url = extractAudioUrl(pred.output);
        if (!url) return Response.json({ error: 'Harmonix returned no audio' }, { status: 502 });
        const r = await fetch(url);
        const file = new File([await r.arrayBuffer()], 'benchmark-master.wav', { type: 'audio/wav' });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        return Response.json({ status: 'succeeded', master_url: file_url });
      }
      return Response.json({ status: pred.status, prediction_id: pred.id });
    }

    if (action === 'poll') {
      const p = await getHarmonixPrediction(body.prediction_id);
      if (p.status === 'starting' || p.status === 'processing') return Response.json({ status: p.status });
      if (p.status !== 'succeeded') return Response.json({ status: p.status, error: p.error || null });
      const url = extractAudioUrl(p.output);
      if (!url) return Response.json({ error: 'Harmonix returned no audio' }, { status: 502 });
      const r = await fetch(url);
      const file = new File([await r.arrayBuffer()], 'benchmark-master.wav', { type: 'audio/wav' });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      return Response.json({ status: 'succeeded', master_url: file_url });
    }

    return Response.json({ error: 'action must be start or poll' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});