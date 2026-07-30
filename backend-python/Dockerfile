FROM python:3.12-slim AS base

WORKDIR /app

COPY pyproject.toml ./
COPY app ./app
COPY schema.sql ./
RUN pip install --no-cache-dir .

# Test deps stay out of the runtime image; CI builds this stage with --target test
# and mounts the checkout (which carries tests/) over /app.
FROM base AS test
RUN pip install --no-cache-dir ".[test]"

FROM base AS runtime
EXPOSE 8081
CMD ["python", "-m", "app.main"]
