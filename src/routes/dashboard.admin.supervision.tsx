import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, Panel, Stat } from "@/components/dashboard/Bits";
import { Shield, AlertTriangle, CheckCircle2, ArrowUpRight, Settings2, FileText, Lock, Eye, Loader2 } from "lucide-react";
import { getAlerts, getRecentAuditLogs } from "@/lib/dashboard.functions";
import { anonymize } from "@/lib/anonymize";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard/admin/supervision")({ component: Supervision });

type Rule = {
  id: string;
  name: string;
  signal: string;
  threshold: number;
  severity: "critical" | "warning" | "info";
  enabled: boolean;
  rationale: string;
};

const DEFAULT_RULES: Rule[] = [
  { id: "r1", name: "Burnout cross-signal", signal: "Absences ≥ N in 30d AND engagement avg < 55", threshold: 3, severity: "critical", enabled: true,
    rationale: "Combination of frequent short absences and low engagement is the strongest published predictor of burnout (Maslach 2018)." },
  { id: "r2", name: "Engagement decline", signal: "Engagement drop ≥ N pts over 14d", threshold: 10, severity: "warning", enabled: true,
    rationale: "Two-week downward trend tends to precede voluntary turnover by 2–4 months." },
  { id: "r3", name: "Overtime spike", signal: "After-hours messages × baseline > N", threshold: 2, severity: "warning", enabled: true,
    rationale: "Sustained after-hours activity correlates with sleep deficit and recovery debt." },
  { id: "r4", name: "Probation review due", signal: "End of probation in ≤ N days", threshold: 14, severity: "info", enabled: true,
    rationale: "Procedural reminder — no risk inference." },
  { id: "r5", name: "Harmful chat content", signal: "Guardrail trigger from AI assistant", threshold: 1, severity: "critical", enabled: true,
    rationale: "Always escalated to HR + admin; conversation is quarantined and audited." },
];

function loadRules(): Rule[] {
  if (typeof window === "undefined") return DEFAULT_RULES;
  try {
    const j = localStorage.getItem("wasl.supervision.rules");
    if (j) return JSON.parse(j);
  } catch (error) {
    console.error("Failed to load supervision rules from localStorage:", error);
  }
  return DEFAULT_RULES;
}
function saveRules(r: Rule[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("wasl.supervision.rules", JSON.stringify(r));
  } catch (error) {
    console.error("Failed to save supervision rules to localStorage:", error);
  }
}

function SevPill({ s }: { s: string }) {
  const c = s === "critical" ? "bg-red-100 text-red-700" : s === "warning" ? "bg-amber-100 text-amber-700" : "bg-secondary text-muted-foreground";
  return <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${c}`}>{s}</span>;
}

function Supervision() {
  const qc = useQueryClient();
  const alertsFn = useServerFn(getAlerts);
  const logsFn = useServerFn(getRecentAuditLogs);
  const { data: alerts = [], isLoading } = useQuery({ queryKey: ["admin-alerts"], queryFn: () => alertsFn(), refetchInterval: 20000 });
  const { data: logs = [] } = useQuery({ queryKey: ["admin-audit"], queryFn: () => logsFn(), refetchInterval: 30000 });

  const [rules, setRules] = useState<Rule[]>([]);
  useEffect(() => { setRules(loadRules()); }, []);
  function patchRule(id: string, p: Partial<Rule>) { setRules(rs => { const n = rs.map(r => r.id === id ? { ...r, ...p } : r); saveRules(n); return n; }); }

  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Realtime updates on alerts table
  useEffect(() => {
    const channelName = `rt-alerts-admin-${Math.random().toString(36).slice(2)}`;
    const ch = supabase.channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => qc.invalidateQueries({ queryKey: ["admin-alerts"] }))
      .subscribe();
    return () => {
      if (ch) {
        supabase.removeChannel(ch);
      }
    };
  }, [qc]);

  async function ack(id: string) {
    setBusy(id);
    try { await supabase.from("alerts").update({ acknowledged: true }).eq("id", id); qc.invalidateQueries({ queryKey: ["admin-alerts"] }); }
    finally { setBusy(null); }
  }
  async function escalate(id: string) {
    setBusy(id);
    try {
      await supabase.from("audit_logs").insert({ action: "alert.escalated", entity: "alerts", metadata: { alert_id: id } as any });
      qc.invalidateQueries({ queryKey: ["admin-audit"] });
    } finally { setBusy(null); }
  }
  async function classify(id: string, severity: "critical" | "warning" | "info") {
    setBusy(id);
    try { await supabase.from("alerts").update({ severity }).eq("id", id); qc.invalidateQueries({ queryKey: ["admin-alerts"] }); }
    finally { setBusy(null); }
  }

  const open = alerts.filter((a: any) => !a.acknowledged);
  const critical = open.filter((a: any) => a.severity === "critical").length;

  return (
    <div className="space-y-5">
      <PageHeader kicker="Governance" title="AI supervision" subtitle="Configure detection rules, review every AI-generated alert with its evidence, acknowledge or escalate. All actions are written to the immutable audit log." />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <Stat label="Open alerts" value={String(open.length)} icon={<AlertTriangle className="w-3.5 h-3.5"/>} />
        <Stat label="Critical" value={String(critical)} accent={critical > 0} icon={<Shield className="w-3.5 h-3.5"/>} />
        <Stat label="Active rules" value={String(rules.filter(r => r.enabled).length)} icon={<Settings2 className="w-3.5 h-3.5"/>} />
        <Stat label="Audit events" value={String(logs.length)} icon={<FileText className="w-3.5 h-3.5"/>} />
      </div>

      <Panel label="DETECTION RULES" title="Rule engine">
        <div className="space-y-2">
          {rules.map(r => (
            <div key={r.id} className="border border-border rounded-xl p-3">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm">{r.name}</span>
                    <SevPill s={r.severity} />
                    {!r.enabled && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">disabled</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{r.signal.replace("N", String(r.threshold))}</div>
                  <div className="text-[11px] italic text-muted-foreground mt-1">Why: {r.rationale}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="flex items-center gap-1 text-[11px]">
                    <span className="text-muted-foreground uppercase tracking-wider">N</span>
                    <input type="number" value={r.threshold} min={1} max={90} onChange={e => patchRule(r.id, { threshold: Number(e.target.value) })} className="w-16 rounded-md border border-border bg-background px-2 py-1 text-xs" />
                  </label>
                  <select
                    aria-label={`Severity for ${r.name}`}
                    value={r.severity}
                    onChange={e => patchRule(r.id, { severity: e.target.value as Rule["severity"] })}
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                  >
                    <option value="info">info</option>
                    <option value="warning">warning</option>
                    <option value="critical">critical</option>
                  </select>
                  <button onClick={() => patchRule(r.id, { enabled: !r.enabled })} className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-md border ${r.enabled ? "border-foreground bg-foreground text-background" : "border-border"}`}>{r.enabled ? "ON" : "OFF"}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground"><Lock className="w-3 h-3 inline mr-1"/>Changes are local to this admin session and audited on apply.</div>
      </Panel>

      <Panel label="ALERT TRIAGE" title="Live queue">
        {isLoading && <div className="text-xs text-muted-foreground py-4"><Loader2 className="w-3 h-3 inline animate-spin mr-1"/>Loading…</div>}
        {!isLoading && open.length === 0 && (
          <div className="text-center py-6"><CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2"/><div className="text-sm font-bold">Inbox clear</div></div>
        )}
        <div className="space-y-2">
          {open.map((a: any) => {
            const pseudo = a.target_id ? anonymize(a.target_id) : "Population-level";
            const isOpen = expanded === a.id;
            return (
              <div key={a.id} className="border border-border rounded-xl p-3">
                <div className="flex items-start gap-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm truncate">{a.title}</span>
                      <SevPill s={a.severity} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{a.description}</div>
                    <div className="text-[11px] text-accent mt-1 font-medium">Subject (anonymized): {pseudo}</div>
                  </div>
                  <div className="flex flex-wrap gap-1 shrink-0">
                    <button onClick={() => setExpanded(isOpen ? null : a.id)} className="text-[10px] uppercase tracking-wider px-2 py-1.5 rounded-md border border-border hover:bg-muted"><Eye className="w-3 h-3 inline mr-1"/>Evidence</button>
                    <select
                      aria-label={`Change severity for alert ${a.title}`}
                      value={a.severity}
                      onChange={e => classify(a.id, e.target.value as any)}
                      className="text-[10px] uppercase rounded-md border border-border bg-background px-1 py-1"
                    >
                      <option value="info">info</option>
                      <option value="warning">warning</option>
                      <option value="critical">critical</option>
                    </select>
                    <button disabled={busy === a.id} onClick={() => escalate(a.id)} className="text-[10px] uppercase tracking-wider px-2 py-1.5 rounded-md border border-amber-400 text-amber-700 hover:bg-amber-50"><ArrowUpRight className="w-3 h-3 inline mr-1"/>Escalate</button>
                    <button disabled={busy === a.id} onClick={() => ack(a.id)} className="text-[10px] uppercase tracking-wider px-2 py-1.5 rounded-md bg-foreground text-background">{busy === a.id ? <Loader2 className="w-3 h-3 inline animate-spin"/> : "Acknowledge"}</button>
                  </div>
                </div>
                {isOpen && (
                  <div className="mt-3 bg-secondary/40 rounded-lg p-3 text-[11px] space-y-1">
                    <div className="bracket-tag">EVIDENCE · ANONYMIZED</div>
                    <div><b>Generated:</b> {new Date(a.created_at).toLocaleString()}</div>
                    <div><b>Subject pseudonym:</b> {pseudo}</div>
                    <div><b>Matched rule:</b> {a.title}</div>
                    <div><b>Reasoning:</b> {a.description}</div>
                    <div className="italic text-muted-foreground pt-1 border-t border-border mt-2">No raw personal data is shown here. Identity disclosure requires a separate audited request through HR.</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel label="AUDIT TRAIL" title="Recent automated decisions">
        {logs.length === 0 && <div className="text-xs text-muted-foreground py-3">No audit events yet.</div>}
        <div className="divide-y divide-border">
          {logs.slice(0, 15).map((l: any) => (
            <div key={l.id} className="py-2 flex items-center gap-2 text-xs">
              <code className="bg-secondary px-1.5 py-0.5 rounded text-[10px]">{l.action}</code>
              <span className="text-muted-foreground truncate flex-1 min-w-0">{l.entity}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{new Date(l.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
