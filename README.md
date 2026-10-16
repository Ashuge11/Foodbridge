# FoodBridge — corrected project

This is the uploaded FoodBridge application with targeted validation, authorization,
error-handling and reliability fixes. Existing accounts and donations are preserved.

## Apply to your existing Windows project

1. Stop frontend and backend with Ctrl+C.
2. Extract the downloaded ZIP. Open PowerShell in its extracted top-level folder
   (the folder containing Apply-Fixes.ps1).
3. Run (enter the FULL path to your existing working Foodbridge folder when prompted):
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Apply-Fixes.ps1
4. Backend terminal:
   Set-Location "C:\Users\Admin\Desktop\Foodbridge\server"
   npm.cmd install --workspaces=false
   npm.cmd start
5. Frontend terminal:
   Set-Location "C:\Users\Admin\Desktop\Foodbridge\client"
   npm.cmd install --workspaces=false
   npm.cmd run dev
6. Open http://localhost:5173 and refresh once.

The script makes a timestamped source backup beside your current project.
It preserves your existing server/.env and client/.env and does not touch MongoDB.
It removes the accidental server/src/package.json and relocates any nested
server/src/node_modules into the backup so old Express/Mongoose versions cannot
override the declared server dependencies. Install packages from server, not server/src.

Do not run the seed again to apply these fixes. Existing passwords remain unchanged.
Seeded development accounts use FoodBridge@123 only if their passwords were never changed.

## New setup

Use Node.js 22 or 24 and MongoDB Community Server or Atlas. No Docker,
replica set or transactions are required. Run npm.cmd install --workspaces=false
separately inside server and client.

Copy server/.env.example to server/.env and client/.env.example to client/.env.
For local MongoDB use mongodb://127.0.0.1:27017/foodbridge.
For your existing Atlas database preserve its actual database name (Foodbgidge).
Set a random JWT_SECRET of at least 32 characters. Configure Atlas database access
and network access for the machine running the backend.
Run npm.cmd run seed in server only if you want development fixtures.
Seed files are fictional demo data.

## UI and inbox update

- Redesigned dashboard welcome banners, notification center and category illustrations.
- Locally bundled illustrative food photo, responsive layouts and reduced-motion support.
- Donor Delete button and confirmation. Available offers are cancelled and hidden;
  terminal listings are hidden from the donor only. Active delivery states cannot
  be deleted. Original records remain for participants, administration and impact.
- Notifications: all/unread views, mark read, mark unread, mark all read, delete one,
  clear read. Notification text and creation remain server-managed.
- Notification deletion is a soft delete: hidden from inbox, retained for deduplication
  and later cancellation alerts. Do not physically delete these MongoDB records.

## Changes

- Corrected backend npm start/dev scripts; server.js forwards to app.js.
- Removed conflicting nested dependency manifests and unused Tailwind 4 plugin.
- Root npm commands now point to the actual client/server folders.
- Central error middleware handles malformed JSON, oversized bodies, schema errors,
  duplicates, invalid IDs and database unavailability.
- Validation responses include field names; internal errors do not expose stacks.
- Database failures return recoverable errors rather than invalidating valid JWTs.
- Unknown roles fail closed; existing backend role checks and ownership filters remain.
- Phone input requires 7–15 digits; login and registration enforce bcrypt byte limits.
- Volunteer acceptance atomically requires a claimed NGO and valid destination.
- Long rejection reasons remain stored in full while bounded history/event messages
  comply with their schema limits.
- Notification messages are bounded; worker retries preserve event order.
- Cancellation, rejection and expiry reach existing notification recipients.
- Notification processing re-reads status before processing a delayed event.
- Removed verbose logs containing recipient names and IDs.
- Donations created by seeded demo donors inherit the demo flag.
- Frontend request timeout, readable API errors, response validation and render fallback.
- Duplicate-submit locks for login, registration and donation form.
- Explicit blank-coordinate checks and inbox stale-response protection.

## Verification actually performed

- Production frontend build: PASS (Vite).
- npm test in server: PASS, 38 checks plus one enclosing test.
  Tests use real HTTP routes, JWT verification, validators and controllers with MOCKED
  model operations. They cover missing/forged/expired/wrong-audience/revoked tokens,
  role restrictions, public admin rejection, verification field injection, invalid
  food and checklist inputs, ownership query filters, notification ownership,
  destination checks and long rejection reasons.
- All backend JavaScript syntax checks: see REVIEW.md.
- Full integration suite is included: npm.cmd run test:integration in server.
  It starts a disposable standalone MongoDB and NEVER reads .env or connects to Atlas.
  Its first run downloads a MongoDB binary. It was attempted here but MongoDB startup
  was blocked by this execution environment ("open: Operation not permitted").
  Therefore live database concurrency, full workflow and notification persistence
  were NOT verified in this review.
- Socket.IO end-to-end and live database deletion tests remain unverified. See UI-UPDATE.md for browser smoke-test results.
- No changes or tests were made against your Atlas database.

## Five-minute manual verification after applying

1. Logged out: /dashboard redirects to login.
2. Wrong password: readable error. Sign-up never offers administrator.
3. Pending/rejected NGO cannot claim. Donor cannot access admin APIs.
4. Donor creates a fresh future-dated demo listing.
5. Wait until TWO verified nearby NGOs receive its notification.
6. One NGO claims; the other sees "Food no longer available".
7. Available nearby volunteer receives a pickup request with NGO destination.
8. Two volunteers accepting the SAME request: only one succeeds.
9. Assigned volunteer dispatches, picks up and submits handover.
10. Only the claiming NGO can confirm receipt. Impact increments once.
11. Create another listing, wait for NGO notification, then cancel it.
    Both previously notified NGOs receive cancellation within the worker cycle.
12. Expired listing cannot be claimed; invalid food quantities/dates are rejected.

A donor creating and cancelling BEFORE the initial offer is processed may produce
no NGO alert: there was no previously notified NGO. Test cancellation after the NGO
has received the original offer. Already-processed historical events are not replayed.

## Limits and reporting

These fixes are not a complete production security certification. The admin UI remains
your existing overview and verification panel. Maps use approximate straight-line
distance; external navigation handles roads. Socket notifications are live in-app
alerts, not background browser push. Checklists are recorded declarations, not a
guarantee of food safety. Declare all fictional hackathon data as demo.

If a port is busy, stop the old process rather than starting duplicate backends.
For CORS, CLIENT_ORIGINS must contain your exact frontend origin; restart the backend.
If Vite environment values change, restart the frontend.
If login reports incorrect credentials, seeding does not overwrite existing passwords.
