import { useCallback, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { getAudiusSdk } from '@/lib/audius/browserSdk';

/**
 * Publishes a UserAsset to Audius from the BROWSER.
 *
 * Audius splits an upload into two phases and only the second one needs to be
 * authorized as the creator:
 *   1. uploads.createAudioUpload / createImageUpload — the bytes go straight to a
 *      storage node from here. This is the phase our backend cannot perform: a
 *      multi-megabyte outbound body fails in that runtime regardless of shape.
 *   2. tracks.createTrack — registers CIDs + metadata on the protocol. Small JSON.
 *
 * The RELEASE ITSELF is still composed server-side (audiusPublishPrepare): asset
 * ownership, COS score and AI disclosure come from stored records, so moving the
 * file transfer into the browser does not move the provenance claim with it.
 */

async function fetchAsFile(url, fallbackName) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not read source file (${res.status})`);
  const blob = await res.blob();
  // Audius' storage node infers the container from the extension, so a name
  // without one is refused as an unsupported file rather than transcoded.
  const fromUrl = (url.split('?')[0].split('/').pop() || '').trim();
  const name = /\.[a-z0-9]{2,4}$/i.test(fromUrl) ? fromUrl : fallbackName;
  return new File([blob], name, { type: blob.type || undefined });
}

export default function useAudiusBrowserPublish() {
  const [phase, setPhase] = useState('idle');   // idle | signin | preparing | uploading | registering
  const [activeAssetId, setActiveAssetId] = useState(null);

  const publish = useCallback(async (asset) => {
    setActiveAssetId(asset.id);
    try {
      setPhase('signin');
      const sdk = await getAudiusSdk();
      if (!(await sdk.oauth.isAuthenticated())) {
        await sdk.oauth.login({ scope: 'write', display: 'popup' });
      }
      const me = await sdk.oauth.getUser();

      // The id carried by the OAuth token is the one the upload API expects —
      // resolving a second id by handle was wrong and produced a mismatched
      // account on the write.
      const userId = String(me?.userId ?? me?.sub ?? '');
      if (!userId) throw new Error('Could not resolve your Audius account id.');

      setPhase('preparing');
      const prepRes = await base44.functions.invoke('audiusPublishPrepare', { assetId: asset.id });
      const prep = prepRes?.data?.data || prepRes?.data;
      if (!prep?.file_url) throw new Error('Could not prepare this release.');

      const [audioFile, coverFile] = await Promise.all([
        fetchAsFile(prep.file_url, 'track.mp3'),
        fetchAsFile(prep.cover_url, 'cover.jpg'),
      ]);

      setPhase('uploading');
      // Independent transfers — started together so a full-length master and its
      // artwork are not uploaded one after the other.
      const [audioResult, coverArtSizes] = await Promise.all([
        sdk.uploads.createAudioUpload({ file: audioFile, userId }).start(),
        sdk.uploads.createImageUpload({ file: coverFile }).start(),
      ]);
      if (!audioResult?.trackCid) throw new Error('Audius did not accept the audio file.');

      setPhase('registering');
      const created = await sdk.tracks.createTrack({
        userId,
        metadata: {
          ...prep.metadata,
          ...audioResult,
          trackCid: audioResult.trackCid,
          coverArtSizes,
          // Audius flags an AI release by attributing it to the uploading account,
          // so this is set only when our own disclosure says the recording is
          // AI-generated — stamping it on a human recording would misdeclare it.
          aiAttributionUserId: prep.ai_disclosure_label === 'ai_generated' ? userId : undefined,
        },
      });

      const audiusTrackId = created?.trackId || created?.data?.trackId;
      if (!audiusTrackId) throw new Error('Audius accepted the upload but returned no track id.');

      await base44.functions.invoke('audiusPublishFinalize', {
        assetId: asset.id,
        audiusTrackId,
        audiusUserId: userId,
        audiusHandle: me.handle,
      });

      return audiusTrackId;
    } finally {
      setPhase('idle');
      setActiveAssetId(null);
    }
  }, []);

  return { publish, phase, activeAssetId };
}