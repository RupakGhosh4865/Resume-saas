FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# SQLite lives here; compose mounts a volume so it survives redeploys.
RUN mkdir -p /app/data \
    && useradd -m optimizer \
    && chown -R optimizer /app
USER optimizer

ENV DB_PATH=/app/data/resume_history.db

# 8002 matches RESUME_OPTIMIZER_URL used by the Node server (was 8000 here,
# so the two services disagreed about the port).
EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8002/health').status==200 else 1)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
