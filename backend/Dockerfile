FROM python:3.11-slim

WORKDIR /app

# Install dependencies needed for PyMuPDF if required (e.g., build-essential, etc is usually not needed for pre-built binaries, but let's just copy requirements)
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
