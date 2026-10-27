"use client";

import { FatherDlaChat } from "@/components/father-dla-chat";

const PRACTICE = [
  { title: "🇫🇷 French verb drill", prompt: "Quiz me on 3 common French regular verbs with examples, one at a time." },
  { title: "🇩🇪 German cases", prompt: "Explain German Dativ prepositions (aus, bei, mit, nach, seit, von, zu) with simple examples." },
  { title: "🇰🇪 Kiswahili dialogue", prompt: "Let's practise a short shopping conversation in Kiswahili. You play the shopkeeper." },
  { title: "🇺🇬 Luganda greetings", prompt: "Teach me polite morning and evening greetings in Luganda." },
  { title: "🌍 What's new?", prompt: "What is one interesting recent news story I can use to practise reading in my target language?" },
];

export function StudentAiTutorChat({ studentName }: { studentName: string }) {
  return <FatherDlaChat name={studentName} suggestions={PRACTICE} />;
}
