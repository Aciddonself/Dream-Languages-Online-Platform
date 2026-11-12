import { redirect } from "next/navigation";

export const metadata = { title: "Administrator sign in", robots: { index: false, follow: false } };

export default function AdministratorSignInRedirect() {
  const host = (process.env.ADMIN_HOST ?? "").trim().toLowerCase();
  if (process.env.NODE_ENV === "production" && !host && process.env.ALLOW_ADMIN_WITHOUT_HOST !== "true") {
    return <main className="mx-auto grid min-h-[60vh] max-w-2xl place-items-center px-5 py-12 text-center">
      <div><h1 className="display-font text-2xl font-bold">Administrator portal needs configuration</h1>
        <p className="mt-3 text-sm opacity-70">Set the production ADMIN_HOST to the school&apos;s administrator hostname, then open this link again. Contact the system administrator if you do not manage deployment settings.</p>
      </div>
    </main>;
  }
  if (!host) redirect("/admin/login");
  const protocol = /^localhost(:\d+)?$/.test(host) ? "http" : "https";
  redirect(`${protocol}://${host}/admin/login`);
}
