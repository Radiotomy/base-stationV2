// Probes NextCut to discover the b-roll endpoint shape.
// Tries the most likely paths and payload shapes with the existing NEXTCUT_API key.
// Returns a ranked list of what worked / what failed and why.

Deno.serve(async (req) => {
  try {
    const apiKey = Deno.env.get("NEXTCUT_API");
    if (!apiKey) {
      return Response.json({ error: "NEXTCUT_API secret not set" }, { status: 500 });
    }

    const baseUrl = "https://api.nextcut.io";
    const headers = {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    };

    // Common payload variants advertised on their homepage SDK snippet:
    //   nextcut.broll({ query: "city traffic", duration: 5, source: "pexels" })
    const payloadA = { query: "ocean waves sunset", duration: 5, source: "pexels" };
    const payloadB = { query: "ocean waves sunset", duration: 5 };
    const payloadC = { action: "broll", query: "ocean waves sunset", duration: 5, source: "pexels" };
    const payloadFlow = {
      steps: [
        { type: "broll", query: "ocean waves sunset", duration: 5, source: "pexels" }
      ]
    };

    // Verification: cost comparison to prove b-roll layer renders Pexels footage
    const candidates = [
      // A: Empty (solid color baseline) — should be cheapest
      { path: "/api-render", method: "POST", body: {
          scenes: [{ startFrame: 0, endFrame: 30, layers: [{ type: "solid", props: { color: "#FF0000" } }] }],
          width: 1080, height: 720, fps: 30
        }, label: "A: solid color baseline (cheapest)" },

      // B: broll layer with a clearly nonsense query — does NextCut error or fallback?
      { path: "/api-render", method: "POST", body: {
          scenes: [{ startFrame: 0, endFrame: 30, layers: [
            { type: "broll", props: { query: "qqzzxxnotarealthing9999", source: "pexels" } }
          ]}],
          width: 1080, height: 720, fps: 30
        }, label: "B: broll with nonsense query" },

      // C: broll layer with a great Pexels query
      { path: "/api-render", method: "POST", body: {
          scenes: [{ startFrame: 0, endFrame: 30, layers: [
            { type: "broll", props: { query: "city traffic timelapse", source: "pexels" } }
          ]}],
          width: 1080, height: 720, fps: 30
        }, label: "C: broll with rich query" },
    ];

    const results = [];
    let firstSuccess = null;

    for (const c of candidates) {
      const start = Date.now();
      try {
        let url = `${baseUrl}${c.path}`;
        const init = { method: c.method, headers };
        if (c.method === "POST" && c.body) {
          init.body = JSON.stringify(c.body);
        } else if (c.method === "GET" && c.body == null) {
          // For GET probe, add query params from a sample query
          url += "?query=ocean+waves+sunset&duration=5&source=pexels";
        }

        const res = await fetch(url, init);
        const latency = Date.now() - start;
        const text = await res.text();
        let parsed = null;
        try { parsed = JSON.parse(text); } catch { /* not JSON */ }

        const summary = {
          path: c.path,
          method: c.method,
          label: c.label,
          status: res.status,
          latency_ms: latency,
          ok: res.ok,
          // Truncate body to keep response small
          response_preview: text.slice(0, 600),
          response_json: parsed,
        };
        results.push(summary);

        // Capture first 200 as the winner
        if (res.ok && !firstSuccess) {
          firstSuccess = summary;
        }
      } catch (err) {
        results.push({
          path: c.path,
          method: c.method,
          label: c.label,
          status: 0,
          latency_ms: Date.now() - start,
          ok: false,
          error: err.message,
        });
      }
    }

    // Diagnose
    let diagnosis;
    if (firstSuccess) {
      diagnosis = `✅ B-roll endpoint discovered: ${firstSuccess.method} ${firstSuccess.path}`;
    } else {
      const statusCounts = {};
      for (const r of results) {
        statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
      }
      diagnosis = `❌ No endpoint returned 2xx. Status breakdown: ${JSON.stringify(statusCounts)}. Check responses for clues.`;
    }

    // Compact summary: per-test cost + output URL + size (HEAD request)
    const compactResults = [];
    for (const r of results) {
      let fileSize = null;
      const outputUrl = r.response_json?.outputUrl;
      if (outputUrl) {
        try {
          const head = await fetch(outputUrl, { method: "HEAD" });
          fileSize = parseInt(head.headers.get("content-length") || "0", 10);
        } catch (_) { /* ignore */ }
      }
      compactResults.push({
        label: r.label,
        status: r.status,
        cost_usd: r.response_json?.cost ?? null,
        compute_cost: r.response_json?.costBreakdown?.compute ?? null,
        s3_transfer: r.response_json?.costBreakdown?.s3_transfer ?? null,
        render_ms: r.response_json?.durationMs ?? null,
        output_size_bytes: fileSize,
        output_url: outputUrl,
        error_preview: r.response_json?.error || (r.ok ? null : r.response_preview?.slice(0, 200)),
      });
    }

    return Response.json({
      diagnosis,
      api_key_present: true,
      api_key_length: apiKey.length,
      compact_results: compactResults,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});