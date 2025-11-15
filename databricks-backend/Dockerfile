# syntax=docker/dockerfile:1.6

# --- Builder stage: install dependencies using Poetry ---
FROM python:3.13-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    POETRY_VERSION=1.7.1 \
    POETRY_HOME="/opt/poetry" \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=false \
    POETRY_VIRTUALENVS_CREATE=true \
    POETRY_CACHE_DIR=/tmp/poetry_cache

# System deps for building (psycopg2 etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc libpq-dev curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Upgrade pip to fix CVE-2025-8869
RUN pip install --no-cache-dir --upgrade pip>=25.3

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | python3 -
ENV PATH="$POETRY_HOME/bin:$PATH"

WORKDIR /app

# Copy dependency files
COPY pyproject.toml poetry.lock ./

# Install dependencies into /venv (no dev dependencies)
RUN python -m venv /venv && \
    . /venv/bin/activate && \
    poetry install --only main --no-root --no-directory && \
    rm -rf $POETRY_CACHE_DIR

# --- Runtime stage ---
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PATH="/venv/bin:$PATH"

# Runtime OS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 10001 appuser

WORKDIR /app

# Copy virtualenv from builder
COPY --from=builder /venv /venv

# Copy app source
COPY src ./src
COPY alembic.ini ./alembic.ini
COPY alembic ./alembic
COPY README.md ./README.md

# Set ownership to non-root user
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose and default envs
ENV HOST=0.0.0.0 \
    PORT=8000 \
    WORKERS=2 \
    LOG_LEVEL=info
EXPOSE 8000

# Healthcheck (HTTP endpoint for Kubernetes liveness/readiness)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health').read()" || exit 1

# Start command (uvicorn with dynamic ENV vars)
CMD ["/bin/sh", "-c", "/venv/bin/uvicorn src.app:app --host ${HOST} --port ${PORT} --workers ${WORKERS} --log-level ${LOG_LEVEL}"]
