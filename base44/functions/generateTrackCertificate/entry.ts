import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

/**
 * Phase 1 — Generate Official Digital Certificate (PDF) for a registered track.
 * Security:
 *   - Authenticates the requesting user
 *   - Ensures the requested registration belongs to the requesting user (RLS-aligned)
 *   - All sensitive operations execute server-side
 * Logging / Accountability:
 *   - Logs success to AnalyticsEvent (event_type: 'certificate_downloaded')
 *   - Logs failures to ErrorLog (component: 'generateTrackCertificate')
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const logError = async (user, message, stack, context = {}, severity = 'error') => {
    try {
      await base44.asServiceRole.entities.ErrorLog.create({
        user_id: user?.id,
        user_email: user?.email,
        component: 'generateTrackCertificate',
        severity,
        message: String(message || 'unknown error').slice(0, 1000),
        stack: stack ? String(stack).slice(0, 4000) : undefined,
        context,
      });
    } catch (_) { /* swallow */ }
  };

  let currentUser = null;

  try {
    currentUser = await base44.auth.me();
    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { registrationId, blockchainType } = await req.json();

    if (!registrationId || !blockchainType) {
      await logError(currentUser, 'Missing registrationId or blockchainType', null, { registrationId, blockchainType }, 'warning');
      return Response.json({ error: 'registrationId and blockchainType are required' }, { status: 400 });
    }

    const type = String(blockchainType).toLowerCase();
    if (type !== 'base' && type !== 'solana') {
      await logError(currentUser, 'Invalid blockchainType', null, { blockchainType }, 'warning');
      return Response.json({ error: 'blockchainType must be "base" or "solana"' }, { status: 400 });
    }

    // Fetch registration (RLS-style ownership check)
    const entity = type === 'base' ? 'BaseTrackRegistry' : 'SolanaTrackRegistry';
    let reg = null;
    try {
      const rows = await base44.entities[entity].filter({ id: registrationId });
      reg = rows[0];
    } catch (_) {
      reg = null;
    }

    if (!reg) {
      await logError(currentUser, 'Registration not found', null, { registrationId, blockchainType: type }, 'warning');
      return Response.json({ error: 'Registration not found' }, { status: 404 });
    }

    if (reg.artist_id !== currentUser.id) {
      await logError(currentUser, 'Unauthorized certificate access attempt', null, {
        registrationId, blockchainType: type, owner_id: reg.artist_id
      }, 'warning');
      return Response.json({ error: 'Forbidden — you do not own this registration' }, { status: 403 });
    }

    // ---- Build the PDF ----
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 50;
    const accent = type === 'base' ? [37, 99, 235] : [139, 92, 246]; // blue / violet
    const chainLabel = type === 'base' ? 'Base Network' : 'Solana Network';
    const txValue = type === 'base' ? (reg.transaction_hash || '—') : (reg.transaction_signature || '—');
    const contractValue = type === 'base' ? (reg.contract_address || '—') : (reg.nft_mint_address || '—');
    const explorerUrl = type === 'base'
      ? (reg.transaction_hash ? `https://basescan.org/tx/${reg.transaction_hash}` : '')
      : (reg.transaction_signature ? `https://solscan.io/tx/${reg.transaction_signature}` : '');

    // Border
    doc.setDrawColor(...accent);
    doc.setLineWidth(3);
    doc.rect(margin / 2, margin / 2, pageWidth - margin, doc.internal.pageSize.getHeight() - margin);

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...accent);
    doc.text('OFFICIAL DIGITAL CERTIFICATE', pageWidth / 2, margin + 10, { align: 'center' });

    doc.setFontSize(28);
    doc.setTextColor(20, 20, 20);
    doc.text('Certificate of Authorship', pageWidth / 2, margin + 45, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(90, 90, 90);
    doc.text(`Immutably registered on ${chainLabel}`, pageWidth / 2, margin + 65, { align: 'center' });

    // Divider
    doc.setDrawColor(...accent);
    doc.setLineWidth(1);
    doc.line(margin, margin + 85, pageWidth - margin, margin + 85);

    // Body — recital
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text('This certifies that the following original musical work has been recorded on the public', margin, margin + 110);
    doc.text(`${chainLabel} blockchain, establishing immutable proof of authorship and provenance.`, margin, margin + 125);

    // Track details
    let y = margin + 160;
    const labelCol = margin;
    const valueCol = margin + 150;
    const lineGap = 22;

    const drawRow = (label, value) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(110, 110, 110);
      doc.text(label.toUpperCase(), labelCol, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(20, 20, 20);
      const str = String(value ?? '—');
      const wrapped = doc.splitTextToSize(str, pageWidth - valueCol - margin);
      doc.text(wrapped, valueCol, y);
      y += lineGap * Math.max(1, wrapped.length);
    };

    drawRow('Track Title', reg.track_title);
    drawRow('Artist', reg.artist_name || currentUser.full_name || '—');
    drawRow('Artist Email', reg.artist_email || currentUser.email || '—');
    if (reg.genre) drawRow('Genre', reg.genre);
    if (reg.ai_tools_used) drawRow('AI Tools Used', reg.ai_tools_used);
    if (reg.description) drawRow('Description', reg.description);

    y += 10;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 25;

    // Blockchain details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...accent);
    doc.text('Blockchain Record', margin, y);
    y += 22;

    drawRow('Network', reg.network || chainLabel);
    drawRow('Wallet Address', reg.wallet_address);
    drawRow(type === 'base' ? 'Transaction Hash' : 'Transaction Signature', txValue);
    drawRow(type === 'base' ? 'Contract Address' : 'NFT Mint Address', contractValue);
    if (reg.metadata_uri) drawRow('Metadata URI', reg.metadata_uri);
    if (reg.fingerprint_hash) drawRow('Fingerprint (SHA-256)', reg.fingerprint_hash);
    drawRow('Status', reg.registration_status || 'pending');
    drawRow('Registered At', reg.registered_at ? new Date(reg.registered_at).toUTCString() : (reg.created_date ? new Date(reg.created_date).toUTCString() : '—'));

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...accent);
    doc.setLineWidth(1);
    doc.line(margin, pageHeight - 95, pageWidth - margin, pageHeight - 95);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text(`Certificate ID: ${reg.id}`, margin, pageHeight - 75);
    doc.text(`Issued: ${new Date().toUTCString()}`, margin, pageHeight - 60);
    if (explorerUrl) {
      doc.setTextColor(...accent);
      doc.textWithLink('Verify on blockchain explorer →', margin, pageHeight - 45, { url: explorerUrl });
    }

    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.text('This certificate is automatically generated from on-chain data. Verify authenticity via the transaction link above.', pageWidth / 2, pageHeight - 25, { align: 'center' });

    const pdfBytes = doc.output('arraybuffer');

    // Logging — success
    try {
      await base44.asServiceRole.entities.AnalyticsEvent.create({
        user_id: currentUser.id,
        user_email: currentUser.email,
        event_type: 'generation_completed',
        event_data: {
          kind: 'certificate_downloaded',
          registration_id: reg.id,
          blockchain_type: type,
          track_title: reg.track_title,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (_) { /* swallow */ }

    const safeTitle = String(reg.track_title || 'certificate').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60);
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="certificate_${type}_${safeTitle}.pdf"`,
      },
    });
  } catch (error) {
    await logError(currentUser, error.message, error.stack);
    return Response.json({ error: error.message || 'Failed to generate certificate' }, { status: 500 });
  }
});