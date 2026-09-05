FROM python:3.14-slim

WORKDIR /app

# System deps for pandoc (export) and weasyprint (PDF export)
RUN apt-get update && apt-get install -y --no-install-recommends \
    pandoc \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

RUN pip install uv

COPY pyproject.toml ./
RUN uv sync --frozen

# Download spaCy English model for NLP analysis (pronoun identification, POS tagging, NER)
RUN uv run python -m spacy download en_core_web_sm

COPY . .

RUN mkdir -p /app/data

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
