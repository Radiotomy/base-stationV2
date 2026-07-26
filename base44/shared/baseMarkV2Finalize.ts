// Shared finalization for BASE Mark V2 predictions — used by both:
//   • pollBaseMarkV2  (user-scoped client called from the frontend)
//   • replicateV2Webhook (service-role client called from Replicate)
// Given a settled Replicate prediction, locates the stamped UserAsset,
// downloads + rehosts the watermarked WAV, and writes the completed state.
// Works with either a user-scoped or service-role base44 client.

import { BASE_MARK_V2_VERSION, v2Model } from "./baseMarkV2.ts";

export async function finalizeV2Prediction(base44, pred) {
  const predictionId = pred?.id;
  if (!predictionId) return { status: "error", error: "No prediction id" };

  if (pred.status === "starting" || pred.status === "processing") {
    return { status: "processing", prediction_id: predictionId };
  }

  // Locate the asset stamped with this prediction id.
  const matches = await base44.entities.UserAsset.filter(
    { "metadata.base_mark_v2.prediction_id": predictionId },
    "-created_date",
    5,
  );
  const asset = matches?.[0];
  if (!asset) return { status: "no_asset", prediction_id: predictionId };

  // Idempotency guard — the async webhook and the frontend's poll loop can
  // both wake up on the same settled prediction. If the asset is already in
  // a terminal state, skip the redundant download + rehost and return.
  const currentStatus = asset.metadata?.base_mark_v2?.status;
  if (currentStatus === "completed" || currentStatus === "failed") {
    return {
      status: currentStatus,
      prediction_id: predictionId,
      asset_id: asset.id,
      marked_file_url: asset.metadata?.base_mark_v2?.marked_file_url,
      payload_hex: asset.metadata?.base_mark_v2?.payload_hex,
      already_finalized: true,
    };
  }

  if (pred.status === "failed" || pred.status === "canceled") {
    await base44.entities.UserAsset.update(asset.id, {
      metadata: {
        ...(asset.metadata || {}),
        base_mark_v2: {
          ...(asset.metadata?.base_mark_v2 || {}),
          status: "failed",
          error: pred.error || pred.status,
        },
      },
    });
    return { status: "failed", error: pred.error || pred.status, prediction_id: predictionId };
  }

  if (pred.status !== "succeeded") {
    return { status: pred.status || "unknown", prediction_id: predictionId };
  }

  const outUrl = typeof pred.output === "string"
    ? pred.output
    : Array.isArray(pred.output)
      ? pred.output[0]
      : pred.output?.url;
  if (!outUrl) {
    return { status: "failed", error: "Model returned no output file", prediction_id: predictionId };
  }

  const dl = await fetch(outUrl);
  if (!dl.ok) {
    return { status: "failed", error: "Could not download the watermarked file from the model", prediction_id: predictionId };
  }
  const file = new File([await dl.arrayBuffer()], "basemark-v2.wav", { type: "audio/wav" });
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  if (!file_url) {
    return { status: "failed", error: "Rehost of marked file failed", prediction_id: predictionId };
  }

  const usedWavSlot = !!asset.metadata?.wav_url;
  const metadata = {
    ...(asset.metadata || {}),
    ...(usedWavSlot ? { wav_url: file_url } : {}),
    base_mark_v2: {
      ...(asset.metadata?.base_mark_v2 || {}),
      version: BASE_MARK_V2_VERSION,
      engine: "neural",
      model: v2Model(),
      payload_hex: asset.metadata?.base_mark_v2?.payload_hex,
      status: "completed",
      marked_file_url: file_url,
      prediction_id: predictionId,
      embedded_at: asset.metadata?.base_mark_v2?.embedded_at || new Date().toISOString(),
    },
  };
  const updates = { metadata };
  if (!usedWavSlot) updates.file_url = file_url;
  await base44.entities.UserAsset.update(asset.id, updates);

  return {
    status: "completed",
    prediction_id: predictionId,
    asset_id: asset.id,
    marked_file_url: file_url,
    payload_hex: asset.metadata?.base_mark_v2?.payload_hex,
  };
}