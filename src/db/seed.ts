import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, pool } from "@/db";
import {
  classes,
  cmsPages,
  departments,
  enrolments,
  faqs,
  gradeScales,
  levels,
  newsPosts,
  partners,
  roles,
  settings,
  terms,
  testimonials,
  users,
} from "@/db/schema";

async function ensureUser(data: typeof users.$inferInsert) {
  const [existing] = await db.select().from(users).where(eq(users.email, data.email!)).limit(1);
  if (existing) return existing;

  const [inserted] = await db.insert(users).values(data).onConflictDoNothing().returning();
  if (inserted) return inserted;

  const [concurrent] = await db.select().from(users).where(eq(users.email, data.email!)).limit(1);
  if (!concurrent) throw new Error(`Could not create or retrieve demo user ${data.email}`);
  return concurrent;
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The demo seed is disabled in production to prevent creating known-password accounts");
  }

  const roleSeeds = [
    { key: "super_admin", name: "Super Admin" },
    { key: "head_academics", name: "Head of Academics" },
    { key: "teacher", name: "Teacher" },
    { key: "finance", name: "Finance Officer" },
    { key: "student", name: "Student" },
    { key: "applicant", name: "Applicant" },
    { key: "guest", name: "Guest" },
  ];
  for (const role of roleSeeds) {
    await db.insert(roles).values(role).onConflictDoNothing();
  }

  const departmentSeeds: Array<typeof departments.$inferInsert> = [
    { code: "ENG", name: "English", flagEmoji: "🇬🇧", accentColor: "#086abd", isLanguage: true },
    { code: "SWA", name: "Kiswahili", flagEmoji: "🇰🇪", accentColor: "#16a08b", isLanguage: true },
    { code: "LUG", name: "Luganda", flagEmoji: "🇺🇬", accentColor: "#fcb900", isLanguage: true },
    { code: "GER", name: "German", flagEmoji: "🇩🇪", accentColor: "#0a294d", isLanguage: true },
    { code: "DUT", name: "Dutch", flagEmoji: "🇳🇱", accentColor: "#ff6d34", isLanguage: true },
    { code: "FRE", name: "French", flagEmoji: "🇫🇷", accentColor: "#086abd", isLanguage: true },
    { code: "SPA", name: "Spanish", flagEmoji: "🇪🇸", accentColor: "#cf2e2e", isLanguage: true },
    { code: "CHI", name: "Chinese", flagEmoji: "🇨🇳", accentColor: "#cf2e2e", isLanguage: true },
    { code: "JPN", name: "Japanese", flagEmoji: "🇯🇵", accentColor: "#ff6d34", isLanguage: true },
    { code: "MAN", name: "Mandarin", flagEmoji: "🇨🇳", accentColor: "#cf2e2e", isLanguage: true },
    { code: "ARA", name: "Arabic", flagEmoji: "🇸🇦", accentColor: "#16a08b", isLanguage: true },
    { code: "DAN", name: "Danish", flagEmoji: "🇩🇰", accentColor: "#cf2e2e", isLanguage: true },
    { code: "SWE", name: "Swedish", flagEmoji: "🇸🇪", accentColor: "#086abd", isLanguage: true },
    { code: "SGN", name: "Sign Language", flagEmoji: "🤟", accentColor: "#fcb900", isLanguage: true },
    { code: "NLP", name: "Neuro-Linguistic Programming", flagEmoji: "🧠", accentColor: "#8b5cf6", isLanguage: false },
    { code: "ICT", name: "Computer / ICT Literacy", flagEmoji: "💻", accentColor: "#086abd", isLanguage: false },
    { code: "AL", name: "Adult Literacy (UNEB/Cambridge)", flagEmoji: "📚", accentColor: "#16a08b", isLanguage: false },
  ];
  for (const department of departmentSeeds) {
    await db.insert(departments).values(department).onConflictDoNothing();
  }

  const allDepartments = await db.select().from(departments);
  const levelCodes = ["A1", "A2", "B1", "B2", "C1", "C2"];
  for (const department of allDepartments.filter((item) => item.isLanguage)) {
    for (let order = 0; order < levelCodes.length; order++) {
      const code = levelCodes[order];
      const [existing] = await db
        .select({ id: levels.id })
        .from(levels)
        .where(and(eq(levels.departmentId, department.id), eq(levels.code, code)))
        .limit(1);
      if (!existing) {
        await db.insert(levels).values({ code, name: code, order, departmentId: department.id });
      }
    }
  }

  const [existingTerm] = await db.select().from(terms).where(eq(terms.name, "Term 1 2026")).limit(1);
  const [term] = existingTerm
    ? [existingTerm]
    : await db
        .insert(terms)
        .values({ name: "Term 1 2026", startDate: "2026-01-12", endDate: "2026-04-30" })
        .returning();
  if (!term) throw new Error("Could not create or retrieve the demo term");

  const grades = [
    { name: "A", minScore: 80, maxScore: 100, grade: "A", gpa: "4.0" },
    { name: "B", minScore: 70, maxScore: 79, grade: "B", gpa: "3.0" },
    { name: "C", minScore: 60, maxScore: 69, grade: "C", gpa: "2.0" },
    { name: "D", minScore: 50, maxScore: 59, grade: "D", gpa: "1.0" },
    { name: "F", minScore: 0, maxScore: 49, grade: "F", gpa: "0.0" },
  ];
  for (const grade of grades) {
    const [existing] = await db.select({ id: gradeScales.id }).from(gradeScales).where(eq(gradeScales.name, grade.name)).limit(1);
    if (!existing) await db.insert(gradeScales).values(grade);
  }

  const passwordHash = await bcrypt.hash("Password123!", 10);
  await ensureUser({
    email: "admin@dla.ug",
    passwordHash,
    role: "super_admin",
    firstName: "Admin",
    lastName: "DLA",
    displayName: "Admin DLA",
  });
  await ensureUser({
    email: "hoc@teachers.dla.ug",
    passwordHash,
    role: "head_academics",
    firstName: "Head",
    lastName: "Academics",
    displayName: "Head of Academics",
  });
  const teacher = await ensureUser({
    email: "teacher@teachers.dla.ug",
    passwordHash,
    role: "teacher",
    firstName: "Emma",
    lastName: "Denis",
    displayName: "Emma Denis",
  });
  await ensureUser({
    email: "finance@dla.ug",
    passwordHash,
    role: "finance",
    firstName: "Finance",
    lastName: "Officer",
    displayName: "Finance Officer",
  });

  const germanDepartment = allDepartments.find((item) => item.code === "GER");
  if (!germanDepartment) throw new Error("The demo German department was not created");
  const [germanLevel] = await db
    .select()
    .from(levels)
    .where(and(eq(levels.departmentId, germanDepartment.id), eq(levels.code, "A1")))
    .limit(1);
  const student = await ensureUser({
    email: "student@students.dla.ug",
    passwordHash,
    role: "student",
    firstName: "Kamoga",
    lastName: "Ronald",
    displayName: "Kamoga Ronald",
    registrationNumber: "DLA/2026/GER/0042",
    departmentId: germanDepartment.id,
    status: "active",
  });
  await ensureUser({
    email: "applicant@dla.ug",
    passwordHash,
    role: "applicant",
    firstName: "New",
    lastName: "Applicant",
    displayName: "New Applicant",
  });

  const [existingClass] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.name, "German A1 - Morning"), eq(classes.termId, term.id)))
    .limit(1);
  const [demoClass] = existingClass
    ? [existingClass]
    : await db
        .insert(classes)
        .values({
          name: "German A1 - Morning",
          departmentId: germanDepartment.id,
          levelId: germanLevel?.id,
          termId: term.id,
          teacherId: teacher.id,
          capacity: 25,
        })
        .returning();
  if (!demoClass) throw new Error("Could not create or retrieve the demo class");
  await db.insert(enrolments).values({ studentId: student.id, classId: demoClass.id }).onConflictDoNothing();

  const testimonialSeeds = [
    { authorName: "Kamoga Ronald", quote: "Dream Language School is an Authentic and result oriented school.", rating: 5 },
    { authorName: "Amutuheire Joan", quote: "I went through dream schools for my Kiswahili training and I don't regret any part of it.", rating: 4 },
    { authorName: "Nakitto Maria", quote: "Get knowledge from a team of professionals found at Dream Language School.", rating: 4 },
  ];
  for (const testimonial of testimonialSeeds) {
    const [existing] = await db.select({ id: testimonials.id }).from(testimonials).where(eq(testimonials.authorName, testimonial.authorName)).limit(1);
    if (!existing) await db.insert(testimonials).values(testimonial);
  }

  const faqSeeds = [
    { question: "How do I register?", answer: "Fill the application form on the website, upload documents, and present your registration number to the Admin for verification.", order: 1 },
    { question: "What payment methods are accepted?", answer: "Bank transfer (accounts 3100104612 / 3100112636) and Mobile Money (MTN merchant 588449, Airtel 4365181).", order: 2 },
    { question: "Can I pause my studies?", answer: "Yes, submit a dead-semester request; fees stop accruing while paused.", order: 3 },
  ];
  for (const faq of faqSeeds) {
    const [existing] = await db.select({ id: faqs.id }).from(faqs).where(eq(faqs.question, faq.question)).limit(1);
    if (!existing) await db.insert(faqs).values(faq);
  }

  for (const partner of [
    { name: "Atrsy", order: 1 },
    { name: "Edu-Tours", order: 2 },
    { name: "Besten Technologies", order: 3 },
    { name: "Your Way", order: 4 },
  ]) {
    const [existing] = await db.select({ id: partners.id }).from(partners).where(eq(partners.name, partner.name)).limit(1);
    if (!existing) await db.insert(partners).values(partner);
  }

  await db
    .insert(cmsPages)
    .values({ slug: "home", title: "Home", status: "published", body: "Welcome to DLA Learning Hub" })
    .onConflictDoNothing();
  await db
    .insert(newsPosts)
    .values([
      { title: "German in 6 Months at DLA", slug: "german-in-6-months", excerpt: "Intensive German course.", body: "Join our intensive German programme.", status: "published", publishedAt: new Date() },
      { title: "Dream Nurses Class 2024", slug: "dream-nurses-2024", excerpt: "Nursing support language class.", body: "Language support for nurses.", status: "published", publishedAt: new Date() },
    ])
    .onConflictDoNothing();

  await db
    .insert(settings)
    .values({
      key: "payment_details",
      value: {
        accountName: "Dream Languages And Adult Literacy Uganda Limited",
        bankAccounts: ["3100104612", "3100112636"],
        mtnMerchant: "588449",
        airtelMerchant: "4365181",
        bankName: "",
        branch: "",
      },
    })
    .onConflictDoNothing();
  await db
    .insert(settings)
    .values({
      key: "school_profile",
      value: { name: "Dream Languages And Adult Literacy Uganda Limited", domain: "dla.ug" },
    })
    .onConflictDoNothing();

  console.log("Seed complete. Demo accounts use password Password123!:");
  console.log("  admin@dla.ug (super_admin)");
  console.log("  hoc@teachers.dla.ug (head_academics)");
  console.log("  teacher@teachers.dla.ug (teacher)");
  console.log("  finance@dla.ug (finance)");
  console.log("  student@students.dla.ug (student)");
  console.log("  applicant@dla.ug (applicant)");
}

main()
  .then(() => pool.end())
  .catch(async (error: unknown) => {
    console.error("Database seed failed:", error);
    await pool.end();
    process.exitCode = 1;
  });
