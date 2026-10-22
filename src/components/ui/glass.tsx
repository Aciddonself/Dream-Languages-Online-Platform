import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function GlassCard({
  className,
  children,
  strong,
  tilt,
}: {
  className?: string;
  children: ReactNode;
  strong?: boolean;
  tilt?: boolean;
}) {
  return (
    <div className={cn("glass", strong && "glass-strong", tilt && "tilt", className)}>
      {children}
    </div>
  );
}

export function GlassButton({
  className,
  children,
  variant = "glass",
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "glass" | "primary" | "ghost"; loading?: boolean }) {
  return (
    <button
      className={cn(
        variant === "primary" && "btn-glass btn-glass-primary",
        variant === "glass" && "btn-glass",
        variant === "ghost" && "px-4 py-2 font-semibold hover:opacity-80 transition-opacity",
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {children}
    </button>
  );
}

export function GlassInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "glass px-4 py-2.5 w-full outline-none focus:ring-2 focus:ring-[var(--brand-accent)]",
        props.className
      )}
    />
  );
}

export function Badge({ className, children, tone = "info" }: { className?: string; children: ReactNode; tone?: "info" | "success" | "warning" | "danger" | "primary" }) {
  const colors: Record<string, string> = {
    info: "var(--info)",
    success: "var(--success)",
    warning: "var(--warning)",
    danger: "var(--danger)",
    primary: "var(--brand-primary)",
  };
  return (
    <span
      className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold glass", className)}
      style={{ color: colors[tone] }}
    >
      {children}
    </span>
  );
}
