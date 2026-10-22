
# Dream Languages Uganda Learning Hub — Application Details

## Overview

The Learning Hub combines the Dream Languages Uganda public website with role-based portals for learners and staff. Its responsive interface uses Liquid Glass surfaces and restrained navy-and-gold accents. The landing hero does not display a logo.

## Technology

- **Web framework:** Next.js 16 with the App Router
- **UI:** React 19, TypeScript, Tailwind CSS 4, and custom glass-style components
- **Database:** PostgreSQL, accessed through Drizzle ORM and the `pg` driver
- **Hosted database:** Neon PostgreSQL is compatible with the application. Use a pooled Neon connection string for deployments.
- **Authentication:** Email/password authentication, bcrypt password hashes, signed tokens, and database-backed sessions
- **Validation and utilities:** Zod, Drizzle-Zod, Lucide icons, Framer Motion, and Sonner

## Main areas

### Public website

- Home page with school information, departments, published testimonials, FAQs, partners, news, and scroll-triggered count-up statistics
- Course listings, About, FAQs, Contact, gallery, testimonials, news, timetable, and design showcase pages
- Admission application with a generated registration number; applicant accounts do not receive login credentials until an administrator issues them
- Full student application intake including address, date of birth, nationality, next-of-kin details, selected language/study plan, and a required profile photo
- Teacher volunteer/paid-work application portal at `/volunteer`, with CV, cover letter, optional paid-teacher recommendation letter, and administrator-only document review
- Courses & Fees page with language-course price tables, international student rates, communication skills, three-month MS Office studies, web development/programming, and private tutoring WhatsApp inquiries
- Downloadable admission and student-results PDFs
- WhatsApp contact options; phone numbers are not displayed to students or on the public site
- Login page for student and staff accounts
- Responsive navigation: horizontal links on wide screens and a vertically stacked expandable menu on phones and tablets
- Selected public-school content and 17 available authorized source-site photos, stored in `public/site-media`

### Role portals

- **Super administrator:** `/admin` — administration dashboard, user status controls, website news/review moderation, announcements, and bulk SMS
- **Head of Academics:** `/hoc` — academic oversight, announcements, discussions, and mark corrections
- **Teacher:** `/teacher` — assigned-class attendance, materials, discussions, assessments, result entry, and timetable scheduling
- **Finance:** `/finance`
- **Student:** `/student`
- **Applicant:** `/applicant`

Students can view fees and verified payments, attendance, published results, class materials, discussions, announcements, and submit reviews/comments for administrator approval. Only approved reviews are published publicly. Teachers can start and end class attendance sessions; students check in/out in the portal, and teachers confirm records. Completed-session attendance is calculated from confirmed minutes. An authorized teacher or academic administrator can correct ended-session attendance, with a required reason and audit record.

Assessment records support manual score publication and test/final-exam report PDFs. Students with less than 60% attendance can qualify through a cleared fee balance. Final-exam scores of 65% or higher promote students to an available next-level class in the same programme; if no class is available, progression remains pending. A documented Head of Academics or administrator exception can hold promotion. Published-mark corrections require a reason and are audited; already-promoted students require a separate placement review.

Students and teachers have private timetable pages. Student meeting links are hidden behind an authenticated join action that verifies class membership. Teachers and the Head of Academics can schedule class sessions; the form provides a Google Calendar event-template link that staff must save to their calendar.

Father-DLA is an authenticated AI tutoring chat available in the public site and portals. It requests answers in the language of the user's latest question and sends up to 12 recent chat turns to the configured OpenAI API. The API key is server-side; chat history is not stored in the school database. Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL`.

New student applications require a profile photo and collect next-of-kin details. The profile-photo API serves only the signed-in user's photo or, to authorized staff, an enrolled student's photo for the assigned class. Staff can upload/update their own photo in the portal header. Student photos appear on the dashboard identity card and teacher attendance roster.

When an administrator admits an applicant, the system creates a fee schedule using the selected language-course price, if present, and emails application and admission PDFs. Local plans are charged in UGX and international language plans in USD. A scheduled endpoint sends class reminders at 25 and 10 minutes before sessions and emails monthly PDF fee statements to students with verified payment history.

The administrator can send bulk SMS to active or registered students through Africa's Talking. Only the provider receives eligible phone numbers for delivery; numbers are not included in student-facing screens, campaign history, or audit records. Invalid phone records are skipped and only aggregate counts are reported.

Portal pages are protected by role checks. Staff and student accounts and credentials are issued by an administrator; public applicants submit an application without creating a usable portal password. Administrators can issue or reset user passwords, archive departing staff while retaining their role history, revoke their sessions, and reactivate their accounts later. Only super administrators can request password-reset links.

### API endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Check application/database health |
| `POST /api/auth/login` | Authenticate an account |
| `POST /api/auth/register` | Submit an applicant form; does not create a usable applicant password or session |
| `POST /api/auth/admin-password-reset` | Request/complete a one-time administrator-only reset or change the signed-in administrator password |
| `POST /api/auth/logout` | End the current session |
| `POST /api/admin/users` | Create an account as an authorized administrator |
| `PATCH /api/admin/users` | Admit applicants, issue credentials, archive/reactivate accounts, and record audit events |
| `POST /api/academic/sessions` | Schedule a class session with an optional Google Meet URL |
| `GET/POST /api/academic/sessions/[sessionId]/attendance` | View, record, confirm, or correct attendance for an authorized class session |
| `POST /api/academic/announcements` | Publish a class or school announcement |
| `POST /api/academic/exams` | Create a class assessment |
| `POST/PATCH /api/academic/results` | Publish results or correct a published mark with an audit reason |
| `POST /api/admin/sms` | Submit an administrator-authorized bulk SMS campaign |
| `POST /api/father-dla` | Send an authenticated question to the OpenAI-powered learning assistant |
| `POST /api/volunteer-applications` | Submit a protected teacher volunteer/paid-work application |
| `PATCH /api/admin/volunteer-applications/[applicationId]` | Update an administrator-only teacher application review status |
| `GET /api/admin/volunteer-applications/[applicationId]/[document]` | Download a teacher application document as an administrator |
| `GET /api/portal/profile-photo` | View the signed-in user's profile photo |
| `POST /api/portal/profile-photo` | Upload or update the signed-in user's profile photo |
| `GET /api/portal/sessions/[sessionId]/join` | Join a class meeting after checking the caller's class authorization |
| `GET /api/cron/school-emails` | Send scheduled class reminders/monthly fee statements (requires `CRON_SECRET`) |
| `POST /api/admin/cms` | Create news and moderate student reviews |
| `POST /api/portal/materials` | Upload a private class document |
| `GET /api/portal/materials/[materialId]` | Download a class document after authorization |
| `POST /api/portal/discussions` | Create or list authorized class discussion rooms |
| `POST /api/portal/reviews` | Submit a student review for moderation |
| `GET /api/portal/documents/admission` | Download the signed-in applicant/student admission details |
| `GET /api/portal/documents/results` | Download the signed-in student's published results and submitted attempt history |
| `GET /api/portal/documents/receipt/[paymentId]` | Download a receipt for a verified payment |

## Data and current integration

The Drizzle schema covers accounts and sessions, roles and permissions, departments and programmes, enrolments, schedules, attendance, learning materials, assignments, exams, results, fees, invoices, payments, receipts, documents, CMS content, announcements, notifications, community discussions, incidents, support tickets, and certificates.

The homepage and account, authentication, student, academic, finance, and moderation flows use PostgreSQL. Public departments, published FAQs, testimonials, partners, and news are cached for five minutes; newly changed public content can take up to five minutes to appear. Applicants and administrator-created students receive registration numbers. A student results PDF contains published results and does not expose unpublished attempt scores.

Staff can create class sessions and attach a Google Meet URL. Automatic Meet creation requires Google OAuth/API credentials and is not configured; an authorized staff member must create the meeting in Google and enter its URL. Attendance is recorded in the LMS and does not read Google Meet participant data. Google Workspace meeting restrictions must be configured in Google to control who can join.

Teacher materials, teacher application documents, and profile photos are saved under `private_uploads/`, which is appropriate only when the host provides persistent local storage. Serverless deployments need a durable volume or object-storage integration before relying on uploads. Africa's Talking delivery requires the server-side `AFRICASTALKING_USERNAME` and `AFRICASTALKING_API_KEY` environment variables; `AFRICASTALKING_SENDER_ID` is optional. Email delivery and administrator reset links require a verified Resend sender plus `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and the canonical site origin in `APP_URL`. Father-DLA requires `OPENAI_API_KEY`. The school-email endpoint needs a strong `CRON_SECRET` and a hosting scheduler configured to call it every minute; the app does not create Google Calendar events automatically. Do not put provider credentials in client-side variables or source control.

## Important production limitations

This project is a functional LMS foundation, not a fully audited production school-management system. Assessment scores are entered by staff; the current assessment flow does not provide online question authoring and student test-taking. Teacher applications are submitted to and reviewed by the administrator; shortlisting does not create a teacher account. The CMS supports news creation and review moderation rather than editing every static page, course, FAQ, partner, or gallery entry. Verify real persistence, authorization, validation, storage durability, payment processing, and school-specific policies before relying on it for operations. Database-backed functions require a reachable, correctly configured PostgreSQL database.

The connected Neon branch discussed during setup is named `production` and currently contains no user accounts. Demo accounts from the seed script are not automatically present, and its shared demo password is for isolated local testing only. Do not seed those credentials into production. Provision the first administrator through a secure, controlled process before creating other users.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Set `DATABASE_URL` to a PostgreSQL URL (for Neon, use the pooled connection string with TLS) and set a unique, sufficiently long `AUTH_SECRET`. Never commit `.env.local` or expose either value to browser code.
4. For a new local database, apply the schema with `npm run db:push`. The generated Drizzle migration is a full-schema baseline; do not apply it to a database that may already contain tables or data without first inspecting the target and migration SQL.
5. Configure `OPENAI_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_URL`, and `CRON_SECRET` on the server to enable Father-DLA, administrator password recovery, and email workflows.
6. Optionally seed an isolated development database with `npm run db:seed`. Do not seed a production database.
7. Start the development server with `npm run dev`.

The local development URL is normally `http://localhost:3000`; if that port is already occupied, Next.js may select another available port. The health endpoint is `/api/health`.

## Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve a production build |
| `npm run typecheck` | Run the TypeScript checker |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Synchronize the schema to the configured database |
| `npm run db:generate` | Generate a database migration |
| `npm run db:migrate` | Apply generated migrations |
| `npm run db:seed` | Add local/demo records to a non-production database |
