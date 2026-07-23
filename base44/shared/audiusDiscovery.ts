// Audius discovery pool — instead of always taking the top of the weekly
// trending chart (which barely changes week to week), build a deep pool from
// several sources (weekly trending, monthly trending, underground trending)
// and randomly sample from it, so every refresh/tune-in yields a fresh mix.

async function getJson(url: URL, headers: Record<string, string>) {
  try {
    const r = await fetch(url.toString(), { headers });
    const j = await r.json();
    return j?.data || [];
  } catch {
    return [];
  }
}

export async function fetchAudiusGenrePool(opts: {
  base: string;
  headers: Record<string, string>;
  useAppName: boolean;
  genre?: string | null;
  appName?: string;
}) {
  const { base, headers, useAppName, genre, appName = 'BaseStation' } = opts;
  const mk = (path: string, params: Record<string, string>) => {
    const url = new URL(`${base}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    if (useAppName) url.searchParams.set('app_name', appName);
    return url;
  };
  const week = mk('/tracks/trending', { time: 'week', ...(genre ? { genre } : {}) });
  const month = mk('/tracks/trending', { time: 'month', ...(genre ? { genre } : {}) });
  const underground = mk('/tracks/trending/underground', { limit: '100' });

  const [a, b, c] = await Promise.all([
    getJson(week, headers),
    getJson(month, headers),
    getJson(underground, headers),
  ]);
  // Underground trending has no genre param — filter client-side
  const ug = genre ? c.filter((t: any) => t?.genre === genre) : c;

  const seen = new Set();
  const pool: any[] = [];
  const add = (list: any[]) => {
    for (const t of list) {
      if (t?.id && !seen.has(t.id)) {
        seen.add(t.id);
        pool.push(t);
      }
    }
  };
  add(a); add(b); add(ug);

  // Sparse genre this week/month — widen to yearly trending
  if (pool.length < 20 && genre) {
    add(await getJson(mk('/tracks/trending', { time: 'year', genre }), headers));
  }
  return pool;
}

// Fisher–Yates shuffle, then take n
export function sampleShuffled<T>(pool: T[], n: number): T[] {
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}