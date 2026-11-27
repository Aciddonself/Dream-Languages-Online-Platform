import { redirect } from "next/navigation";

export default function LegacyAdminLoginPage() {
  redirect("/admin/sign-in");
}
