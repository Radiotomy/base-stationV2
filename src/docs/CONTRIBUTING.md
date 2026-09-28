# Contributing to BASE Station

This repository is two-way synced with the Base44 Builder: pushes here appear in
the Builder, and Builder edits are pushed back. Pull before you start.

---

## Setup

```bash
npm install
cp .env.example .env.local   # VITE_BASE44_APP_ID, VITE_BASE44_APP_BASE_URL
npm run dev
```

Run `npm run lint` and `npm run build` before opening a PR. A build failure in
this app is usually one of three things: an import that doesn't resolve, a
`lucide-react` icon that doesn't exist, or a page added without a route.

## Frontend conventions

- **One component per file**, default-exported, named the same as the file. Keep
  components small; split a page into components rather than growing it.
- **Imports use the `@/` alias.** Never relative `../../src/...` paths.
- **Design tokens only.** `bg-card`, `text-foreground`, `font-display` — not
  `bg-[#241C14]`, not inline `style={{ color: '#fff' }}`. Token values live in
  `src/index.css`; the Tailwind mapping lives in `tailwind.config.js`. Update
  both `:root` and `.dark` when changing a colour.
- **Tailwind class names must be literal strings.** `` `bg-${c}-500` `` is purged
  from the build and silently disappears. Only runtime-sourced values belong in
  `safelist`.
- **Icons** come from `lucide-react` only, and must actually exist — a bad icon
  import breaks the whole bundle, not just the page.
- **New page?** Add both the `lazy()` import and the `<Route>` in `src/App.jsx`,
  under `ProtectedRoute` unless the page is genuinely public.
- **Never touch** `src/components/ui/*` (shadcn primitives) or the auth pages
  (`Login`, `Register`, `ForgotPassword`, `ResetPassword`) except to translate
  visible strings. The auth flows are complete; changing them breaks OTP.
- **Clean up effects.** Return the `unsubscribe` from every
  `entities.X.subscribe()` and clear every timer. A leaked subscription shows up
  as a multi-second `'message' handler took …ms` violation and feels like a
  freeze.
- **Mobile matters.** The app ships to phones from this same code. Test at 390px
  and respect the performance-mode rules in `index.css` (no new backdrop blurs or
  infinite animations on mobile).

## Backend conventions

- Shared logic goes in `base44/shared/` and is imported. **Never copy a block
  between two functions** — for provenance code this is a correctness bug.
- Secrets are read with `Deno.env.get` in functions only. Nothing sensitive may
  appear under `src/`, and nothing sensitive goes in a `VITE_`-prefixed variable.
- Every user-supplied URL passes `assertSafeUrl`. Redirect-following code
  re-validates the host after each hop.
- Any function spending a platform token, credit balance or wallet balance checks
  `user.role === 'admin'` or the owning user server-side.
- Long jobs are start → persist → finalize. Webhook and poller must converge on
  the same shared finalize module.
- Entity files are written **whole** — the file replaces the stored schema, and
  comments/placeholders are not allowed in it.
- Adding RLS? Restrict writes as carefully as reads, and verify you haven't
  locked owners out of their own rows.

## Rules specific to provenance code

These carry more weight than ordinary code review:

1. **Nothing about watermark embedding, detection thresholds or COS weights may
   ship to the client.** If a feature seems to need it, redesign the feature.
2. **Do not change `BASE_MARK_SEED`.** It invalidates every existing V1
   watermark in the field.
3. **Pin models by digest.** An unpinned Replicate reference means a later
   `cog push` silently changes watermarking behaviour.
4. **Never loosen a detection threshold to make a test pass.** The detector is
   designed to abstain on insufficient evidence; a confident false attribution is
   the worst outcome this system can produce.
5. **Measure, don't claim.** Any robustness statement must trace to a
   `BaseMarkBenchmark` row produced by `benchmarkBaseMark`. Publish the failures
   alongside the successes — the in-app robustness chart does.
6. **Master integrity is non-negotiable.** A watermarked file must come out at
   the same sample rate, channel count and length it went in. Assert it before
   promoting anything to canonical.

## Pull requests

Keep them scoped to one change. In the description, state:

- what changed and why;
- which surfaces you actually clicked through (desktop and mobile);
- for provenance changes, the benchmark rows or test output that back it.

## Trade secrets and third-party licences

- Files headed `TRADE SECRET` (BASE Mark, BASE Print, COS engine and stamping)
  stay in `base44/shared/`. Never import them into `src/`, and never copy their
  coefficients, thresholds, weights or key handling into docs, issues, PRs,
  screenshots or logs.
- Public docs may describe the protocol, payload format, measured results and
  limits. They must not describe the embed/detect maths or the COS weights.
- Before adding any open-source package or open-weight model, add it to
  [`NOTICES.md`](./NOTICES.md) with its licence and the obligations it brings.
  Non-commercial weights must never be reachable from a production release
  path.

## Reporting security issues

Do **not** open a public issue for anything touching watermark recovery, the
sponsoring wallet, or cross-user data access. Contact the maintainers privately.