# Security Policy

## Secret Handling
- **NEVER** commit secrets to git.
- Use `.env.example` for template configuration.
- Use `.env` (gitignored) for local secrets.
- In CI/CD, use repository secrets.

## Local-Only Assumptions
- This project is designed for a single-user, private environment.
- Services are expected to run within a perimeter-protected network or authenticated cloud environment (Cloudflare Zero Trust recommended).

## Threat Model Summary
- **Asset**: Personal chat history and memory.
- **Risk**: Unauthorized access to memory store.
- **Mitigation**:
  - Cloudflare D1/KV encryption at rest.
  - Durable Objects state protection.
  - Strict authentication for any exposed endpoints.
