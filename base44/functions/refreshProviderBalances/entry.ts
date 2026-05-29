import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PROVIDERS = [
  { name: "nuro", envKey: "NURO_API_KEY" },
  { name: "sonic", envKey: "SONIC_API_KEY" },
  { name: "producer", envKey: "PRODUCER_API_KEY" },
  { name: "tempcolor", envKey: "TEMPCOLOR_API_KEY" },
  { name: "ltx", envKey: "LTX_API_KEY" },
];

// Attempt to fetch balance for each provider
// Each provider has a different API shape — we do best-effort
async function fetchBalance(provider, apiKey) {
  try {
    if (provider === "nuro" || provider === "sonic" || provider === "producer") {
      const res = await fetch("https://api.aimusicapi.ai/v1/get-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` }
      });
      if (!res.ok) return { balance: null, status: "error", error: `HTTP ${res.status}` };
      const data = await res.json();
      return { balance: data.credits ?? data.remaining ?? null, status: "active" };
    }

    if (provider === "tempcolor") {
      // Tempolor account billing: POST /open-apis/v1/account/billing — raw key auth (NOT Bearer)
      // Returns { status: 200000, data: { balance: number } }
      const res = await fetch("https://api.tempolor.com/open-apis/v1/account/billing", {
        method: "POST",
        headers: { "Authorization": apiKey, "Content-Type": "application/json; charset=utf-8" },
        body: "{}",
      });
      if (!res.ok) return { balance: null, status: "error", error: `HTTP ${res.status}` };
      const data = await res.json();
      if (data?.status !== 200000) return { balance: null, status: "error", error: data?.message || "Bad response" };
      return { balance: data?.data?.balance ?? null, status: "active" };
    }

    if (provider === "ltx") {
      // LTX doesn't always expose a public balance endpoint — mark as active if key exists
      return { balance: null, status: apiKey ? "active" : "inactive" };
    }

    return { balance: null, status: "inactive" };
  } catch (err) {
    return { balance: null, status: "error", error: err.message };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both scheduled (no user) and admin manual trigger
    let isAuthorized = false;
    try {
      const user = await base44.auth.me();
      if (user?.role === "admin") isAuthorized = true;
    } catch {
      // Scheduled call — no user context, allow via service role
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const results = [];

    for (const { name, envKey } of PROVIDERS) {
      const apiKey = Deno.env.get(envKey) || "";
      const { balance, status, error } = await fetchBalance(name, apiKey);

      // Upsert into ProviderBalance entity
      const existing = await base44.asServiceRole.entities.ProviderBalance.filter({ provider: name });
      const now = new Date().toISOString();

      if (existing.length > 0) {
        await base44.asServiceRole.entities.ProviderBalance.update(existing[0].id, {
          balance: balance ?? existing[0].balance,
          status,
          last_checked: now,
          error_message: error || null,
        });
      } else {
        await base44.asServiceRole.entities.ProviderBalance.create({
          provider: name,
          balance: balance ?? 0,
          status,
          last_checked: now,
          error_message: error || null,
        });
      }

      results.push({ provider: name, balance, status, error });
    }

    return Response.json({ success: true, updated: results, timestamp: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});