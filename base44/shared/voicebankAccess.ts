/**
 * Who may render with which Cantor voicebank.
 *
 * The engine lists every installed bank; the Voicebank registry says who owns
 * each one. A bank with NO registry row was installed by hand on the Space and is
 * a platform default. A row with is_platform is public. Any other row is private
 * to its uploader — a creator's own trained voice must never be pickable (or
 * renderable by guessed id) by anyone else.
 *
 * Shared by listDiffSingerVoicebanks and generateVocalsDiffSinger so the list a
 * creator sees and the set they can actually render with can never disagree.
 */

export interface VoicebankRow {
  id: string;
  bank_id: string;
  user_id: string;
  is_platform?: boolean;
  status: string;
  kind?: string;
  license_text?: string;
  name?: string;
}

export async function loadVoicebankRows(base44: any): Promise<VoicebankRow[]> {
  const rows = await base44.asServiceRole.entities.Voicebank.filter({ kind: 'voicebank' }, '-created_date', 500);
  return Array.isArray(rows) ? rows : [];
}

export function canUseBank(bankId: string, rows: VoicebankRow[], user: any): boolean {
  const row = rows.find((r) => r.bank_id === bankId);
  if (!row) return true; // hand-installed platform default
  if (row.status !== 'installed') return false;
  return Boolean(row.is_platform) || row.user_id === user.id || user.role === 'admin';
}

/** 'platform' | 'mine' | 'private' — what the picker labels the bank as. */
export function bankOwnership(bankId: string, rows: VoicebankRow[], user: any): string {
  const row = rows.find((r) => r.bank_id === bankId);
  if (!row || row.is_platform) return 'platform';
  return row.user_id === user.id ? 'mine' : 'private';
}