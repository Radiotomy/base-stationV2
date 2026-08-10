// Shared AssemblyAI helpers — used by transcribeAudio and generateChapters.
const AAI_BASE = 'https://api.assemblyai.com/v2';

export async function submitTranscript(apiKey, audioUrl, params = {}) {
  const res = await fetch(`${AAI_BASE}/transcript`, {
    method: 'POST',
    headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_url: audioUrl, ...params }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AssemblyAI submit failed (${res.status}): ${err.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.id;
}

export async function getTranscript(apiKey, id) {
  const res = await fetch(`${AAI_BASE}/transcript/${id}`, {
    headers: { 'Authorization': apiKey },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AssemblyAI fetch failed (${res.status}): ${err.slice(0, 300)}`);
  }
  return await res.json();
}

// Poll until the transcript completes, errors, or the time budget runs out.
// Returns the latest transcript object — caller checks .status.
export async function pollTranscript(apiKey, id, budgetMs = 50000, intervalMs = 3000) {
  const deadline = Date.now() + budgetMs;
  let data = await getTranscript(apiKey, id);
  while (data.status !== 'completed' && data.status !== 'error' && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    data = await getTranscript(apiKey, id);
  }
  return data;
}