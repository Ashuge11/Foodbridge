# Interface and inbox update

## Apply to your current working project on any Windows computer
1. Stop backend and frontend terminals with Ctrl+C.
2. Extract this ZIP into a NEW folder.
3. Open that extracted folder (contains Apply-Fixes.ps1) in VS Code.
4. Open PowerShell there and run:
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Apply-Fixes.ps1
5. At the prompt paste the FULL path to your existing working Foodbridge folder
   that contains client and server. Do not enter the extracted update folder.
6. Reopen your existing project. Its .env files are preserved.
7. In a terminal at that project's root:
   npm.cmd --prefix server install --workspaces=false
   npm.cmd --prefix client install --workspaces=false
   npm.cmd --prefix server start
8. In a second terminal at that project's root:
   npm.cmd --prefix client run dev
9. Open http://localhost:5173 and refresh. No seed or database reset is needed.

## New controls
- Donor cards: Delete with confirmation. Available food is cancelled, alerts queued,
  and the card hidden from the donor's dashboard.
- Completed/cancelled/rejected/expired cards: Delete hides the donor's card, retaining
  original records for impact, administration and involved participants.
- Claimed/assigned/in-transit food: Delete is disabled. Use Cancel when allowed;
  dispatched food must finish the tracked workflow. Backend enforces this too.
- Notification inbox: All/Unread tabs, refresh, mark read/unread, mark all read,
  delete one, and clear read with confirmation.
- Notifications are created automatically from actual workflow events. Users cannot
  forge or edit the message text. Update means changing read/unread state.
- Deleted alerts retain their event keys privately so worker retries cannot recreate
  the alert. Later cancellation still reaches a previously notified recipient.

## Visual changes
Locally bundled illustrative food photo, editorial typography, emerald/cream/orange
palette, role-specific welcome banners, illustrated food category covers, responsive
inbox rows, accessible native confirmation dialogs, hover and entrance animations.
Reduced-motion preference disables animations. Images do not depict actual donations.
Photo source and credit: client/public/images/CREDITS.txt.

## Verification
PASS: Vite production build.
PASS: 38 backend guard checks (39 including the enclosing test), using real HTTP,
JWT and controllers with mocked database operations.
PASS: all backend source syntax checks.
NOT VERIFIED: rendered browser UI, database-backed deletion and Socket.IO end-to-end.
Browser smoke testing was attempted but the browser binary download failed.
The earlier disposable MongoDB integration attempt was blocked by the environment.
No tests connected to your Atlas database.

## Manual check
1. Delete an available donor listing after its NGO notification arrives.
   Donor card disappears; NGO receives cancellation.
2. Verify Delete is disabled for active claims and rejected by the API.
3. Delete a delivered donor card: public impact totals must stay unchanged.
4. Mark one notification read then unread; count and unread filter update.
5. Cancel a delete confirmation: notification stays.
6. Confirm delete: notification disappears.
7. Clear read: unread notifications remain.
8. Refresh after each action: MongoDB state should persist.
9. Open at mobile width and verify buttons, forms, dialogs and sidebar fit.
