# FaceIQLabs HTML Reference -> `/ui/*` Routes

Source folder: `_ui_reference/faceiqlabs-html/*.html`

All pages in that folder are mirrored as Next routes under `app/(ui)/ui/**`.

| Reference HTML | Next route | Route file |
| --- | --- | --- |
| `index.html` | `/ui` | `app/(ui)/ui/page.tsx` |
| `dashboard.html` | `/ui/dashboard` | `app/(ui)/ui/dashboard/page.tsx` |
| `analytics.html` | `/ui/analytics` | `app/(ui)/ui/analytics/page.tsx` |
| `reports.html` | `/ui/reports` | `app/(ui)/ui/reports/page.tsx` |
| `settings.html` | `/ui/settings` | `app/(ui)/ui/settings/page.tsx` |
| `profile.html` | `/ui/profile` | `app/(ui)/ui/profile/page.tsx` |
| `billing.html` | `/ui/billing` | `app/(ui)/ui/billing/page.tsx` |
| `team.html` | `/ui/team` | `app/(ui)/ui/team/page.tsx` |
| `notifications.html` | `/ui/notifications` | `app/(ui)/ui/notifications/page.tsx` |
| `help.html` | `/ui/help` | `app/(ui)/ui/help/page.tsx` |
| `help_documentation.html` | `/ui/help/documentation` | `app/(ui)/ui/help/documentation/page.tsx` |
| `help_support.html` | `/ui/help/support` | `app/(ui)/ui/help/support/page.tsx` |
| `api_docs.html` | `/ui/api-docs` | `app/(ui)/ui/api-docs/page.tsx` |
| `auth.html` | `/ui/auth` | `app/(ui)/ui/auth/page.tsx` |
| `auth_login.html` | `/ui/auth/login` | `app/(ui)/ui/auth/login/page.tsx` |
| `auth_register.html` | `/ui/auth/register` | `app/(ui)/ui/auth/register/page.tsx` |

Notes:
- The captured reference HTML for some pages is a default Next `404` payload, but the file exists and therefore the route is still mirrored here as a real screen (not a placeholder).

