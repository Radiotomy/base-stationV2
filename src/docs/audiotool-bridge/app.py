"""BASE Nexus Bridge -- native protobuf ingestion of Audiotool session state."""
import os

from fastapi import FastAPI

import audiotool_state as ats
from audiotool_router import router

app = FastAPI(title="BASE Nexus Bridge")
app.include_router(router)


@app.on_event("startup")
def _load():
    ats.load_bindings()


@app.get("/health")
def health():
    return {
        "ok": True,
        "engine": "nexus-bridge",
        "nexus_version": os.environ.get("NEXUS_VERSION"),
        "proto_modules": ats.load_bindings(),
    }