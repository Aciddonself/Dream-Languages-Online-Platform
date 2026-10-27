import type { Metadata } from "next";
import { Classes2027 } from "@/components/classes-2027";

export const metadata: Metadata = {
  title: "Language Classes 2027",
  description: "DLA 2027 monthly intakes, class times, registration and exam dates for German, English and French.",
};

export default function Classes2027Page() {
  return (
    <main className="min-h-screen px-4 py-8 max-w-6xl mx-auto">
      <Classes2027 />
    </main>
  );
}
