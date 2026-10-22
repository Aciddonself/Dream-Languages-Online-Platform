# DLA Learning Hub

Next.js application using PostgreSQL through Drizzle ORM. Neon is a good fit: it provides managed PostgreSQL, works with the existing `pg` driver, and its pooled connection string suits deployed Next.js/serverless workloads.

## Local setup with Neon

1. Create a Neon project and database. Copy the **pooled** connection string from the Neon connection details (pooled host, normally ending in `-pooler`) and keep `sslmode=require`.
2. Copy `.env.example` to `.env.local` in the project root and fill in the real `DATABASE_URL` from Neon. Use the pooled URL and keep `sslmode=require`. Generate a fresh `AUTH_SECRET` using:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

   The app will show an actionable configuration error until `DATABASE_URL` is set to a real PostgreSQL connection URL. Do not commit `.env.local`, share the connection string, or reuse the example secret. Set both values in the hosting provider's environment settings for deployments.
3. Install dependencies and create the database tables:

   ```powershell
   npm install
   npm run db:push
   ```

   `db:push` is convenient for initial setup and local development. For a production schema change, generate and review a migration, then apply it with `npm run db:generate` and `npm run db:migrate`.
4. Load local demo records and start the app. Do not run the demo seed against a production database:

   ```powershell
   npm run db:seed
   npm run dev
   ```

   Restart the dev server after creating or changing `.env.local`, then open `http://localhost:3000`. `GET /api/health` reports whether the application can reach PostgreSQL.

The database is accessed server-side only. Do not prefix `DATABASE_URL` with `NEXT_PUBLIC_`. For production, use a separate Neon branch/database, deploy migrations as part of release, and replace all seeded/demo credentials.

## Demo sign-ins

All six demo accounts use `Password123!` immediately after a fresh seed. Sign in at `/login`.

| Portal | Email | Role |
| --- | --- | --- |
| Admin | `admin@dla.ug` | `super_admin` |
| Head of Academics | `hoc@teachers.dla.ug` | `head_academics` |
| Teacher | `teacher@teachers.dla.ug` | `teacher` |
| Finance | `finance@dla.ug` | `finance` |
| Student | `student@students.dla.ug` | `student` |
| Applicant | `applicant@dla.ug` | `applicant` |

Use these only for local testing. Change the demo passwords or remove the accounts before deploying. Public registration creates applicant accounts only; students, teachers, finance users, and administrators must be provisioned by a super administrator from `/admin/users`.

## Database and application status

The auth endpoints, seeded academic/public records, courses, homepage, payment details, admin user management/statistics, student attendance/fee/assignment/session data, and health check use PostgreSQL through Drizzle. Server-rendered portal entry pages enforce roles; the middleware redirects unauthenticated requests, while database-backed sessions allow logout/revocation and expiry checks.

This repository is a functional starting point, not a complete production LMS. Several dashboard widgets and actions still use static sample values or are presentation-only (including attendance, exams, results, payment processing, timetable management, document upload, CMS editing, and many admin actions). Do not rely on those for real school operations until their APIs, authorization, persistence, validation, and tests are implemented.

Useful checks:

```powershell
npm run typecheck
npm run lint
npm run build
```
