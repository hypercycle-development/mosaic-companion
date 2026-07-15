FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install pyhypercycle_aim (clone if private repo)
RUN pip install --no-cache-dir \
    starlette==0.29.0 \
    uvicorn==0.29.0 \
    anyio==3.7.1 \
    httptools click h11 python-dotenv \
    filelock pyyaml markupsafe websockets \
    requests==2.33.0 urllib3 certifi \
    charset-normalizer idna

WORKDIR /app
COPY app/ /app/
COPY manifest.json /app/manifest.json

ENV PORT=4000 \
    PYTHONPATH=/app

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:4000/health || exit 1

CMD ["python3", "/app/main.py"]
