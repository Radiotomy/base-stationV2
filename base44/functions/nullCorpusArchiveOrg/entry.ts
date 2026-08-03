import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Null-corpus candidate source: human-performed MUSIC in a LOSSLESS container.
//
// This is the class that actually gates publishing a false-positive rate. The
// two classes we already have both fall short of it, in different ways:
//   - ai_generated_wav      — lossless, but our own engines, not human
//   - human_lossy_preview   — human, but MP3 previews, so codec damage and human
//                             provenance are confounded and cannot be separated
//
// Internet Archive's Great 78 Project (the `georgeblood` collection) is the only
// large, freely-fetchable source of human-performed music as lossless 24-bit
// FLAC with direct file URLs — ~187k sides, each with a real `length` in its
// metadata so the 60s comparability gate can be enforced before spending compute.
//
// HONEST CAVEAT, and it is not a small one: these are 78rpm shellac transfers.
// They are band-limited (little content above ~8kHz), carry surface noise, and
// are usually mono. They are NOT acoustically representative of the modern
// digital masters the platform actually scans. What they ARE is human-performed
// music with no codec damage, and adversarially harder than clean audio for a
// speed-searching detector — broadband surface noise is exactly where a
// hallucinated pattern line would come from. So this closes the "lossless +
// human" gap while leaving a "modern master" gap that is stated, not papered over.
//
// Admin-only: it feeds a benchmark that burns platform compute.

const SEARCH = 'https://archive.org/advancedsearch.php';

// Public-domain / CC0 markers. Great 78 items are frequently published with no
// licenseurl at all, so the license is REPORTED per candidate rather than
// assumed — an unlicensed item is returned flagged, never silently treated as CC0.
function licenseState(url) {
  if (!url) return { license: null, license_ok: false, license_note: 'No licenseurl in item metadata — verify before publishing any figure derived from it.' };
  const u = String(url).toLowerCase();
  const ok = u.includes('publicdomain') || u.includes('/zero/') || u.includes('mark/1.0');
  return {
    license: url,
    license_ok: ok,
    license_note: ok ? 'Public domain / CC0 — no attribution obligation.' : 'Not a public-domain marker; attribution or restrictions may apply.',
  };
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const minSeconds = body.min_seconds || 66;
    const rows = Math.max(1, Math.min(60, body.rows || 24));
    const page = Math.max(1, body.page || 1);

    // License filtering is ON by default and searches the wider 78rpm collection
    // rather than georgeblood alone. The georgeblood mass-digitization items
    // almost all ship with NO licenseurl, so an unfiltered search returns
    // thousands of candidates we are not willing to publish figures from. This
    // clause restricts to items explicitly marked public domain / CC0 (~4.8k
    // sides), which is more than enough for a 50–100 corpus.
    const requireLicense = body.require_license !== false;
    const collection = body.collection || '78rpm';
    const q = [
      `collection:${collection}`,
      'format:FLAC',
      requireLicense ? 'licenseurl:*publicdomain*' : null,
    ].filter(Boolean).join(' AND ');

    // Only items that actually carry a FLAC. `runtime` is requested so the
    // length gate can reject short sides before any metadata round trip.
    const params = new URLSearchParams({
      q,
      rows: String(rows),
      page: String(page),
      output: 'json',
    });
    params.append('fl[]', 'identifier');
    params.append('fl[]', 'title');
    params.append('fl[]', 'creator');
    params.append('fl[]', 'licenseurl');
    params.append('fl[]', 'runtime');
    params.append('sort[]', 'identifier asc');

    const res = await fetch(`${SEARCH}?${params}`);
    if (!res.ok) {
      return Response.json({ error: `Archive.org search failed: ${res.status}` }, { status: 502 });
    }
    const found = await res.json();
    const docs = found?.response?.docs || [];

    const candidates = [];
    const rejected = [];

    // The search index does not expose filenames, so the direct FLAC URL needs
    // one metadata read per item. Capped, because each is a network round trip.
    for (const doc of docs.slice(0, Math.min(docs.length, body.resolve_limit || 12))) {
      const metaRes = await fetch(`https://archive.org/metadata/${doc.identifier}`);
      if (!metaRes.ok) {
        rejected.push({ identifier: doc.identifier, reason: `metadata fetch ${metaRes.status}` });
        continue;
      }
      const meta = await metaRes.json();
      const files = meta?.files || [];

      // Prefer the plainly-named preferred transfer (the engineer-selected one)
      // over the raw per-stylus files, which are alternate takes of the same side.
      const flac = files.find((f) => /flac/i.test(f.format || '') && f.length && Number(f.length) >= minSeconds);
      if (!flac) {
        const anyFlac = files.find((f) => /flac/i.test(f.format || ''));
        rejected.push({
          identifier: doc.identifier,
          reason: anyFlac
            ? `rejected by the ${minSeconds}s length gate (${anyFlac.length || 'unknown'}s)`
            : 'no FLAC file in item',
        });
        continue;
      }

      const lic = licenseState(doc.licenseurl || meta?.metadata?.licenseurl);
      candidates.push({
        identifier: doc.identifier,
        title: doc.title || meta?.metadata?.title || null,
        creator: doc.creator || meta?.metadata?.creator || null,
        // Passed straight to smokeBaseMarkV4 null_scan as a { url, seconds } source.
        url: `https://archive.org/download/${doc.identifier}/${encodeURIComponent(flac.name)}`,
        seconds: Number(Number(flac.length).toFixed(2)),
        bytes: Number(flac.size || 0),
        flac_format: flac.format,
        ...lic,
      });
    }

    return Response.json({
      query: q,
      license_filtered: requireLicense,
      total_matching: found?.response?.numFound ?? null,
      returned: candidates.length,
      rejected: rejected.length,
      source_class: 'human_lossless',
      fidelity_note:
        'Lossless 24-bit FLAC, human-performed music, no codec damage — this is the class a published false-positive figure needs.',
      representativeness_caveat:
        '78rpm shellac transfers: band-limited (little above ~8kHz), surface noise, usually mono. NOT representative of modern digital masters. Adversarially useful (broadband noise is where a speed search would hallucinate) but the "modern master" gap remains open and must be stated alongside any figure from this class.',
      license_warning: candidates.some((c) => !c.license_ok)
        ? 'Some candidates carry no public-domain marker. Verify those before publishing figures derived from them.'
        : null,
      handling_note:
        'These files are large (tens of MB). Scan them via smokeBaseMarkV4 null_scan WITHOUT passthrough and with range_bytes set, so only the leading portion is downloaded and decoded.',
      candidates,
      rejected_detail: rejected,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}