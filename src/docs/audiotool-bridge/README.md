---
title: BASE Nexus Bridge
sdk: docker
app_port: 7860
---

# BASE Nexus Bridge

Native Protocol Buffer ingestion of Audiotool project state for BASE Engines.

- Build time: `dts_to_proto.py` rebuilds Audiotool's document `.proto` files from the
  pinned `@audiotool/nexus` package (110 files: notes, automation, devices, cables,
  tracks, presets…) and `grpc_tools.protoc` compiles them to `*_pb2.py`.
- Run time: `POST /audiotool/ingest` calls Audiotool's `DocumentService/GetEntities`
  with `application/proto` and parses every `google.protobuf.Any` entity straight into
  its generated message class. No JSON between Audiotool and the model code.

## Endpoints
| Method | Path | Body |
|---|---|---|
| GET | `/health` | — |
| POST | `/audiotool/ingest` | `{project, access_token, limit?}` |
| POST | `/audiotool/ingest/binary` | raw `GetEntitiesResponse` bytes |

## Mounting in another engine Space (Aurora, Skye, Coda, Siren Song)
Copy `dts_to_proto.py`, `audiotool_state.py`, `audiotool_router.py`, add the protoc
`RUN` block from this Dockerfile, then:

```python
from audiotool_router import router as audiotool_router
app.include_router(audiotool_router)
```

Model code works on `ats.ProjectState` directly — `state.by_kind["Note"]` is a list of
real `Note` protobuf messages.