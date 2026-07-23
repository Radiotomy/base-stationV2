// Shared helpers for ElevenLabs Music Finetunes functions
export const EL_BASE = 'https://api.elevenlabs.io/v1';

export async function elError(res) {
  try {
    const j = await res.json();
    return j?.detail?.message || (typeof j?.detail === 'string' ? j.detail : JSON.stringify(j?.detail || j));
  } catch {
    return `HTTP ${res.status}`;
  }
}

// Credit gate — returns the user's credit record + whether balance covers cost
export async function checkCredits(base44, user, cost) {
  const credits = await base44.asServiceRole.entities.UserCredit.filter({ user_id: user.id });
  const record = credits[0] || null;
  const balance = record?.balance ?? 0;
  return { record, balance, ok: balance >= cost };
}

// Deduct credits + write CreditLog (mirrors the app-wide pattern)
export async function deductCredits(base44, user, record, cost, description, jobId = null) {
  let rec = record;
  if (!rec) {
    rec = await base44.asServiceRole.entities.UserCredit.create({
      user_id: user.id, user_email: user.email,
      balance: 0, lifetime_earned: 0, lifetime_spent: 0,
    });
  }
  const newBalance = (rec.balance || 0) - cost;
  await base44.asServiceRole.entities.UserCredit.update(rec.id, {
    balance: newBalance,
    lifetime_spent: (rec.lifetime_spent || 0) + cost,
    monthly_used: (rec.monthly_used || 0) + cost,
  });
  await base44.asServiceRole.entities.CreditLog.create({
    user_id: user.id, user_email: user.email,
    transaction_type: 'generation', amount: -cost,
    balance_before: rec.balance, balance_after: newBalance,
    related_job_id: jobId, provider: 'elevenlabs', description,
  }).catch(() => {});
  return newBalance;
}