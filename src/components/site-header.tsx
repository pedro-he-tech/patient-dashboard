"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/patients", label: "Patients" },
  { href: "/patients/deleted", label: "Deleted patients" },
] as const;

/**
 * Deleted patients is its own section. Every other /patients URL, including a
 * chart and the create form, keeps the Patients link highlighted.
 */
function isCurrent(pathname: string, href: string): boolean {
  if (href === "/patients/deleted") {
    return pathname.startsWith("/patients/deleted");
  }
  return (
    pathname === "/patients" ||
    (pathname.startsWith("/patients/") &&
      !pathname.startsWith("/patients/deleted"))
  );
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link
          href="/patients"
          className="text-sm font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Patient Dashboard
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1">
          {links.map((link) => {
            const active = isCurrent(pathname, link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
