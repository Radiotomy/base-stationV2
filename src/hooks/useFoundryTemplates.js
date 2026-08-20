import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

// Category order is pedagogical, not alphabetical: an instrument shows a whole
// voice, an effect shows processing, then utilities and modulators.
const CATEGORY_ORDER = ['instrument', 'effect', 'utility', 'modulator'];

const byCurationOrder = (a, b) => {
  const d = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
  return d !== 0 ? d : (a.title || '').localeCompare(b.title || '');
};

/** Curated Starter Templates, in teaching order. null while loading. */
export default function useFoundryTemplates() {
  const [templates, setTemplates] = useState(null);

  useEffect(() => {
    base44.entities.FoundryPlugin
      .filter({ is_template: true }, '-created_date', 24)
      .then((rows) => setTemplates([...rows].sort(byCurationOrder)))
      .catch(() => setTemplates([]));
  }, []);

  return templates;
}