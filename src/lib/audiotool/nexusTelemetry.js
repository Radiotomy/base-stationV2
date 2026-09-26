// COS telemetry for the Audiotool Bridge. Every AI invocation made through the
// bridge is logged per project, recording exactly which entities the AI wrote —
// so human vs machine contribution is MEASURED from the live document rather
// than inferred from prompts.
//
// Audiotool API User Data Policy: telemetry lives only in BASE Station's own
// database (NexusTelemetryEvent, private to the creator). Nothing is kept in the
// browser and nothing is sent to third parties.
import { base44 } from '@/api/base44Client';
import { CHAIN_INSTRUMENTS, CHAIN_EFFECTS } from '@/lib/audiotool/instrumentChain';

const Events = base44.entities.NexusTelemetryEvent;
const legacyKey = (project) => `nexus_cos_${project}`;

const toLog = (rows) => rows.map((r) => ({
  tool: r.tool, prompt: r.prompt, at: r.at,
  collectionIds: r.collection_ids || [], deviceIds: r.device_ids || [],
}));

// One-time move of any telemetry an older version kept in this browser.
async function migrateLegacy(userId, project) {
  const raw = localStorage.getItem(legacyKey(project));
  if (!raw) return;
  const old = JSON.parse(raw || '[]');
  if (old.length) {
    await Events.bulkCreate(old.map((e) => ({
      user_id: userId, project_url: project, tool: e.tool, prompt: (e.prompt || '').slice(0, 500),
      collection_ids: e.collectionIds || [], device_ids: e.deviceIds || [], at: e.at,
    })));
  }
  localStorage.removeItem(legacyKey(project));
}

export async function readLog(userId, project) {
  await migrateLegacy(userId, project);
  return toLog(await Events.filter({ user_id: userId, project_url: project }, 'created_date', 500));
}

export async function logInvocation(project, entry) {
  const me = await base44.auth.me();
  return Events.create({
    user_id: me.id,
    project_url: project,
    tool: entry.tool,
    prompt: (entry.prompt || '').slice(0, 500),
    collection_ids: entry.collectionIds || [],
    device_ids: entry.deviceIds || [],
    at: new Date().toISOString(),
  });
}

/** Removes a logged invocation once the AI output it describes has been undone. */
export const deleteInvocation = (id) => Events.delete(id);

export const subscribeTelemetry = (cb) => Events.subscribe(cb);

const PATTERN_TYPES = ['beatbox8Pattern', 'basslinePattern', 'tonematrixPattern'];
const ofTypes = (nexus, types) => types.flatMap((t) => nexus.queryEntities.ofTypes(t).get());

export function computeContribution(nexus, log) {
  const aiCollections = new Set(log.flatMap((e) => e.collectionIds || []));
  const aiDeviceIds = new Set(log.flatMap((e) => e.deviceIds || []));

  const notes = nexus.queryEntities.ofTypes('note').get();
  const aiNotes = notes.filter((n) => aiCollections.has(n.fields.collection.value.entityId)).length;
  // audioDevice = sample players; Songstarter logs the ones it creates as AI.
  const devices = ofTypes(nexus, [...CHAIN_INSTRUMENTS, ...CHAIN_EFFECTS, 'audioDevice', 'beatbox8', 'bassline', 'tonematrix']);
  const aiDevices = devices.filter((d) => aiDeviceIds.has(d.id)).length;

  // Automation points belong to the AI when their collection was AI-written.
  const autoEvents = nexus.queryEntities.ofTypes('automationEvent').get();
  const aiAutomation = autoEvents.filter((e) => aiCollections.has(e.fields.collection?.value?.entityId)).length;
  // Step patterns belong to the AI when they sit on a device an AI tool created.
  const patterns = ofTypes(nexus, PATTERN_TYPES);
  const aiPatterns = patterns.filter((p) => aiDeviceIds.has(p.fields.slot?.value?.entityId)).length;
  // Mixer channels are recorded as session context only: creating one isn't authorship.
  const mixerChannels = nexus.queryEntities.ofTypes('mixerChannel').get().length;

  const humanNotes = notes.length - aiNotes;
  const humanDevices = devices.length - aiDevices;
  const humanAutomation = autoEvents.length - aiAutomation;
  const humanPatterns = patterns.length - aiPatterns;
  const human = humanNotes + humanDevices + humanAutomation + humanPatterns;
  const total = notes.length + devices.length + autoEvents.length + patterns.length;
  return {
    humanNotes, aiNotes, humanDevices, aiDevices,
    humanAutomation, aiAutomation, humanPatterns, aiPatterns, mixerChannels,
    invocations: log.length,
    humanShare: total ? Math.round((human / total) * 100) : null,
  };
}