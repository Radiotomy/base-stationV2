"""Mountable FastAPI router: any BASE Engine Space can `app.include_router(router)`."""
from fastapi import APIRouter, HTTPException, Request
from google.protobuf.message import DecodeError
from pydantic import BaseModel

import audiotool_state as ats

router = APIRouter(prefix="/audiotool", tags=["audiotool"])


class IngestBody(BaseModel):
    project: str
    access_token: str
    limit: int = 2000


@router.post("/ingest")
async def ingest(body: IngestBody):
    """Fetch a project from Audiotool as binary protobuf and parse it natively."""
    try:
        state = await ats.fetch_project_state(body.project, body.access_token)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return ats.summarize(state, body.limit)


@router.post("/ingest/binary")
async def ingest_binary(request: Request):
    """Body = raw audiotool.document.v1.GetEntitiesResponse bytes (application/x-protobuf)."""
    raw = await request.body()
    if not raw:
        raise HTTPException(status_code=400, detail="empty body")
    try:
        state = ats.parse_entities_response(raw)
    except DecodeError as e:
        raise HTTPException(status_code=400, detail=f"not a GetEntitiesResponse: {e}")
    return ats.summarize(state)