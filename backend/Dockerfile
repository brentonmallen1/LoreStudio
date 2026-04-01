FROM python:3.13-slim

WORKDIR /app

RUN pip install uv

COPY pyproject.toml ./
RUN uv sync --frozen

COPY . .

RUN mkdir -p /app/data

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
