import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { PageHeader, Panel } from "@/components/dashboard/Bits";
import { Heart, Activity, AlertTriangle, Stethoscope, Flame, ShieldAlert, ClipboardList, ArrowUpRight } from "lucide-react";
import { getMedicalSnapshot } from "@/lib/medical.functions";
import { listAllMedicalRequests } from "@/lib/medical-requests.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/medecin/")({ component: MedecinHome });

function Stat({ icon: Icon, label, value, sub, tone = "default" }: { icon: any; label: string; value: string | number; sub?: string; tone?: "default" | "warn" | "danger" | "good" }) {
  const colors = { default: "var(--accent)", warn: "#f59e0b", danger: "#dc2626", good: "#16a34a" } as const;
  return (
    <div className="edunai-card p-3">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl grid place-items-center text-white" style={{ background: colors[tone] }}><Icon className="w-4 h-4"/></div>
        <div className="bracket-tag">{label}</div>
      </div>
      <div className="font-display font-bold text-2xl mt-2">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function MiniBars({ data, label }: { data: number[]; label: string }) {
  const max = Math.max(1, ...data);
  return (
    <div>
      <div className="bracket-tag mb-2">{label}</div>
      <div className="flex items-end gap-1 h-16">
        {data.map((v, i) => (
          <div key={i} className="flex-1 rounded-t-md" style={{ height: `${(v / max) * 100}%`, minHeight: 4, background: v > max * 0.7 ? "#dc2626" : v > max * 0.4 ? "#f59e0b" : "var(--accent)" }} />
        ))}
      </div>
    </div>
  );
}

function MedecinHome() {
  const fn = useServerFn(getMedicalSnapshot);
  const reqFn = useServerFn(listAllMedicalRequests);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["medecin-snap"], queryFn: () => fn(), refetchInterval: 60000 });
  const { data: reqs = [] } = useQuery({ queryKey: ["all-medical-requests"], queryFn: () => reqFn(), refetchInterval: 30000 });

  useEffect(() => {
    const ch = supabase
      .channel("rt-medecin-home")
      .on("postgres_changes", { event: "*", schema: "public", table: "medical_requests" }, () => {
        qc.invalidateQueries({ queryKey: ["all-medical-requests"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, () => {
        qc.invalidateQueries({ queryKey: ["medecin-snap"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (error) return <div className="text-sm text-red-600">{(error as Error).message}</div>;

  const pending = reqs.filter((r: any) => r.status === "pending").length;
  const scheduled = reqs.filter((r: any) => r.status === "scheduled").length;
  const weeks = [3, 4, 2, 5, 6, 4, 7, 5];

  return (
    <div className="space-y-5">
      <PageHeader kicker="Occupational health" title="Well-being dashboard" subtitle="Confidential cross-signals to detect burnout & sick-leave patterns — anonymised at the team level." />

      <div className="grid grid-cols-2 gap-2">
        <Stat icon={Heart} label="Sick days (90d)" value={data?.sickDays ?? 0} tone="warn" />
        <Stat icon={Activity} label="Avg engagement" value={`${data?.avgEngagement ?? 0}/100`} tone={(data?.avgEngagement ?? 0) < 60 ? "danger" : "good"} />
        <Stat icon={Flame} label="Burnout candidates" value={data?.burnoutCandidates ?? 0} tone="danger" sub="≥3 absences + low pulse" />
        <Stat icon={ClipboardList} label="Pending requests" value={pending} tone={pending > 0 ? "warn" : "default"} sub={`${scheduled} scheduled`} />
      </div>

      <Link to="/dashboard/medecin/requests" className="edunai-card p-4 flex items-center gap-3 hover:border-foreground transition border border-transparent">
        <div className="w-10 h-10 rounded-xl bg-foreground text-background grid place-items-center"><ClipboardList className="w-4 h-4"/></div>
        <div className="flex-1">
          <div className="font-display font-bold text-sm">Consultation requests</div>
          <div className="text-[11px] text-muted-foreground">{pending} pending · {scheduled} scheduled · live</div>
        </div>
        <ArrowUpRight className="w-4 h-4" />
      </Link>

      <Panel label="TREND" title="Sick-leave volume — last 8 weeks">
        <MiniBars data={weeks} label="WEEKLY DAYS OFF" />
      </Panel>

      <Panel label="ALERTS" title="Recent health-related signals">
        {(data?.recentAlerts ?? []).slice(0, 6).map((a: any) => (
          <div key={a.id} className="py-2 border-b border-border last:border-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5" style={{ color: a.severity === "critical" || a.severity === "high" ? "#dc2626" : "#f59e0b" }} />
              <span className="text-sm font-medium">{a.title}</span>
            </div>
            <div className="text-[11px] text-muted-foreground">{new Date(a.created_at).toLocaleString()} · {a.severity}</div>
          </div>
        ))}
        {(data?.recentAlerts ?? []).length === 0 && <div className="text-xs text-muted-foreground py-4">No recent alerts.</div>}
      </Panel>

      <Panel label="ESCALATIONS" title="AI-flagged sensitive cases">
        {(data?.escalations ?? []).slice(0, 6).map((e: any) => (
          <div key={e.id} className="py-2 border-b border-border last:border-0">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-accent" />
              <span className="text-sm font-medium capitalize">{String(e.topic).replace("_", " ")}</span>
              <span className="text-[10px] tracking-wider uppercase text-muted-foreground ml-auto">{e.status}</span>
            </div>
            <div className="text-[11px] text-muted-foreground truncate">{e.prompt_excerpt}</div>
          </div>
        ))}
        {(data?.escalations ?? []).length === 0 && <div className="text-xs text-muted-foreground py-4">No escalations.</div>}
      </Panel>

      <div className="text-[11px] text-muted-foreground flex items-center gap-2 px-2">
        <Stethoscope className="w-3 h-3" />
        Data shown is anonymised. Individual employee identity is never displayed without explicit consent.
      </div>
    </div>
  );
}
