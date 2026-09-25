"""Native protobuf ingestion of Audiotool project state.

Audiotool's document service returns a project as GetEntitiesResponse: a
topologically sorted list of google.protobuf.Any, one per entity (notes,
automation events, devices, cables, tracks...). This module parses that binary
straight into generated protobuf message classes -- there is no JSON step
anywhere between Audiotool's servers and the objects our generative models read.
"""
import importlib
import os
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field

import httpx
from google.protobuf import descriptor_pool, message_factory

GEN_DIR = os.environ.get("AUDIOTOOL_PROTO_GEN", "/app/audiotool_gen")
RPC_URL = "https://rpc.audiotool.com"
GET_ENTITIES = "/audiotool.document.v1.DocumentService/GetEntities"

_loaded = 0
_classes = {}


def load_bindings():
    """Import every generated *_pb2 module so all types register in the default pool."""
    global _loaded
    if _loaded:
        return _loaded
    if GEN_DIR not in sys.path:
        sys.path.insert(0, GEN_DIR)
    for root, _, files in os.walk(os.path.join(GEN_DIR, "audiotool")):
        for f in files:
            if f.endswith("_pb2.py"):
                rel = os.path.relpath(os.path.join(root, f[:-3]), GEN_DIR)
                importlib.import_module(rel.replace(os.sep, "."))
                _loaded += 1
    return _loaded


def message_class(type_name):
    cls = _classes.get(type_name)
    if cls is None:
        desc = descriptor_pool.Default().FindMessageTypeByName(type_name)
        cls = _classes[type_name] = message_factory.GetMessageClass(desc)
    return cls


def entity_kind(type_name):
    """audiotool.document.v1.entity.timeline.v1.note.Note -> Note"""
    return type_name.rsplit(".", 1)[-1]


@dataclass
class ProjectState:
    """Parsed project. Every value is a live protobuf message, never a dict."""
    entities: list = field(default_factory=list)       # [(type_name, message)] in topo order
    by_id: dict = field(default_factory=dict)
    by_kind: dict = field(default_factory=lambda: defaultdict(list))
    unknown_types: set = field(default_factory=set)    # types newer than our pinned bindings


def parse_entities_response(raw: bytes) -> ProjectState:
    load_bindings()
    from audiotool.document.v1 import document_service_pb2

    resp = document_service_pb2.GetEntitiesResponse.FromString(raw)
    state = ProjectState()
    for any_msg in resp.entities:
        type_name = any_msg.type_url.rsplit("/", 1)[-1]
        try:
            cls = message_class(type_name)
        except KeyError:
            state.unknown_types.add(type_name)
            continue
        msg = cls.FromString(any_msg.value)
        state.entities.append((type_name, msg))
        state.by_kind[entity_kind(type_name)].append(msg)
        if getattr(msg, "id", None):
            state.by_id[msg.id] = (type_name, msg)
    return state


def project_name(project: str) -> str:
    """Accepts a studio URL, a bare uuid, or 'projects/<uuid>'."""
    if project.startswith("projects/"):
        return project
    m = re.search(r"[?&]project=([\w-]+)", project)
    return f"projects/{m.group(1) if m else project.rstrip('/').rsplit('/', 1)[-1]}"


async def fetch_project_state(project: str, access_token: str) -> ProjectState:
    """Pull the latest project state from Audiotool as binary protobuf (Connect unary)."""
    load_bindings()
    from audiotool.document.v1 import document_service_pb2

    req = document_service_pb2.GetEntitiesRequest(project_name=project_name(project))
    token = access_token if access_token.startswith("Bearer ") else f"Bearer {access_token}"
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            RPC_URL + GET_ENTITIES,
            content=req.SerializeToString(),
            headers={
                "Content-Type": "application/proto",
                "Connect-Protocol-Version": "1",
                "Authorization": token,
            },
        )
    if r.status_code != 200:
        raise RuntimeError(f"Audiotool GetEntities {r.status_code}: {r.text[:300]}")
    return parse_entities_response(r.content)


def _ptr(p):
    return p.entity_id or None


def summarize(state: ProjectState, limit=2000):
    """Compact view of MIDI, automation and routing for the HTTP caller."""
    notes = state.by_kind.get("Note", [])
    events = state.by_kind.get("AutomationEvent", [])
    cables = [(k, m) for k, m in state.entities if entity_kind(k).endswith("Cable")]
    tracks = [(k, m) for k, m in state.entities if entity_kind(k).endswith("Track")]
    counts = defaultdict(int)
    for k, _ in state.entities:
        counts[entity_kind(k)] += 1
    return {
        "entity_count": len(state.entities),
        "entity_type_counts": dict(counts),
        "unknown_types": sorted(state.unknown_types),
        "notes": [
            {"id": n.id, "collection": _ptr(n.collection), "pitch": n.pitch,
             "position_ticks": n.position_ticks, "duration_ticks": n.duration_ticks,
             "velocity": round(n.velocity, 4), "slide": n.does_slide}
            for n in notes[:limit]
        ],
        "automation_events": [
            {"id": e.id, "collection": _ptr(e.collection), "position_ticks": e.position_ticks,
             "value": round(e.value, 5), "slope": round(e.slope, 5), "interpolation": e.interpolation}
            for e in events[:limit]
        ],
        "cables": [
            {"type": entity_kind(k), "id": m.id,
             "from": _ptr(m.from_socket) if hasattr(m, "from_socket") else None,
             "to": _ptr(m.to_socket) if hasattr(m, "to_socket") else None}
            for k, m in cables[:limit]
        ],
        "tracks": [{"type": entity_kind(k), "id": m.id} for k, m in tracks[:limit]],
        "truncated": any(len(x) > limit for x in (notes, events, cables, tracks)),
    }