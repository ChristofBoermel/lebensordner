# Phase Breakdown

## Task 1: Fix Family Member Document Access & Dashboard Routing

**Fix family/invitee document access:**

- Fix role-based redirects in `src/app/(dashboard)/layout.tsx` for family vs owners.
- Verify/update `getFamilyPermissions()` & `requireFamilyPermission()` in `src/lib/permissions/family-permissions.ts`.
- Redirect legacy VP dashboard access to `/zugriff#familie`.
- Test family APIs: `src/app/api/family/documents/download-url/route.ts`, `src/app/api/family/download/route.ts`.

Relevant Files:

- `d:\Projects\Lebensordner\src\app(dashboard)\layout.tsx`

- `d:\Projects\Lebensordner\src\lib\permissions\family-permissions.ts`

- `d:\Projects\Lebensordner\src\app(family)\family\page.tsx`

- `d:\Projects\Lebensordner\src\app\api\family\documents\download-url\route.ts`

- `d:\Projects\Lebensordner\src\app\api\family\download\route.ts`

Note:
- `/vp-dashboard` redirects to `/zugriff#familie`.
- Alle Familien-Funktionen sind im Zugriff-Tab konsolidiert.


## Task 2: Fix Navigation Sidebar Mobile Responsiveness

**Make dashboard nav mobile responsive:**

- Fix overflows in `src/components/layout/dashboard-nav.tsx` for sidebar/mobile menu.
- Handle senior mode fonts/search/accessibility without overflow.
- Adjust mobile overlay, scroll/sticky for <640px, 640-1024px.
- Ensure 44px/52px touch targets.

Relevant Files:

- `d:\Projects\Lebensordner\src\components\layout\dashboard-nav.tsx`


## Task 3: Fix Zugriff & Familie Tab Mobile Responsiveness

**Responsive Zugriff page:**

- Fix `src/app/(dashboard)/zugriff/page.tsx` layout overflow on mobile/tablet.
- Stack cards/grid single-column <640px; responsive dialogs/tables.
- Touch-friendly buttons/inputs; no senior mode overflow.
- Fix tabs horizontal scroll.

Relevant Files:

- `d:\Projects\Lebensordner\src\app(dashboard)\zugriff\page.tsx`


## Task 4: Fix Family Documents View Mobile Responsiveness

**Responsive family docs view:**

- Fix toolbar/grid overflow in `src/app/(family)/family/family-documents-client.tsx`.
- Mobile: 1-col grid, wrap toolbar; tablet:2-col, desktop:3-col.
- Responsive cards/tooltips/notices; senior mode safe.
- Test category spacing.

Relevant Files:

- `d:\Projects\Lebensordner\src\app(family)\family\family-documents-client.tsx`


## Task 5: Fix Remaining Dashboard Pages Mobile Responsiveness

**Responsive remaining dashboard pages:**

- Fix `src/app/(dashboard)/dashboard/page.tsx` & `src/components/dashboard/dashboard-content.tsx`.
- Update dokumente/notfall/erinnerungen/export/einstellungen pages.
- Responsive forms/tables/cards; senior mode tests.
- Document components if needed.

Relevant Files:

- `d:\Projects\Lebensordner\src\app(dashboard)\dashboard\page.tsx`

- `d:\Projects\Lebensordner\src\components\dashboard\dashboard-content.tsx`

- `d:\Projects\Lebensordner\src\app(dashboard)\dokumente\page.tsx`

- `d:\Projects\Lebensordner\src\app(dashboard)
otfall\page.tsx`

- `d:\Projects\Lebensordner\src\app(dashboard)\erinnerungen\page.tsx`

- `d:\Projects\Lebensordner\src\app(dashboard)\export\page.tsx`

- `d:\Projects\Lebensordner\src\app(dashboard)\einstellungen\page.tsx`


## Task 6: Enhance Senior Mode CSS for Mobile Devices

**Mobile senior mode CSS:**

- Add responsive breakpoints in `src/app/globals.css`.
- Mobile adjustments: reduce padding, clamp fonts, word-break.
- Update `tailwind.config.ts` utilities if needed.
- Test no horizontal scroll all breakpoints.

Relevant Files:

- `d:\Projects\Lebensordner\src\app\globals.css`

- `d:\Projects\Lebensordner\tailwind.config.ts`


## Task 7: Add Mobile Responsiveness Testing & Documentation

**Add mobile tests/docs:**

- E2E responsive tests in `e2e/family-dashboard.spec.ts`.
- New tests: nav/forms/senior mode mobile.
- Update `mobile_responsiveness.md` with breakpoints/checklist.
- Real device verification.

Relevant Files:

- `d:\Projects\Lebensordner\e2e\family-dashboard.spec.ts`

- `d:\Projects\Lebensordner\mobile_responsiveness.md`
