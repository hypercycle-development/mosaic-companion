FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

LABEL GPUS=0 GPU_MEMORY=0GB
LABEL maintainer="Mosaic HyperCycle"
LABEL description="Mosaic Hermes AIM — OpenAI-compatible bridge for HyperCycle nodes"

WORKDIR /opt/app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    git gcc build-essential ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# FIX: pyhypercycle-aim imports disks.py which creates /container_mount dirs
RUN mkdir -p /container_mount/virtual_disks /container_mount/disk_mounts && chmod 777 /container_mount

# Copy pyhypercycle-aim source (bundled) and requirements
COPY requirements.txt .
COPY pyhypercycle-aim ./pyhypercycle-aim

# Install all deps including bundled pyhypercycle_aim
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app ./app
COPY mosaic_hermes_wrapper.py ./app/mosaic_hermes_wrapper.py
COPY manifest.json ./app/manifest.json

WORKDIR /opt/app/app

EXPOSE 4000/tcp

# HERMES_BASE_URL and HERMES_MODEL can be overridden at runtime
ENV HERMES_BASE_URL="http://localhost:3000"
ENV HERMES_MODEL="kimi-k2.6"
ENV PORT="4000"

# Healthcheck: /health returns 200 when Hermes is reachable
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:4000/health', timeout=5)" || exit 1

CMD ["python3", "main.py"]
