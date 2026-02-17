# Teams Meeting API - Setup and Operations Guide

This document is the full runbook for building, configuring, testing, and operating the Teams meeting creation app in this repository.

It includes:
- Local Node.js app setup
- Microsoft Entra app registration requirements
- Microsoft Teams policy requirements
- End-to-end validation steps
- Common failure cases and fixes
- Security and production checklist

---

## 1) What this app does

This app creates Microsoft Teams online meetings using Microsoft Graph **application permissions** (client credentials flow), so no end-user login is required in the app UI.

Core behavior:
- Organizer identity is fixed in `.env`
- UI and API do not ask for organizer email each time
- API endpoint creates meetings and returns join URL

Main endpoints:
- `GET /health`
- `POST /api/meetings`

UI pages:
- Main UI: `/`
- Test console: `/test.html`

---

## 2) Project structure

Key files:
- `src/index.js` - Express server and error handling
- `src/auth/graphAuth.js` - Graph authentication client
- `src/services/meetingService.js` - Validation + Graph online meeting creation
- `src/routes/meetingRoutes.js` - API routes
- `src/public/index.html` - Main browser form
- `src/public/test.html` - Debug/test console page
- `.env` / `.env.example` - Environment configuration

---

## 3) Environment variables

Required environment variables:

```env
CLIENT_ID=your-app-client-id
TENANT_ID=your-tenant-id
CLIENT_SECRET=your-client-secret-value
DEFAULT_ORGANIZER_USER_ID=00000000-0000-0000-0000-000000000000
DEFAULT_ORGANIZER_EMAIL=organizer@yourdomain.com
PORT=3000
```

Notes:
- `DEFAULT_ORGANIZER_USER_ID` is preferred and used first.
- `DEFAULT_ORGANIZER_EMAIL` is fallback.
- Keep `.env` out of source control.

---

## 4) Local app setup

1. Install Node.js (18+ recommended).
2. Install dependencies:

```bash
npm install
```

3. Configure `.env` with tenant/app/organizer values.
4. Start server:

```bash
npm start
```

5. Open:
- `http://localhost:3000`
- `http://localhost:3000/test.html`

---

## 5) Microsoft Entra app setup (client tenant)

In Entra portal (`https://entra.microsoft.com`):

1. Open app registration (by Client ID).
2. Go to **API permissions**.
3. Add **Application** permission:
   - `OnlineMeetings.ReadWrite.All`
4. Click **Grant admin consent**.
5. In **Certificates & secrets**, create/rotate secret and copy secret value.

Reference:
- https://learn.microsoft.com/en-us/graph/api/application-post-onlinemeetings?view=graph-rest-1.0&tabs=http

---

## 6) Teams application access policy (required for app-only)

This is mandatory for app-only meeting creation:

```powershell
Install-Module MicrosoftTeams -Force
Connect-MicrosoftTeams

New-CsApplicationAccessPolicy `
  -Identity "GraphMeetingsPolicy" `
  -AppIds "<your-client-id>" `
  -Description "Allow app to create online meetings"

Grant-CsApplicationAccessPolicy `
  -PolicyName "GraphMeetingsPolicy" `
  -Identity "organizer@tenant.onmicrosoft.com"
```

Verification:

```powershell
Get-CsApplicationAccessPolicy -Identity "GraphMeetingsPolicy"
Get-CsOnlineUser -Identity "organizer@tenant.onmicrosoft.com" | Select DisplayName, ApplicationAccessPolicy
```

---

## 7) Teams meeting policy for open join (lobby behavior)

If users see:
`Someone will let you in when the meeting starts`

Then Teams meeting policy is enforcing lobby behavior.

### 7.1 UI path

In Teams admin center (`https://admin.teams.microsoft.com`):
- Meetings -> Meeting policies
- Edit the policy assigned to organizer (or create dedicated policy)
- Enable anonymous join
- Set lobby bypass/auto admit to `Everyone`

Also check:
- Meetings -> Meeting settings -> Anonymous users can join meetings = On

### 7.2 PowerShell option (dedicated organizer policy)

```powershell
New-CsTeamsMeetingPolicy -Identity "OpenJoinPolicy"
Set-CsTeamsMeetingPolicy -Identity "OpenJoinPolicy" -AllowAnonymousUsersToJoinMeeting $true
Set-CsTeamsMeetingPolicy -Identity "OpenJoinPolicy" -AutoAdmittedUsers "Everyone"
Grant-CsTeamsMeetingPolicy -Identity "organizer@tenant.onmicrosoft.com" -PolicyName "OpenJoinPolicy"
```

Check assigned policy:

```powershell
Get-CsOnlineUser -Identity "organizer@tenant.onmicrosoft.com" | Select DisplayName, TeamsMeetingPolicy
```

Important:
- If `TeamsMeetingPolicy` is blank, user is on Global default policy.
- Policy propagation can take 10-30+ minutes.

---

## 8) API usage

### 8.1 Create meeting request

`POST /api/meetings`

Body:

```json
{
  "subject": "Team Sync",
  "startDateTime": "2026-02-20T10:00:00Z",
  "endDateTime": "2026-02-20T11:00:00Z"
}
```

Success response:

```json
{
  "meetingId": "....",
  "subject": "Team Sync",
  "startDateTime": "2026-02-20T10:00:00Z",
  "endDateTime": "2026-02-20T11:00:00Z",
  "joinUrl": "https://teams.microsoft.com/l/meetup-join/...",
  "organizer": "organizer@tenant.onmicrosoft.com"
}
```

### 8.2 PowerShell test

```powershell
$body = @{
  subject = "Final validation"
  startDateTime = "2026-02-20T10:00:00Z"
  endDateTime = "2026-02-20T11:00:00Z"
} | ConvertTo-Json -Compress

Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/meetings" -ContentType "application/json" -Body $body
```

---

## 9) Built-in app defaults and behavior

Current implementation requests open meeting defaults at creation:
- `lobbyBypassSettings.scope = "everyone"`
- `lobbyBypassSettings.isDialInBypassEnabled = true`
- `allowedPresenters = "everyone"`

But tenant policy can still override these values.

---

## 10) Troubleshooting matrix

### Error: `DEFAULT_ORGANIZER_EMAIL is not configured`
- Set organizer values in `.env`
- Restart app

### Error: `No application access policy found for this app`
- Create/assign `CsApplicationAccessPolicy` to organizer user

### Error: `Microsoft Graph permissions are missing`
- Confirm Graph app permission + admin consent

### Error: `Unknown Graph API error`
- Check request-id in response
- Verify organizer user exists and policy assignment propagated

### Meeting link opens lobby waiting screen
- Update Teams meeting policy to allow anonymous join and bypass lobby
- Ensure policy assigned to organizer and propagated

### Works for some meetings but not others
- Old links keep old meeting options
- Generate and test with a newly created meeting link

---

## 11) Operational runbook for support

When issue is reported:

1. Verify local app health (`GET /health`)
2. Create fresh meeting via `/test.html` or API
3. Capture:
   - Timestamp
   - Request payload (without secrets)
   - Full response
   - Graph request-id (if error)
4. Verify tenant config:
   - App permission consent
   - Application access policy assignment
   - Teams meeting policy assignment
5. Retest after propagation window

---

## 12) Security checklist

- Rotate client secret regularly and after any exposure.
- Never commit `.env`.
- Use separate app registration per environment (dev/stage/prod).
- Restrict who can access organizer account.
- Keep audit logs for meeting creation requests.
- Prefer least privilege and review Graph permissions periodically.

---

## 13) Production hardening recommendations

- Add Graph request timeout and retry with backoff.
- Add structured logs with correlation IDs.
- Add endpoint-level rate limiting.
- Add server-side request validation schema.
- Add monitoring alerts for 401/403/429/5xx spikes.
- Add a diagnostics endpoint for non-secret health metadata.

---

## 14) Reference links

- Graph create online meeting:
  - https://learn.microsoft.com/en-us/graph/api/application-post-onlinemeetings?view=graph-rest-1.0&tabs=http
- Teams admin center:
  - https://admin.teams.microsoft.com
- Entra admin center:
  - https://entra.microsoft.com

