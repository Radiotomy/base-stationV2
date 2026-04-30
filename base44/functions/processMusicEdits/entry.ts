import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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
        // Use Sonic API for stem extraction
        const sonicApiKey = Deno.env.get('SONIC_API_KEY');
        const stemResponse = await fetch('https://api.aimusicapi.ai/api/v1/sonic/separate', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sonicApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            audio_url: audioUrl,
            separate_type: parameters.separate_type || 'full' // 'full' for 4 stems (vocals, drums, bass, other)
          })
        });

        if (!stemResponse.ok) {
          throw new Error(`Sonic API error: ${stemResponse.statusText}`);
        }

        const stemData = await stemResponse.json();
        result.stems = stemData.stems || [];
        result.task_id = stemData.task_id;
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

      case 'add_vocals': {
        // Use Nuro or Producer API to add vocals
        const nuroApiKey = Deno.env.get('NURO_API_KEY');
        const vocalResponse = await fetch('https://api.aimusicapi.ai/api/v1/nuro/add-vocals', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${nuroApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            instrumental_url: audioUrl,
            vocal_prompt: parameters.vocal_prompt || 'Default male vocals',
            duration: parameters.duration || 30
          })
        });

        if (!vocalResponse.ok) {
          throw new Error(`Nuro API error: ${vocalResponse.statusText}`);
        }

        const vocalData = await vocalResponse.json();
        result.outputUrl = vocalData.output_url;
        result.task_id = vocalData.task_id;
        break;
      }

      case 'add_instrumental': {
        // Use Producer API to add instrumental backing
        const producerApiKey = Deno.env.get('PRODUCER_API_KEY');
        const instrumentalResponse = await fetch('https://api.aimusicapi.ai/api/v1/producer/add-instrument', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${producerApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            vocal_url: audioUrl,
            instrument_prompt: parameters.instrument_prompt || 'Piano and strings',
            genre: parameters.genre || 'pop'
          })
        });

        if (!instrumentalResponse.ok) {
          throw new Error(`Producer API error: ${instrumentalResponse.statusText}`);
        }

        const instrumentalData = await instrumentalResponse.json();
        result.outputUrl = instrumentalData.output_url;
        result.task_id = instrumentalData.task_id;
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

    // Log the edit operation
    await base44.asServiceRole.entities.AnalyticsEvent.create({
      user_id: user.id,
      user_email: user.email,
      event_type: 'generation_completed',
      event_data: { task, parameters },
      session_id: parameters.session_id || 'unknown'
    });

    return Response.json(result);
  } catch (error) {
    console.error('Error in processMusicEdits:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});