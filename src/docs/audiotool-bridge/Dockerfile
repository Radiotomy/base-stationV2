FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    NEXUS_VERSION=0.0.18 \
    AUDIOTOOL_PROTO_GEN=/app/audiotool_gen

RUN useradd -m -u 1000 user
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Build-time: rebuild Audiotool's .proto sources from the pinned nexus package
# and compile native Python bindings. Nothing is generated at request time.
COPY dts_to_proto.py .
RUN python dts_to_proto.py "$NEXUS_VERSION" /app/audiotool_protos \
 && mkdir -p "$AUDIOTOOL_PROTO_GEN" \
 && WKT="$(python -c 'import grpc_tools, os; print(os.path.join(os.path.dirname(grpc_tools.__file__), "_proto"))')" \
 && python -m grpc_tools.protoc -I /app/audiotool_protos -I "$WKT" \
      --python_out="$AUDIOTOOL_PROTO_GEN" $(find /app/audiotool_protos -name '*.proto')

COPY audiotool_state.py audiotool_router.py app.py ./
RUN chown -R user /app
USER user

EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]