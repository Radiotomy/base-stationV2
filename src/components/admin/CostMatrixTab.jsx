import { useState } from "react";
import { DollarSign, TrendingUp, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── RAW API COSTS (what WE pay) ─────────────────────────────────────────────
// AIMusicAPI: 1 credit = ~$0.01 USD (based on their plan tiers, ~$30/3000 credits)
// Tempolor:   1 credit = $0.01 USD (explicitly stated in docs)

const AIMUSIC_CREDIT_USD = 0.01; // per their credit
const TEMPOLOR_CREDIT_USD = 0.01; // per their credit

// Our markup target: ~3-5x to cover infrastructure, support, margin
// We price in BASE Station Credits where 1 BS Credit = $0.01 USD retail to user
// So: api_cost_usd * markup = our_charge_usd → BS credits = our_charge_usd / 0.01

const MARKUP = 4.0; // 4x default markup (adjustable below)

// ─── OPERATIONS MATRIX ───────────────────────────────────────────────────────
// Fields: provider, model, operation, api_credits, api_usd_cost, output, notes
const OPERATIONS = [
  // ── SONIC (via AIMusicAPI) ──────────────────────────────────────────────────
  { provider: "sonic", model: "sonic-v4-5-plus / v5-5", operation: "Create Music", api_credits: 10, api_usd: 10 * AIMUSIC_CREDIT_USD, output: "2 tracks", category: "music" },
  { provider: "sonic", model: "sonic-v4-5-plus / v5-5", operation: "Extend Music", api_credits: 10, api_usd: 10 * AIMUSIC_CREDIT_USD, output: "2 tracks", category: "music" },
  { provider: "sonic", model: "sonic-v4-5-plus / v5-5", operation: "Remaster", api_credits: 10, api_usd: 10 * AIMUSIC_CREDIT_USD, output: "2 tracks", category: "edit" },
  { provider: "sonic", model: "sonic-v4-5-plus / v5-5", operation: "Add Vocals", api_credits: 10, api_usd: 10 * AIMUSIC_CREDIT_USD, output: "2 tracks", category: "edit" },
  { provider: "sonic", model: "sonic-v4-5-plus / v5-5", operation: "Add Instrumental", api_credits: 10, api_usd: 10 * AIMUSIC_CREDIT_USD, output: "2 tracks", category: "edit" },
  { provider: "sonic", model: "sonic-v4-5-plus / v5-5", operation: "Replace Section", api_credits: 10, api_usd: 10 * AIMUSIC_CREDIT_USD, output: "2 tracks", category: "edit" },
  { provider: "sonic", model: "sonic-v4-5-plus / v5-5", operation: "Stems Basic (4-stem)", api_credits: 10, api_usd: 10 * AIMUSIC_CREDIT_USD, output: "4 stems", category: "stems" },
  { provider: "sonic", model: "sonic-v4-5-plus / v5-5", operation: "Stems Full (24-stem)", api_credits: 50, api_usd: 50 * AIMUSIC_CREDIT_USD, output: "24 stems", category: "stems" },
  { provider: "sonic", model: "sonic-v4-5-plus / v5-5", operation: "Get MIDI", api_credits: 1, api_usd: 1 * AIMUSIC_CREDIT_USD, output: "MIDI file", category: "utility" },
  { provider: "sonic", model: "sonic-v4-5-plus / v5-5", operation: "Get BPM", api_credits: 1, api_usd: 1 * AIMUSIC_CREDIT_USD, output: "BPM data", category: "utility" },
  { provider: "sonic", model: "sonic-v4-5-plus / v5-5", operation: "Get VOX", api_credits: 1, api_usd: 1 * AIMUSIC_CREDIT_USD, output: "Vocal audio", category: "utility" },
  { provider: "sonic", model: "sonic-v4-5-plus / v5-5", operation: "Concat Music", api_credits: 2, api_usd: 2 * AIMUSIC_CREDIT_USD, output: "1 track", category: "utility" },
  // ── LYRICS (via AIMusicAPI) ─────────────────────────────────────────────────
  { provider: "sonic", model: "Lyrics API", operation: "Generate Lyrics", api_credits: 10, api_usd: 10 * AIMUSIC_CREDIT_USD, output: "Full lyrics", category: "lyrics" },
  // ── TEMPOLOR ────────────────────────────────────────────────────────────────
  { provider: "tempcolor", model: "TemPolor v4.6", operation: "Song Generation (vocal, up to 5 min)", api_credits: 5, api_usd: 5 * TEMPOLOR_CREDIT_USD, output: "1 track", category: "music" },
  { provider: "tempcolor", model: "TemPolor v3", operation: "Song Generation (vocal, up to 2 min)", api_credits: 3, api_usd: 3 * TEMPOLOR_CREDIT_USD, output: "1 track", category: "music" },
  { provider: "tempcolor", model: "TemPolor i3.5", operation: "Instrumental Generation (up to 270s)", api_credits: 4, api_usd: 4 * TEMPOLOR_CREDIT_USD, output: "1 track", category: "music" },
  { provider: "tempcolor", model: "TemPolor i3", operation: "Instrumental Generation (up to 120s)", api_credits: 3, api_usd: 3 * TEMPOLOR_CREDIT_USD, output: "1 track", category: "music" },
  { provider: "tempcolor", model: "Lyric v1", operation: "Lyrics Generation", api_credits: 1, api_usd: 1 * TEMPOLOR_CREDIT_USD, output: "Lyrics", category: "lyrics" },
  { provider: "tempcolor", model: "Stems v1", operation: "Audio Stem Separation (vocal + instrumental)", api_credits: 5, api_usd: 5 * TEMPOLOR_CREDIT_USD, output: "2 stems", category: "stems" },
];

const PROVIDER_STYLE = {
  sonic:     { label: "Sonic",    color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
  tempcolor: { label: "Tempolor", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
};

const CATEGORY_LABELS = {
  music:   { label: "🎵 Music Gen", color: "text-cyan-400" },
  lyrics:  { label: "✍️ Lyrics",    color: "text-pink-400" },
  stems:   { label: "🎚️ Stems",     color: "text-purple-400" },
  edit:    { label: "✂️ Editing",    color: "text-amber-400" },
  utility: { label: "🔧 Utility",   color: "text-muted-foreground" },
};

function usd(val) { return `$${val.toFixed(4)}`; }
function bsCredits(api_usd, markup) { return Math.ceil((api_usd * markup) / 0.01); }

export default function CostMatrixTab() {
  const [markup, setMarkup] = useState(MARKUP);
  const [filterProvider, setFilterProvider] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const filtered = OPERATIONS.filter(op =>
    (filterProvider === "all" || op.provider === filterProvider) &&
    (filterCategory === "all" || op.category === filterCategory)
  );

  // Summary totals
  const avgMargin = markup > 1 ? `${Math.round((1 - 1/markup) * 100)}%` : "0%";
  const cheapest = [...OPERATIONS].filter(o => o.category === "music").sort((a, b) => a.api_usd - b.api_usd)[0];
  const mostExpensive = [...OPERATIONS].filter(o => o.category === "music").sort((a, b) => b.api_usd - a.api_usd)[0];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-foreground flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-emerald-400" /> Cost & Revenue Matrix
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          What we pay per API operation vs. what we charge users — adjust markup to model revenue.
        </p>
      </div>

      {/* Markup Slider */}
      <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-bold text-foreground">Revenue Markup Multiplier</p>
            <p className="text-xs text-muted-foreground">1 BASE Station Credit = $0.01 retail price to user</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-2xl font-black text-emerald-400">{markup}×</p>
              <p className="text-xs text-muted-foreground">markup</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-yellow-400">{avgMargin}</p>
              <p className="text-xs text-muted-foreground">gross margin</p>
            </div>
          </div>
        </div>
        <input
          type="range" min={1.5} max={10} step={0.5}
          value={markup}
          onChange={e => setMarkup(parseFloat(e.target.value))}
          className="w-full accent-emerald-500"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1.5× (33% margin)</span>
          <span>3× (67% margin)</span>
          <span>5× (80% margin)</span>
          <span>10× (90% margin)</span>
        </div>

        {/* Markup guide */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          {[
            { m: 2,   label: "Break-even+", sub: "covers infra only",          color: "border-red-500/30 bg-red-500/5 text-red-400" },
            { m: 3,   label: "Conservative", sub: "33% reinvest in platform",   color: "border-yellow-500/30 bg-yellow-500/5 text-yellow-400" },
            { m: 4,   label: "Recommended ✓", sub: "balanced growth",           color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
            { m: 6,   label: "Premium",       sub: "feature-gated tiers",       color: "border-purple-500/30 bg-purple-500/5 text-purple-400" },
          ].map(({ m, label, sub, color }) => (
            <button key={m} onClick={() => setMarkup(m)}
              className={`p-3 rounded-xl border text-left transition-all ${markup === m ? color : "border-border bg-muted/30 text-muted-foreground hover:border-border/80"}`}>
              <p className="font-bold text-sm">{m}×</p>
              <p className="text-xs font-semibold">{label}</p>
              <p className="text-xs opacity-70">{sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Cheapest Track Gen", value: cheapest ? usd(cheapest.api_usd) : "—", sub: `${PROVIDER_STYLE[cheapest?.provider]?.label} — ${cheapest?.model}`, color: "text-emerald-400" },
          { label: "Most Expensive Track", value: mostExpensive ? usd(mostExpensive.api_usd) : "—", sub: `${PROVIDER_STYLE[mostExpensive?.provider]?.label} — ${mostExpensive?.model}`, color: "text-red-400" },
          { label: "Our Avg Charge (4×)", value: `${bsCredits(0.05, 4)} BS Credits`, sub: "for a typical 5¢ generation", color: "text-yellow-400" },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="p-4 rounded-2xl bg-card border border-border">
            <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">{label}</p>
            <p className={`text-xl font-black ${color}`}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select value={filterProvider} onChange={e => setFilterProvider(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg bg-muted border border-border text-foreground">
          <option value="all">All Providers</option>
          {Object.entries(PROVIDER_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg bg-muted border border-border text-foreground">
          <option value="all">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span className="px-3 py-1.5 text-xs text-muted-foreground">{filtered.length} operations</span>
      </div>

      {/* Main Matrix Table */}
      <div className="rounded-2xl border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              {["Provider", "Model", "Operation", "Category", "API Credits", "Our Cost (USD)", `User Charge (${markup}×)`, "User Price (USD)", "Gross Margin", "Output"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((op, i) => {
              const ps = PROVIDER_STYLE[op.provider];
              const cat = CATEGORY_LABELS[op.category];
              const chargeCredits = bsCredits(op.api_usd, markup);
              const chargeUsd = chargeCredits * 0.01;
              const margin = ((chargeUsd - op.api_usd) / chargeUsd * 100).toFixed(0);
              const isHighCost = op.api_usd >= 0.10;
              return (
                <tr key={i} className={`hover:bg-muted/20 transition-colors ${isHighCost ? "bg-red-500/3" : ""}`}>
                  <td className="px-4 py-3">
                    <Badge className={`${ps.color} border text-xs`}>{ps.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">{op.model}</td>
                  <td className="px-4 py-3 text-xs text-foreground font-medium">{op.operation}</td>
                  <td className={`px-4 py-3 text-xs font-semibold ${cat.color}`}>{cat.label}</td>
                  <td className="px-4 py-3 text-xs text-center font-mono text-muted-foreground">
                    {op.api_credits != null ? op.api_credits : <span className="text-blue-400">flat</span>}
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-red-400">{usd(op.api_usd)}</td>
                  <td className="px-4 py-3 text-xs font-bold text-yellow-400 whitespace-nowrap">
                    {chargeCredits} BS Credits
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-emerald-400">{usd(chargeUsd)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${margin}%` }} />
                      </div>
                      <span className="text-xs font-bold text-emerald-400">{margin}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{op.output}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pricing Strategy Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-3">
          <p className="text-sm font-black text-blue-300 flex items-center gap-2"><Info className="w-4 h-4" /> Credit Unit Economics</p>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between border-b border-border pb-1">
              <span>1 BASE Station Credit (retail)</span><span className="text-foreground font-semibold">= $0.01</span>
            </div>
            <div className="flex justify-between border-b border-border pb-1">
              <span>1 AIMusicAPI Credit (our cost)</span><span className="text-foreground font-semibold">≈ $0.01</span>
            </div>
            <div className="flex justify-between border-b border-border pb-1">
              <span>1 Tempolor Credit (our cost)</span><span className="text-foreground font-semibold">= $0.01</span>
            </div>
            <div className="flex justify-between pt-1">
              <span>Recommended credit pack price</span><span className="text-yellow-400 font-bold">100 BS Credits = $1.99</span>
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
          <p className="text-sm font-black text-emerald-300 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Recommended User Pricing</p>
          <div className="space-y-2 text-xs text-muted-foreground">
            {[
              { op: "Quick Music Gen (Tempolor i3)",  bs: bsCredits(0.03, markup), note: "most used" },
              { op: "Full Song (Sonic v4-5-plus)",    bs: bsCredits(0.10, markup), note: "premium" },
              { op: "Song w/ Vocals (Tempolor v4.6)", bs: bsCredits(0.05, markup), note: "flagship" },
              { op: "Stems Basic (Sonic)",            bs: bsCredits(0.10, markup), note: "power user" },
              { op: "Stems Full 24-stem (Sonic)",     bs: bsCredits(0.50, markup), note: "pro tier only" },
              { op: "Generate Lyrics (Tempolor)",     bs: bsCredits(0.01, markup), note: "cheap" },
            ].map(({ op, bs, note }) => (
              <div key={op} className="flex justify-between items-center border-b border-border pb-1">
                <span>{op} <span className="text-muted-foreground/50">({note})</span></span>
                <span className="text-yellow-400 font-bold whitespace-nowrap">{bs} cr</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}