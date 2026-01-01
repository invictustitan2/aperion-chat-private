# Manual Gate — Cloudflare Access UI: Path B (Same-Origin `/api` on `chat.aperion.cc`)

Purpose: This checklist is an evidence-backed manual gate for Path B rollout.

Hard rules:

- Do NOT paste or store secrets here.
- Do NOT paste service token values.
- Record names/labels only.

---

## Metadata

- Date/time (UTC): ****\*\*\*\*****\_\_****\*\*\*\*****
- Operator: ******\*\*\*\*******\_******\*\*\*\*******
- Cloudflare account name (no ID): \***\*\_\_\*\***
- Cloudflare zone name (no ID): **\*\***\_**\*\***

---

## Target Application

- Access application name (UI): `Aperion Chat (UI)` (or equivalent)
- Access application domain: `chat.aperion.cc/*`

---

## REQUIRED Toggle (UI setting)

In the Cloudflare Zero Trust dashboard for the app above:

- [ ] Enable: **Return 401 Response for Service Auth policies**
  - Evidence note (screenshot filename or note): ****\*\*\*\*****\_\_****\*\*\*\*****

(Implementation note: this corresponds to `service_auth_401_redirect=true`.)

---

## REQUIRED Policy (Service Token allow for browser surface probes)

Create or update a policy under the same app:

- [ ] Policy action: **Allow**
- [ ] Policy name: **Service Token (browser surface probes)**
- [ ] Include rule: **Service Token** (select the existing token)
  - Token display name (no ID): ****\*\*\*\*****\_\_****\*\*\*\*****
- [ ] Exclude rules: **none**
- [ ] Session duration: **leave default** (unless explicitly required)

Save/apply changes.

Evidence:

- Screenshot filename or note: ****\*\*\*\*****\_\_****\*\*\*\*****

---

## Post-change Proof (copy/paste devshell outputs — non-secret)

After saving the changes, run these commands locally from repo root and paste outputs below.

### 1) REST probe (browser surface)

Command:

- `RUN_NETWORK_TESTS=1 ./dev access:probe --surface browser`

Paste output:

```

```

### 2) WebSocket smoke (browser surface)

Command:

- `RUN_NETWORK_TESTS=1 ./dev deploy:validate --surface browser`

Paste output:

```

```

Notes:

- Expected: `with_service_token.V1_IDENTITY.http_status: 200` (not `302`).
- Expected: WS smoke shows open + close (client-initiated `1000`).

---

## Rollback

If the manual change must be reverted:

- [ ] Disable the new policy OR remove the Service Token include rule from the Chat UI app.
- [ ] (Optional) Disable **Return 401 Response for Service Auth policies** if it was enabled only for this rollout.

Post-rollback evidence:

- `RUN_NETWORK_TESTS=1 ./dev access:probe --surface browser`

Expected regression patterns:

- Service-token requests may return `302` to Access login (or otherwise fail auth).

Paste output:

```

```
