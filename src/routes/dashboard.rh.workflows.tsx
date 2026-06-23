import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, Panel } from "@/components/dashboard/Bits";
import { Toast } from "@/components/Modal";
import { Compass, CheckCircle2, XCircle, FileText, Loader2 } from "lucide-react";
import { listOnboardings } from "@/lib/workflows.functions";
import { listPendingDocuments, reviewDocument } from "@/lib/documents.functions";
import { openPrintablePdf } from "@/lib/pdf";

export const Route = createFileRoute("/dashboard/rh/workflows")({ component: Workflows });

function Workflows() {
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const obFn = useServerFn(listOnboardings);
  const pendingFn = useServerFn(listPendingDocuments);
  const reviewFn = useServerFn(reviewDocument);
  const { data: obData } = useQuery({ queryKey: ["onbs"], queryFn: () => obFn() });
  const { data: pendData } = useQuery({ queryKey: ["pending-docs"], queryFn: () => pendingFn() });

  const review = useMutation({
    mutationFn: (input: { id: string; decision: "approve" | "reject"; reason?: string }) => reviewFn({ data: input }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["pending-docs"] }); qc.invalidateQueries({ queryKey: ["all-docs"] }); setToast(vars.decision === "approve" ? "Approved" : "Rejected"); },
  });

  const onbs = obData?.items ?? [];
  const pend = pendData?.documents ?? [];

  return (
    <div className="space-y-5">
      <PageHeader kicker="Workflows" title="Approvals & onboardings" subtitle="HR validates AI-prefilled documents and tracks every onboarding live." />

      <Panel title={`Pending documents · ${pend.length}`}>
        {pend.length === 0 && <div className="text-xs text-muted-foreground py-4">All caught up. No documents awaiting validation.</div>}
        {pend.map((d: any) => (
          <div key={d.id} className="py-3 border-b border-border last:border-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary grid place-items-center"><FileText className="w-4 h-4 text-accent" /></div>
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{d.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{d.owner?.full_name ?? "Unknown"} · {d.owner?.position ?? ""} · {new Date(d.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <button onClick={() => openPrintablePdf({ title: d.title, kind: d.type, body: decodeBody(d.storage_path), recipient: d.owner?.full_name, issuedAt: d.issued_at })}
                  className="pill-btn !text-[9px] !py-1 !px-2.5 tracking-[0.2em] uppercase"><FileText className="w-3 h-3"/> Preview</button>
                <button onClick={() => review.mutate({ id: d.id, decision: "approve" })} disabled={review.isPending}
                  className="pill-btn accent !text-[9px] !py-1 !px-2.5 tracking-[0.2em] uppercase"><CheckCircle2 className="w-3 h-3" /> Approve</button>
                <button onClick={() => {
                  const r = prompt("Reason for rejection (optional):") ?? "";
                  review.mutate({ id: d.id, decision: "reject", reason: r || undefined });
                }}
                  className="pill-btn !text-[9px] !py-1 !px-2.5 tracking-[0.2em] uppercase"><XCircle className="w-3 h-3" /> Reject</button>
              </div>
            </div>
          </div>
        ))}
      </Panel>

      <Panel title={`Onboardings · ${onbs.length}`}>
        {onbs.length === 0 && <div className="text-xs text-muted-foreground py-4">No active onboardings.</div>}
        {onbs.map((o: any) => {
          const widthClass = o.progress >= 100 ? "w-full" :
            o.progress >= 90 ? "w-[90%]" :
            o.progress >= 80 ? "w-[80%]" :
            o.progress >= 70 ? "w-[70%]" :
            o.progress >= 60 ? "w-[60%]" :
            o.progress >= 50 ? "w-[50%]" :
            o.progress >= 40 ? "w-[40%]" :
            o.progress >= 30 ? "w-[30%]" :
            o.progress >= 20 ? "w-[20%]" :
            o.progress >= 10 ? "w-[10%]" : "w-[4%]";
          return (
            <div key={o.id} className="py-3 border-b border-border last:border-0 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl grid place-items-center text-white shrink-0 bg-[var(--grad-brand)]">
                <Compass className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm">{o.employee?.full_name ?? "Unknown"}</div>
                  <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{o.status}</span>
                </div>
                <div className="text-xs text-muted-foreground truncate">{o.current_step ?? "—"}</div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden mt-1.5">
                  <div className={`h-full rounded-full transition-all bg-[var(--accent)] ${widthClass}`} />
                </div>
              </div>
            </div>
          );
        })}
      </Panel>

      {review.isPending && <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Working…</div>}
      <Toast msg={toast} onDone={() => setToast(null)} />
    </div>
  );
}

function decodeBody(path: string | null): string {
  if (!path?.startsWith("inline://")) return "";
  try { return decodeURIComponent(escape(atob(path.slice(9)))); } catch { return ""; }
}
