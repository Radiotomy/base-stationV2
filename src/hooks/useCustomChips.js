import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// Module-level cache so multiple components share the same fetched chips.
// Keys are created lazily so every chip_type (genre, mood, duration, style, …) works.
const _cache = {};

/**
 * Loads and manages custom user-added chips for a given type (genre | mood | duration).
 * Custom chips are stored in the CustomChip entity and shared across all users.
 */
export function useCustomChips(chipType) {
  const [customChips, setCustomChips] = useState(_cache[chipType] || []);
  const [loaded, setLoaded] = useState(Array.isArray(_cache[chipType]));

  useEffect(() => {
    if (Array.isArray(_cache[chipType])) return;
    base44.entities.CustomChip.filter({ chip_type: chipType }, 'value', 200)
      .then(items => {
        const vals = items.map(i => i.value);
        _cache[chipType] = vals;
        setCustomChips(vals);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [chipType]);

  const addChip = async (value) => {
    const trimmed = value.trim();
    if (!trimmed || customChips.includes(trimmed)) return false;
    try {
      const user = await base44.auth.me();
      await base44.entities.CustomChip.create({
        chip_type: chipType,
        value: trimmed,
        added_by: user.email,
      });
      const updated = [...customChips, trimmed];
      _cache[chipType] = updated;
      setCustomChips(updated);
      return true;
    } catch {
      return false;
    }
  };

  return { customChips, addChip, loaded };
}