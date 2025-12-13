# Aperion Chat - Web UI

This is the single-user web interface for Aperion Chat, built with React, Vite, and Tailwind CSS.

## Features

- **Chat**: Real-time chat interface with the AI assistant.
  - **Semantic Write Toggle**: Control whether messages are stored in semantic memory (default: off).
  - **Episodic Memory**: All chat messages are automatically stored in episodic memory.
- **Memory**: View and manage the system's memory.
  - **Identity Store**: View and update the user's identity record.
  - **Recent Episodic**: View the latest episodic memory logs.
- **Receipts**: Audit log of policy decisions.
  - View allowed/denied actions and the reasons behind them.

## Development

### Prerequisites

- Node.js & pnpm
- Running `api-worker` (or configured environment variables)

### Setup

```bash
pnpm install
```

### Running Locally

1. Ensure the API worker is running (usually on port 8787):
   ```bash
   cd ../api-worker
   pnpm dev
   ```

2. Start the web development server:
   ```bash
   pnpm dev
   ```

3. Open [http://localhost:5173](http://localhost:5173) in your browser.

### Testing

- **Unit Tests**:
  ```bash
  pnpm test
  ```

- **E2E Tests** (Playwright):
  ```bash
  pnpm test:e2e
  ```

## Configuration

Environment variables can be set in `.env` files:

- `VITE_API_URL`: URL of the API worker (default: `http://localhost:8787`)
- `VITE_API_TOKEN`: Authentication token for the API (default: `dev-token`)
