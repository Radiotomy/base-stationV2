import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

// Builds a null-corpus candidate list from Freesound CC0 material — outside,
// human-produced recordings, which is the population a real /verify scan will
// actually see. Kept separate from searchFreesoundSounds because that function
// serves the loop library: it filters to 0.1–30s and returns fields a creator
// cares about. A null corpus needs the opposite (long, license-restricted to
// CC0, duration-gated), and conflating the two would make both worse.
//
// CC0 only, deliberately. These clips back a published false-positive figure,
// so they have to be quotable without attribution obligations we would then
// have to honour in the paper.
//
// IMPORTANT — fidelity ceiling. Freesound's token auth only exposes LOSSY MP3
// previews; original lossless files require an OAuth2 user flow we have not
// set up. So this path yields human-produced-but-lossy audio, and codec damage
// is confounded with human provenance in every row it produces. That is why the
// rows are tagged human_lossy_preview and must not be quoted as a clean
// human-audio result.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    // Admin-only, consistent with every other benchmark entrypoint: this feeds
    // a forensic measurement, not a creator-facing feature.
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin access required' }, { status: 403 });
    }

    const apiKey = secrets.get('FREESOUND_API_KEY');
    if (!apiKey) return Response.json({ error: 'Freesound is not configured' }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    // Window rather than a minimum. The scan length has to match the 60s rows we
    // already have or the classes stop being comparable, and we cannot trim a
    // lossy preview in this runtime, so the clip must arrive close to length.
    const minSeconds = body.min_seconds || 55;
    const maxSeconds = body.max_seconds || 75;
    const query = body.query || '';
    const pageSize = Math.max(1, Math.min(50, body.page_size || 20));

    const params = new URLSearchParams({
      query,
      token: apiKey,
      page: String(body.page || 1),
      page_size: String(pageSize),
      fields: 'id,name,username,previews,duration,type,samplerate,channels,license,url',
      filter: `license:"Creative Commons 0" duration:[${minSeconds} TO ${maxSeconds}]`,
      sort: 'downloads_desc',
    });

    const res = await fetch(`https://freesound.org/apiv2/search/text/?${params.toString()}`);
    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: `Freesound search failed: ${res.status} ${text.slice(0, 200)}` }, { status: 502 });
    }
    const data = await res.json();

    const candidates = [];
    const rejected = [];
    for (const r of data.results || []) {
      const url = r.previews?.['preview-hq-mp3'];
      const seconds = typeof r.duration === 'number' ? Number(r.duration.toFixed(2)) : null;
      // Re-checked here rather than trusted from the filter: the duration gate is
      // the whole reason these rows are comparable, and a short clip is a
      // measurably EASIER scan that would bias the null rate toward clean.
      if (!url || seconds == null || seconds < minSeconds || seconds > maxSeconds) {
        rejected.push({ id: r.id, name: r.name, seconds, reason: !url ? 'no hq mp3 preview' : 'outside duration gate' });
        continue;
      }
      candidates.push({
        url,
        seconds,
        id: r.id,
        name: r.name,
        username: r.username,
        license: r.license,
        original_type: r.type,
        original_sample_rate: r.samplerate,
        channels: r.channels,
        page_url: r.url,
      });
    }

    return Response.json({
      total_matches: data.count,
      candidates,
      rejected,
      source_class: 'human_lossy_preview',
      fidelity_warning:
        'Freesound token auth serves lossy MP3 previews only. Codec damage is confounded with human provenance in these rows — do not report them as a clean human-audio false-positive rate.',
      note: 'Pass candidates straight to smokeBaseMarkV4 action:"null_scan" with passthrough:true.',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}