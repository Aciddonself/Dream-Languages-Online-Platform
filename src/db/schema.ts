import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------- Enums ----------
export const roleEnum = pgEnum("role", [
  "super_admin",
  "head_academics",
  "teacher",
  "finance",
  "student",
  "applicant",
  "guest",
]);

export const userStatusEnum = pgEnum("user_status", [
  "applicant",
  "registered",
  "active",
  "on_hold",
  "paused",
  "resuming",
  "completed",
  "archived",
  "withdrawn",
  "suspended",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "verified",
  "rejected",
  "reversed",
]);

export const holdStatusEnum = pgEnum("hold_status", ["active", "lifted"]);

export const docStatusEnum = pgEnum("doc_status", [
  "submitted",
  "under_review",
  "approved",
  "rejected",
]);

export const cmsStatusEnum = pgEnum("cms_status", [
  "draft",
  "preview",
  "published",
  "unpublished",
  "archived",
]);

export const incidentStatusEnum = pgEnum("incident_status", [
  "open",
  "warned",
  "muted",
  "banned",
  "resolved",
]);

// ---------- Core: roles & permissions ----------
export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const permissions = pgTable("permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  description: text("description"),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("role_perm_unique").on(t.roleId, t.permissionId)]
);

// ---------- Users / profiles ----------
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("student"),
    status: userStatusEnum("status").notNull().default("registered"),
    displayName: text("display_name"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    avatarStorageKey: text("avatar_storage_key"),
    address: text("address"),
    dateOfBirth: date("date_of_birth"),
    nationality: text("nationality"),
    nextOfKinName: text("next_of_kin_name"),
    nextOfKinRelationship: text("next_of_kin_relationship"),
    nextOfKinPhone: text("next_of_kin_phone"),
    nextOfKinAddress: text("next_of_kin_address"),
    studyFormat: varchar("study_format", { length: 32 }),
    studyDurationMonths: integer("study_duration_months"),
    studyMode: varchar("study_mode", { length: 16 }),
    isInternational: boolean("is_international").default(false).notNull(),
    registrationNumber: varchar("registration_number", { length: 64 }).unique(),
    departmentId: uuid("department_id"),
    twoFactorSecret: text("two_factor_secret"),
    twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("users_role_idx").on(t.role), index("users_status_idx").on(t.status)]
);

export const teacherApplications = pgTable("teacher_applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  languageTaught: text("language_taught").notNull(),
  isVolunteer: boolean("is_volunteer").notNull(),
  payPerSession: integer("pay_per_session"),
  availability: varchar("availability", { length: 16 }),
  nextOfKinName: text("next_of_kin_name").notNull(),
  nextOfKinRelationship: text("next_of_kin_relationship").notNull(),
  nextOfKinPhone: text("next_of_kin_phone").notNull(),
  nextOfKinAddress: text("next_of_kin_address").notNull(),
  referenceName: text("reference_name"),
  referencePhone: text("reference_phone"),
  cvPath: text("cv_path").notNull(),
  coverLetterPath: text("cover_letter_path").notNull(),
  recommendationPath: text("recommendation_path"),
  status: varchar("status", { length: 24 }).notNull().default("pending"),
  reviewNote: text("review_note"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  userAgent: text("user_agent"),
  ip: text("ip"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id").references(() => users.id),
    action: varchar("action", { length: 128 }).notNull(),
    entityType: varchar("entity_type", { length: 64 }).notNull(),
    entityId: uuid("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)]
);

// ---------- Academic structure ----------
export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 16 }).notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  accentColor: varchar("accent_color", { length: 16 }),
  flagEmoji: varchar("flag_emoji", { length: 8 }),
  isLanguage: boolean("is_language").default(true).notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const programmes = pgTable("programmes", {
  id: uuid("id").defaultRandom().primaryKey(),
  departmentId: uuid("department_id").references(() => departments.id),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const levels = pgTable("levels", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 8 }).notNull(),
  name: text("name").notNull(),
  order: integer("order").default(0).notNull(),
  departmentId: uuid("department_id").references(() => departments.id),
});

export const terms = pgTable("terms", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const classes = pgTable("classes", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  departmentId: uuid("department_id").references(() => departments.id),
  programmeId: uuid("programme_id").references(() => programmes.id),
  levelId: uuid("level_id").references(() => levels.id),
  termId: uuid("term_id").references(() => terms.id),
  teacherId: uuid("teacher_id").references(() => users.id),
  capacity: integer("capacity").default(30),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const enrolments = pgTable(
  "enrolments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 32 }).default("active").notNull(),
    enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("enrolment_unique").on(t.studentId, t.classId)]
);

export const timetableSessions = pgTable("timetable_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  classId: uuid("class_id").references(() => classes.id),
  teacherId: uuid("teacher_id").references(() => users.id),
  title: text("title").notNull(),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  room: text("room"),
  meetUrl: text("meet_url"),
  recurring: boolean("recurring").default(false).notNull(),
  liveStartedAt: timestamp("live_started_at"),
  liveEndedAt: timestamp("live_ended_at"),
  teacherCheckInAt: timestamp("teacher_check_in_at"),
  teacherCheckOutAt: timestamp("teacher_check_out_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id").references(() => timetableSessions.id),
    studentId: uuid("student_id").references(() => users.id),
    status: varchar("status", { length: 16 }).notNull().default("present"),
    markedAt: timestamp("marked_at").defaultNow().notNull(),
    checkInAt: timestamp("check_in_at"),
    checkOutAt: timestamp("check_out_at"),
    confirmedBy: uuid("confirmed_by").references(() => users.id),
    confirmedAt: timestamp("confirmed_at"),
    note: text("note"),
  },
  (t) => [uniqueIndex("attendance_session_student_unique").on(t.sessionId, t.studentId)]
);

export const materials = pgTable("materials", {
  id: uuid("id").defaultRandom().primaryKey(),
  classId: uuid("class_id").references(() => classes.id),
  teacherId: uuid("teacher_id").references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  fileUrl: text("file_url"),
  type: varchar("type", { length: 32 }).default("file"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const assignments = pgTable("assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  classId: uuid("class_id").references(() => classes.id),
  teacherId: uuid("teacher_id").references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  dueAt: timestamp("due_at"),
  maxScore: integer("max_score").default(100),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const submissions = pgTable("submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  assignmentId: uuid("assignment_id").references(() => assignments.id),
  studentId: uuid("student_id").references(() => users.id),
  fileUrl: text("file_url"),
  text: text("text"),
  score: integer("score"),
  feedback: text("feedback"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  gradedAt: timestamp("graded_at"),
});

// ---------- Exams & results ----------
export const exams = pgTable("exams", {
  id: uuid("id").defaultRandom().primaryKey(),
  classId: uuid("class_id").references(() => classes.id),
  teacherId: uuid("teacher_id").references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  assessmentType: varchar("assessment_type", { length: 32 }).default("test").notNull(),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  durationMinutes: integer("duration_minutes").default(60),
  published: boolean("published").default(false).notNull(),
  approvedBy: uuid("approved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const examQuestions = pgTable("exam_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  examId: uuid("exam_id").references(() => exams.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 32 }).notNull().default("mcq"),
  prompt: text("prompt").notNull(),
  options: jsonb("options"),
  correctAnswer: text("correct_answer"),
  points: integer("points").default(1).notNull(),
  order: integer("order").default(0).notNull(),
});

export const examAttempts = pgTable("exam_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  examId: uuid("exam_id").references(() => exams.id),
  studentId: uuid("student_id").references(() => users.id),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  submittedAt: timestamp("submitted_at"),
  score: integer("score"),
  answers: jsonb("answers"),
  status: varchar("status", { length: 32 }).default("in_progress").notNull(),
});

export const results = pgTable(
  "results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id").references(() => users.id),
    examId: uuid("exam_id").references(() => exams.id),
    classId: uuid("class_id").references(() => classes.id),
    score: integer("score"),
    grade: varchar("grade", { length: 8 }),
    gpa: text("gpa"),
    comments: text("comments"),
    published: boolean("published").default(false).notNull(),
    publishedAt: timestamp("published_at"),
    promotionStatus: varchar("promotion_status", { length: 32 }).default("pending"),
    promotionReason: text("promotion_reason"),
    promotionReviewedBy: uuid("promotion_reviewed_by").references(() => users.id),
    promotedAt: timestamp("promoted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("result_student_exam_unique").on(t.studentId, t.examId)]
);

export const gradeScales = pgTable("grade_scales", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  minScore: integer("min_score").notNull(),
  maxScore: integer("max_score").notNull(),
  grade: varchar("grade", { length: 8 }).notNull(),
  gpa: text("gpa"),
});

export const resitRequests = pgTable("resit_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id").references(() => users.id),
  examId: uuid("exam_id").references(() => exams.id),
  reason: text("reason"),
  status: varchar("status", { length: 32 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Finance ----------
export const feeStructures = pgTable("fee_structures", {
  id: uuid("id").defaultRandom().primaryKey(),
  programmeId: uuid("programme_id").references(() => programmes.id),
  levelId: uuid("level_id").references(() => levels.id),
  termId: uuid("term_id").references(() => terms.id),
  name: text("name").notNull(),
  amount: integer("amount").notNull().default(0),
  currency: varchar("currency", { length: 8 }).default("UGX").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const feeSchedules = pgTable("fee_schedules", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id").references(() => users.id),
  feeStructureId: uuid("fee_structure_id").references(() => feeStructures.id),
  dueDate: date("due_date"),
  amount: integer("amount").notNull().default(0),
  currency: varchar("currency", { length: 8 }).default("UGX").notNull(),
  paid: integer("paid").default(0).notNull(),
  status: varchar("status", { length: 32 }).default("unpaid").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id").references(() => users.id),
  number: varchar("number", { length: 64 }).notNull().unique(),
  amount: integer("amount").notNull().default(0),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  dueAt: timestamp("due_at"),
  status: varchar("status", { length: 32 }).default("open").notNull(),
});

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id").references(() => users.id),
  invoiceId: uuid("invoice_id").references(() => invoices.id),
  amount: integer("amount").notNull().default(0),
  currency: varchar("currency", { length: 8 }).default("UGX").notNull(),
  method: varchar("method", { length: 32 }).default("bank").notNull(),
  reference: text("reference"),
  proofUrl: text("proof_url"),
  status: paymentStatusEnum("status").default("pending").notNull(),
  verifiedBy: uuid("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id").references(() => payments.id),
    number: varchar("number", { length: 64 }).notNull().unique(),
    issuedAt: timestamp("issued_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("receipt_payment_unique").on(t.paymentId)]
);

export const holds = pgTable("holds", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id").references(() => users.id),
  reason: text("reason").notNull(),
  status: holdStatusEnum("status").default("active").notNull(),
  placedBy: uuid("placed_by").references(() => users.id),
  liftedBy: uuid("lifted_by").references(() => users.id),
  placedAt: timestamp("placed_at").defaultNow().notNull(),
  liftedAt: timestamp("lifted_at"),
});

export const discounts = pgTable("discounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id").references(() => users.id),
  name: text("name").notNull(),
  amount: integer("amount").notNull().default(0),
  approved: boolean("approved").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ledgerEntries = pgTable("ledger_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id").references(() => users.id),
  type: varchar("type", { length: 16 }).notNull(),
  amount: integer("amount").notNull().default(0),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pauseRequests = pgTable("pause_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id").references(() => users.id),
  reason: text("reason").notNull(),
  documentUrl: text("document_url"),
  status: varchar("status", { length: 32 }).default("pending").notNull(),
  pausedAt: timestamp("paused_at"),
  resumedAt: timestamp("resumed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const statusHistory = pgTable("status_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id").references(() => users.id),
  fromStatus: varchar("from_status", { length: 32 }),
  toStatus: varchar("to_status", { length: 32 }).notNull(),
  reason: text("reason"),
  changedBy: uuid("changed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Documents ----------
export const documentRequirements = pgTable("document_requirements", {
  id: uuid("id").defaultRandom().primaryKey(),
  role: varchar("role", { length: 32 }).notNull(),
  programmeId: uuid("programme_id").references(() => programmes.id),
  name: text("name").notNull(),
  required: boolean("required").default(true).notNull(),
  allowedTypes: text("allowed_types"),
  maxSizeMb: integer("max_size_mb").default(10),
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id").references(() => users.id),
  requirementId: uuid("requirement_id").references(() => documentRequirements.id),
  name: text("name").notNull(),
  fileUrl: text("file_url").notNull(),
  status: docStatusEnum("status").default("submitted").notNull(),
  comment: text("comment"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- CMS / public content ----------
export const cmsPages = pgTable("cms_pages", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  title: text("title").notNull(),
  body: text("body"),
  status: cmsStatusEnum("status").default("draft").notNull(),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  version: integer("version").default(1).notNull(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const newsPosts = pgTable("news_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  excerpt: text("excerpt"),
  body: text("body"),
  category: varchar("category", { length: 64 }),
  coverUrl: text("cover_url"),
  status: cmsStatusEnum("status").default("draft").notNull(),
  publishedAt: timestamp("published_at"),
  authorId: uuid("author_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const testimonials = pgTable("testimonials", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id").references(() => users.id),
  authorName: text("author_name").notNull(),
  role: text("role"),
  quote: text("quote").notNull(),
  rating: integer("rating").default(5),
  avatarUrl: text("avatar_url"),
  published: boolean("published").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const faqs = pgTable("faqs", {
  id: uuid("id").defaultRandom().primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  category: varchar("category", { length: 64 }),
  order: integer("order").default(0).notNull(),
  published: boolean("published").default(true).notNull(),
});

export const partners = pgTable("partners", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  website: text("website"),
  order: integer("order").default(0).notNull(),
  published: boolean("published").default(true).notNull(),
});

export const announcements = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  audience: varchar("audience", { length: 32 }).default("all").notNull(),
  departmentId: uuid("department_id").references(() => departments.id),
  classId: uuid("class_id").references(() => classes.id),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  createdBy: uuid("created_by").references(() => users.id),
});

export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailLogs = pgTable("email_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  dedupeKey: varchar("dedupe_key", { length: 255 }).unique(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  status: varchar("status", { length: 32 }).default("queued").notNull(),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const smsCampaigns = pgTable("sms_campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdBy: uuid("created_by").references(() => users.id),
  message: text("message").notNull(),
  recipientCount: integer("recipient_count").default(0).notNull(),
  status: varchar("status", { length: 32 }).default("queued").notNull(),
  providerReference: text("provider_reference"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  title: text("title").notNull(),
  body: text("body"),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Community ----------
export const communityGroups = pgTable("community_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  type: varchar("type", { length: 32 }).default("language").notNull(),
  departmentId: uuid("department_id").references(() => departments.id),
  classId: uuid("class_id").references(() => classes.id),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => communityGroups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 16 }).default("member").notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("group_member_unique").on(t.groupId, t.userId)]
);

export const posts = pgTable("posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id").references(() => communityGroups.id),
  authorId: uuid("author_id").references(() => users.id),
  body: text("body").notNull(),
  mediaUrl: text("media_url"),
  pinned: boolean("pinned").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const discussionRooms = pgTable("discussion_rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  topic: text("topic"),
  language: varchar("language", { length: 64 }),
  level: varchar("level", { length: 16 }),
  visibility: varchar("visibility", { length: 16 }).default("public").notNull(),
  classId: uuid("class_id").references(() => classes.id),
  departmentId: uuid("department_id").references(() => departments.id),
  ownerId: uuid("owner_id").references(() => users.id),
  status: varchar("status", { length: 16 }).default("open").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const roomMembers = pgTable(
  "room_members",
  {
    roomId: uuid("room_id")
      .notNull()
      .references(() => discussionRooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("room_member_unique").on(t.roomId, t.userId)]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    senderId: uuid("sender_id").references(() => users.id),
    recipientId: uuid("recipient_id").references(() => users.id),
    roomId: uuid("room_id").references(() => discussionRooms.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("message_room_created_idx").on(t.roomId, t.createdAt)]
);

export const incidents = pgTable("incidents", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: varchar("type", { length: 32 }).default("phone_share").notNull(),
  actorId: uuid("actor_id").references(() => users.id),
  location: text("location"),
  maskedContent: text("masked_content"),
  rawEncrypted: text("raw_encrypted"),
  recipientId: uuid("recipient_id").references(() => users.id),
  status: incidentStatusEnum("status").default("open").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const moderationActions = pgTable("moderation_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  incidentId: uuid("incident_id").references(() => incidents.id),
  action: varchar("action", { length: 32 }).notNull(),
  actorId: uuid("actor_id").references(() => users.id),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------- Support / certificates / settings ----------
export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: varchar("status", { length: 32 }).default("open").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const certificates = pgTable("certificates", {
  id: uuid("id").defaultRandom().primaryKey(),
  studentId: uuid("student_id").references(() => users.id),
  classId: uuid("class_id").references(() => classes.id),
  level: varchar("level", { length: 16 }),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  verifyCode: varchar("verify_code", { length: 64 }).notNull().unique(),
  pdfUrl: text("pdf_url"),
});

export const settings = pgTable("settings", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});