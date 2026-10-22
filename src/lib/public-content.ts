import { db } from "@/db";
import { departments, faqs, newsPosts, partners, testimonials } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export const DEFAULT_DEPARTMENTS = [
  { id: "1", code: "FRE", name: "French", flagEmoji: "🇫🇷", accentColor: "#086abd", description: "Learn French from beginner (A1) to advanced (B2/C1) for study, DELF exams, and travel.", isLanguage: true },
  { id: "2", code: "GER", name: "German", flagEmoji: "🇩🇪", accentColor: "#0a294d", description: "Comprehensive German classes for Goethe-Institut exams, nursing careers in Germany, and higher education.", isLanguage: true },
  { id: "3", code: "SWA", name: "Kiswahili", flagEmoji: "🇰🇪", accentColor: "#16a08b", description: "East Africa's lingua franca for business, cross-border trade, and regional communication.", isLanguage: true },
  { id: "4", code: "ENG", name: "English & Communication", flagEmoji: "🇬🇧", accentColor: "#086abd", description: "Fluency, professional business English, public speaking, and IELTS exam preparation.", isLanguage: true },
  { id: "5", code: "LUG", name: "Luganda", flagEmoji: "🇺🇬", accentColor: "#fcb900", description: "Central Uganda's indigenous language for culture, research, NGO community work, and everyday life.", isLanguage: true },
  { id: "6", code: "SPA", name: "Spanish", flagEmoji: "🇪🇸", accentColor: "#cf2e2e", description: "One of the world's most spoken languages for diplomacy, business, and global travel.", isLanguage: true },
  { id: "7", code: "ARA", name: "Arabic", flagEmoji: "🇸🇦", accentColor: "#16a08b", description: "Modern Standard Arabic (Fusha) for careers in the Middle East, diplomacy, and scholarship.", isLanguage: true },
  { id: "8", code: "CHI", name: "Chinese (Mandarin)", flagEmoji: "🇨🇳", accentColor: "#cf2e2e", description: "Mandarin Chinese language and HSK examination preparation for international commerce.", isLanguage: true },
  { id: "9", code: "DUT", name: "Dutch", flagEmoji: "🇳🇱", accentColor: "#ff6d34", description: "Dutch language training for relocation, civic integration (Inburgeringsexamen), and studies.", isLanguage: true },
  { id: "10", code: "JPN", name: "Japanese", flagEmoji: "🇯🇵", accentColor: "#ff6d34", description: "Japanese language fundamentals, JLPT preparation, and cultural communication.", isLanguage: true },
  { id: "11", code: "SGN", name: "Sign Language", flagEmoji: "🤟", accentColor: "#fcb900", description: "Ugandan Sign Language for inclusive community engagement, accessibility, and professional interpreting.", isLanguage: true },
];

export async function getPublicDepartments() {
  try {
    const list = await db.select().from(departments).orderBy(asc(departments.name));
    if (list.length > 0) return list;
  } catch (err) {
    console.warn("Public departments DB fetch error, using resilient cache:", err);
  }
  return DEFAULT_DEPARTMENTS as typeof departments.$inferSelect[];
}

export async function getPublishedTestimonials() {
  try {
    const list = await db.select().from(testimonials).where(eq(testimonials.published, true));
    if (list.length > 0) return list;
  } catch (err) {
    console.warn("Testimonials DB fetch error:", err);
  }
  return [
    {
      id: "demo-t1",
      authorName: "Sarah Nakato",
      role: "German A2 Student",
      quote: "Learning German with DLA was smooth. The live Google Meet sessions and Father-DLA tutor helped me pass my Goethe-Institut exam!",
      rating: 5,
      avatarUrl: null,
      published: true,
      studentId: null,
      createdAt: new Date(),
    },
    {
      id: "demo-t2",
      authorName: "Jean-Paul Mugisha",
      role: "French B1 Immersion",
      quote: "The interactive speaking classes with native instructors gave me real fluency for my international job applications.",
      rating: 5,
      avatarUrl: null,
      published: true,
      studentId: null,
      createdAt: new Date(),
    },
  ];
}

export async function getPublishedFaqs() {
  try {
    const list = await db.select().from(faqs).where(eq(faqs.published, true));
    if (list.length > 0) return list;
  } catch (err) {
    console.warn("FAQs DB fetch error:", err);
  }
  return [
    {
      id: "demo-f1",
      question: "How do online live classes work at Dream Languages Uganda?",
      answer: "Live classes are hosted via Google Meet. Once admitted and enrolled, you can join your scheduled sessions directly from your student portal dashboard with 1 click.",
      category: "Learning",
      published: true,
      order: 1,
    },
    {
      id: "demo-f2",
      question: "What language levels do you offer?",
      answer: "We offer CEFR levels A1 (Beginner), A2 (Elementary), B1 (Intermediate), B2 (Upper Intermediate), C1 (Advanced), and C2 (Mastery).",
      category: "Courses",
      published: true,
      order: 2,
    },
  ];
}

export async function getPublishedPartners() {
  try {
    const list = await db.select().from(partners).where(eq(partners.published, true));
    if (list.length > 0) return list;
  } catch (err) {
    console.warn("Partners DB fetch error:", err);
  }
  return [
    { id: "demo-p1", name: "Goethe-Institut Partner Network", logoUrl: null, website: null, published: true },
    { id: "demo-p2", name: "Alliance Française Cultural Network", logoUrl: null, website: null, published: true },
  ];
}

export async function getPublishedNews() {
  try {
    return await db.select().from(newsPosts).where(eq(newsPosts.status, "published"));
  } catch (err) {
    console.warn("News DB fetch error:", err);
    return [];
  }
}
