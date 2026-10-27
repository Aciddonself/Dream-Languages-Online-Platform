# DLA Learning Hub

Next.js application using Supabase Auth and PostgreSQL through Drizzle ORM. Deploy the application on Vercel and connect the repository to GitHub for automatic deployments.

## Local setup

1. Create a Supabase project. In its database settings, copy the PostgreSQL connection string (use the session pooler for serverless deployments). In Supabase Auth, enable email/password sign-in.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and `APP_URL`. Keep `.env.local` private; never commit or share its values.
3. Install dependencies and create/update tables on a fresh or development database:

   ```powershell
   npm install
   npm run db:push
   ```

   For production, review and apply checked-in migrations with `npm run db:migrate`; the migration creates the private Supabase Storage bucket for student photos and adds official document-stamp fields. Do not use `db:push` against a live database.
4. To create local demo records, set `ALLOW_DEMO_SEED=1` and a private `SEED_DEMO_PASSWORD` of at least 10 characters, then run:

   ```powershell
   $env:ALLOW_DEMO_SEED = "1"
   $env:SEED_DEMO_PASSWORD = "choose-a-private-password"
   npm run db:seed
   Remove-Item Env:ALLOW_DEMO_SEED, Env:SEED_DEMO_PASSWORD
   ```

   Demo seeding is for isolated local development only. It does not change the password of an account that already exists.
5. Start the app:

   ```powershell
   npm run dev
   ```

   Open `http://localhost:3000`. `GET /api/health` reports whether the application can reach PostgreSQL.

## Demo sign-ins

Demo account passwords are the value you set in `SEED_DEMO_PASSWORD` when seeding. Use `/login` for non-admin demo accounts and `/admin/login` for the administrator. The seed does not reset existing users.

| Portal | Email | Role |
| --- | --- | --- |
| Admin | `admin@dla.ug` | `super_admin` |
| Head of Academics | `hoc@teachers.dla.ug` | `head_academics` |
| Teacher | `teacher@teachers.dla.ug` | `teacher` |
| Finance | `finance@dla.ug` | `finance` |
| Student | `student@students.dla.ug` | `student` |
| Applicant | `applicant@dla.ug` | `applicant` |

Use demo accounts only for local testing. Do not seed demo accounts into production. Public registration creates applicant accounts only; students, teachers, finance users, and administrators must be provisioned by a super administrator from `/admin/users`.

### Recover administrator access

First use the dedicated sign-in page: `/admin/login`. An administrator signing in through `/login` is intentionally rejected. Production additionally requires the request to use the exact hostname configured in `ADMIN_HOST`.

If the password is unknown and administrator recovery email is not configured, reset the existing account without removing other users:

```powershell
$env:ADMIN_PASSWORD_RESET_EMAIL = "the-admin-email"
$env:ADMIN_PASSWORD_RESET_PASSWORD = "a-new-private-password"
npm run admin:password-reset
Remove-Item Env:ADMIN_PASSWORD_RESET_EMAIL, Env:ADMIN_PASSWORD_RESET_PASSWORD
```

Run this only from a trusted machine with the correct Supabase service-role key and database connection in `.env.local`. Then sign in at `/admin/login`; administrators must enroll or verify authenticator-based 2FA.

`npm run admin:reset` is a different, destructive operation: it deletes demo users and creates one super administrator. Use it only when you intentionally want to remove those demo accounts.

## Deploy from GitHub to Vercel

1. Push the project to a private GitHub repository. Confirm `.env.local` is not committed; add secrets only in Vercel's Environment Variables settings.
2. In Vercel, choose **Add New → Project**, import the GitHub repository, leave the framework as **Next.js**, and deploy. Vercel will build and deploy commits pushed to the connected production branch.
3. Before expecting authentication to work, add these environment variables to the Vercel project for **Production** (and Preview only if you intend to use it there):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-side secret; never prefix it with `NEXT_PUBLIC_`)
   - `DATABASE_URL` (Supabase PostgreSQL connection string; use a pooled connection)
   - `APP_URL` (the public site origin, e.g. `https://www.example.com`)
   - `ADMIN_HOST` (hostname only, e.g. `admin.example.com`; no scheme or path)
   - `CRON_SECRET` if scheduled endpoints are enabled

   Add any other integrations you use, such as email, CAPTCHA, or rate-limiting credentials. Redeploy after changing environment variables.
4. Apply migrations to the production database with `npm run db:migrate` from a trusted local machine configured with that production `DATABASE_URL`. Do not run demo seeding against production.
5. In Vercel **Settings → Domains**, add both the public hostname (such as `www.example.com`) and the administrator hostname (such as `admin.example.com`) to this same project. Configure the DNS records Vercel displays and wait for both domains to verify and receive HTTPS certificates.
6. In the Supabase Auth URL configuration, set the public site URL and allow the administrator recovery URL, for example `https://admin.example.com/admin/forgot-password`. Configure the email provider if password-recovery links should be delivered.
7. Create the production administrator on a trusted machine by setting `FIRST_ADMIN_EMAIL` and `FIRST_ADMIN_PASSWORD` in its environment, then running `npx tsx scripts/create-first-admin.ts` with production Supabase/database credentials. This is a one-time bootstrap and refuses to run if an administrator already exists. Never put the first-admin password in Git or Vercel build logs.

The public sign-in URL is `https://www.example.com/login`. The separate administrator sign-in URL is `https://admin.example.com/admin/login`. `ADMIN_HOST` enforces that admin pages and admin authentication are only available on the configured hostname; `/admin` on the public hostname returns 404. Vercel deployments require the real Supabase and database environment values and the configured admin hostname before production sign-in will succeed.

## Student photos, digital IDs, and report-card stamps

Student applications require a passport-style photo. The application form and admin-created student form prepare it as a centered, portrait 7:9 JPEG, then save it in the private `student-photos` Supabase Storage bucket. Students can upload or replace their own photo from the digital ID section of their dashboard, and a super administrator can add or replace a photo for an existing student or applicant in **Admin → Users**. Only signed-in staff with the appropriate role can retrieve another student's private photo.

The super administrator can stamp a student from **Admin → Users**. The super administrator or Head of Academics can also stamp students from **Head of Academics → Student IDs and document stamps**. Stamping records the acting staff member, role title, and time in the database and audit log. Once stamped, the student can download the digital ID and report cards; each PDF includes the passport photo and DLA-logo stamp dated in Uganda local time. Update the stamp from either staff screen to record a new signer/date.

Apply the database migration before enabling this in production. Existing students whose old photos were stored only on a development server should upload their photo again after deployment; Vercel's local filesystem is not persistent.

## Holiday approval and student notifications

The super administrator and Head of Academics can prepare public-holiday and other school-holiday drafts from **Admin → Holiday approvals** or **Head of Academics → Holiday approvals**. Drafts are not visible to students. Approving a draft publishes a portal notification for every active or registered student and emails the same audience. Failed email deliveries are logged and can be retried from the holiday approvals page without resending emails that already succeeded.

Vercel runs the holiday reminder job daily at 06:00 East Africa Time. It emails active administrators and the Head of Academics when a pending holiday is within 14 days, and also places a reminder in their portal notifications. The reminder runs only for holiday drafts recorded in the system; staff should enter planned holidays ahead of time. Configure `CRON_SECRET`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` in Vercel Environment Variables for the scheduled reminders and student/staff emails. Students see published holiday notices in the **Portal notifications** section of their dashboard.

Apply the checked-in Drizzle migrations with `npm run db:migrate` before using holiday approvals in production.

## Database and application status

The auth endpoints, seeded academic/public records, courses, homepage, payment details, admin user management/statistics, student attendance/fee/assignment/session data, and health check use PostgreSQL through Drizzle. Server-rendered portal entry pages enforce roles; the Next.js proxy redirects unauthenticated requests, while database-backed sessions allow logout/revocation and expiry checks.

This repository is a functional starting point, not a complete production LMS. Several dashboard widgets and actions still use static sample values or are presentation-only (including attendance, exams, results, payment processing, timetable management, document upload, CMS editing, and many admin actions). Do not rely on those for real school operations until their APIs, authorization, persistence, validation, and tests are implemented.

Useful checks:

```powershell
npm run typecheck
npm run lint
npm run build
npm run test:student-documents
```
