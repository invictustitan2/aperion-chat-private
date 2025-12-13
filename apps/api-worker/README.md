# API Worker

The `api-worker` is a Cloudflare Worker that serves as the backend for Aperion Chat. It manages memory storage (D1) and enforces policy.

## Setup

1.  **Create D1 Database**:
    ```bash
    pnpm wrangler d1 create aperion-memory
    ```
    Update `wrangler.toml` with the `database_id`.

2.  **Set Secrets**:
    ```bash
    pnpm wrangler secret put API_TOKEN
    ```

3.  **Run Migrations**:
    ```bash
    pnpm db:migrate
    ```
    For local dev:
    ```bash
    pnpm db:migrate:local
    ```

## Development

Start the local development server:
```bash
pnpm dev:api
```

## Endpoints

All endpoints require `Authorization: Bearer <API_TOKEN>`.

-   `POST /v1/episodic`: Store episodic memory.
-   `GET /v1/episodic`: Retrieve episodic memory.
-   `POST /v1/semantic`: Store semantic memory (requires references).
-   `POST /v1/identity`: Store identity memory (requires `explicit_confirm: true`).
-   `GET /v1/identity`: Retrieve identity memory.
-   `POST /v1/runbooks/hash`: Compute stable hash for a runbook task.
