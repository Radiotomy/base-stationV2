import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Triggered by entity automation when a GenerationJob changes status to completed/failed.
// Payload: { event, data, old_data }

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Support both direct call and entity automation payload
    const job = body?.data || body;

    if (!job?.user_email || !job?.status) {
      return Response.json({ error: 'Missing job data' }, { status: 400 });
    }

    const { user_email, user_id, job_type, provider, status, output_url, error_message } = job;

    const isComplete = status === 'completed';
    const typeLabel = job_type === 'video' ? 'Video' : job_type === 'music' ? 'Music Track' : 'Generation';
    const providerLabel = provider ? ` (${provider})` : '';

    const subject = isComplete
      ? `✅ Your ${typeLabel} is ready!`
      : `❌ Your ${typeLabel} generation failed`;

    const body_html = isComplete
      ? `
        <h2 style="color:#a855f7">Your ${typeLabel}${providerLabel} is ready! 🎵</h2>
        <p>Great news — your AI-generated ${typeLabel.toLowerCase()} has finished processing on Base Station.</p>
        ${output_url ? `<p><a href="${output_url}" style="color:#a855f7">Click here to listen / download</a></p>` : ''}
        <p>Head back to your <strong>Creator Dashboard</strong> or the relevant Studio to access and save your track.</p>
        <br/>
        <p style="color:#888;font-size:12px">Base Station — AI Music Platform</p>
      `
      : `
        <h2 style="color:#ef4444">Your ${typeLabel}${providerLabel} generation failed</h2>
        <p>Unfortunately, your ${typeLabel.toLowerCase()} generation did not complete successfully.</p>
        ${error_message ? `<p><strong>Reason:</strong> ${error_message}</p>` : ''}
        <p>Please try again from your Studio — your credits have not been charged for failed jobs.</p>
        <br/>
        <p style="color:#888;font-size:12px">Base Station — AI Music Platform</p>
      `;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user_email,
      subject,
      body: body_html,
      from_name: 'Base Station',
    });

    // Log the notification
    console.log(`Notification sent to ${user_email} — job ${status} (${job_type}/${provider})`);

    return Response.json({ success: true, sent_to: user_email });
  } catch (error) {
    console.error('sendJobNotification error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});