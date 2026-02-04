I have the following user query that I want you to help me with. Please implement the requested functionality following best practices.

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
