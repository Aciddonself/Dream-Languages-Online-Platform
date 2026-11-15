import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = { title: "Administrator sign in", robots: { index: false, follow: false } };

export default function AdministratorSignInRedirect() {
  const host = (process.env.ADMIN_HOST ?? "").trim().toLowerCase();
  if (!host) redirect("/admin/sign-in");
  const protocol = /^localhost(:\d+)?$/.test(host) ? "http" : "https";
  redirect(`${protocol}://${host}/admin/sign-in`);
}
