import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Verifiable external sources — a link is only accepted if its domain (and the
// final domain after redirects) matches one of these.
const SOURCES = [
  { name: "Suno", domains: ["suno.com", "suno.ai", "app.suno.ai"] },
  { name: "Udio", domains: ["udio.com"] },
  { name: "YouTube", domains: ["youtube.com", "youtu.be", "music.youtube.com"] },
  { name: "TikTok", domains: ["tiktok.com", "vm.tiktok.com", "vt.tiktok.com"] },
  { name: "SoundCloud", domains: ["soundcloud.com", "on.soundcloud.com"] },
  { name: "Audius", domains: ["audius.co"] },
  { name: "Spotify", domains: ["open.spotify.com", "spotify.link"] },
  { name: "Apple Music", domains: ["music.apple.com"] },
  { name: "Bandcamp", domains: ["bandcamp.com"] },
  { name: "Instagram", domains: ["instagram.com"] },
  { name: "Loudly", domains: ["loudly.com"] },
  { name: "Boomy", domains: ["boomy.com"] },
  { name: "Mubert", domains: ["mubert.com"] },
  { name: "Beatoven", domains: ["beatoven.ai"] },
  { name: "Riffusion", domains: ["riffusion.com"] },
];

function matchSource(hostname) {
  const h = String(hostname || "").toLowerCase().replace(/^www\./, "");
  for (const s of SOURCES) {
    for (const d of s.domains) {
      if (h === d || h.endsWith("." + d)) return s.name;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { mode, url, file_url, declared_label, declared_tools } = await req.json();

    // ---- MODE 1: external link verification ----
    if (mode === "link") {
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        return Response.json({ verified: false, reason: "Not a valid URL" });
      }
      if (parsed.protocol !== "https:") {
        return Response.json({ verified: false, reason: "Only secure https:// links are accepted" });
      }
      const sourceName = matchSource(parsed.hostname);
      if (!sourceName) {
        return Response.json({
          verified: false,
          reason: `"${parsed.hostname}" is not a recognized source. Accepted: ${SOURCES.map(s => s.name).join(", ")}`,
        });
      }

      // Confirm the link actually resolves at the real source. Redirects are
      // followed MANUALLY so every intermediate hop is validated against the
      // whitelist before it is fetched — a shortener on an allowed domain can't
      // bounce this server to an internal/unlisted address (SSRF protection).
      // Some sources bounce automated requests to a consent/login page of the same
      // company (e.g. YouTube -> google.com consent) — treat those as the original source.
      const INTERSTITIALS = ["google.com", "facebook.com"];
      const isInterstitialHost = (hn) => {
        const h = String(hn || "").toLowerCase().replace(/^www\./, "");
        return INTERSTITIALS.some(d => h === d || h.endsWith("." + d));
      };
      const MAX_REDIRECTS = 5;
      let status = 0;
      let finalHost = parsed.hostname;
      try {
        let current = url;
        for (let hop = 0; ; hop++) {
          const cu = new URL(current);
          if (cu.protocol !== "https:") {
            return Response.json({ verified: false, reason: "Link redirects to a non-https address" });
          }
          if (!matchSource(cu.hostname) && !isInterstitialHost(cu.hostname)) {
            return Response.json({ verified: false, reason: `Link redirects away from a verified source (ends at ${cu.hostname})` });
          }
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 10000);
          const res = await fetch(current, {
            method: "GET",
            redirect: "manual",
            signal: controller.signal,
            headers: { "User-Agent": "Mozilla/5.0 (compatible; BaseStationVerifier/1.0)" },
          });
          clearTimeout(t);
          try { await res.body?.cancel(); } catch { /* ignore */ }
          const loc = (res.status >= 300 && res.status < 400) ? res.headers.get("location") : null;
          if (loc) {
            if (hop >= MAX_REDIRECTS) {
              return Response.json({ verified: false, reason: "Too many redirects" });
            }
            current = new URL(loc, current).toString();
            continue;
          }
          status = res.status;
          finalHost = cu.hostname;
          break;
        }
      } catch {
        return Response.json({ verified: false, source_name: sourceName, reason: "The link could not be reached — it may be dead or private" });
      }

      const isInterstitial = isInterstitialHost(finalHost);
      const finalSource = matchSource(finalHost) || (isInterstitial ? sourceName : null);
      if (!finalSource) {
        return Response.json({ verified: false, reason: `Link redirects away from a verified source (ends at ${finalHost})` });
      }
      if (status === 404 || status === 410) {
        return Response.json({ verified: false, source_name: finalSource, reason: "The source reports this content does not exist (404)" });
      }

      return Response.json({
        verified: true,
        source_name: finalSource,
        final_url: url,
        method: "link",
        checked_at: new Date().toISOString(),
      });
    }

    // ---- MODE 2: AI-involvement analysis of an uploaded audio file ----
    if (mode === "audio") {
      if (!file_url) return Response.json({ error: "file_url required" }, { status: 400 });

      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an audio forensics assistant for a music platform that requires honest AI-usage disclosure (RIAA/IFPI GenAI labels). Listen to the attached audio recording and assess the likelihood that generative AI was involved in creating it.

Consider indicators such as: characteristic GenAI vocal artifacts (smearing, phaseyness, garbled consonants, unnatural vibrato), overly quantized or "averaged" instrumentation, typical AI-generator mixing signatures, unnatural song structure or transitions, spectral artifacts, and production traits typical of tools like Suno or Udio.

The submitter declared this recording as "${declared_label || "unknown"}" (ai_generated = mostly AI, ai_assisted = mostly human with some AI, human = no AI)${declared_tools?.length ? ` and listed these AI tools: ${declared_tools.join(", ")}` : ""}.

Be honest about uncertainty — this is a heuristic screening, not proof. Rate consistency of your findings with the declared label.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            ai_likelihood: { type: "number", description: "0-100 estimated likelihood generative AI created most of the recording" },
            verdict: { type: "string", enum: ["likely_ai_generated", "possibly_ai_assisted", "likely_human", "inconclusive"] },
            indicators: { type: "array", items: { type: "string" }, description: "Specific audio traits observed" },
            label_consistency: { type: "string", enum: ["consistent", "questionable", "inconsistent"], description: "Does the analysis match the declared label?" },
            summary: { type: "string", description: "2-3 sentence plain-language summary" },
          },
        },
      });

      return Response.json({
        ...analysis,
        method: "audio_analysis",
        checked_at: new Date().toISOString(),
      });
    }

    return Response.json({ error: "Invalid mode — use 'link' or 'audio'" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});