# Alto — Frontend Plan

> **Console:** GitHub Pages | **API:** `https://api.alto-ai.tech`

---

## Table of Contents

1. [What You're Building](#1-what-youre-building)
2. [Pages](#2-pages)
3. [Authentication](#3-authentication)
4. [Tools List Page](#4-tools-list-page)
5. [Tool Settings Page](#5-tool-settings-page)
6. [Agent Behaviour Page](#6-agent-behaviour-page)
7. [Live Logs Page](#7-live-logs-page)
8. [Error Handling](#8-error-handling)
9. [API Quick Reference](#9-api-quick-reference)
10. [Rules](#10-rules)

---

## 1. What You're Building

A static console hosted on GitHub Pages. One admin user. No registration. Every page except login requires authentication.

Talks **only** to `https://api.alto-ai.tech`. What it does:
- Manage integration settings and OAuth connections
- Configure agent behaviour (personality, language, etc.)
- View live server logs
- Change the admin password

---

## 2. Pages

| Page | Path | Requires login |
|---|---|---|
| Login | `/login` | No |
| Tools list | `/tools` | Yes |
| Tool settings | `/tools/{id}` | Yes |
| Agent behaviour | `/agent` | Yes |
| Live logs | `/logs` | Yes |

Redirect to `/login` if any protected page is accessed without a valid token. After login, redirect to `/tools`.

---

## 3. Authentication

### Login

```
POST https://api.alto-ai.tech/auth/login
Content-Type: application/json

{ "username": "admin", "password": "..." }
```

Success `200`:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer",
  "expires_in": 900
}
```

### Token Storage

| Token | Store in |
|---|---|
| `access_token` | Memory only (JS variable / React state). Never `localStorage`. |
| `refresh_token` | `localStorage` |

Access token expires in **15 minutes**. Refresh token expires in **7 days**.

### Automatic Token Refresh

Before every API call: decode the JWT and read the `exp` field (no signature verification needed client-side). If it has expired or will expire within 30 seconds:

1. Call `POST /auth/refresh` with the stored refresh token.
2. Store the new tokens.
3. Continue with the original request.

If refresh returns `401`, clear all tokens and redirect to `/login`. This must be invisible to the user — they should never see a failed request caused by token expiry.

### Sending the Token

Every protected request:
```
Authorization: Bearer <access_token>
```

Exceptions: `/auth/login`, `/auth/refresh`, `/health`, and the logs SSE stream (uses a query param — see [Live Logs Page](#7-live-logs-page)).

### Logout

1. `POST /auth/logout` with the refresh token.
2. Clear all tokens regardless of response.
3. Redirect to `/login`.

```
POST https://api.alto-ai.tech/auth/logout
Authorization: Bearer <access_token>

{ "refresh_token": "..." }
```

### Password Change

Available from a profile section. Enforce minimum 8 characters client-side.

```
PUT https://api.alto-ai.tech/auth/password
Authorization: Bearer <access_token>

{ "current_password": "old", "new_password": "new" }
```

On `204`: log the user out immediately (the server has invalidated all tokens).

---

## 4. Tools List Page

On load:
```
GET https://api.alto-ai.tech/tools
Authorization: Bearer <access_token>
```

Response:
```json
{
  "tools": [
    { "id": "discord", "name": "Discord", "active": true,  "version": "1.0.0" },
    { "id": "trello",  "name": "Trello",  "active": false, "version": "1.0.0" }
  ]
}
```

Render one card per tool. Show name and active status (green = active, grey = inactive). Clicking a card goes to `/tools/{id}`. Re-fetch this list after returning from a tool page.

---

## 5. Tool Settings Page

### Loading

On load:
```
GET https://api.alto-ai.tech/tools/{id}
Authorization: Bearer <access_token>
```

This response is the **only source of truth** for what to render. Do not hardcode any field names, labels, or types.

Response shape:
```json
{
  "id": "trello",
  "name": "Trello",
  "description": "...",
  "active": false,
  "has_oauth": true,
  "settings": [
    {
      "key": "trello__oauth_token",
      "label": "Trello Connection",
      "type": "oauth",
      "source": "oauth",
      "description": "Connect your Trello account.",
      "connected": false,
      "required_for_activation": true
    },
    {
      "key": "trello__board_id",
      "label": "Default Board ID",
      "type": "string",
      "source": "settings",
      "description": "The Trello board Alto will use by default.",
      "current_value": null,
      "required_for_activation": false
    }
  ]
}
```

### What to render per field

**Based on `source`:**

| `source` | Editable | How to render |
|---|---|---|
| `settings` | Yes | Normal input field |
| `env` | No | Greyed-out. Show `description` as a note. Exclude from all save calls. |
| `oauth` | No — has its own controls | Connect/Disconnect button (see below) |

**Based on `type`:**

| `type` | Input element | Pre-fill |
|---|---|---|
| `string` | Text input | `current_value` |
| `secret` | Password input with show/hide toggle | **Always empty.** Never pre-fill with `"●●●●●●"`. Only include in save if user typed something. |
| `string_array` | Tag input or textarea (one item per line) | `current_value` array |
| `boolean` | Toggle switch | `current_value` |
| `integer` | Number input | `current_value` |
| `oauth` | Not an input — render Connect/Disconnect button | Use `connected` field |

### OAuth Connect/Disconnect

For any field with `type: "oauth"`:

**If `connected: false`** — show a **Connect** button.

When clicked:
1. Refresh access token if needed.
2. Call `GET /oauth/{tool_id}/start` → receive `{ "authorization_url": "..." }`.
3. Open `authorization_url` in a new tab.
4. Begin polling `GET /tools/{id}` every 3 seconds (max 2 minutes).
5. When `connected: true` appears in the response, stop polling, show success, update the UI.
6. If polling times out, show: *"Connection timed out. Please try again."*

**If `connected: true`** — show a **Disconnect** button.

When clicked:
1. Show a confirmation prompt: *"Disconnect Trello? Alto will no longer be able to use this integration."*
2. Call `DELETE /oauth/{tool_id}`.
3. On `204`: re-fetch `GET /tools/{id}`, update the UI.

### Active status

Show an Active/Inactive badge at the top using the `active` field. Re-fetch after every save, clear, connect, or disconnect.

For any `required_for_activation: true` field with no value (or `connected: false`), show a note beneath it: *"Required to activate this integration."*

### Saving

One **Save** button per tool. When clicked, send only fields that:
- Have `source: "settings"`
- Were changed by the user
- Are not empty secret fields (user opened the page but didn't type a new value)

```
PUT https://api.alto-ai.tech/settings
Authorization: Bearer <access_token>
Content-Type: application/json

{ "trello__board_id": "xyz" }
```

On `200`: show success toast, re-fetch `GET /tools/{id}`.  
On error: show `error.message`.

Do not auto-save.

### Clearing a field

Every `source: "settings"` field gets a clear/remove button (✕).

When clicked:
1. For `type: "secret"`: confirm first.
2. Call `DELETE https://api.alto-ai.tech/settings/{key}`.
3. On `204`: clear the input, re-fetch `GET /tools/{id}`.
4. On `404`: clear the input silently (was already unset).

---

## 6. Agent Behaviour Page

### Loading

On load:
```
GET https://api.alto-ai.tech/agent
Authorization: Bearer <access_token>
```

Response:
```json
{
  "settings": {
    "agent__name": "Alto",
    "agent__personality": "Helpful, concise, and professional.",
    "agent__response_style": "short",
    "agent__language": "en"
  },
  "schema": [
    { "key": "agent__name",           "label": "Agent Name",     "type": "string", "description": "What Alto calls itself.",         "default": "Alto" },
    { "key": "agent__personality",    "label": "Personality",    "type": "string", "description": "How Alto should behave.",          "default": "Helpful, concise, and professional." },
    { "key": "agent__response_style", "label": "Response Style", "type": "string", "description": "How verbose responses should be.", "default": "short" },
    { "key": "agent__language",       "label": "Language",       "type": "string", "description": "BCP 47 tag, e.g. en, nl, de.",     "default": "en" }
  ]
}
```

Render the form dynamically from `schema`, pre-filling each field from `settings`. Same rendering logic as tool settings — use `type` to pick the input element.

### Saving

One **Save** button. Send only changed fields.

```
PUT https://api.alto-ai.tech/agent
Authorization: Bearer <access_token>
Content-Type: application/json

{ "agent__personality": "Friendly and brief." }
```

On `200`: show success toast.

---

## 7. Live Logs Page

Connect using the browser's `EventSource`. Because `EventSource` cannot send custom headers, pass the token as a query param:

```
GET https://api.alto-ai.tech/logs/stream?token=<access_token>
```

Refresh the token before connecting if needed (same logic as other requests).

### Display

- Scrollable terminal-style area. Newest lines at the bottom.
- Auto-scroll to bottom unless the user has manually scrolled up.
- Each event: `{ "ts": "...", "level": "INFO", "msg": "..." }`
- Format: `[HH:MM:SS] LEVEL  message`
- Colour by level: `INFO` grey · `WARN` yellow · `ERROR` red · `DEBUG` dim

### Controls

- **Clear** button — clears displayed lines only, not the log file.
- **Connection status** — "Connected" (green) or "Reconnecting..." (yellow).

### Reconnection

Reconnect automatically with exponential backoff on disconnect (start 2s, max 30s). Refresh the access token before reconnecting.

---

## 8. Error Handling

All API errors:
```json
{ "error": { "code": "INVALID_TOKEN", "message": "JWT has expired.", "request_id": "req_abc123" } }
```

| Situation | What to do |
|---|---|
| Any `4xx` or `5xx` | Show `error.message` in a toast or inline |
| `401 INVALID_TOKEN` mid-session | Attempt one transparent token refresh. If that fails, log out. |
| `401 BAD_CREDENTIALS` on login | Show *"Incorrect username or password."* inline — not a toast. |
| `401 TOKEN_REVOKED` | Clear tokens, redirect to `/login` with: *"Your session expired. Please log in again."* |
| `/health` returns `agent: "unavailable"` | Persistent banner across all pages: *"Agent is currently offline."* |

Never silently ignore errors. Never show raw server errors or stack traces.

---

## 9. API Quick Reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/auth/login` | No | Log in |
| `POST` | `/auth/refresh` | Refresh token in body | Get new access token |
| `POST` | `/auth/logout` | Yes | Log out |
| `PUT` | `/auth/password` | Yes | Change password |
| `GET` | `/tools` | Yes | List all tools + active status |
| `GET` | `/tools/{id}` | Yes | Tool manifest + current field values |
| `PUT` | `/settings` | Yes | Save one or more integration settings |
| `DELETE` | `/settings/{key}` | Yes | Clear one setting |
| `GET` | `/agent` | Yes | Agent behaviour settings + schema |
| `PUT` | `/agent` | Yes | Save agent behaviour settings |
| `GET` | `/oauth/{id}/start` | Yes | Get OAuth authorization URL |
| `DELETE` | `/oauth/{id}` | Yes | Disconnect an OAuth integration |
| `GET` | `/logs/stream?token=` | Token in query param | Live log SSE stream |
| `GET` | `/health` | No | Server status |

---

## 10. Rules

- Only talk to `api.alto-ai.tech`. Never contact the agent server.
- Access token in memory only — never in `localStorage`.
- Never pre-fill secret fields with `"●●●●●●"`.
- Never log tokens or passwords to the console.
- Never hardcode field names, labels, or tool IDs — everything comes from the API.
- Token refresh must be invisible to the user.
- All protected pages check for a valid token on mount and redirect to `/login` if missing.
- The OAuth polling loop must have a timeout (2 minutes max). Never poll indefinitely.
- Must work as a fully static GitHub Pages site — no backend, no proxy, no build-time secrets.