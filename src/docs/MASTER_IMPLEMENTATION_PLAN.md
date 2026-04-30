# Base Station: Master AI Music Integration Plan

## Executive Summary

Base Station is a comprehensive AI-powered music creation platform that integrates multiple music generation, editing, and video APIs through a modular, phased approach. This plan consolidates all infrastructure, API integrations, frontend experiences, and backend orchestration into a single roadmap spanning four implementation phases plus ongoing optimization.

**Key Principles:**
- Modular architecture with clear separation of concerns
- Intelligent API routing for cost optimization and feature coverage
- Client-side processing (Web Audio/Video APIs) for immediate feedback
- Server-side AI APIs for advanced generation and processing
- Unified credit tracking and logging across all providers
- Progressive feature delivery with continuous user value

---

## Phase 0: Infrastructure Setup (Pre-Implementation)

### 0.1 Secret Management

**Objective:** Securely store and manage API credentials for all external services.

**Action Items:**
```
Request via set_secrets:
- LOUDLY_API_KEY (Loudly music generation)
- AIMUSIC_API_KEY (AI Music API: Sonic, Producer, Nuro, stems, editing)
- TEMPOLOR_API_KEY (Tempolor: music, lyrics, instrumentals, stems)
- LTX_API_KEY (LTX: video generation, retake, extend)
- OPENAI_API_KEY (optional: for advanced prompt engineering)
```

### 0.2 File Storage & CDN Strategy

**Architecture:**
- **Public Assets:** `Core.UploadFile` → Base44 CDN for generated tracks, lyrics, cover art
- **Private Assets:** `Core.UploadPrivateFile` → Signed URLs via `CreateFileSignedUrl` for user project files, stems, intermediate edits
- **Playback:** Stream directly from Base44 CDN; sign URLs on-demand for temporary private access
- **Future:** If performance bottlenecks emerge, integrate external CDN (e.g., Cloudflare, BunnyCDN)

**Storage Schema:**
```
/user-{id}/
  /tracks/
    - {track_id}.m4a (final mix)
    - {track_id}-stems/ (vocals, drums, instruments, etc.)
  /lyrics/
    - {lyric_id}.txt
  /cover-art/
    - {artwork_id}.jpg
  /projects/ (private)
    - {project_id}-session.json
    - {project_id}-waveform.json
```

### 0.3 Unified API Wrapper Backend Functions

**Core Functions to Create:**

#### `generateLyrics(provider, prompt, userPreferences)`
- Routes to AI Music API (Nuro) or Tempolor based on complexity/cost
- Handles async task polling, callbacks
- Standardizes output: `{ lyrics: string, titles: [], metadata: {} }`
- Logs credits consumed

#### `generateMusic(provider, options)`
- Providers: Loudly, AI Music API (Sonic/Producer), Tempolor
- Input: `{ soundPrompt, lyrics?, duration, genre, mood, seed?, provider }`
- Output: `{ audioUrl, duration, metadata, coverArt?, credits_used }`
- Handles multi-track responses (returns array if applicable)
- Auto-generates cheap cover art for initial track generation

#### `processMusicEdits(task, audioInput, parameters)`
- Tasks: extract_stems, remaster, replace_section, add_vocals, add_instrumental
- Providers: AI Music API (Sonic/Producer), Tempolor
- Uses Web Audio API for client-side effects where applicable
- Output: Edited audio + stems to storage

#### `generateVideo(provider, inputs)`
- Provider: LTX API
- Tasks: text_to_video, image_to_video, audio_to_video, retake, extend
- Output: `{ videoUrl, duration, metadata, credits_used }`

#### `generateCoverArt(prompt, quality)`
- Quality: "cheap" (auto-generated, gemini_3_flash) or "modest" (user-customized, gemini_3_1_pro)
- Uses `Core.GenerateImage`
- Output: `{ imageUrl, credits_used }`

#### `queryAPICredits(provider)`
- Calls Tempolor's "Query Balance," AI Music API's "get-credits"
- Returns: `{ balance, lastUpdated, provider }`

#### `logAPIUsage(userId, provider, task, credits, duration)`
- Persists to `APIUsageLog` entity
- Tracks all API calls for admin dashboard and billing

**Error Handling & Retry Strategy:**
- Implement exponential backoff (3 retries max)
- Graceful degradation: fallback to alternative provider if primary fails
- User-facing error messages with credit refund options

---

## Phase 1: Core Music Generation, Dedicated Lyrics Studio & Tiered Cover Art

### 1.1 Dedicated Lyrics Generation Studio

**Backend:**
- `generateLyrics()` function with intelligent provider routing
- Async task management with webhook callbacks for fast feedback
- Caching of generated lyrics for quick retrieval

**AI Agent: `agents/lyrics_studio.json`**
```json
{
  "description": "AI Lyric Writing Studio — Generate, refine, and perfect song lyrics with intelligent suggestions and musical context.",
  "instructions": "You are a creative lyric writing assistant. Help users generate original lyrics based on themes, moods, and musical styles. Offer variations, refinements, and improvements. Guide them through song structure (verse, chorus, bridge, etc.).",
  "tool_configs": [
    {
      "type": "backend_function",
      "function_name": "generateLyrics",
      "reason": "Generate lyrics from user prompts via AI Music API or Tempolor"
    }
  ]
}
```

**Frontend: `pages/LyricsStudio.jsx`**
- Chat interface with AI agent for iterative lyric creation
- Edit panel for manual lyric refinement
- Section manager (Verse, Chorus, Bridge, Outro) with drag-to-reorder
- Real-time waveform visualization if audio reference provided
- Save to Base44 storage with versioning
- Export as .txt, .srt (for video), or sync with music generation

### 1.2 Music Track Generation (Initial)

**Backend:**
- `generateMusic()` with multi-provider support
- Handles async polling for Provider/Tempolor (task-based)
- Sonic (Loudly) may be synchronous; confirm and adapt accordingly
- Auto-triggers cheap cover art generation

**Frontend: `pages/MusicStudio.jsx` or `components/MusicGenerator.jsx`**
- **Input Panel:**
  - Provider selection (Loudly, Sonic, Producer, Tempolor, Nuro)
  - Sound prompt input
  - Genre & mood dropdowns
  - Duration slider (15s—120s)
  - Lyrics input/selection (from Lyrics Studio)
  - Optional: Title, seed for reproducibility
- **Processing State:**
  - Progress indicator with estimated time
  - Live credit cost display
- **Output Panel:**
  - Waveform visualization (using Web Audio API)
  - Playback controls (play, pause, volume, speed)
  - Generated metadata (BPM, key, mood scores)
  - Auto-generated cover art preview
  - Actions: Download, Save to Library, Register on Blockchain, Edit (Phase 2)

**Automatic Cheap Cover Art:**
- Triggered on initial full track generation
- Prompt: `"Genre: [genre], Mood: [mood], Style: abstract, vibrant, professional album cover art"`
- Model: `gemini_3_flash` (cheapest, fast)
- Saved to `/cover-art/{track_id}-auto.jpg`

### 1.3 Tiered Cover Art Studio

**Frontend: `pages/CoverArtStudio.jsx` or `components/CoverArtGenerator.jsx`**
- **Cheap Automatic:** Pre-generated during track creation (view-only, included)
- **Modest Custom:** User can input detailed prompts
  - Prompt builder with suggestions (genre, mood, visual themes)
  - Preview gallery (3—5 variations)
  - Model: `gemini_3_1_pro` (higher quality, modest cost)
  - User informed of credit cost before generation
- **Actions:** Select & save to track, download, regenerate

### 1.4 Basic Asset Storage

**Create Entity: `UserAsset`**
```json
{
  "name": "UserAsset",
  "properties": {
    "user_id": { "type": "string" },
    "asset_type": { "type": "string", "enum": ["track", "lyric", "coverart", "project"] },
    "title": { "type": "string" },
    "description": { "type": "string" },
    "file_url": { "type": "string" },
    "metadata": { "type": "object" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "created_date": { "type": "string", "format": "date-time" },
    "is_public": { "type": "boolean", "default": false }
  }
}
```

**Backend Integration:**
- Auto-save all generated assets to `UserAsset` on completion
- Link to `TrackSubmission` for eventual publishing
- Provide quick-access library in AI Studio

---

## Phase 2: Advanced Music Editing & Multi-Provider Integration

### 2.1 Web Audio API Integration (Client-Side Audio Editor)

**Capabilities:**
- **Waveform Visualization:** Use Web Audio API `AnalyserNode` for real-time frequency display
- **Audio Trimming:** `AudioContext` with `MediaElementAudioSourceNode` for in/out point setting
- **Looping & Playback Control:** Native playback control with custom speed (0.5x—2x) and pitch shifting
- **Basic Effects:** 
  - Fade in/out (gain envelope)
  - Simple EQ (BiquadFilterNode for bass/mid/treble)
  - Volume normalization
- **Local Export:** Download edited audio as WAV before server upload

**Frontend: `components/AudioEditor.jsx`**
- Two-panel layout: Waveform viewer + effect controls
- Timeline with zoom/pan
- Keyboard shortcuts for common tasks
- Real-time playback with effects applied

### 2.2 Web Video API Integration (Client-Side Video Editor)

**Capabilities:**
- **Video Preview:** `<video>` element with standard controls
- **Frame Scrubbing:** Timeline-based seeking, frame-by-frame navigation
- **Segment Marking:** Set in/out points for cuts, export segment metadata
- **Thumbnail Generation:** `<canvas>` capture of keyframes
- **Subtitle/Text Overlay:** Canvas-based text rendering on video preview (visual planning)

**Frontend: `components/VideoEditor.jsx`**
- Timeline with video frames
- Trim/cut tools with preview
- Subtitle track editor
- Export segment list for LTX API processing

### 2.3 Unified Editing/Remixing Studio

**Backend:**
- `processMusicEdits()` with AI Music API (Sonic/Producer) and Tempolor
- Stem extraction: basic (2 tracks) vs full (12 tracks)
- Section replacement with seamless crossfade
- Vocal/instrumental isolation and re-mixing

**Frontend: `pages/AudioRemixStudio.jsx`**
- **File Upload:** Via `Core.UploadFile` (user's own audio)
- **Stem Extraction:**
  - Extract stems via AI Music API or Tempolor
  - Display in separate tracks
  - Individual volume/pan/mute controls (Web Audio API)
  - Solo individual stems for review
- **Advanced Edits:**
  - Replace music section (provide new segment)
  - Add vocals to instrumental (via AI Music API)
  - Add instrumental to vocal (remastering)
  - Remaster (enhance/normalize via provider)
- **Output:** Save final mix + individual stems to storage

### 2.4 Persona/Voice Integration

**Backend:**
- `createVoicePersona(audioFile, voiceMetadata)` → AI Music API voice creation endpoint
- Stores persona ID for future music generation

**Frontend: `pages/VoiceCreator.jsx`**
- Audio upload with sample recording guide
- Metadata input (name, vocal range, style, language)
- Preview of voice model creation process
- Saved personas list with manage/delete options

---

## Phase 3: Video Generation & Admin Credit Management

### 3.1 LTX Video Studio

**Backend:**
- `generateVideo()` with LTX API support
- Handles Text-to-Video, Image-to-Video, Audio-to-Video, Retake, Extend
- Async task polling with webhook callbacks
- Stores generated video to Base44 storage

**Frontend: `pages/VideoStudio.jsx`**
- **Text-to-Video:**
  - Rich prompt input with style suggestions
  - Model selection (if multiple LTX versions available)
  - Duration & aspect ratio options
- **Image-to-Video:**
  - Image upload (from cover art or custom)
  - Motion direction/intensity controls
  - Audio sync option
- **Audio-to-Video:**
  - Audio input (from generated track)
  - Visual theme/style prompt
  - Sync to beat/lyrics option
- **Iterative Refinement:**
  - Preview generated video
  - **Retake:** Regenerate with modified parameters
  - **Extend:** Extend duration with continuation prompt
  - Version history
- **Output:** Download, save to library, add to projects

### 3.2 Admin Credit Management Dashboard

**Create Entity: `APIUsageLog`**
```json
{
  "name": "APIUsageLog",
  "properties": {
    "user_id": { "type": "string" },
    "user_email": { "type": "string" },
    "provider": { "type": "string", "enum": ["loudly", "aimusic", "tempolor", "ltx", "openai"] },
    "task": { "type": "string" },
    "credits_used": { "type": "number" },
    "status": { "type": "string", "enum": ["success", "failed", "pending"] },
    "duration_ms": { "type": "number" },
    "timestamp": { "type": "string", "format": "date-time" }
  }
}
```

**Create Entity: `ProviderBalance`**
```json
{
  "name": "ProviderBalance",
  "properties": {
    "provider": { "type": "string", "enum": ["loudly", "aimusic", "tempolor", "ltx"] },
    "current_balance": { "type": "number" },
    "last_updated": { "type": "string", "format": "date-time" },
    "monthly_allocation": { "type": "number" },
    "monthly_used": { "type": "number" }
  }
}
```

**Frontend: `pages/admin/AdminAIIntegrations.jsx`**
- **Credit Status Cards:**
  - Current balance for each provider
  - Monthly usage vs allocation
  - Cost breakdown ($/credit for each provider)
- **Usage Analytics:**
  - Total credits consumed (overall, by provider, by user)
  - Top users by credit consumption
  - Popular tasks/features
  - Trends (daily/weekly/monthly charts)
- **Usage Logs:**
  - Filterable table: user, provider, task, status, date range
  - Export logs as CSV
- **Admin Actions:**
  - Manual balance refresh (poll provider APIs)
  - (Future) Manual credit top-up for users
  - Set monthly spending limits/alerts

**Backend: Scheduled Automation**
- Create automation: `refreshProviderBalances` (runs hourly)
  - Calls `queryAPICredits()` for each provider
  - Updates `ProviderBalance` entity
  - Alerts if balance drops below threshold

---

## Phase 4: Optimization, Advanced Features & UI/UX Polish

### 4.1 Performance Optimization

**Caching Strategy:**
- Cache generated lyrics (same prompt → same output)
- Cache BPM/key/vocal analysis results
- Browser local storage for draft projects

**API Call Optimization:**
- Batch requests where possible
- Parallel API calls (e.g., generate lyrics + cover art simultaneously)
- Prefetch likely user actions (e.g., "continue" predictions)

**Audio/Video Streaming:**
- HTTP range requests for large files
- Adaptive bitrate streaming if needed
- Lazy-load waveforms for long audio files

### 4.2 Enhanced UI/UX

- **Progress Indicators:** Detailed status with ETA for async tasks
- **Real-Time Feedback:** Show credit costs, estimated time, quality settings upfront
- **Keyboard Shortcuts:** Accessible editing (especially audio/video editors)
- **Dark/Light Themes:** Respect user preference (already in place)
- **Responsive Design:** Optimized for mobile, tablet, desktop

### 4.3 Advanced Features

- **AI Music API Utilities:**
  - BPM extraction → display & allow adjustment
  - VOX (vocal analysis) → isolation/enhancement
  - MIDI export for further production in DAWs
- **Tempolor Extensions:**
  - Song extension (continue existing track)
  - Instrumental extension
  - Advanced stem manipulation
- **Prompt Engineering:**
  - Suggestion library for common styles (lo-fi, cinematic, trap, etc.)
  - Prompt templates per genre/mood
  - User feedback loop to refine model understanding

---

## Technical Architecture Overview

### API Integration Matrix

| Provider | Lyrics | Music Gen | Editing | Video | Async | Outputs |
|----------|--------|-----------|---------|-------|-------|---------|
| **Loudly** | — | ✓ | — | — | Likely sync | Audio, metadata |
| **AI Music API (Sonic)** | ✓ timeline | ✓ | ✓ stems, remaster, replace, vocal add | — | Async | Audio, WAV, MIDI, BPM |
| **AI Music API (Producer)** | — | ✓ (lyrics input) | — | — | Async | Audio, image |
| **AI Music API (Nuro)** | ✓ dedicated | ✓ vocal/instrumental | — | — | — | Audio |
| **Tempolor** | ✓ dedicated | ✓ | ✓ stems, extend | — | Async | Audio, metadata |
| **LTX API** | — | — | — | ✓ | Async | Video |
| **Core.GenerateImage** | — | — | — | — | Async | Image |

### Data Flow Diagram

```
User Input (Prompts, Uploads)
    ↓
Frontend (Pages/Components with Web Audio/Video APIs)
    ↓
Unified Backend Functions (generateLyrics, generateMusic, etc.)
    ↓
Provider Router (select AI Music API, Tempolor, LTX, etc.)
    ↓
External API Call + Error Handling
    ↓
Async Task Polling / Webhook Callback
    ↓
Base44 Storage (Core.UploadFile)
    ↓
UserAsset Entity + APIUsageLog
    ↓
Frontend Display + User Library
```

### Web Audio/Video API Usage

| API | Use Case | Phase |
|-----|----------|-------|
| **Web Audio** | Waveform visualization, trimming, EQ, fade effects, playback control | 2 |
| **Web Video** | Video preview, frame scrubbing, thumbnail generation, segment marking | 3 |
| **Canvas API** | Text overlay preview, waveform rendering | 2–3 |

---

## Implementation Roadmap & Timeline

### Phase 0: Week 1—2
- [ ] Collect & store API keys
- [ ] Create backend function stubs for all providers
- [ ] Set up file storage structure & CDN
- [ ] Create APIUsageLog & ProviderBalance entities

### Phase 1: Week 3—6
- [ ] Implement `generateLyrics()` backend function
- [ ] Create `agents/lyrics_studio.json` AI agent
- [ ] Build `pages/LyricsStudio.jsx` component
- [ ] Implement `generateMusic()` backend function
- [ ] Build `pages/MusicStudio.jsx` with Web Audio API waveform
- [ ] Auto-generate cheap cover art in `generateMusic()`
- [ ] Build `pages/CoverArtStudio.jsx`
- [ ] Create `UserAsset` entity and integrate storage

### Phase 2: Week 7—10
- [ ] Build `components/AudioEditor.jsx` with Web Audio API
- [ ] Implement `processMusicEdits()` backend function
- [ ] Build `pages/AudioRemixStudio.jsx` with stem extraction
- [ ] Implement voice persona creation
- [ ] Refactor audio playback for consistency

### Phase 3: Week 11—13
- [ ] Implement `generateVideo()` backend function
- [ ] Build `pages/VideoStudio.jsx` with Web Video API
- [ ] Build `components/VideoEditor.jsx`
- [ ] Create `APIUsageLog` entity & logging infrastructure
- [ ] Build admin dashboard section
- [ ] Set up automated balance refresh

### Phase 4: Week 14+
- [ ] Implement caching strategies
- [ ] Optimize API call sequences
- [ ] Add BPM/VOX/MIDI extraction features
- [ ] Enhance UI/UX across all pages
- [ ] User testing & refinements

---

## Success Metrics

- **User Adoption:** Track active users in AI Studios (Lyrics, Music, Video)
- **Credit Efficiency:** Monitor average credits per track generated
- **Feature Usage:** Most-used generation + editing features
- **Error Rates:** Track failed API calls & retry success rates
- **Performance:** Average task completion time per provider
- **User Satisfaction:** NPS for AI Studios

---

## Future Enhancements

- Collaborative project editing (real-time sync)
- Advanced prompt engineering with AI suggestions
- Integration with music distribution platforms (DistroKid, CD Baby)
- Smart credit bundling/pricing tiers
- Community templates & presets
- Mobile app (React Native)
- Voice-controlled prompt input

---

## Appendix: API Reference Quick Links

- **Loudly:** https://loudly.com/api
- **AI Music API Sonic:** https://docs.aimusicapi.ai/doc-2058749
- **AI Music API Producer:** https://docs.aimusicapi.ai/doc-2058752
- **AI Music API Nuro:** https://docs.aimusicapi.ai/doc-2058753
- **AI Music API Lyrics:** https://docs.aimusicapi.ai/api-32136937
- **Tempolor:** https://platform.tempolor.com/docs
- **LTX Video:** https://www.ltx.ai/api
- **Web Audio API:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- **Web Video API:** https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement