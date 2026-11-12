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

Use **Staff sign in** in the public site's navigation, or open `/admin-login`. That link redirects to `/admin/login` on the hostname configured in `ADMIN_HOST`. An administrator signing in through `/login` is intentionally rejected. Production additionally requires the request to use the exact hostname configured in `ADMIN_HOST`.

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

## Deploy to Namecheap cPanel

This is a server-rendered Next.js application, so deploy it as a Node.js app through **cPanel → Setup Node.js App**. Do not upload it as a static React site. Namecheap's cPanel workflow uses the included `server.js` startup file, which starts Next on the port assigned by cPanel. Use a Node.js version supported by the hosting account and compatible with this Next.js release (Node.js 22 or newer is recommended), set the app mode to **Production**, and keep the application root outside `public_html`.

1. Confirm the hosting plan exposes **Setup Node.js App**, enough memory/process capacity for a Next.js server, and SSH or cPanel Terminal. Build the production app with `npm ci` and `npm run build`, then deploy the project files including `.next`, `public`, `server.js`, `package.json`, and the lockfile. In cPanel, configure `server.js` as the startup file and install production dependencies with the cPanel Node.js app environment.
2. Add the production environment variables in cPanel's Node.js app settings. At minimum configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `APP_URL`, `ADMIN_HOST`, and a strong `CRON_SECRET`. Add only the integrations the school will use. Keep secrets out of Git and the public web root.
3. Use Supabase for PostgreSQL and student-photo storage as configured by the app. Apply reviewed database migrations from a trusted machine with the production `DATABASE_URL` before opening the site. Create the first administrator once using the documented bootstrap script and production credentials; never seed demo users in production.
4. Assignment submissions use the private Supabase Storage bucket created by migration `0009_durable_assignment_storage.sql`; apply the migration before enabling assignment file uploads. Teacher materials and teacher-application documents remain in `private_uploads/`, so confirm the deployed app has writable, persistent storage and that this directory is outside the public web root. Back it up and check account disk limits.
5. Point the public and administrator DNS hostnames to the cPanel account, enable HTTPS, and verify both login hostnames. Configure the Supabase authentication URLs and `APP_URL` to match the final HTTPS domains.
6. Configure scheduled endpoints with cPanel Cron Jobs or an external scheduler and send `Authorization: Bearer <CRON_SECRET>`. Namecheap shared hosting does not allow cron intervals shorter than five minutes, while the school-email endpoint is designed for a one-minute cadence. Use an external scheduler that supports one-minute jobs, or use a hosting plan that does; do not silently run it every five minutes because reminders and timed statements may be late. The daily holiday reminder can run daily. Confirm your chosen plan's cron limits before deployment.
7. After starting the app, check `/api/health`, sign in with the production administrator, and exercise a student login, upload/download flow, email delivery, and scheduled endpoint. Watch cPanel application logs and resource usage during this check.

Shared hosting resources are limited, so measure response time and cPanel CPU/memory limits under realistic concurrent use. If pages remain slow after the client-side bundle reduction, inspect database query time and hosting resource throttling before changing frameworks or increasing client-side complexity. A Namecheap VPS offers more control when the shared plan cannot meet the app's runtime, cron, or storage requirements.

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

This repository has working role-based portals and database-backed school workflows, but it still needs further completion and live validation before production use. Student payment reporting and Finance verification support manual transfers; payment-provider checkout and proof uploads are not included. Online multiple-choice assessments support authoring, timed student attempts, auto-grading and teacher review/publication; free-response questions and proctoring are not included. Teachers can create assignments, students can submit written work or private files, and authorized staff can grade with feedback. Assignment attachments use a private Supabase Storage bucket configured by migration `0009_durable_assignment_storage.sql`; apply and verify that migration before production. Older assignment files still fall back to local `private_uploads/` storage. CMS pages and news can both be edited and published. Scheduling uses Google Meet links entered by staff rather than creating rooms through Google's API. See [PROJECT_AUDIT.md](PROJECT_AUDIT.md) for the current findings and repair order. Validate workflows against real school accounts and policies before relying on them for school operations.

Useful checks:

```powershell
npm run typecheck
npm run lint
npm run build
npm run test:student-documents
```
