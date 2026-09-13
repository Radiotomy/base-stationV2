#!/bin/bash
# Boot script for the Inspire Space.
#
# Kept as a FILE rather than an inline CMD on purpose. An inline exec-form CMD
# holding a multi-line shell script is not valid JSON (a backslash before a
# newline is not a legal JSON escape), so Docker silently falls back to shell
# form and the mangled result exits before running anything — which is exactly
# the "exit code 0, no output at all" failure this replaces. A plain file has no
# escaping to get wrong.
#
# Not a login shell: /etc/shinit_v2 in the CUDA image reprints the whole CUDA
# banner for every login shell, which is the duplicated banner in the logs and
# pure noise.

echo "[boot] python  = $(which python) ($(python -V 2>&1))"
echo "[boot] uvicorn = $(which uvicorn)"
echo "[boot] cwd     = $(pwd)"

# Import the app FIRST and let the traceback reach the log. If app.py raises at
# import time, uvicorn's own failure message is far less specific than the real
# exception, and the two are indistinguishable in the Space log.
python - <<'PY' || echo "[boot] APP IMPORT FAILED — see traceback above"
import traceback
try:
    import app
    print("[boot] app module imported OK")
except Exception:
    traceback.print_exc()
    raise SystemExit(1)
PY

# exec so uvicorn becomes PID 1 and the platform's signals and exit codes reach
# it directly.
exec uvicorn app:app --host 0.0.0.0 --port 7860 --timeout-keep-alive 600 --log-level info