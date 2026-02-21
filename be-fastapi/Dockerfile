FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-ind \
    poppler-utils \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libglib2.0-0 \
    libffi-dev \
    libcairo2 \
    libharfbuzz0b \
    shared-mime-info \
    fonts-liberation \
    fontconfig \
    libjpeg62-turbo \
    libopenjp2-7 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev

COPY . .

RUN mkdir -p uploads

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
