// Creates and fully sets up a Portals room for a venue preset: the real 3D world
// comes from the template chosen at create time, then branding, public access
// and the preset's stage rig go on top. Shared by venue creation and style switch.

import { createRoom, setRoomSettings, downloadRoomData, uploadRoomData } from './portalsApi.ts';
import { buildVenueRig } from './venuePresets.ts';

export async function createVenueRoom(key: string, preset: any, opts: {
  name: string; description?: string; coverImageUrl?: string; loadingImageUrl?: string;
  screenUrl?: string | null; extraSettings?: string;
}) {
  const { name, description, coverImageUrl, loadingImageUrl, screenUrl, extraSettings } = opts;
  const roomId = await createRoom(key, preset.portalTemplate, name);

  // Best-effort from here: the room exists and is usable.
  try {
    await setRoomSettings(roomId, key, {
      Name: name.slice(0, 60),
      Description: description || `A BASE Station live venue — ${name}`,
      ...(coverImageUrl && { Image: coverImageUrl }),
      ...(loadingImageUrl && { LoadingImages: [loadingImageUrl] }),
      // Publishing needs a ShortDescription; AccessLevel is what actually lets fans in.
      ShortDescription: `${name} — a BASE Station live music venue.`.slice(0, 160),
      Status: 'Published',
      ShowOnDirectory: true,
      AccessLevel: 'public',
    });
  } catch (err) {
    console.warn('Venue settings failed:', (err as Error).message);
  }

  try {
    const roomData = await downloadRoomData(roomId, key);
    const rig = buildVenueRig(preset, { name, coverImageUrl, screenUrl });
    // Never write `allowedUsers` — any stored value is treated as a whitelist.
    await uploadRoomData(roomId, key, {
      ...roomData,
      roomItems: { ...(roomData.roomItems || {}), ...rig.items },
      logic: { ...(roomData.logic || {}), ...rig.logic },
      settings: {
        ...(roomData.settings || {}),
        isNight: preset.isNight,
        onlyNftHolders: false,
        // Carry welcome panel / UI config over from a previous room.
        ...(extraSettings && { roomSettingsExtraData: extraSettings }),
      },
    });
  } catch (err) {
    console.warn('Stage rig build failed (room still usable):', (err as Error).message);
  }

  return roomId;
}