"""
Cantor — BASE Station's DiffSinger singing-voice engine.

Renders a HUMAN-AUTHORED melody (syllable + MIDI pitch + beat length) into sung
vocals using DiffSinger ONNX voicebanks in the OpenUtau bank format.

Design notes that are load-bearing:

* THE MELODY IS NOT NEGOTIABLE. The requested pitches are written straight into
  the f0 curve. Nothing here smooths, re-harmonizes or "improves" the line,
  because a render that drifts off the authored notes silently destroys the
  authorship claim this whole engine exists to support.

* RENDERING IS ASYNCHRONOUS. A diffusion vocal render on CPU takes minutes, far
  past any sane HTTP timeout, so /render returns a job id and the caller polls
  /status. Inline would guarantee gateway timeouts. Installs use the same
  lifecycle: a 500 MB bank download plus a validation render is minutes too.

* ONE JOB AT A TIME. max_workers=1 is deliberate. Concurrent renders each hold a
  full acoustic model plus a full mel tensor in RAM — exactly how the Coda and
  Siren Song Spaces earn their meta-tensor / OOM crashes. Queueing is slower but
  never fails. Installs share the same worker so a validation render can never
  overlap a creator's render.

* VOICEBANKS LIVE IN /data, NOT IN THIS IMAGE. /data is the persistent mount; a
  bank under /tmp would need re-uploading on every restart. The engine ships with
  no voices on purpose — each bank carries its own licence.

* INSTALL IS OWNER-AUTHENTICATED VIA HUGGING FACE. /install and DELETE accept a
  Hugging Face token and ask HF whoami who it belongs to; only the Space owner's
  token passes. No shared secret to provision or rotate on either side.

* A HALF-INSTALLED BANK IS AN ERROR, NEVER A VOICE. Every install binds the
  acoustic and vocoder inputs by name and performs a short test render. A bank
  that fails either is removed again, so a creator can never pick a voice that
  produces confident garbage.

* soundfile, NOT torchaudio. torchaudio's native backend does not load on the HF
  Space image (an already-paid-for lesson from Skye), and this Space has no torch
  at all — onnxruntime only.
"""

import json
import os
import shutil
import time
import urllib.request
import uuid
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import onnxruntime as ort
import soundfile as sf
import yaml
from huggingface_hub import HfApi, snapshot_download
from fastapi import FastAPI, Header, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

OUT = Path("/tmp/outputs")
OUT.mkdir(parents=True, exist_ok=True)


def _is_persistent_mount(path: Path) -> bool:
    """
    True only when the path sits on a real Hugging Face persistent-storage mount.
    A bare `mkdir /data` on an ephemeral disk is WRITABLE but not persistent — the
    banks vanish on the next restart — so writability must never be read as
    persistence. HF mounts persistent storage at /data; check the mount table.
    """
    try:
        mounts = Path("/proc/mounts").read_text().split("\n")
    except Exception:
        return False
    return any(len(m.split()) > 1 and m.split()[1] == "/data" for m in mounts)


def _writable_dir(preferred: str, fallback: str) -> Tuple[Path, bool]:
    """Use the persistent mount when it exists and is writable; otherwise fall back
    to /tmp and SAY SO in /health, rather than silently losing banks on restart."""
    for candidate in (Path(preferred), Path(fallback)):
        try:
            candidate.mkdir(parents=True, exist_ok=True)
            probe = candidate / ".write_probe"
            probe.write_text("ok")
            probe.unlink()
            return candidate, _is_persistent_mount(Path("/data")) and str(candidate).startswith("/data")
        except Exception:
            continue
    raise RuntimeError("no writable storage for voicebanks")


BANK_DIR, BANKS_PERSISTENT = _writable_dir(
    os.environ.get("VOICEBANK_DIR", "/data/voicebanks"), "/tmp/voicebanks"
)
VOCODER_DIR, _ = _writable_dir(
    os.environ.get("VOCODER_DIR", str(BANK_DIR.parent / "vocoders")), "/tmp/vocoders"
)
INSTALL_TMP = Path("/tmp/install")
INSTALL_TMP.mkdir(parents=True, exist_ok=True)

# DURABLE STORE = A PRIVATE HUB DATASET REPO, NOT THE SPACE DISK. This Space has no
# persistent-storage add-on, so /data is wiped on every restart. The owner's Hub
# account has repo storage instead, so every validated install is pushed to
# HUB_REPO (layout: voicebanks/<id>/…, vocoders/<id>/…) and pulled back into
# /data at boot. The repo is private on purpose: several community banks forbid
# redistribution, and a public mirror would be exactly that.
HUB_REPO = os.environ.get("CANTOR_HUB_REPO", "Radiotomy/cantor-voicebanks")
HUB_TOKEN = os.environ.get("HF_TOKEN")
HUB_SYNCED = False


def _hub_path(kind: str, bank_id: str) -> str:
    return f"{'vocoders' if kind == 'vocoder' else 'voicebanks'}/{bank_id}"


def _sync_from_hub():
    """Pull every stored bank into /data. Boot-blocking on purpose: a render that
    arrives before the banks exist would fail as 'not installed', which is false."""
    global HUB_SYNCED
    if not HUB_TOKEN:
        return
    try:
        snapshot_download(
            repo_id=HUB_REPO, repo_type="dataset", token=HUB_TOKEN,
            local_dir=str(BANK_DIR.parent), local_dir_use_symlinks=False,
        )
        HUB_SYNCED = True
    except Exception as exc:
        print(f"[cantor] hub sync skipped: {type(exc).__name__}: {exc}")


_sync_from_hub()

# The Hugging Face account that owns this Space. Only its tokens may install or
# remove banks.
OWNER = os.environ.get("CANTOR_OWNER", "Radiotomy").lower()

app = FastAPI(title="Cantor", description="DiffSinger singing voice synthesis")
# Static mount so a finished render is a plain downloadable URL. The backend copies
# it into Base44 storage — a /tmp file on a sleeping Space is gone.
app.mount("/outputs", StaticFiles(directory=str(OUT)), name="outputs")

JOBS: Dict[str, dict] = {}
POOL = ThreadPoolExecutor(max_workers=1)
_sessions: Dict[str, dict] = {}
_auth_cache: Dict[str, Tuple[bool, float]] = {}

# DiffSinger acoustic models are trained at a fixed frame rate. 512-sample hop at
# 44.1kHz is the community default; a bank that differs declares it in dsconfig.
DEFAULT_SAMPLE_RATE = 44100
DEFAULT_HOP = 512

# Expression curves the acoustic model may REQUIRE. Cantor has no variance model to
# predict these, so a bank that needs them is refused at install rather than fed
# constants that would make it sing wrong on purpose.
UNSUPPORTED_CURVES = ("energy", "breathiness", "voicing", "tension")


# ----------------------------------------------------------------------------- banks


def _read_yaml(file: Path) -> dict:
    try:
        return yaml.safe_load(file.read_text(encoding="utf-8")) or {}
    except Exception:
        return {}


def _resolve_vocoder(path: Path, cfg: dict) -> Tuple[Optional[Path], str]:
    """
    Banks rarely ship their own vocoder — dsconfig names a shared one instead
    ('vocoder: nsf_hifigan'). Look in the bank first, then the shared vocoder store.
    """
    named = str(cfg.get("vocoder") or "").strip()
    candidates: List[Path] = []
    if named:
        candidates += [path / named, path / named / "vocoder.onnx", VOCODER_DIR / named / "vocoder.onnx"]
    candidates += [path / "dsvocoder" / "vocoder.onnx", path / "vocoder.onnx"]
    for c in candidates:
        if c.is_file():
            return c, "bundled" if str(c).startswith(str(path)) else "global"
    for c in sorted(VOCODER_DIR.glob("*/vocoder.onnx")):
        return c, "global"
    return None, "missing"


def _resolve_dictionary(path: Path, cfg: dict) -> Tuple[Optional[Path], str]:
    """Prefer an English dictionary on a multi-dict bank; otherwise whatever exists."""
    dicts = cfg.get("dictionaries")
    if isinstance(dicts, dict) and dicts:
        for lang in ("en", "en-us", "eng", "english"):
            if lang in dicts and (path / str(dicts[lang])).is_file():
                return path / str(dicts[lang]), lang
        for lang, name in dicts.items():
            if (path / str(name)).is_file():
                return path / str(name), str(lang)
    single = cfg.get("dictionary")
    if single and (path / str(single)).is_file():
        return path / str(single), ""
    for name in ("dsdict-en.yaml", "dsdict.yaml", "dictionary.txt"):
        if (path / name).is_file():
            return path / name, "en" if "en" in name else ""
    return None, ""


def _bank_display_name(path: Path, cfg: dict) -> str:
    if cfg.get("name"):
        return str(cfg["name"])
    char_yaml = path / "character.yaml"
    if char_yaml.is_file():
        name = _read_yaml(char_yaml).get("name")
        if name:
            return str(name)
    char_txt = path / "character.txt"
    if char_txt.is_file():
        for line in char_txt.read_text(encoding="utf-8", errors="ignore").splitlines():
            if line.lower().startswith("name="):
                return line.split("=", 1)[1].strip()
    return path.name


def _bank_paths(path: Path) -> dict:
    """Locate a bank's parts. Missing pieces are reported, never guessed at."""
    cfg_file = path / "dsconfig.yaml"
    cfg = _read_yaml(cfg_file) if cfg_file.exists() else {}

    acoustic = path / str(cfg.get("acoustic") or "acoustic.onnx")
    vocoder, vocoder_source = _resolve_vocoder(path, cfg)
    dictionary, dict_lang = _resolve_dictionary(path, cfg)

    licence = ""
    for name in ("LICENSE", "LICENSE.txt", "LICENSE.md", "LICENCE", "license.txt", "README.md", "readme.txt"):
        f = path / name
        if f.exists():
            licence = f.read_text(encoding="utf-8", errors="ignore").strip()[:600]
            break

    speakers = cfg.get("speakers") if isinstance(cfg.get("speakers"), list) else []

    return {
        "cfg": cfg,
        "acoustic": acoustic if acoustic.is_file() else None,
        "vocoder": vocoder,
        "vocoder_source": vocoder_source,
        "dictionary": dictionary,
        "dict_lang": dict_lang,
        "phonemes": cfg.get("phonemes") or ("phonemes.txt" if (path / "phonemes.txt").is_file() else None),
        "speakers": [str(s) for s in speakers],
        "languages": cfg.get("languages") if isinstance(cfg.get("languages"), dict) else {},
        "sample_rate": int(cfg.get("sample_rate") or DEFAULT_SAMPLE_RATE),
        "hop_size": int(cfg.get("hop_size") or DEFAULT_HOP),
        "name": _bank_display_name(path, cfg),
        "language": str(cfg.get("language") or ("en" if dict_lang.startswith("en") else dict_lang or "")),
        "license": licence,
    }


def list_banks() -> List[dict]:
    if not BANK_DIR.exists():
        return []
    out = []
    for path in sorted(p for p in BANK_DIR.iterdir() if p.is_dir()):
        parts = _bank_paths(path)
        out.append(
            {
                "id": path.name,
                "name": parts["name"],
                "language": parts["language"],
                "license": parts["license"],
                "speakers": parts["speakers"],
                "vocoder_source": parts["vocoder_source"],
                "sample_rate": parts["sample_rate"],
                # Reported rather than hidden: a half-installed bank should be a
                # diagnosable problem, not a voice that mysteriously vanished.
                "renderable": bool(parts["acoustic"] and parts["vocoder"]),
            }
        )
    return out


def load_phoneme_map(path: Path, parts: dict) -> Dict[str, int]:
    """Phoneme -> token id. dsconfig's ordered list is authoritative when present."""
    listed = parts.get("phonemes")
    if not listed:
        return {}
    if isinstance(listed, str):
        f = path / listed
        listed = (
            f.read_text(encoding="utf-8").split()
            if f.exists()
            else [p.strip() for p in listed.split(",")]
        )
    return {p: i for i, p in enumerate(listed)}


def load_dictionary(file: Optional[Path]) -> Dict[str, List[str]]:
    """
    Grapheme -> phonemes. Two formats in the wild: OpenUtau's dsdict YAML
    ({entries: [{grapheme, phonemes}]}) and plain tab/space text ('twin\tt w ih n').
    """
    if not file or not file.exists():
        return {}
    table: Dict[str, List[str]] = {}
    if file.suffix.lower() in (".yaml", ".yml"):
        data = _read_yaml(file)
        for entry in data.get("entries") or []:
            g = str(entry.get("grapheme", "")).strip().lower()
            phs = entry.get("phonemes") or []
            if g and phs:
                table[g] = [str(p) for p in phs]
        return table
    for line in file.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        cols = line.replace("\t", " ").split()
        if len(cols) >= 2:
            table[cols[0].lower()] = cols[1:]
    return table


def load_speaker_embeds(path: Path, parts: dict) -> Dict[str, np.ndarray]:
    """Vocal modes ship as raw float32 .emb vectors named in dsconfig `speakers`."""
    embeds: Dict[str, np.ndarray] = {}
    for name in parts["speakers"]:
        f = path / f"{name}.emb"
        if not f.is_file():
            f = path / name
        if f.is_file():
            embeds[Path(name).name] = np.fromfile(str(f), dtype=np.float32)
    return embeds


def get_bank(bank_id: str, fresh: bool = False) -> dict:
    if fresh:
        _sessions.pop(bank_id, None)
    if bank_id in _sessions:
        return _sessions[bank_id]

    path = BANK_DIR / bank_id
    if not path.is_dir():
        raise FileNotFoundError(f"voicebank '{bank_id}' is not installed")

    parts = _bank_paths(path)
    if not parts["acoustic"]:
        raise FileNotFoundError(f"voicebank '{bank_id}' has no acoustic.onnx")
    if not parts["vocoder"]:
        raise FileNotFoundError(
            f"voicebank '{bank_id}' has no vocoder — it names '{parts['cfg'].get('vocoder')}' "
            f"and no shared vocoder is installed under {VOCODER_DIR}"
        )

    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 2
    # ORT's graph optimizer segfaults (exit 139, NodeArg index assertion) while
    # fusing DiffSinger acoustic graphs. Load them un-optimized — the models are
    # already exported optimized, so the cost is negligible.
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_DISABLE_ALL
    bank = {
        "acoustic": ort.InferenceSession(str(parts["acoustic"]), opts, providers=["CPUExecutionProvider"]),
        "vocoder": ort.InferenceSession(str(parts["vocoder"]), opts, providers=["CPUExecutionProvider"]),
        "phoneme_map": load_phoneme_map(path, parts),
        "dictionary": load_dictionary(parts["dictionary"]),
        "speaker_embeds": load_speaker_embeds(path, parts),
        "languages": parts["languages"],
        "dict_lang": parts["dict_lang"],
        "sample_rate": parts["sample_rate"],
        "hop_size": parts["hop_size"],
        "cfg": parts["cfg"],
    }
    _sessions[bank_id] = bank
    return bank


# ----------------------------------------------------------------------------- score


def phonemize(syllable: str, bank: dict) -> List[str]:
    """
    Syllable -> phonemes via the bank's own dictionary.

    Unknown syllables fall back to the bare lowercase text: many banks key on
    syllables directly, and refusing to sing a word that is simply absent from the
    dictionary would be a worse failure than attempting it.
    """
    word = syllable.strip().lower()
    if not word or word == "-":
        return []
    if word in bank["dictionary"]:
        return bank["dictionary"][word]
    # English banks ship phoneme-level dictionaries: OpenUtau's phonemizer does the
    # word -> ARPAbet step itself, so Cantor has to as well. Only used when every
    # resulting phoneme exists in the bank, otherwise the old fallback stands.
    arpa = _cmu().get(word.strip(".,!?'\""))
    if arpa:
        phones = ["".join(c for c in p if not c.isdigit()).lower() for p in arpa[0]]
        if all(resolve_token(p, bank)[0] is not None for p in phones):
            return phones
    return [word]


_CMU = None


def _cmu():
    global _CMU
    if _CMU is None:
        try:
            import cmudict
            _CMU = cmudict.dict()
        except Exception:
            _CMU = {}
    return _CMU


def resolve_token(ph: str, bank: dict) -> Tuple[Optional[int], int]:
    """
    Token id plus language id. Multi-language banks prefix phonemes ('en/ah') in the
    phoneme list while dictionaries stay unprefixed, so both spellings are tried.
    """
    pmap = bank["phoneme_map"]
    langs = bank["languages"] or {}
    if ph in pmap:
        lang = ph.split("/")[0] if "/" in ph else bank["dict_lang"]
        return pmap[ph], int(langs.get(lang, 0)) if isinstance(langs.get(lang, 0), int) else 0
    ordered = ([bank["dict_lang"]] if bank["dict_lang"] else []) + [l for l in langs if l != bank["dict_lang"]]
    for lang in ordered:
        key = f"{lang}/{ph}"
        if key in pmap:
            return pmap[key], int(langs.get(lang, 0)) if isinstance(langs.get(lang, 0), int) else 0
    return None, 0


def build_frames(notes: List[dict], bpm: float, bank: dict):
    """
    Turn the authored score into token / duration / f0 arrays.

    A '-' syllable HOLDS the previous one: that is how a melisma (one word sung
    across several notes) is written, and treating it as a new word would re-attack
    the consonant on every note.
    """
    sr = bank["sample_rate"]
    hop = bank["hop_size"]
    frames_per_beat = (60.0 / bpm) * sr / hop

    tokens: List[int] = []
    lang_ids: List[int] = []
    durations: List[int] = []
    f0_frames: List[float] = []
    unknown: List[str] = []

    sp_token, _ = resolve_token("SP", bank)
    sp_token = sp_token if sp_token is not None else 0

    for note in notes:
        frames = max(1, int(round(float(note["beats"]) * frames_per_beat)))
        hz = 440.0 * (2.0 ** ((float(note["midi"]) - 69.0) / 12.0))
        f0_frames.extend([hz] * frames)

        phones = phonemize(note.get("syllable", ""), bank)
        if not phones:
            # Held note: extend the previous phoneme instead of starting a new one.
            if durations:
                durations[-1] += frames
                continue
            phones = ["SP"]  # leading hold has nothing to extend — sing silence

        # Split the note's frames across its phonemes, remainder on the vowel-ish
        # tail so the sustained part of the syllable carries the length.
        each = max(1, frames // len(phones))
        for i, ph in enumerate(phones):
            token, lang_id = resolve_token(ph, bank)
            if token is None:
                token, lang_id = sp_token, 0
                if ph not in unknown:
                    unknown.append(ph)
            tokens.append(token)
            lang_ids.append(lang_id)
            durations.append(frames - each * (len(phones) - 1) if i == len(phones) - 1 else each)

    return (
        np.array([tokens], dtype=np.int64),
        np.array([durations], dtype=np.int64),
        np.array([f0_frames], dtype=np.float32),
        np.array([lang_ids], dtype=np.int64),
        unknown,
    )


ALIASES = {
    "tokens": ["tokens", "phoneme", "ph_seq", "text"],
    "durations": ["durations", "ph_dur", "durs", "dur"],
    "f0": ["f0", "f0_seq", "pitch"],
    "mel": ["mel", "mel_spec", "spectrogram", "c"],
    "languages": ["languages", "lang_seq", "language"],
    "spk_embed": ["spk_embed", "speaker_embed", "spk"],
}


def feed(session, candidates: dict, n_frames: int) -> Tuple[dict, List[str]]:
    """
    Match our arrays to whatever the bank's model actually named its inputs.

    Banks vary in export naming ('tokens' vs 'phoneme', 'durations' vs 'ph_dur'),
    so inputs are bound by name with aliases rather than by position — a positional
    bind would feed durations into the f0 slot on half the banks and produce
    confident garbage instead of an error. Anything left unbound is RETURNED so the
    caller can refuse to render rather than let onnxruntime guess.
    """
    bound = {}
    missing: List[str] = []
    for inp in session.get_inputs():
        name = inp.name
        is_float = "float" in str(inp.type)
        hit = next((k for k, names in ALIASES.items() if name in names and k in candidates), None)
        if hit:
            bound[name] = candidates[hit]
        elif name == "speedup":
            bound[name] = np.array(10, dtype=np.int64)  # 100 diffusion steps
        elif name == "steps":
            bound[name] = np.array(20, dtype=np.int64)
        elif name == "depth":
            bound[name] = np.array(1.0, dtype=np.float32) if is_float else np.array(1000, dtype=np.int64)
        elif name == "gender":
            bound[name] = np.zeros((1, n_frames), dtype=np.float32)
        elif name == "velocity":
            bound[name] = np.ones((1, n_frames), dtype=np.float32)
        else:
            missing.append(name)
    return bound, missing


def speaker_frames(bank: dict, speaker: Optional[str], n_frames: int) -> Optional[np.ndarray]:
    embeds = bank["speaker_embeds"]
    if not embeds:
        return None
    vec = embeds.get(speaker or "") or next(iter(embeds.values()))
    return np.tile(vec[None, None, :], (1, n_frames, 1)).astype(np.float32)


def synthesize(bank: dict, notes: List[dict], bpm: float, speaker: Optional[str]):
    tokens, durations, f0, lang_ids, unknown = build_frames(notes, bpm, bank)
    if tokens.size == 0:
        raise ValueError("score contained no singable notes")
    n_frames = int(f0.shape[1])

    candidates = {"tokens": tokens, "durations": durations, "f0": f0, "languages": lang_ids}
    spk = speaker_frames(bank, speaker, n_frames)
    if spk is not None:
        candidates["spk_embed"] = spk

    bound, missing = feed(bank["acoustic"], candidates, n_frames)
    if missing:
        curves = [m for m in missing if m in UNSUPPORTED_CURVES]
        if curves:
            raise ValueError(
                f"this bank requires {', '.join(curves)} curves, which Cantor cannot predict yet"
            )
        raise ValueError(f"acoustic model has inputs Cantor cannot supply: {', '.join(missing)}")
    mel = bank["acoustic"].run(None, bound)[0]

    vbound, vmissing = feed(bank["vocoder"], {"mel": mel, "f0": f0}, n_frames)
    if vmissing:
        raise ValueError(f"vocoder has inputs Cantor cannot supply: {', '.join(vmissing)}")
    wave = bank["vocoder"].run(None, vbound)[0]
    audio = np.asarray(wave, dtype=np.float32).squeeze()

    # Guard against clipping without changing the performance: peak-normalize
    # only when the render actually exceeds full scale.
    peak = float(np.max(np.abs(audio))) if audio.size else 0.0
    if peak > 1.0:
        audio = audio / peak
    return audio, unknown, peak


# ----------------------------------------------------------------------------- render


class RenderRequest(BaseModel):
    voicebank: str
    bpm: float = 120.0
    notes: List[dict] = []
    speaker: Optional[str] = None


def _run(job_id: str, req: RenderRequest):
    try:
        JOBS[job_id]["status"] = "processing"
        bank = get_bank(req.voicebank)
        audio, unknown, _ = synthesize(bank, req.notes, req.bpm, req.speaker)

        path = OUT / f"{job_id}.wav"
        sf.write(str(path), audio, bank["sample_rate"])

        JOBS[job_id].update(
            status="completed",
            audio_url=f"/outputs/{path.name}",
            sample_rate=bank["sample_rate"],
            voicebank=req.voicebank,
            duration_seconds=round(len(audio) / bank["sample_rate"], 2),
            # Surfaced so a creator learns their bank has no entry for a syllable,
            # rather than wondering why one word sounds wrong.
            unknown_phonemes=unknown,
        )
    except Exception as exc:  # reported verbatim: the message names the real fault
        JOBS[job_id].update(status="failed", error=f"{type(exc).__name__}: {exc}")


# ----------------------------------------------------------------------------- install


def _authorized(authorization: Optional[str]) -> bool:
    """Owner check via Hugging Face: the presented token must belong to OWNER."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return False
    token = authorization.split(" ", 1)[1].strip()
    cached = _auth_cache.get(token)
    if cached and cached[1] > time.time():
        return cached[0]
    ok = False
    try:
        req = urllib.request.Request(
            "https://huggingface.co/api/whoami-v2", headers={"Authorization": f"Bearer {token}"}
        )
        with urllib.request.urlopen(req, timeout=15) as res:
            who = json.loads(res.read().decode("utf-8"))
        ok = str(who.get("name", "")).lower() == OWNER
    except Exception:
        ok = False
    _auth_cache[token] = (ok, time.time() + 600)
    return ok


def _download(url: str, dest: Path):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Cantor installer)"})
    with urllib.request.urlopen(req, timeout=120) as res, dest.open("wb") as out:
        shutil.copyfileobj(res, out, length=1 << 20)


def _safe_extract(archive: Path, target: Path):
    with zipfile.ZipFile(str(archive)) as zf:
        for member in zf.infolist():
            name = member.filename
            if not name or name.startswith("/") or ".." in Path(name).parts:
                continue
            zf.extract(member, str(target))


def _find_bank_root(root: Path) -> Optional[Path]:
    hits = sorted(root.rglob("dsconfig.yaml"), key=lambda p: len(p.parts))
    # A bank folder holds dsconfig at its top; sub-models (dsdur/, dspitch/) hold their
    # own dsconfig deeper, so the shallowest match is the bank itself.
    return hits[0].parent if hits else None


class InstallRequest(BaseModel):
    bank_id: str
    zip_url: str
    kind: str = "voicebank"  # or "vocoder"
    replace: bool = False


def _install(job_id: str, req: InstallRequest, token: str):
    work = INSTALL_TMP / job_id
    target = (VOCODER_DIR if req.kind == "vocoder" else BANK_DIR) / req.bank_id
    try:
        JOBS[job_id]["status"] = "processing"
        if target.exists() and not req.replace:
            raise FileExistsError(f"'{req.bank_id}' is already installed")

        work.mkdir(parents=True, exist_ok=True)
        archive = work / "bank.zip"
        JOBS[job_id]["stage"] = "downloading"
        _download(req.zip_url, archive)
        JOBS[job_id]["stage"] = "extracting"
        extracted = work / "x"
        _safe_extract(archive, extracted)

        if req.kind == "vocoder":
            onnx = sorted(extracted.rglob("vocoder.onnx"), key=lambda p: len(p.parts))
            if not onnx:
                onnx = [p for p in extracted.rglob("*.onnx")]
            if not onnx:
                raise FileNotFoundError("archive contains no vocoder .onnx")
            src = onnx[0].parent
        else:
            src = _find_bank_root(extracted)
            if src is None:
                # Release "packs" wrap the real bank in a nested zip.
                for inner in sorted(extracted.rglob("*.zip")):
                    sub = work / f"inner_{uuid.uuid4().hex[:6]}"
                    _safe_extract(inner, sub)
                    src = _find_bank_root(sub)
                    if src:
                        break
            if src is None:
                raise FileNotFoundError("archive contains no dsconfig.yaml — not an OpenUtau DiffSinger bank")

        JOBS[job_id]["stage"] = "installing"
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(src, target)
        if req.kind == "vocoder" and not (target / "vocoder.onnx").exists():
            only = [p for p in target.glob("*.onnx")]
            if only:
                only[0].rename(target / "vocoder.onnx")

        JOBS[job_id]["stage"] = "validating"
        if req.kind == "vocoder":
            _vopts = ort.SessionOptions()
            _vopts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_DISABLE_ALL
            sess = ort.InferenceSession(str(target / "vocoder.onnx"), _vopts, providers=["CPUExecutionProvider"])
            names = [i.name for i in sess.get_inputs()]
            report = {"kind": "vocoder", "inputs": names}
            if not any(n in ALIASES["mel"] for n in names):
                raise ValueError(f"vocoder inputs {names} include no mel input Cantor recognises")
        else:
            parts = _bank_paths(target)
            for other in list(_sessions):
                _sessions.pop(other, None)  # free RAM before loading the newcomer
            bank = get_bank(req.bank_id, fresh=True)
            test_notes = [
                {"syllable": "la", "midi": 60, "beats": 1},
                {"syllable": "la", "midi": 64, "beats": 1},
                {"syllable": "la", "midi": 67, "beats": 2},
            ]
            audio, unknown, peak = synthesize(bank, test_notes, 120.0, None)
            if audio.size == 0 or peak < 1e-4:
                raise ValueError("validation render produced silence")
            probe = OUT / f"{job_id}.wav"
            sf.write(str(probe), audio, bank["sample_rate"])
            report = {
                "kind": "voicebank",
                "name": parts["name"],
                "language": parts["language"],
                "license": parts["license"],
                "license_present": bool(parts["license"]),
                "acoustic_inputs": [i.name for i in bank["acoustic"].get_inputs()],
                "vocoder_inputs": [i.name for i in bank["vocoder"].get_inputs()],
                "vocoder_source": parts["vocoder_source"],
                "speakers": list(bank["speaker_embeds"].keys()),
                "sample_rate": bank["sample_rate"],
                "hop_size": bank["hop_size"],
                "dictionary_entries": len(bank["dictionary"]),
                "phoneme_count": len(bank["phoneme_map"]),
                "unknown_phonemes_in_test": unknown,
                "test_seconds": round(len(audio) / bank["sample_rate"], 2),
                "test_audio_url": f"/outputs/{probe.name}",
            }

        # Validated — now make it survive a restart. The owner's token that
        # authorised the install is what authorises the push.
        JOBS[job_id]["stage"] = "persisting"
        api = HfApi(token=token)
        api.create_repo(HUB_REPO, repo_type="dataset", private=True, exist_ok=True)
        api.upload_folder(
            folder_path=str(target), path_in_repo=_hub_path(req.kind, req.bank_id),
            repo_id=HUB_REPO, repo_type="dataset",
            commit_message=f"install {req.kind} {req.bank_id}",
        )
        report["persisted_to"] = f"{HUB_REPO}/{_hub_path(req.kind, req.bank_id)}"

        JOBS[job_id].update(status="completed", stage="done", report=report, bank_id=req.bank_id)
    except Exception as exc:
        # A bank that failed validation must not remain pickable.
        _sessions.pop(req.bank_id, None)
        if target.exists() and (req.replace or not JOBS[job_id].get("preexisting")):
            shutil.rmtree(target, ignore_errors=True)
        JOBS[job_id].update(status="failed", error=f"{type(exc).__name__}: {exc}")
    finally:
        shutil.rmtree(work, ignore_errors=True)


# ----------------------------------------------------------------------------- api


@app.get("/health")
def health():
    banks = list_banks()
    return {
        "ok": True,
        "engine": "diffsinger",
        "voicebank_dir": str(BANK_DIR),
        "vocoder_dir": str(VOCODER_DIR),
        "persistent": BANKS_PERSISTENT or HUB_SYNCED,
        "hub_repo": HUB_REPO,
        "hub_synced": HUB_SYNCED,
        "installed": len(banks),
        "renderable": len([b for b in banks if b["renderable"]]),
        "vocoders": [p.parent.name for p in VOCODER_DIR.glob("*/vocoder.onnx")],
        "loaded": list(_sessions.keys()),
        "queued": len([j for j in JOBS.values() if j["status"] == "queued"]),
    }


@app.get("/voicebanks")
def voicebanks():
    return {"voicebanks": list_banks()}


@app.post("/render")
def render(req: RenderRequest):
    if not req.voicebank:
        return {"error": "voicebank is required"}
    if not req.notes:
        return {"error": "notes are required"}
    job_id = uuid.uuid4().hex
    JOBS[job_id] = {"status": "queued", "kind": "render"}
    POOL.submit(_run, job_id, req)
    return {"job_id": job_id, "status": "queued", "voicebank": req.voicebank}


@app.post("/install")
def install(req: InstallRequest, response: Response, authorization: Optional[str] = Header(default=None)):
    if not _authorized(authorization):
        response.status_code = 401
        return {"error": "install requires the Space owner's Hugging Face token"}
    bank_id = "".join(ch for ch in req.bank_id if ch.isalnum() or ch in "-_").strip("-_")
    if not bank_id:
        response.status_code = 400
        return {"error": "bank_id must be alphanumeric"}
    if req.kind not in ("voicebank", "vocoder"):
        response.status_code = 400
        return {"error": "kind must be 'voicebank' or 'vocoder'"}
    if not req.zip_url.startswith("http"):
        response.status_code = 400
        return {"error": "zip_url must be an http(s) URL"}
    req.bank_id = bank_id
    job_id = uuid.uuid4().hex
    target = (VOCODER_DIR if req.kind == "vocoder" else BANK_DIR) / bank_id
    JOBS[job_id] = {"status": "queued", "kind": "install", "bank_id": bank_id, "preexisting": target.exists()}
    POOL.submit(_install, job_id, req, authorization.split(" ", 1)[1].strip())
    return {"job_id": job_id, "status": "queued", "bank_id": bank_id}


@app.delete("/voicebanks/{bank_id}")
def remove(bank_id: str, response: Response, authorization: Optional[str] = Header(default=None)):
    if not _authorized(authorization):
        response.status_code = 401
        return {"error": "removal requires the Space owner's Hugging Face token"}
    target = BANK_DIR / bank_id
    if not target.is_dir() or target.parent != BANK_DIR:
        response.status_code = 404
        return {"error": f"voicebank '{bank_id}' is not installed"}
    _sessions.pop(bank_id, None)
    shutil.rmtree(target, ignore_errors=True)
    try:
        HfApi(token=authorization.split(" ", 1)[1].strip()).delete_folder(
            _hub_path("voicebank", bank_id), repo_id=HUB_REPO, repo_type="dataset"
        )
    except Exception as exc:
        return {"removed": bank_id, "hub_warning": f"{type(exc).__name__}: {exc}"}
    return {"removed": bank_id}


@app.get("/status/{job_id}")
def status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        return {"error": "unknown job_id", "status": "failed"}
    return {"job_id": job_id, **job}