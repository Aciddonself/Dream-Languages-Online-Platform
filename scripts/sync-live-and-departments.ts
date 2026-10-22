import { pool, db } from "../src/db";
import { departments, levels, terms, classes, users } from "../src/db/schema";
import { eq, and } from "drizzle-orm";

async function run() {
  console.log("Applying column updates to timetable_sessions...");
  await pool.query(`
    ALTER TABLE "timetable_sessions" ADD COLUMN IF NOT EXISTS "live_started_at" timestamp;
    ALTER TABLE "timetable_sessions" ADD COLUMN IF NOT EXISTS "live_ended_at" timestamp;
    ALTER TABLE "timetable_sessions" ADD COLUMN IF NOT EXISTS "teacher_check_in_at" timestamp;
    ALTER TABLE "timetable_sessions" ADD COLUMN IF NOT EXISTS "teacher_check_out_at" timestamp;
  `);
  console.log("Columns verified on timetable_sessions.");

  // Check if departments exist
  const existingDepts = await db.select().from(departments);
  console.log(`Current departments count: ${existingDepts.length}`);

  if (existingDepts.length === 0) {
    console.log("Seeding core language departments...");
    const departmentSeeds: Array<typeof departments.$inferInsert> = [
      { code: "ENG", name: "English & Communication", flagEmoji: "🇬🇧", accentColor: "#086abd", isLanguage: true },
      { code: "FRE", name: "French", flagEmoji: "🇫🇷", accentColor: "#086abd", isLanguage: true },
      { code: "GER", name: "German", flagEmoji: "🇩🇪", accentColor: "#0a294d", isLanguage: true },
      { code: "SWA", name: "Kiswahili", flagEmoji: "🇰🇪", accentColor: "#16a08b", isLanguage: true },
      { code: "LUG", name: "Luganda", flagEmoji: "🇺🇬", accentColor: "#fcb900", isLanguage: true },
      { code: "SPA", name: "Spanish", flagEmoji: "🇪🇸", accentColor: "#cf2e2e", isLanguage: true },
      { code: "ARA", name: "Arabic", flagEmoji: "🇸🇦", accentColor: "#16a08b", isLanguage: true },
      { code: "CHI", name: "Chinese (Mandarin)", flagEmoji: "🇨🇳", accentColor: "#cf2e2e", isLanguage: true },
      { code: "DUT", name: "Dutch", flagEmoji: "🇳🇱", accentColor: "#ff6d34", isLanguage: true },
      { code: "JPN", name: "Japanese", flagEmoji: "🇯🇵", accentColor: "#ff6d34", isLanguage: true },
      { code: "SGN", name: "Sign Language", flagEmoji: "🤟", accentColor: "#fcb900", isLanguage: true },
    ];

    for (const dept of departmentSeeds) {
      await db.insert(departments).values(dept).onConflictDoNothing();
    }
    console.log("Departments seeded.");
  }

  const allDepts = await db.select().from(departments);

  // Check levels
  const levelCodes = ["A1", "A2", "B1", "B2", "C1", "C2"];
  for (const dept of allDepts.filter((d) => d.isLanguage)) {
    for (let order = 0; order < levelCodes.length; order++) {
      const code = levelCodes[order];
      const [existing] = await db
        .select({ id: levels.id })
        .from(levels)
        .where(and(eq(levels.departmentId, dept.id), eq(levels.code, code)))
        .limit(1);
      if (!existing) {
        await db.insert(levels).values({ code, name: code, order, departmentId: dept.id }).onConflictDoNothing();
      }
    }
  }

  // Check terms
  let [term] = await db.select().from(terms).limit(1);
  if (!term) {
    const [newTerm] = await db
      .insert(terms)
      .values({ name: "Term 1 2026", startDate: "2026-01-12", endDate: "2026-04-30" })
      .returning();
    term = newTerm;
  }

  // Check classes
  const existingClasses = await db.select().from(classes);
  console.log(`Current classes count: ${existingClasses.length}`);

  if (existingClasses.length === 0 && term) {
    // Find an existing teacher if available
    const [teacher] = await db.select().from(users).where(eq(users.role, "teacher")).limit(1);

    const defaultClasses = [
      { name: "French A1 Beginners - Live Cohort", deptCode: "FRE", levelCode: "A1" },
      { name: "German A1 - Morning Online", deptCode: "GER", levelCode: "A1" },
      { name: "German B1 - Intermediate Conversation", deptCode: "GER", levelCode: "B1" },
      { name: "Kiswahili Conversational - Evening", deptCode: "SWA", levelCode: "A1" },
      { name: "English Fluency & IELTS Prep", deptCode: "ENG", levelCode: "B2" },
      { name: "Luganda Language & Culture Live", deptCode: "LUG", levelCode: "A1" },
      { name: "Spanish A1 - Weekend Live", deptCode: "SPA", levelCode: "A1" },
      { name: "Arabic for Beginners", deptCode: "ARA", levelCode: "A1" },
    ];

    for (const c of defaultClasses) {
      const dept = allDepts.find((d) => d.code === c.deptCode);
      if (!dept) continue;
      const [lvl] = await db.select().from(levels).where(and(eq(levels.departmentId, dept.id), eq(levels.code, c.levelCode))).limit(1);
      await db.insert(classes).values({
        name: c.name,
        departmentId: dept.id,
        levelId: lvl?.id ?? null,
        termId: term.id,
        teacherId: teacher?.id ?? null,
        capacity: 35,
      }).onConflictDoNothing();
    }
    console.log("Core classes created.");
  }

  console.log("Database sync and setup complete!");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
