import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import JSZip from 'npm:jszip@3.10.1';
import { assertSafeUrl } from '../../shared/safeUrl.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { task, audioUrl, parameters } = await req.json();

    if (!task || !audioUrl) {
      return Response.json({ error: 'Missing task or audioUrl' }, { status: 400 });
    }

    let result = {};

    // Route to appropriate provider based on task
    switch (task) {
      case 'extract_stems': {
        // Multi-provider stem separation. Tier meaning is provider-specific:
        //  - Sonic:      Basic = 4-stem (vocals/drums/bass/other), Advanced = full multi-stem breakdown
        //  - Tempolor:   Basic only — 2-stem (vocals/instrumental), no advanced tier
        //  - ElevenLabs: Basic = 2-stem (vocals/instrumental), Advanced = 6-stem
        const stemProvider = ['tempcolor', 'elevenlabs'].includes(parameters.provider) ? parameters.provider : 'sonic';
        const tier = parameters.tier === 'advanced' ? 'advanced' : 'basic';

        if (stemProvider === 'tempcolor') {
          // Docs: POST /open-apis/v1/stems { url, callback_url } — async, raw-key auth (not Bearer).
          // Tempolor only separates into vocals + instrumental (no advanced tier).
          const tempcolorApiKey = Deno.env.get('TEMPCOLOR_API_KEY');
          const callbackUrl = Deno.env.get('TEMPOLOR_WEBHOOK_URL') || 'https://webhook.site/tempolor-callback';
          const stemsResponse = await fetch('https://api.tempolor.com/open-apis/v1/stems', {
            method: 'POST',
            headers: { 'Authorization': tempcolorApiKey, 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({ url: audioUrl, callback_url: callbackUrl }),
          });
          if (!stemsResponse.ok) throw new Error(`Tempolor API error: ${stemsResponse.statusText}`);
          const stemsData = await stemsResponse.json();
          if (stemsData?.status !== 200000) throw new Error(stemsData?.message || 'Tempolor stem separation failed');
          const itemId = stemsData?.data?.item_ids?.[0];
          if (!itemId) throw new Error('No item_id from Tempolor stems');
          result.task_id = itemId;
          result.tier = 'basic';
          result.provider = 'tempcolor';
        } else if (stemProvider === 'elevenlabs') {
          // Docs: POST /v1/music/separate-stems — multipart file upload, synchronous.
          // Returns a ZIP of separated stem audio files. stem_variation_id: two_stems_v1 | six_stems_v1.
          const elevenApiKey = Deno.env.get('ELEVENLABS_API');
          if (!elevenApiKey) throw new Error('ELEVENLABS_API key not configured');
          const stemVariationId = tier === 'advanced' ? 'six_stems_v1' : 'two_stems_v1';

          const audioRes = await fetch(assertSafeUrl(audioUrl));
          if (!audioRes.ok) throw new Error('Failed to fetch source audio for ElevenLabs stem separation');
          const audioBlob = await audioRes.blob();

          const form = new FormData();
          form.append('file', new File([audioBlob], 'source.mp3', { type: audioBlob.type || 'audio/mpeg' }));
          form.append('stem_variation_id', stemVariationId);

          const sepRes = await fetch('https://api.elevenlabs.io/v1/music/separate-stems', {
            method: 'POST',
            headers: { 'xi-api-key': elevenApiKey },
            body: form,
          });
          if (!sepRes.ok) throw new Error(`ElevenLabs stems error: HTTP ${sepRes.status}`);

          const zip = await JSZip.loadAsync(await sepRes.arrayBuffer());
          const stems = {};
          for (const [filename, entry] of Object.entries(zip.files)) {
            if (entry.dir) continue;
            const bytes = await entry.async('uint8array');
            const stemName = filename.replace(/\.[^.]+$/, '').replace(/^.*\//, '');
            const stemFile = new File([bytes], filename, { type: 'audio/mpeg' });
            const uploaded = await base44.integrations.Core.UploadFile({ file: stemFile });
            stems[stemName] = uploaded.file_url;
          }
          result.stems = stems;
          result.tier = tier;
          result.provider = 'elevenlabs';
        } else {
          // Sonic
          const sonicApiKey = Deno.env.get('SONIC_API_KEY');
          const stemResponse = await fetch('https://api.aimusicapi.ai/api/v1/sonic/separate', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${sonicApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              audio_url: audioUrl,
              separate_type: tier === 'advanced' ? (parameters.separate_type || 'advanced') : 'full',
            })
          });

          if (!stemResponse.ok) {
            throw new Error(`Sonic API error: ${stemResponse.statusText}`);
          }

          const stemData = await stemResponse.json();
          result.stems = stemData.stems || [];
          result.tier = tier;
          result.task_id = stemData.task_id;
          result.provider = 'sonic';
        }
        break;
      }

      case 'remaster': {
        // Use Sonic API for remastering
        const sonicApiKey = Deno.env.get('SONIC_API_KEY');
        const remasterResponse = await fetch('https://api.aimusicapi.ai/api/v1/sonic/remaster', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sonicApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            audio_url: audioUrl,
            target_loudness: parameters.target_loudness || -14
          })
        });

        if (!remasterResponse.ok) {
          throw new Error(`Sonic API error: ${remasterResponse.statusText}`);
        }

        const remasterData = await remasterResponse.json();
        result.outputUrl = remasterData.output_url;
        result.task_id = remasterData.task_id;
        break;
      }

      case 'vox_isolate': {
        // VOX — vocal isolation using Sonic API
        const sonicApiKeyVox = Deno.env.get('SONIC_API_KEY');
        const voxResponse = await fetch('https://api.aimusicapi.ai/api/v1/sonic/separate', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sonicApiKeyVox}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audio_url: audioUrl,
            separate_type: 'vocals', // isolate only vocals
            output_format: 'mp3',
          }),
        });

        if (!voxResponse.ok) {
          throw new Error(`Sonic VOX API error: ${voxResponse.statusText}`);
        }

        const voxData = await voxResponse.json();
        result.outputUrl = voxData.vocals_url || voxData.output_url;
        result.task_id = voxData.task_id;
        result.vox_type = 'isolated_vocals';
        break;
      }

      case 'vox_remove': {
        // VOX — instrumental only (remove vocals)
        const sonicApiKeyVoxRm = Deno.env.get('SONIC_API_KEY');
        const voxRmResponse = await fetch('https://api.aimusicapi.ai/api/v1/sonic/separate', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sonicApiKeyVoxRm}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audio_url: audioUrl,
            separate_type: 'instrumental', // remove vocals, keep instruments
            output_format: 'mp3',
          }),
        });

        if (!voxRmResponse.ok) {
          throw new Error(`Sonic VOX remove error: ${voxRmResponse.statusText}`);
        }

        const voxRmData = await voxRmResponse.json();
        result.outputUrl = voxRmData.instrumental_url || voxRmData.output_url;
        result.task_id = voxRmData.task_id;
        result.vox_type = 'instrumental_only';
        break;
      }

      case 'vox_enhance': {
        // VOX — vocal enhancement/de-noise via Sonic remaster with vocal focus
        const sonicApiKeyVoxEnh = Deno.env.get('SONIC_API_KEY');
        const voxEnhResponse = await fetch('https://api.aimusicapi.ai/api/v1/sonic/enhance-vocals', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sonicApiKeyVoxEnh}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audio_url: audioUrl,
            denoise: parameters.denoise !== false,
            clarity: parameters.clarity || 'high',
          }),
        });

        if (!voxEnhResponse.ok) {
          throw new Error(`Sonic VOX enhance error: ${voxEnhResponse.statusText}`);
        }

        const voxEnhData = await voxEnhResponse.json();
        result.outputUrl = voxEnhData.output_url;
        result.task_id = voxEnhData.task_id;
        result.vox_type = 'enhanced_vocals';
        break;
      }

      case 'replace_section': {
        // Advanced edit - replace audio section
        if (!parameters.startTime || !parameters.endTime || !parameters.newSegmentUrl) {
          return Response.json({ error: 'Missing startTime, endTime, or newSegmentUrl' }, { status: 400 });
        }

        const sonicApiKey = Deno.env.get('SONIC_API_KEY');
        const replaceResponse = await fetch('https://api.aimusicapi.ai/api/v1/sonic/replace-segment', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sonicApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            original_url: audioUrl,
            start_time: parameters.startTime,
            end_time: parameters.endTime,
            replacement_url: parameters.newSegmentUrl,
            crossfade_duration: parameters.crossfade_duration || 0.5
          })
        });

        if (!replaceResponse.ok) {
          throw new Error(`Sonic API error: ${replaceResponse.statusText}`);
        }

        const replaceData = await replaceResponse.json();
        result.outputUrl = replaceData.output_url;
        result.task_id = replaceData.task_id;
        break;
      }

      default:
        return Response.json({ error: 'Unknown task' }, { status: 400 });
    }

    // Secure content log for legal traceability
    const enc = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(`${user.id}|${task}|${audioUrl}|${new Date().toISOString()}`));
    const contentHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    base44.asServiceRole.entities.APIUsageLog.create({
      user_id: user.id, user_email: user.email, user_name: user.full_name,
      provider: result.provider || 'sonic', task: `process_edits`,
      credits_used: 1, status: 'success',
      timestamp: new Date().toISOString(),
      metadata: {
        model_version: 'sonic-edit-v1',
        input_parameters: { task, audio_url: audioUrl, parameters },
        output_details: {
          output_url: result.outputUrl || null,
          stems: result.stems || null,
          task_id: result.task_id || null,
        },
        generated_timestamp: new Date().toISOString(),
        content_hash: contentHash,
      },
    }).catch(() => {});

    return Response.json(result);
  } catch (error) {
    console.error('Error in processMusicEdits:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});