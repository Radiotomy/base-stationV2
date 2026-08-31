import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Triggered by entity automation when a GenerationJob changes status to completed/failed.
// Payload: { event, data, old_data }

const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Best available human name for the job.
 *
 * A GenerationJob has no `title` column — the name lives wherever the studio that
 * created the row happened to put it, so the fallback order matters:
 *   output_metadata.title  — what the engine actually named the finished audio
 *   input_data.title       — what the creator typed before generating
 *   input_data.source_title— the source score/track a derived render came from
 *   input_data.topic       — lyric/brief jobs, which carry a subject not a title
 * Returns '' when the job genuinely has no name, so callers can omit it rather
 * than print "undefined" at a creator.
 */
const resolveTitle = (job) => {
  const candidates = [
    job?.output_metadata?.title,
    job?.input_data?.title,
    job?.input_data?.source_title,
    job?.input_data?.topic,
  ];
  const found = candidates.find((t) => typeof t === 'string' && t.trim());
  return found ? found.trim().slice(0, 200) : '';
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Reject unauthenticated direct calls — only the platform automation
    // (which invokes with platform auth) or an admin may send job emails.
    const caller = await base44.auth.me().catch(() => null);
    if (!caller || caller.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

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

    const title = resolveTitle(job);
    const safeTitle = title ? escapeHtml(title) : '';

    // The title is what the creator recognises — it leads the subject line. The
    // generic type label stays as the fallback for jobs that never had a name.
    const subject = isComplete
      ? (title ? `✅ "${title}" is ready!` : `✅ Your ${typeLabel} is ready!`)
      : (title ? `❌ "${title}" failed to generate` : `❌ Your ${typeLabel} generation failed`);

    // A few facts the creator can act on, each only when the engine reported it.
    const meta = job?.output_metadata || {};
    const details = [
      safeTitle ? `<strong>Title:</strong> ${safeTitle}` : '',
      `<strong>Type:</strong> ${escapeHtml(typeLabel)}`,
      provider ? `<strong>Engine:</strong> ${escapeHtml(provider)}` : '',
      meta.duration ? `<strong>Length:</strong> ${escapeHtml(Math.round(Number(meta.duration)))}s` : '',
      meta.bpm ? `<strong>BPM:</strong> ${escapeHtml(meta.bpm)}` : '',
      meta.key ? `<strong>Key:</strong> ${escapeHtml(meta.key)}` : '',
    ].filter(Boolean);

    const detailsHtml = `<p style="line-height:1.7">${details.join('<br/>')}</p>`;

    const body_html = isComplete
      ? `
        <h2 style="color:#a855f7">${safeTitle ? `${safeTitle} is ready! 🎵` : `Your ${typeLabel}${providerLabel} is ready! 🎵`}</h2>
        <p>Great news — your ${typeLabel.toLowerCase()} has finished processing on Base Station.</p>
        ${detailsHtml}
        ${output_url && /^https?:\/\//i.test(output_url) ? `<p><a href="${escapeHtml(output_url)}" style="color:#a855f7">Click here to listen / download</a></p>` : ''}
        <p>Head back to your <strong>Creator Dashboard</strong> or the relevant Studio to access and save your track.</p>
        <br/>
        <p style="color:#888;font-size:12px">Base Station — AI Music Platform</p>
      `
      : `
        <h2 style="color:#ef4444">${safeTitle ? `${safeTitle} failed to generate` : `Your ${typeLabel}${providerLabel} generation failed`}</h2>
        <p>Unfortunately, your ${typeLabel.toLowerCase()} generation did not complete successfully.</p>
        ${detailsHtml}
        ${error_message ? `<p><strong>Reason:</strong> ${escapeHtml(error_message)}</p>` : ''}
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