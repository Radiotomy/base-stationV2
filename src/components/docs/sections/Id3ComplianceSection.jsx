import CodeBlock from '../CodeBlock';
import ParamsTable from '../ParamsTable';

const FRAMES = `ID3v2.3 tag layout (MP3 exports)

TXXX (User-defined text frames)
├─ COS_SCORE              → "72"
├─ AI_DISCLOSURE_LABEL    → "ai_assisted"
├─ DDEX_AI_METADATA       → '{"ai_lyrical_content":false,...}'
├─ C2PA_PROVENANCE_HASH   → "sha256:7c1e4a9b0d…"
├─ BASE_MARK_PAYLOAD      → "dff13efe"
└─ BASE_MARK_VERSION      → "1.0"

WXXX (User-defined URL frame)
└─ PROVENANCE_MANIFEST    → https://basestation.live/api/v1/cos/manifest/{asset_id}`;

const READING = `# Reading the frames with ffprobe
ffprobe -show_entries format_tags -v quiet track.mp3

# Or with any ID3 library (Python / mutagen example)
from mutagen.id3 import ID3
tags = ID3("track.mp3")
for frame in tags.getall("TXXX"):
    print(frame.desc, "=", frame.text[0])
for frame in tags.getall("WXXX"):
    print(frame.desc, "=", frame.url)`;

export default function Id3ComplianceSection() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF9A4D] mb-2">Standards</p>
        <h1 className="text-3xl font-display text-foreground mb-4">ID3v2 Compliance</h1>
        <p className="text-muted-foreground leading-relaxed max-w-2xl">
          Provenance shouldn't stop at the API boundary — it should travel with the file. BASE Station injects
          COS and DDEX provenance data directly into every MP3 export as standard ID3v2 frames, so any downstream
          system (DSP ingestion pipelines, distributors, audit tools) can read a track's AI attribution without
          calling our API at all.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-display text-foreground">Injected frames</h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Two user-defined frame types carry the provenance payload:
        </p>
        <CodeBlock title="Frame layout" language="text" code={FRAMES} />
      </div>

      <ParamsTable
        title="TXXX frames (custom metadata)"
        params={[
          { name: 'COS_SCORE', type: 'TXXX', required: true, description: 'The asset\u2019s 0\u2013100 Creative Ownership Score at export time.' },
          { name: 'AI_DISCLOSURE_LABEL', type: 'TXXX', required: true, description: 'RIAA/IFPI-style label: "ai_generated" or "ai_assisted".' },
          { name: 'DDEX_AI_METADATA', type: 'TXXX', required: true, description: 'JSON-serialized DDEX AI attribution flags.' },
          { name: 'C2PA_PROVENANCE_HASH', type: 'TXXX', required: false, description: 'SHA-256 checksum anchoring the manifest to this file.' },
          { name: 'BASE_MARK_PAYLOAD', type: 'TXXX', required: false, description: 'Hex payload of the BASE Mark acoustic watermark embedded in this asset\u2019s audio waveform.' },
          { name: 'BASE_MARK_VERSION', type: 'TXXX', required: false, description: 'BASE Mark engine version used for embedding.' },
        ]}
      />

      <ParamsTable
        title="WXXX frame (manifest URL)"
        params={[
          { name: 'PROVENANCE_MANIFEST', type: 'WXXX', required: true, description: 'Resolvable URL of the asset\u2019s canonical Provenance Manifest (GET /api/v1/cos/manifest/{asset_id}).' },
        ]}
      />

      <div className="space-y-3">
        <h2 className="text-xl font-display text-foreground">Where injection happens</h2>
        <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
          <li><span className="text-foreground font-medium">Downloads</span> — frames are written when a creator downloads an MP3 from any studio.</li>
          <li><span className="text-foreground font-medium">Audius publishing</span> — the tagged file is what gets uploaded, so provenance persists on the network.</li>
          <li><span className="text-foreground font-medium">MP3 only</span> — ID3v2 is not valid inside WAV containers; WAV exports rely on the manifest URL and the in-waveform BASE Mark instead.</li>
          <li><span className="text-foreground font-medium">Cross-referenced with the watermark</span> — the same BASE Mark payload written into the TXXX frames is acoustically embedded in the waveform, so even if these frames are stripped, the file can be traced back to this record.</li>
        </ul>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Injection is best-effort and non-blocking: if tagging ever fails, the original file is still delivered and
          provenance remains available via the manifest endpoint.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-display text-foreground">Reading the frames</h2>
        <CodeBlock title="Verification examples" language="shell" code={READING} />
      </div>
    </div>
  );
}