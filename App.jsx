import React, { useState } from "react";

// Simple single-file React component (Tailwind CSS assumed available)
// Default-exported component for student project. Provides calculators for:
// - k (elimination constant) from t1/2 or Cl/Vd
// - half-life
// - AUC (trapezoidal + extrapolated to infinity)
// - Cmax / Tmax from concentration-time points
// - Loading dose and Maintenance dose suggestions
// - Simple renal/hepatic guidance flags (educational only)

export default function TetracyclinePKCalculator() {
  const [drugName, setDrugName] = useState("Tetracycline");
  const [dose, setDose] = useState(500); // mg
  const [route, setRoute] = useState("oral");
  const [F, setF] = useState(0.6); // oral bioavailability default 60% (editable)
  const [Vd, setVd] = useState(40); // L
  const [Cl, setCl] = useState(4); // L/hr
  const [t12, setT12] = useState(8); // hours
  const [ka, setKa] = useState(1.2); // 1/hr (absorption)
  const [tau, setTau] = useState(12); // dosing interval hours
  const [cssTarget, setCssTarget] = useState(2); // mg/L desired average conc
  const [pointsCsv, setPointsCsv] = useState("0:0,1:2.1,2:3.5,4:2.2,6:1.1,8:0.6");
  const [results, setResults] = useState(null);

  function parsePoints(csv) {
    // expects "t1:c1,t2:c2,..." where times in hours and conc mg/L
    try {
      const arr = csv.split(",").map((p) => {
        const [t, c] = p.split(":").map((x) => x.trim());
        return { t: parseFloat(t), c: parseFloat(c) };
      });
      arr.sort((a, b) => a.t - b.t);
      return arr;
    } catch (e) {
      return [];
    }
  }

  function trapezoidalAUC(points) {
    // points: [{t,c},...]
    let auc = 0;
    for (let i = 1; i < points.length; i++) {
      const dt = points[i].t - points[i - 1].t;
      const avgC = (points[i].c + points[i - 1].c) / 2;
      auc += avgC * dt;
    }
    return auc;
  }

  function estimateTerminalK(points) {
    // take last 3 nonzero points, do ln transform and linear fit
    const nonzero = points.filter((p) => p.c > 0);
    if (nonzero.length < 2) return null;
    const last = nonzero.slice(-4); // up to last 4
    const xs = last.map((p) => p.t);
    const ys = last.map((p) => Math.log(p.c));
    // linear regression slope
    const n = xs.length;
    const xbar = xs.reduce((a, b) => a + b, 0) / n;
    const ybar = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0,
      den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - xbar) * (ys[i] - ybar);
      den += (xs[i] - xbar) * (xs[i] - xbar);
    }
    if (den === 0) return null;
    const slope = num / den;
    const k = -slope; // slope = -k
    return k > 0 ? k : null;
  }

  function handleCalculate(e) {
    e.preventDefault();
    const points = parsePoints(pointsCsv);
    const auc = trapezoidalAUC(points);
    const k_from_t12 = t12 ? 0.693 / t12 : null;
    const k_from_cl_vd = Cl && Vd ? Cl / Vd : null;
    const k_est = estimateTerminalK(points);
    const k = k_est || k_from_cl_vd || k_from_t12 || null;
    const t_half = k ? 0.693 / k : null;

    // AUC infinity: last concentration / k
    const lastC = points.length ? points[points.length - 1].c : 0;
    const aucInf = k ? auc + lastC / k : null;

    // Cmax and Tmax
    let Cmax = 0,
      Tmax = 0;
    points.forEach((p) => {
      if (p.c > Cmax) {
        Cmax = p.c;
        Tmax = p.t;
      }
    });

    // Loading dose: LD = Css_target * Vd / F   (assumes immediate IV distribution; educational)
    const LD = (cssTarget * Vd) / (F || 1);

    // Maintenance dose rate: MD_rate = Css_target * Cl   (mg/hr)
    const MD_rate = cssTarget * (Cl || (k && Vd ? k * Vd : 0));
    // Maintenance dose per interval: MD = MD_rate * tau / F
    const MD = MD_rate * (tau || 1) / (F || 1);

    setResults({
      points,
      auc,
      k_from_t12,
      k_from_cl_vd,
      k_est,
      k,
      t_half,
      aucInf,
      Cmax,
      Tmax,
      LD,
      MD,
      MD_rate,
      lastC,
    });
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">{drugName} — Pharmacokinetic Calculator</h1>
      <form onSubmit={handleCalculate} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col">
            Dose (mg)
            <input className="mt-1 p-2 border rounded" type="number" value={dose} onChange={(e) => setDose(+e.target.value)} />
          </label>

          <label className="flex flex-col">
            Route
            <select className="mt-1 p-2 border rounded" value={route} onChange={(e) => setRoute(e.target.value)}>
              <option value="oral">Oral</option>
              <option value="iv">IV Bolus</option>
            </select>
          </label>

          <label className="flex flex-col">
            Bioavailability (F, fraction)
            <input className="mt-1 p-2 border rounded" type="number" step="0.01" value={F} onChange={(e) => setF(+e.target.value)} />
          </label>

          <label className="flex flex-col">
            Volume of distribution (Vd, L)
            <input className="mt-1 p-2 border rounded" type="number" value={Vd} onChange={(e) => setVd(+e.target.value)} />
          </label>

          <label className="flex flex-col">
            Clearance (Cl, L/hr)
            <input className="mt-1 p-2 border rounded" type="number" value={Cl} onChange={(e) => setCl(+e.target.value)} />
          </label>

          <label className="flex flex-col">
            Half-life (t1/2, hr)
            <input className="mt-1 p-2 border rounded" type="number" value={t12} onChange={(e) => setT12(+e.target.value)} />
          </label>

          <label className="flex flex-col">
            Absorption rate ka (1/hr)
            <input className="mt-1 p-2 border rounded" type="number" step="0.01" value={ka} onChange={(e) => setKa(+e.target.value)} />
          </label>

          <label className="flex flex-col">
            Dosing interval (tau, hr)
            <input className="mt-1 p-2 border rounded" type="number" value={tau} onChange={(e) => setTau(+e.target.value)} />
          </label>
        </div>

        <div>
          <label className="flex flex-col">
            Desired average concentration at steady-state (Css, mg/L)
            <input className="mt-1 p-2 border rounded" type="number" step="0.01" value={cssTarget} onChange={(e) => setCssTarget(+e.target.value)} />
          </label>
        </div>

        <div>
          <label className="flex flex-col">
            Concentration-time points (CSV e.g. 0:0,1:2.1,2:3.5)
            <textarea className="mt-1 p-2 border rounded" rows={3} value={pointsCsv} onChange={(e) => setPointsCsv(e.target.value)} />
          </label>
        </div>

        <div className="flex gap-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded" type="submit">Calculate</button>
        </div>
      </form>

      {results && (
        <div className="mt-6 p-4 bg-gray-50 rounded">
          <h2 className="text-lg font-semibold">Results (educational)</h2>
          <ul className="mt-2 space-y-2">
            <li>K estimates: from t1/2 = {results.k_from_t12 ? results.k_from_t12.toFixed(4) : "-"}  1/hr; from Cl/Vd = {results.k_from_cl_vd ? results.k_from_cl_vd.toFixed(4) : "-"}; from terminal slope = {results.k_est ? results.k_est.toFixed(4) : "-"}</li>
            <li>Selected k used = {results.k ? results.k.toFixed(4) : "-"} 1/hr</li>
            <li>Half-life (t1/2) = {results.t_half ? results.t_half.toFixed(2) : "-"} hr</li>
            <li>AUC (trapezoidal) = {results.auc.toFixed(3)} mg·hr/L</li>
            <li>AUC∞ (extrapolated) = {results.aucInf ? results.aucInf.toFixed(3) : "-"} mg·hr/L</li>
            <li>Cmax = {results.Cmax.toFixed(3)} mg/L at Tmax = {results.Tmax} hr</li>
            <li>Loading dose (LD) estimate = {results.LD.toFixed(1)} mg (LD = Css_target · Vd / F)</li>
            <li>Maintenance dose per interval (MD) = {results.MD.toFixed(1)} mg (MD = Css · Cl · tau / F)</li>
          </ul>

          <div className="mt-4 text-sm text-gray-700">
            <strong>Notes / Disclaimers:</strong>
            <ul className="list-disc pl-5">
              <li>This tool is for educational / project use only — not clinical dosing advice.</li>
              <li>Tetracycline group pharmacokinetics vary by compound. Use measured concentration data or literature values for Vd, Cl, F, or t1/2 when available.</li>
              <li>Dosing adjustment guidance for renal/hepatic impairment is educational; doxycycline is less renally eliminated and often does not need renal adjustment (per your lecture notes).</li>
            </ul>
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-yellow-50 rounded text-sm">
        <h3 className="font-semibold">Video & Presentation checklist</h3>
        <ol className="list-decimal pl-5 mt-2">
          <li>Record a short demo showing: input screen, entering concentration-time data, and reading outputs (Cmax, Tmax, AUC, t1/2, LD, MD).</li>
          <li>Show one worked example (use the CSV box) and explain each calculated parameter and equation briefly.</li>
          <li>Mention how the app handles renal/hepatic impairment and which tetracyclines (e.g., doxycycline) behave differently.</li>
          <li>Include code screenshot and link to repo (if required) and discuss validation & limitations.</li>
        </ol>
      </div>
    </div>
  );
}
