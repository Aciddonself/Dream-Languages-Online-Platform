# LMS implementation audit

This is a code-level audit of the current checkout. “Present” means there is a visible page and connected server/database behavior; it does not mean the workflow has been proven against the school's live accounts or policies.

## Current findings

| Area | State | Finding |
| --- | --- | --- |
| Authentication and roles | Present; production setup required | Supabase authentication, database-backed roles, role guards and MFA for administrators, Finance and Head of Academics are implemented. A visible Staff sign in link now redirects through `/admin-login` to the `ADMIN_HOST` portal. The first administrator must still be provisioned and `ADMIN_HOST` must match the admin hostname. |
| Scheduling and attendance | Present; needs live workflow validation | Sessions are stored as records, recurrence creates separate sessions, attendance is role-checked, and actual Google Meet URLs must be added by staff. The app does not create Meet rooms through Google's API. |
| Student fees and payment workflow | Implemented for manual transfers; not live-account verified | Students can report a payment reference; Finance can verify/reject it; verification allocates funds to outstanding fee schedules transactionally. Receipts use the existing verified-payment route. It currently does not take card/mobile-money payments or upload proof. |
| Online assessments | Implemented for multiple-choice exams; not live-account verified | Teachers can author multiple-choice questions, students can start/resume one attempt, save answers, and submit against server-side time limits. The server grades attempts, but does not expose the score to students before staff review and publication. Teachers can review and publish scores through the existing results workflow. Free-response questions, file uploads, and external proctoring are not included. |
| Assignments/homework | Implemented; storage migration and live validation needed | Teachers can create assignments for assigned classes; enrolled students can submit written work or private files; authorized staff can grade with feedback. New attachments use the private `assignment-submissions` Supabase Storage bucket and authenticated download routes. Apply migration `0009_durable_assignment_storage.sql` before enabling uploads. Older submissions still fall back to the app's `private_uploads` directory. |
| CMS | Implemented; media migration applied to configured project | Admins can create/edit/publish pages and news, manage public social links, and approve reviews. A new image library manages the public logo, home page images, partner marks, about portraits, course feature image, and gallery. Uploads are converted to WebP and stored in the public `site-media` bucket. The media migration was applied to the Supabase project configured in this checkout. |
| Bulk SMS | Implemented; live provider setup required | Super administrators can send campaigns to students with valid Uganda mobile numbers. The app requires Africa's Talking username and API key; live sends also require an approved Uganda sender ID and funded balance. Campaigns show provider acceptance, not handset delivery. Never retry a timeout until provider status is checked. |
| Father-DLA AI | Implemented; provider key and live validation required | The app supports Gemini or Groq streaming, per-user history, safety filters, rate and cost limits, search citations when supported, and admin usage monitoring. Configure one provider key in Railway and validate with a learner and staff account. The 39 safety and routing tests pass. |
| Email | Partly implemented / awaiting school configuration | Outbound school email jobs and notification flows exist. There is no inbound mailbox reader inside the app. The admin/HOD webmail shortcut depends on `CPANEL_WEBMAIL_URL`, intentionally left unset until the school's mailbox URL is known. |
| Deployment | Partly validated | Railway production is connected to `phase-1-dasher-design`, auto-deploys GitHub pushes, and has the custom domain attached. The local production build remains blocked on this Windows checkout by an `EPERM` error creating a nested `.next/server/app` directory, so the next Railway build must confirm the deploy. Next.js is updated to 16.4.6 and the production dependency audit reports no vulnerabilities. |
| Quality checks | Partial | TypeScript, ESLint and all 39 Father-DLA tests pass. Full role-by-role end-to-end verification still needs real accounts and provider services. |

## Repair order

1. Run full manual-payment scenarios with real student and finance accounts; add proof uploads or a provider after selecting the school's process.
2. Run online assessment scenarios with real teacher/student accounts, then add free-response question types and policy controls if required.
3. Apply the assignment-storage migration, verify the private Supabase bucket accepts and serves files, then run teacher/student accounts through upload, download and resubmission workflows.
4. Verify CMS public cache refresh and publishing behavior in the running site.
5. Resolve admin access: provision the first admin, configure its hostname, and make the correct sign-in URL easy to find for authorized staff.
6. Add and test Africa's Talking credentials, an approved sender ID, and provider balance before live SMS use.
7. Configure school email and cPanel webmail once the address and provider details are available; add inbox integration only if the chosen provider supports a secure API/IMAP workflow.
8. Complete role-by-role end-to-end scenarios, address defects, finish performance tuning, and verify the next Railway production build and health check.

## Admin access discoverability fix

- The public site's **Staff sign in** link opens `/admin-login`, which redirects to `/admin/login` on the configured `ADMIN_HOST`.
- Production shows a configuration message if the host is not set and host isolation is required.
- The link does not create an administrator account. Use the documented one-time bootstrap on a trusted machine, and configure `ADMIN_HOST` in production.

## Payment workflow added in this repair step

- Students can submit the amount, currency, method and transfer reference from Fees.
- Finance and administrators can review pending payments and verify/reject them.
- Verification credits the student's outstanding fee schedules transactionally and refuses overpayments.
- Verified payments remain eligible for the existing receipt download route.
- Payment provider checkout and payment-proof uploads are not included in this step.

## Online assessment workflow added in this repair step

- Academic staff can author multiple-choice questions for an assessment; question editing is locked as soon as a student starts.
- Active students in the assessment's class can start one attempt, resume it, autosave answers, and submit before the server-enforced deadline.
- Only answer options are sent to the student; answer keys and auto-scores remain server-side until an authorized teacher reviews and publishes the score.
- Teacher results page lists submitted attempts and publishes scores through the existing audited result workflow.
- Timed online exams require real-account validation. Free-response scoring, file upload answers, and proctoring are not included.

## Assignment and CMS workflow added in this repair step

- Teachers can create assignments for their own classes; due dates and max scores are validated.
- Enrolled students can submit written responses and/or private document, image, or audio files, resubmit before the deadline, and see scores/feedback once graded.
- Teachers can see only their assignment submissions and grade them; Head of Academics and administrators can review across classes. Download endpoints enforce account/role access.
- New assignment files use a private Supabase Storage bucket configured by `drizzle/0009_durable_assignment_storage.sql`; apply that migration before accepting uploads. Legacy files still read from `private_uploads` on the original server and should be migrated or retained there until verified.
- Existing CMS news posts can now be edited, published, unpublished, or archived. Changes are audited and refresh the public content cache.
