import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageHeader, Panel, Stat, AreaChart } from "@/components/dashboard/Bits";
import { Activity, Download, TrendingDown, TrendingUp, Calculator, FileDown } from "lucide-react";

export const Route = createFileRoute("/dashboard/manager/simulator")({ component: Simulator });

type Scenario = {
  headcount: number;
  avgSalary: number;
  turnoverPct: number;     // annual
  absenteeismPct: number;  // % working days lost
  engagementIdx: number;   // 0-100
  hiringRate: number;      // hires per month
  trainingBudgetPct: number; // % of salary mass
  horizonMonths: number;
};

const DEFAULT: Scenario = {
  headcount: 180, avgSalary: 12500, turnoverPct: 14, absenteeismPct: 4.2,
  engagementIdx: 68, hiringRate: 4, trainingBudgetPct: 2.5, horizonMonths: 12,
};

function project(s: Scenario) {
  // Simple but defensible projection model:
  // - turnover reduces headcount monthly, hires add to it (capped)
  // - salary mass scales with headcount; absenteeism subtracts productive cost
  // - engagement influences turnover elasticity
  const months: Array<{ m: number; headcount: number; mass: number; absCost: number; attrition: number; engagement: number }> = [];
  let hc = s.headcount;
  let eng = s.engagementIdx;
  const monthlyTurnover = s.turnoverPct / 100 / 12;
  for (let m = 1; m <= s.horizonMonths; m++) {
    // engagement drift toward 60 when low training, up to +0.6/mo when training>=3%
    eng = Math.max(20, Math.min(95, eng + (s.trainingBudgetPct - 2) * 0.25 - (s.absenteeismPct - 3) * 0.15));
    const engFactor = 1 + (70 - eng) / 200; // low engagement => more attrition
    const attrition = Math.round(hc * monthlyTurnover * engFactor);
    hc = Math.max(0, hc - attrition + s.hiringRate);
    const mass = hc * s.avgSalary;
    const absCost = mass * (s.absenteeismPct / 100);
    months.push({ m, headcount: hc, mass, absCost, attrition, engagement: Math.round(eng) });
  }
  const totalMass = months.reduce((a, b) => a + b.mass, 0);
  const totalAbsCost = months.reduce((a, b) => a + b.absCost, 0);
  const totalAttrition = months.reduce((a, b) => a + b.attrition, 0);
  const replacementCost = totalAttrition * s.avgSalary * 0.6; // 60% of salary per replacement
  return { months, totalMass, totalAbsCost, totalAttrition, replacementCost, endHeadcount: months.at(-1)?.headcount ?? s.headcount, endEngagement: months.at(-1)?.engagement ?? s.engagementIdx };
}

function exportCSV(s: Scenario, r: ReturnType<typeof project>) {
  const lines = [
    "WASL — What-if HR scenario",
    `Generated,${new Date().toISOString()}`,
    "",
    "Inputs",
    `headcount,${s.headcount}`,
    `avg_salary_MAD,${s.avgSalary}`,
    `turnover_pct,${s.turnoverPct}`,
    `absenteeism_pct,${s.absenteeismPct}`,
    `engagement_idx,${s.engagementIdx}`,
    `hiring_rate_per_month,${s.hiringRate}`,
    `training_budget_pct,${s.trainingBudgetPct}`,
    `horizon_months,${s.horizonMonths}`,
    "",
    "Projection",
    "month,headcount,salary_mass_MAD,absence_cost_MAD,attrition,engagement",
    ...r.months.map(m => `${m.m},${m.headcount},${m.mass.toFixed(0)},${m.absCost.toFixed(0)},${m.attrition},${m.engagement}`),
    "",
    "Summary",
    `total_salary_mass_MAD,${r.totalMass.toFixed(0)}`,
    `total_absence_cost_MAD,${r.totalAbsCost.toFixed(0)}`,
    `total_attrition,${r.totalAttrition}`,
    `est_replacement_cost_MAD,${r.replacementCost.toFixed(0)}`,
    `end_headcount,${r.endHeadcount}`,
    `end_engagement,${r.endEngagement}`,
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `wasl-scenario-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function exportPrintable(s: Scenario, r: ReturnType<typeof project>) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>WASL scenario</title>
  <style>body{font:13px/1.5 system-ui,sans-serif;padding:24px;color:#0a0a12}h1{font-size:22px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px;text-transform:uppercase;letter-spacing:.18em;color:#666}table{border-collapse:collapse;width:100%;margin-top:8px}td,th{border:1px solid #ddd;padding:6px 8px;font-size:12px;text-align:left}.kpi{display:inline-block;margin:6px 16px 6px 0}.kpi b{display:block;font-size:18px}.noprint{position:fixed;top:8px;right:8px}@media print{.noprint{display:none}}</style></head><body>
  <h1>WASL — What-if HR scenario</h1>
  <div style="color:#666">${new Date().toLocaleString()}</div>
  <h2>Inputs</h2>
  <div class="kpi"><span>Headcount</span><b>${s.headcount}</b></div>
  <div class="kpi"><span>Avg salary (MAD)</span><b>${s.avgSalary.toLocaleString()}</b></div>
  <div class="kpi"><span>Turnover</span><b>${s.turnoverPct}%</b></div>
  <div class="kpi"><span>Absenteeism</span><b>${s.absenteeismPct}%</b></div>
  <div class="kpi"><span>Engagement</span><b>${s.engagementIdx}/100</b></div>
  <div class="kpi"><span>Hiring/month</span><b>${s.hiringRate}</b></div>
  <div class="kpi"><span>Training budget</span><b>${s.trainingBudgetPct}%</b></div>
  <h2>12-month projection</h2>
  <table><tr><th>Month</th><th>Headcount</th><th>Salary mass</th><th>Absence cost</th><th>Attrition</th><th>Engagement</th></tr>
  ${r.months.map(m => `<tr><td>${m.m}</td><td>${m.headcount}</td><td>${m.mass.toLocaleString()}</td><td>${m.absCost.toLocaleString(undefined,{maximumFractionDigits:0})}</td><td>${m.attrition}</td><td>${m.engagement}</td></tr>`).join("")}
  </table>
  <h2>Summary</h2>
  <div class="kpi"><span>Total salary mass</span><b>${r.totalMass.toLocaleString(undefined,{maximumFractionDigits:0})} MAD</b></div>
  <div class="kpi"><span>Total absence cost</span><b>${r.totalAbsCost.toLocaleString(undefined,{maximumFractionDigits:0})} MAD</b></div>
  <div class="kpi"><span>Attrition</span><b>${r.totalAttrition}</b></div>
  <div class="kpi"><span>Est. replacement cost</span><b>${r.replacementCost.toLocaleString(undefined,{maximumFractionDigits:0})} MAD</b></div>
  <div class="noprint"><button onclick="window.print()" style="padding:6px 10px;font:600 11px sans-serif;background:#0b1730;color:#fff;border:0;border-radius:6px;cursor:pointer">Print / Save PDF</button></div>
  <script>setTimeout(()=>window.print(),350)</script></body></html>`;
  try {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank", "noopener,noreferrer,width=900,height=1100");
    if (!w) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `wasl-whatif-${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    console.error("exportPrintable failed", e);
  }
}

function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="font-bold">{value}{unit ?? ""}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-foreground" />
    </div>
  );
}

function Simulator() {
  const [s, setS] = useState<Scenario>(DEFAULT);
  const baseline = useMemo(() => project(DEFAULT), []);
  const r = useMemo(() => project(s), [s]);
  const massDelta = r.totalMass - baseline.totalMass;
  const attritionDelta = r.totalAttrition - baseline.totalAttrition;

  return (
    <div className="space-y-5">
      <PageHeader kicker="Predictive analytics" title="What-if simulator" subtitle="Tune turnover, absenteeism, hiring and training inputs to project salary mass, attrition cost and engagement over time. Export the scenario as CSV or PDF." right={
        <div className="hidden sm:flex gap-1">
          <button onClick={() => exportCSV(s, r)} className="pill-btn !text-[10px] !py-2 !px-3"><Download className="w-3 h-3"/>CSV</button>
          <button onClick={() => exportPrintable(s, r)} className="pill-btn accent !text-[10px] !py-2 !px-3"><FileDown className="w-3 h-3"/>PDF</button>
        </div>
      } />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <Stat label="End headcount" value={String(r.endHeadcount)} delta={`Δ ${r.endHeadcount - s.headcount >= 0 ? "+" : ""}${r.endHeadcount - s.headcount}`} icon={<Activity className="w-3.5 h-3.5"/>} />
        <Stat label="Salary mass" value={`${(r.totalMass/1_000_000).toFixed(1)}M`} delta={`${massDelta >= 0 ? "+" : ""}${(massDelta/1_000_000).toFixed(1)}M vs base`} icon={massDelta >= 0 ? <TrendingUp className="w-3.5 h-3.5"/> : <TrendingDown className="w-3.5 h-3.5"/>} />
        <Stat label="Absence cost" value={`${(r.totalAbsCost/1_000).toFixed(0)}k`} icon={<TrendingDown className="w-3.5 h-3.5"/>} />
        <Stat label="Attrition" value={String(r.totalAttrition)} delta={`${attritionDelta >= 0 ? "+" : ""}${attritionDelta} vs base`} accent icon={<Calculator className="w-3.5 h-3.5"/>} />
      </div>

      <Panel label="INPUTS" title="Tune the scenario">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Slider label="Headcount" value={s.headcount} min={20} max={500} step={5} onChange={v => setS({...s, headcount: v})} />
          <Slider label="Avg salary" value={s.avgSalary} min={4000} max={40000} step={500} unit=" MAD" onChange={v => setS({...s, avgSalary: v})} />
          <Slider label="Annual turnover" value={s.turnoverPct} min={2} max={40} step={0.5} unit="%" onChange={v => setS({...s, turnoverPct: v})} />
          <Slider label="Absenteeism" value={s.absenteeismPct} min={0} max={15} step={0.1} unit="%" onChange={v => setS({...s, absenteeismPct: v})} />
          <Slider label="Engagement index" value={s.engagementIdx} min={20} max={95} step={1} onChange={v => setS({...s, engagementIdx: v})} />
          <Slider label="Hires per month" value={s.hiringRate} min={0} max={20} step={1} onChange={v => setS({...s, hiringRate: v})} />
          <Slider label="Training budget" value={s.trainingBudgetPct} min={0} max={8} step={0.1} unit="%" onChange={v => setS({...s, trainingBudgetPct: v})} />
          <Slider label="Horizon" value={s.horizonMonths} min={3} max={24} step={1} unit=" mo" onChange={v => setS({...s, horizonMonths: v})} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => setS(DEFAULT)} className="pill-btn !text-[10px] !py-2 !px-3">Reset baseline</button>
          <button onClick={() => setS({...s, trainingBudgetPct: Math.min(8, s.trainingBudgetPct + 1), turnoverPct: Math.max(2, s.turnoverPct - 2)})} className="pill-btn !text-[10px] !py-2 !px-3">Quick: invest in training</button>
          <button onClick={() => setS({...s, hiringRate: s.hiringRate + 2})} className="pill-btn !text-[10px] !py-2 !px-3">Quick: hiring sprint</button>
          <div className="ml-auto flex gap-1 sm:hidden">
            <button onClick={() => exportCSV(s, r)} className="pill-btn !text-[10px] !py-2 !px-3"><Download className="w-3 h-3"/>CSV</button>
            <button onClick={() => exportPrintable(s, r)} className="pill-btn accent !text-[10px] !py-2 !px-3"><FileDown className="w-3 h-3"/>PDF</button>
          </div>
        </div>
      </Panel>

      <Panel label="PROJECTION" title="Salary mass over time">
        <AreaChart data={r.months.map(m => m.mass / 1000)} />
        <div className="mt-3 text-[11px] text-muted-foreground">Each point = monthly payroll (k MAD). Engagement ends at <span className="font-bold text-foreground">{r.endEngagement}/100</span>.</div>
      </Panel>

      <Panel label="EXPLAINABILITY" title="Model rationale">
        <ul className="text-xs space-y-1.5 list-disc pl-4 text-muted-foreground">
          <li>Monthly turnover = annual / 12, scaled by engagement (low engagement ⇒ higher attrition).</li>
          <li>Engagement drifts ±0.6/mo from training budget vs. baseline 2% and absenteeism vs. 3%.</li>
          <li>Replacement cost = 60% of avg salary per departure (industry-standard heuristic).</li>
          <li>Absence cost = salary mass × absenteeism rate (proxy for lost productivity).</li>
          <li>All inputs are user-controlled; no PII is used in the projection.</li>
        </ul>
      </Panel>
    </div>
  );
}
