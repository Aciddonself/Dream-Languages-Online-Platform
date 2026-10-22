"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { GlassButton } from "@/components/ui/glass";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign out failed. Please try again.");
      toast.success("You have been signed out.");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign out. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <GlassButton type="button" variant="ghost" className="w-full justify-start" loading={loading} onClick={logout}>
      {!loading && <LogOut size={16} className="mr-2" />} Sign out
    </GlassButton>
  );
}
