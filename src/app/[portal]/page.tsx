import { notFound, redirect } from "next/navigation";

const legacyRoutes: Record<string, string> = {
  "about-us": "/about",
  "contact-us": "/contact",
  applylanguage: "/apply",
  features: "/about",
  testimonial: "/testimonials",
  testimonials: "/testimonials",
  shop: "/courses",
  cart: "/pay-now",
  checkout: "/pay-now",
  "my-account": "/login",
  book: "/contact",
  events: "/timetable",
  "intakes-for-german-language-2024": "/courses",
};

export default async function LegacyRoute({ params }: { params: Promise<{ portal: string }> }) {
  const { portal } = await params;
  const destination = legacyRoutes[portal];
  if (!destination) notFound();
  redirect(destination);
}
