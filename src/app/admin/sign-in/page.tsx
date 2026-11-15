import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Administrator sign in", robots: { index: false, follow: false } };

export default function AdminSignInPage() {
  return <LoginForm mode="admin" />;
}
