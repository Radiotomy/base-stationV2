// Audiotool requires orderAmongTracks to be unique across ALL track types, and
// orderAmongStrips unique across all mixer strips. Using a count collides as soon
// as anything was deleted, so new entries always take the highest value + 1.
// Call inside a transaction with the TransactionBuilder `t`.
const TRACK_TYPES = ['audioTrack', 'noteTrack', 'automationTrack', 'patternTrack'];
const STRIP_TYPES = ['mixerChannel', 'mixerGroup', 'mixerAux', 'mixerDelayAux', 'mixerReverbAux'];

const nextAfter = (values) => Math.max(-1, ...values.filter(Number.isFinite)) + 1;
const all = (t, types) => types.flatMap((type) => t.entities.ofTypes(type).get());

export const nextTrackOrder = (t) =>
  nextAfter(all(t, TRACK_TYPES).map((e) => e.fields.orderAmongTracks?.value));

export const nextStripOrder = (t) =>
  nextAfter(all(t, STRIP_TYPES).map((e) => e.fields.displayParameters?.fields?.orderAmongStrips?.value));