# Teams Meeting Creator (Node.js)

A Node.js app that creates Microsoft Teams online meetings with **no end-user login**.  
It uses Microsoft Graph application authentication (client credentials flow), plus:

- REST API: `POST /api/meetings`
- Web UI: `http://localhost:3000`

## 1) Prerequisites

- Node.js 18+ installed
- Azure app registration with:
  - Application permission: `OnlineMeetings.ReadWrite.All`
  - Admin consent granted
- A valid organizer user in your tenant, configured once in `.env` (prefer Object ID)

## 2) Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and fill your values:

```env
CLIENT_ID=your-client-id
TENANT_ID=your-tenant-id
CLIENT_SECRET=your-client-secret-value
CLIENT_SECRET_ID=your-client-secret-id
DEFAULT_ORGANIZER_USER_ID=00000000-0000-0000-0000-000000000000
DEFAULT_ORGANIZER_EMAIL=organizer@yourdomain.com
PORT=3000
```

Notes:
- `CLIENT_SECRET` is the secret **Value**.
- `CLIENT_SECRET_ID` is optional metadata and not used by runtime logic.
- `DEFAULT_ORGANIZER_USER_ID` is recommended and used first if present.
- `DEFAULT_ORGANIZER_EMAIL` is optional fallback when user ID is not set.

3. Start the app:

```bash
npm start
```

4. Open:

- Web UI: `http://localhost:3000`
- Health endpoint: `http://localhost:3000/health`

## 3) API Usage

### Create Meeting

`POST /api/meetings`

Request body:

```json
{
  "subject": "Team Sync",
  "startDateTime": "2026-02-20T10:00:00Z",
  "endDateTime": "2026-02-20T11:00:00Z"
}
```

Example curl:

```bash
curl -X POST http://localhost:3000/api/meetings \
  -H "Content-Type: application/json" \
  -d '{
    "subject":"Team Sync",
    "startDateTime":"2026-02-20T10:00:00Z",
    "endDateTime":"2026-02-20T11:00:00Z"
  }'
```

Success response:

```json
{
  "meetingId": "meeting-id",
  "subject": "Team Sync",
  "startDateTime": "2026-02-20T10:00:00.0000000Z",
  "endDateTime": "2026-02-20T11:00:00.0000000Z",
  "joinUrl": "https://teams.microsoft.com/l/meetup-join/...",
  "organizer": "user@yourdomain.com"
}
```

Meeting defaults:
- The app requests open join settings by default (`lobbyBypassSettings.scope = everyone`).
- Microsoft Teams tenant or meeting policies can still override these options.

## 4) Troubleshooting

- `401 Authentication with Microsoft Graph failed`
  - Verify `CLIENT_ID`, `TENANT_ID`, and `CLIENT_SECRET`.
- `403 Microsoft Graph permissions are missing`
  - Ensure `OnlineMeetings.ReadWrite.All` (Application) is added and admin consent is granted.
- `404` from `/users/{id}/onlineMeetings`
  - Ensure `DEFAULT_ORGANIZER_USER_ID` (or fallback email) exists in your tenant.
- `429`
  - You are being rate-limited; retry later.

## 5) Project Structure

```text
src/
  auth/graphAuth.js
  services/meetingService.js
  routes/meetingRoutes.js
  public/index.html
  public/styles.css
  index.js
```
