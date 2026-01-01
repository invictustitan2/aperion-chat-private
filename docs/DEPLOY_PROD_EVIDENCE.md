# Production Deploy Evidence

Note: this is a point-in-time snapshot of the then-current production surface (`api.aperion.cc` + `chat.aperion.cc`). The planned same-origin API mount (`/api/*` on `chat.aperion.cc`) is tracked separately in `docs/path-b/SAME_ORIGIN_PLAN.md`.

## Version

- Commit: 717d296

## GitHub Actions

- API Worker deploy: https://github.com/invictustitan2/aperion-chat-private/actions/runs/20417404592
- Web deploy: https://github.com/invictustitan2/aperion-chat-private/actions/runs/20417421871

## Smoke tests

### HTTP (unauth)

- GET https://api.aperion.cc/v1/identity
- Result: HTTP/2 302

### Preferences (ai.tone)

- GET https://api.aperion.cc/v1/preferences/ai.tone
- Result: HTTP/2 302

### WebSocket (unauth)

- node scripts/smoke-ws.mjs
- Result: event error non-101; close code=1002

### WebSocket (auth)

- Result: service token not available locally; skipped authenticated WS smoke

### Web (Access boundary)

- GET https://chat.aperion.cc
- Result: HTTP/2 302

## Notes

- HTTP 302 responses are expected when Cloudflare Access redirects unauthenticated requests to login.
