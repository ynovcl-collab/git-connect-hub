import { Link, useRouterState } from "@tanstack/react-router";
import { MoreHorizontal, X } from "lucide-react";
import { useEffect, useState } from "react";

export type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

/**
 * Mobile-first bottom nav: shows up to 4 primary items + a "More" button
 * that opens a bottom-sheet (slides up) with the overflow items.
 * Works for any number of nav items per role.
 */
export function BottomNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  const PRIMARY = 4;
  const needsMore = items.length > PRIMARY; // always show More when overflow exists
  const primary = needsMore ? items.slice(0, PRIMARY) : items;
  const overflow = needsMore ? items.slice(PRIMARY) : [];

  // Auto-close on route change
  useEffect(() => { setOpen(false); }, [path]);

  return (
    <>
      <nav className="bottom-nav">
        {primary.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to as never} activeOptions={{ exact: true }} title={label}>
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        ))}
        {needsMore && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="bn-more"
            aria-label="More"
            data-status={overflow.some((o) => path.startsWith(o.to)) ? "active" : undefined}
          >
            <MoreHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">More</span>
          </button>
        )}
      </nav>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-foreground/50 z-[95] animate-in fade-in duration-200"
          />
          <div
            className="fixed left-0 right-0 bottom-0 z-[96] bg-background border-t border-border rounded-t-3xl p-4 pb-8 animate-in slide-in-from-bottom duration-300"
            role="dialog"
            aria-label="More navigation"
          >
            <div className="mx-auto w-10 h-1.5 rounded-full bg-muted mb-3" />
            <div className="flex items-center justify-between mb-3">
              <div className="bracket-tag">MORE</div>
              <button
                onClick={() => setOpen(false)}
                className="w-9 h-9 grid place-items-center rounded-full hover:bg-muted transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {overflow.map(({ to, label, icon: Icon }) => {
                const active = path === to || path.startsWith(to + "/");
                return (
                  <Link
                    key={to}
                    to={to as never}
                    onClick={() => setOpen(false)}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl p-4 border transition ${
                      active
                        ? "bg-foreground text-background border-foreground"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] tracking-[0.18em] uppercase font-semibold text-center leading-tight">
                      {label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
