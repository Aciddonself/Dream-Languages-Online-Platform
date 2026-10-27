"use client";

import { FatherDlaChat } from "@/components/father-dla-chat";

const HELPERS = [
  { title: "📝 Lesson plan", prompt: "Create a 45-minute B1 lesson plan on past tenses with a warm-up, practice activity and homework." },
  { title: "🧪 Test questions", prompt: "Write 10 A2 multiple-choice grammar questions with an answer key and a short marking guide." },
  { title: "🔤 Translate", prompt: "Translate this short notice into French and Kiswahili, keeping a polite tone: 'Class will start 30 minutes late on Friday.'" },
  { title: "💬 Feedback comments", prompt: "Give me 5 encouraging, specific feedback comments for a student who improved their speaking." },
];

export function StaffAssistantChat({ name }: { name: string }) {
  return <FatherDlaChat name={name} staff suggestions={HELPERS} />;
}
