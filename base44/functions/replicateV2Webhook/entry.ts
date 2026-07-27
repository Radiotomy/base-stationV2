// Replicate webhook receiver for BASE Mark V2 neural embeds.
// When `startV2` (in baseMarkV2.ts) registers a webhook_url with a prediction,
// Replicate POSTs here when that prediction reaches a terminal state
// (succeeded | failed | canceled). We verify the shared-secret ?sig= query
// param, re-fetch the authoritative prediction (webhook bodies sometimes
// omit the output URL), then run the SAME finalization as pollBaseMarkV2
// via the shared baseMarkV2Finalize helper.
//
// IMPORTANT: this endpoint is intentionally PUBLIC (no user auth) — trust
// comes from constant-time comparison of the ?sig= query param against
// REPLICATE_WEBHOOK_SECRET. Replicate itself does not HMAC-sign webhooks.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { getV2Prediction } from "../../shared/baseMarkV2.ts";
import { finalizeV2Prediction } from "../../shared/baseMarkV2Finalize.ts";
import { finalizeJob } from "../../shared/jobFinalize.ts";

const SECRET = Deno.env.get("REPLICATE_WEBHOOK_SECRET") || "";

function sigMatches(provided) {
  if (!SECRET || !provided || provided.length !== SECRET.length) return false;
  let diff = 0;
  for (let i = 0; i < SECRET.length; i++) diff |= SECRET.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const u = new URL(req.url);
    if (!sigMatches(u.searchParams.get("sig") || "")) {
      return new Response("Forbidden", { status: 403 });
    }

    const body = await req.json();
    const pid = body?.id;
    if (!pid) return Response.json({ ok: true, status: "ignored" });

    // Re-fetch the prediction — the webhook body may not include the output URL.
    const pred = await getV2Prediction(pid);
    if (pred.status === "starting" || pred.status === "processing") {
      return Response.json({ ok: true, status: "processing", prediction_id: pid });
    }

    // No logged-in user (public webhook) — createClientFromRequest auto-binds
    // the internal service token so asServiceRole can bypass RLS. The plain
    // createClient({requiresAuth:false}) form does NOT bind a service token,
    // which is why Replicate saw 500s here.
    const base44 = createClientFromRequest(req);

    // This single webhook URL is shared by two different prediction flows —
    // BASE Mark V2 embeds AND generation jobs (BASE-Harmonix, BASE SoundForge).
    // Check for a matching GenerationJob first; fall through to the V2 embed
    // finalizer when there isn't one.
    const jobs = await base44.asServiceRole.entities.GenerationJob.filter({ provider_job_id: pid });
    if (jobs[0]) {
      const result = await finalizeJob(base44.asServiceRole, jobs[0]);
      return Response.json({ ok: true, ...result });
    }

    const result = await finalizeV2Prediction(base44.asServiceRole, pred);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("replicateV2Webhook error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});