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

# The Space injects CUDA_VISIBLE_DEVICES=1 into the RUNTIME environment, which
# overrides any ENV baked into the image — measured: the render worker reported
# visible_devices "1", device_count 0, cuda_available False on a single-GPU box,
# so inference silently fell back to CPU. Exported here, at runtime, which is the
# only place that beats the injected value.
export CUDA_VISIBLE_DEVICES=0

echo "[boot] python  = $(which python) ($(python -V 2>&1))"
echo "[boot] CUDA_VISIBLE_DEVICES = $CUDA_VISIBLE_DEVICES"
python -c "import torch; print('[boot] cuda=%s devices=%d' % (torch.cuda.is_available(), torch.cuda.device_count()))"
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