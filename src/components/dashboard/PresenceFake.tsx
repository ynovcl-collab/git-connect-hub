import { PageHeader, Panel } from "@/components/dashboard/Bits";
import { Fingerprint, LogIn, LogOut, AlertTriangle, CheckCircle2 } from "lucide-react";

type Row = { day: string; check_in: string | null; check_out: string | null; anomaly?: string | null };
type TeamRow = { name: string; department: string; day: string; check_in: string | null; check_out: string | null; status: "present" | "late" | "remote" | "absent" };

function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function hours(a?: string | null, b?: string | null) {
  if (!a || !b) return "—";
  return `${((new Date(b).getTime() - new Date(a).getTime()) / 3600000).toFixed(1)} h`;
}

function iso(daysAgo: number, h: number, m: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
function dayStr(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

const MY_ROWS: Row[] = [
  { day: dayStr(0), check_in: iso(0, 8, 58), check_out: null },
  { day: dayStr(1), check_in: iso(1, 9, 2), check_out: iso(1, 18, 11) },
  { day: dayStr(2), check_in: iso(2, 8, 55), check_out: iso(2, 17, 48) },
  { day: dayStr(3), check_in: iso(3, 9, 14), check_out: iso(3, 18, 5), anomaly: "late_arrival" },
  { day: dayStr(4), check_in: iso(4, 8, 51), check_out: iso(4, 17, 32) },
  { day: dayStr(7), check_in: iso(7, 9, 6), check_out: iso(7, 18, 22) },
  { day: dayStr(8), check_in: iso(8, 8, 49), check_out: iso(8, 17, 55) },
  { day: dayStr(9), check_in: iso(9, 9, 0), check_out: iso(9, 18, 0) },
  { day: dayStr(10), check_in: iso(10, 8, 47), check_out: iso(10, 17, 41) },
  { day: dayStr(11), check_in: iso(11, 9, 18), check_out: iso(11, 18, 30), anomaly: "late_arrival" },
];

const TEAM: TeamRow[] = [
  { name: "Aya Bensaid", department: "Engineering", day: dayStr(0), check_in: iso(0, 8, 58), check_out: null, status: "present" },
  { name: "Mehdi Ziani", department: "Engineering", day: dayStr(0), check_in: iso(0, 9, 22), check_out: null, status: "late" },
  { name: "Lina Karim", department: "Marketing", day: dayStr(0), check_in: iso(0, 8, 45), check_out: null, status: "present" },
  { name: "Sara Rafik", department: "HR", day: dayStr(0), check_in: iso(0, 8, 30), check_out: null, status: "present" },
  { name: "Karim Naciri", department: "Sales", day: dayStr(0), check_in: null, check_out: null, status: "absent" },
  { name: "Fatima Idrissi", department: "Finance", day: dayStr(0), check_in: iso(0, 9, 5), check_out: null, status: "remote" },
  { name: "Youssef Alami", department: "Engineering", day: dayStr(0), check_in: iso(0, 8, 52), check_out: null, status: "present" },
  { name: "Nadia Cherkaoui", department: "Design", day: dayStr(0), check_in: iso(0, 9, 1), check_out: null, status: "present" },
  { name: "Omar Tazi", department: "Sales", day: dayStr(0), check_in: iso(0, 9, 35), check_out: null, status: "late" },
  { name: "Salma Bennani", department: "Legal", day: dayStr(0), check_in: iso(0, 8, 40), check_out: null, status: "present" },
];

const STATUS_COLOR: Record<TeamRow["status"], string> = {
  present: "#16a34a",
  late: "#f59e0b",
  remote: "#5b7bff",
  absent: "#dc2626",
};

export function CollabPresenceView() {
  const today = MY_ROWS[0];
  return (
    <div className="space-y-6">
      <PageHeader kicker="Biometric link" title="Presence" subtitle="Synced automatically with the on-site biometric gate — no manual action required." />
      <Panel title={`Today · ${today.day}`}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl grid place-items-center text-white" style={{ background: "var(--accent)" }}>
            <Fingerprint className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><LogIn className="w-3 h-3"/> Check-in</div>
            <div className="font-bold text-lg">{fmt(today.check_in)}</div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><LogOut className="w-3 h-3"/> Check-out</div>
            <div className="font-bold text-lg">{fmt(today.check_out)}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
          Detected by badge · device WASL-GATE-01
        </div>
      </Panel>
      <Panel title="Last 30 days">
        <div className="divide-y divide-border/60">
          <div className="flex items-center justify-between py-2 text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
            <div className="w-24">Day</div>
            <div className="w-16">In</div>
            <div className="w-16">Out</div>
            <div className="w-16">Hours</div>
            <div className="w-24 text-right">Note</div>
          </div>
          {MY_ROWS.map((r) => (
            <div key={r.day} className="flex items-center justify-between py-2 text-sm">
              <div className="w-24 font-mono text-xs">{r.day}</div>
              <div className="w-16 text-xs">{fmt(r.check_in)}</div>
              <div className="w-16 text-xs">{fmt(r.check_out)}</div>
              <div className="w-16 text-xs text-muted-foreground">{hours(r.check_in, r.check_out)}</div>
              <div className="w-24 text-right">
                {r.anomaly && (
                  <span className="inline-flex items-center gap-1 text-amber-600 text-[10px] uppercase tracking-wider">
                    <AlertTriangle className="w-3 h-3" />
                    {r.anomaly.replace("_", " ")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function TeamPresenceView({ scope }: { scope: "manager" | "rh" | "admin" }) {
  const present = TEAM.filter((t) => t.status === "present").length;
  const late = TEAM.filter((t) => t.status === "late").length;
  const remote = TEAM.filter((t) => t.status === "remote").length;
  const absent = TEAM.filter((t) => t.status === "absent").length;
  const subtitle = {
    manager: "Live presence of your direct reports — biometric & remote check-ins.",
    rh: "Company-wide presence feed from the biometric gates.",
    admin: "All-employees presence — audit & oversight view.",
  }[scope];

  return (
    <div className="space-y-6">
      <PageHeader kicker="Biometric link" title="Presence" subtitle={subtitle} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { l: "Present", v: present, c: STATUS_COLOR.present },
          { l: "Late", v: late, c: STATUS_COLOR.late },
          { l: "Remote", v: remote, c: STATUS_COLOR.remote },
          { l: "Absent", v: absent, c: STATUS_COLOR.absent },
        ].map((s) => (
          <div key={s.l} className="edunai-card p-3">
            <div className="bracket-tag">{s.l}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full" style={{ background: s.c }} />
              <span className="font-display font-bold text-2xl">{s.v}</span>
            </div>
          </div>
        ))}
      </div>
      <Panel title={`Today · ${dayStr(0)}`}>
        <div className="divide-y divide-border/60">
          <div className="flex items-center py-2 text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
            <div className="flex-1">Employee</div>
            <div className="w-16">In</div>
            <div className="w-16">Out</div>
            <div className="w-20 text-right">Status</div>
          </div>
          {TEAM.map((r) => (
            <div key={r.name} className="flex items-center py-2 text-sm">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{r.name}</div>
                <div className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground">{r.department}</div>
              </div>
              <div className="w-16 text-xs font-mono">{fmt(r.check_in)}</div>
              <div className="w-16 text-xs font-mono">{fmt(r.check_out)}</div>
              <div className="w-20 text-right">
                <span
                  className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full text-white"
                  style={{ background: STATUS_COLOR[r.status] }}
                >
                  {r.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <div className="text-[11px] text-muted-foreground px-2">
        Demo data · biometric gate WASL-GATE-01 · refreshes in real time on production.
      </div>
    </div>
  );
}
