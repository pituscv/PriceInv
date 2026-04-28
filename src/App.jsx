import { useMemo, useState } from "react";
import { ALL_PRODUCTS, APPLIED_ACTIONS, MARKDOWN_LIST, MARKUP_LIST, MATRIX, PRODUCT_DETAILS } from "./data.js";
import { clamp, fmtEUR, fmtIndex, fmtInt, fmtPct, fmtPctFromMult } from "./utils.js";

const recoPalette = {
  "Markdown -10%": ["rgba(147,112,219,0.15)", "rgba(147,112,219,0.50)", "#c9a8ff"],
  "Markdown -20%": ["rgba(99,102,241,0.15)", "rgba(99,102,241,0.50)", "#a5b4fc"],
  "Markdown -30%": ["rgba(59,130,246,0.15)", "rgba(59,130,246,0.50)", "#93c5fd"],
  "Mark-up +10%": ["rgba(20,184,166,0.15)", "rgba(20,184,166,0.50)", "#5eead4"],
  "Mark-up +20%": ["rgba(59,130,246,0.15)", "rgba(59,130,246,0.50)", "#93c5fd"],
  "Mark-up +30%": ["rgba(168,85,247,0.15)", "rgba(168,85,247,0.50)", "#d8b4fe"],
};

function RecoChip({ value }) {
  const [bg, border, color] = recoPalette[value] || ["rgba(255,255,255,0.06)", "rgba(255,255,255,0.20)", "rgba(234,242,255,0.80)"];
  return <span className="recoChip" style={{ background: bg, borderColor: border, color }}>{value}</span>;
}

function StatusChip({ value, tone = "neutral" }) {
  return <span className={`statusChip statusChip--${tone}`}>{value}</span>;
}

function getProductBySku(sku) {
  return ALL_PRODUCTS.find((product) => product.sku === sku);
}

function fmtSignedPct(x) {
  if (x == null || Number.isNaN(Number(x))) return "-";
  const sign = Number(x) >= 0 ? "+" : "";
  return `${sign}${(Number(x) * 100).toFixed(1)}%`;
}

function statusTone(value) {
  const normalized = String(value).toLowerCase();
  if (normalized.includes("effective") || normalized === "low") return "good";
  if (normalized.includes("watch") || normalized === "medium") return "warn";
  if (normalized.includes("over") || normalized.includes("follow") || normalized === "high") return "bad";
  return "neutral";
}

function computeMatrixStats() {
  const { cols, rows, values } = MATRIX;
  const zeroColIdx = cols.indexOf("0%");
  const mdRowIdxs = rows.flatMap((r, i) => (parseInt(r, 10) < 0 ? [i] : []));
  const muRowIdxs = rows.flatMap((r, i) => (parseInt(r, 10) > 0 ? [i] : []));
  const mdColIdxs = cols.flatMap((c, i) => (parseInt(c, 10) < 0 ? [i] : []));
  const muColIdxs = cols.flatMap((c, i) => (parseInt(c, 10) > 0 ? [i] : []));
  const mdRequired = mdRowIdxs.reduce((s, ri) => s + (Number(values[ri][zeroColIdx]) || 0), 0);
  const muRequired = muRowIdxs.reduce((s, ri) => s + (Number(values[ri][zeroColIdx]) || 0), 0);
  const mdApplied = mdColIdxs.reduce((s, ci) => s + values.reduce((ss, row) => ss + (Number(row[ci]) || 0), 0), 0);
  const muApplied = muColIdxs.reduce((s, ci) => s + values.reduce((ss, row) => ss + (Number(row[ci]) || 0), 0), 0);
  const inventoryAtRisk = Math.round(mdRequired * 27.5 * 70);
  const marginUpside = Math.round(inventoryAtRisk * 0.238);
  return { mdRequired, muRequired, mdApplied, muApplied, inventoryAtRisk, marginUpside };
}

function Sidebar({ activeTab, onNavigate }) {
  const activeSection = activeTab === "products" || activeTab === "detail"
    ? "products"
    : activeTab === "applied-actions" || activeTab === "applied-detail"
      ? "applied-actions"
      : "overview";
  const items = [
    ["overview", "Dashboard", "dashboard"],
    ["products", "Product List", "products"],
    ["applied-actions", "Applied Actions", "applied"],
  ];

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="sidebar__profile">
        <div className="sidebar__avatar" aria-hidden="true" />
        <div className="sidebar__user">
          <div className="sidebar__name">Name</div>
          <div className="sidebar__role">Pricing Admin</div>
        </div>
        <div className="sidebar__chevron" aria-hidden="true" />
      </div>
      <nav className="sidebar__nav">
        {items.map(([key, label, icon]) => (
          <button
            className={`sidebar__item ${activeSection === key ? "is-active" : ""}`}
            key={key}
            type="button"
            onClick={() => onNavigate(key)}
          >
            <span className={`sidebar__icon sidebar__icon--${icon}`} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar__brand">
        <div className="sidebar__powered">Powered by</div>
        <div className="sidebar__brandRow">
          <div className="sidebar__brandMark" aria-hidden="true" />
          <div className="sidebar__brandName">SK</div>
        </div>
      </div>
    </aside>
  );
}

function PageHeader({ activeTab }) {
  const titles = {
    overview: "Dashboard",
    products: "Product List",
    "applied-actions": "Applied Actions",
    detail: "Product Detail",
    "applied-detail": "Applied Action Detail",
  };

  return (
    <header className="pageHeader">
      <div>
        <h1>{titles[activeTab] || "Dashboard"}</h1>
        <p>Recommended actions based on demand, elasticity, and inventory signals - As of day 60</p>
      </div>
    </header>
  );
}

function KpiRow() {
  const stats = computeMatrixStats();
  const tiles = [
    ["SKUs with a markdown recommendation", fmtInt(stats.mdRequired)],
    ["SKUs with a markup recommendation", fmtInt(stats.muRequired)],
    ["Inventory at risk (EUR)", fmtEUR(stats.inventoryAtRisk)],
    ["Margin upside if recommendations implemented (EUR)", fmtEUR(stats.marginUpside)],
  ];
  return (
    <div className="kpi-row">
      {tiles.map(([label, value]) => (
        <div className="card" key={label}>
          <div className="card__inner">
            <div className="card__label">{label}</div>
            <div className="card__value">{value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TransitionMatrix() {
  const { cols, rows, values } = MATRIX;
  const rowTotals = values.map((row) => row.reduce((s, v) => s + (Number(v) || 0), 0));
  const colTotals = cols.map((_, ci) => values.reduce((s, row) => s + (Number(row[ci]) || 0), 0));
  const maxVal = Math.max(...values.flat().map((v) => Number(v) || 0), 1);
  return (
    <div className="table-wrap">
      <table className="matrix">
        <thead>
          <tr>
            <th className="rowhdr">Proposed</th>
            {cols.map((col) => <th key={col}><span className={`band ${col === "0%" ? "bandZero" : parseInt(col, 10) < 0 ? "bandDown" : "bandUp"}`}>{col}</span></th>)}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row}>
              <th className="rowhdr"><span className={`band ${row === "0%" ? "bandZero" : parseInt(row, 10) < 0 ? "bandDown" : "bandUp"}`}>{row}</span></th>
              {values[ri].map((value, ci) => {
                const n = Number(value) || 0;
                const alpha = row === "0%" && cols[ci] === "0%" ? 0 : clamp(n / maxVal, 0, 1);
                return <td key={cols[ci]} style={{ "--heat": alpha }}>{n > 0 ? fmtInt(n) : ""}</td>;
              })}
              <td className="totalCell">{fmtInt(rowTotals[ri])}</td>
            </tr>
          ))}
          <tr>
            <th className="rowhdr">Total</th>
            {colTotals.map((total, i) => <td className="totalCell" key={cols[i]}>{total > 0 ? fmtInt(total) : ""}</td>)}
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ImpactTiles() {
  const stats = computeMatrixStats();
  const tiles = [
    ["Current Season Day", 60],
    ["SKUs with markdown applied", Math.round(stats.mdApplied)],
    ["SKUs with markup applied", Math.round(stats.muApplied)],
  ];
  return (
    <div className="impact__tiles">
      {tiles.map(([label, value]) => (
        <div className="impact-tile" key={label}>
          <div className="impact-tile__label">{label}</div>
          <div className="impact-tile__value">{fmtInt(value)}</div>
        </div>
      ))}
    </div>
  );
}

function DataTable({ rows, columns, onOpen }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>{columns.map((col) => <th className={col.align || ""} key={col.key}>{col.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id || `${row.type}-${row.sku}`} onClick={() => onOpen?.(row)}>
              {columns.map((col) => {
                const value = row[col.key];
                const content = col.render ? col.render(value, row) : value ?? "-";
                const numericValue = Number(value) || 0;
                const intensity = col.max ? clamp((col.abs ? Math.abs(numericValue) : numericValue) / col.max, 0, 1) : undefined;
                const signClass = col.cellClass === "impactCell" ? (numericValue < 0 ? "is-negative" : "is-positive") : "";
                return (
                  <td key={col.key} className={`${col.align || ""} ${col.cellClass || ""} ${signClass}`} style={intensity == null ? undefined : { "--i": intensity }}>
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AppliedActionsTable({ onOpen }) {
  const maxRevenue = Math.max(...APPLIED_ACTIONS.map((row) => Math.abs(row.revenueImpact) || 0), 1);
  const maxMargin = Math.max(...APPLIED_ACTIONS.map((row) => Math.abs(row.marginImpact) || 0), 1);
  const rows = APPLIED_ACTIONS.map((action) => {
    const product = getProductBySku(action.sku);
    return {
      ...action,
      name: product?.name || action.sku,
      priceMove: `${fmtEUR(action.oldPrice)} -> ${fmtEUR(action.newPrice)}`,
    };
  });
  const columns = [
    { key: "name", label: "Name" },
    { key: "sku", label: "SKU" },
    { key: "action", label: "Applied action", render: (value) => <RecoChip value={value} /> },
    { key: "appliedDay", label: "Applied day", align: "num", render: (value) => `Day ${value}` },
    { key: "priceMove", label: "Price move", align: "num" },
    { key: "rotationDelta", label: "Rotation uplift", align: "num", render: fmtSignedPct },
    { key: "revenueImpact", label: "Revenue impact", align: "num", render: fmtEUR, cellClass: "impactCell", max: maxRevenue, abs: true },
    { key: "marginImpact", label: "Margin impact", align: "num", render: fmtEUR, cellClass: "impactCell", max: maxMargin, abs: true },
    { key: "updatedInventoryForecast", label: "Updated inventory forecast", align: "num", render: fmtPct },
    { key: "riskStatus", label: "Risk", render: (value) => <StatusChip value={value} tone={statusTone(value)} /> },
    { key: "outcome", label: "Outcome", render: (value) => <StatusChip value={value} tone={statusTone(value)} /> },
    { key: "nextAction", label: "Next action" },
  ];

  return <DataTable rows={rows} columns={columns} onOpen={onOpen} />;
}

function OverviewPage({ onOpen, onOpenAppliedAction }) {
  const markdownMax = Math.max(...MARKDOWN_LIST.map((r) => r.margin_up || 0), 1);
  const markupMax = Math.max(...MARKUP_LIST.map((r) => r.margin_up || 0), 1);
  const markdownColumns = [
    { key: "name", label: "Name" }, { key: "sku", label: "SKU" },
    { key: "curr", label: "Initial (EUR)", align: "num", render: fmtEUR },
    { key: "comp", label: "Competitor (EUR)", align: "num", render: fmtEUR },
    { key: "pct_comp", label: "Price vs competitor", align: "num", render: fmtPct },
    { key: "inv_risk_pct", label: "Inventory at risk", align: "num", render: fmtPct, cellClass: "riskCell", max: Math.max(...MARKDOWN_LIST.map((r) => r.inv_risk_pct || 0), 1) },
    { key: "reco", label: "Policy", render: (v) => <RecoChip value={v} /> },
    { key: "final_price", label: "Final (EUR)", align: "num", render: fmtEUR },
    { key: "uplift", label: "Uplift", align: "num", render: fmtPct },
    { key: "margin_up", label: "Margin Uplift (EUR)", align: "num", render: fmtEUR, cellClass: "upsideCell", max: markdownMax },
  ];
  const markupColumns = [
    { key: "name", label: "Name" }, { key: "sku", label: "SKU" },
    { key: "curr", label: "Initial (EUR)", align: "num", render: fmtEUR },
    { key: "comp", label: "Competitor (EUR)", align: "num", render: fmtEUR },
    { key: "pct_comp", label: "Price vs competitor", align: "num", render: fmtPct },
    { key: "rot", label: "Rotation vs Forecast", align: "num", render: fmtPctFromMult },
    { key: "reco", label: "Policy", render: (v) => <RecoChip value={v} /> },
    { key: "final_price", label: "Final (EUR)", align: "num", render: fmtEUR },
    { key: "margin_up", label: "Margin Uplift (EUR)", align: "num", render: fmtEUR, cellClass: "upsideCell", max: markupMax },
  ];

  return (
    <>
      <KpiRow />
      <div className="mid">
        <section className="panel">
          <div className="panel__head">
            <div className="panel__title">Transition Matrix (SKU Count)</div>
            <div className="panel__hint"><span className="muted">Rows:</span> Proposed strategy <span className="dot sep">&bull;</span> <span className="muted">Columns:</span> Current price level</div>
          </div>
          <div className="panel__body"><TransitionMatrix /></div>
        </section>
        <aside className="impact">
          <div className="panel">
            <div className="panel__head"><div className="panel__title">Season status</div></div>
            <div className="panel__body"><ImpactTiles /></div>
          </div>
        </aside>
      </div>
      <section className="panel">
        <div className="panel__head">
          <div className="panel__title">Applied Actions / Post-mortem</div>
          <div className="panel__hint">Actions already executed, measured against post-action sales, revenue, margin, and updated inventory risk.</div>
        </div>
        <div className="panel__body"><AppliedActionsTable onOpen={onOpenAppliedAction} /></div>
      </section>
      <section className="panel">
        <div className="panel__head"><div className="panel__title">Markdown Actions</div></div>
        <div className="panel__body"><DataTable rows={MARKDOWN_LIST.map((p) => ({ ...p, type: "markdown" }))} columns={markdownColumns} onOpen={onOpen} /></div>
      </section>
      <section className="panel">
        <div className="panel__head"><div className="panel__title">Markup Opportunities</div></div>
        <div className="panel__body"><DataTable rows={MARKUP_LIST.map((p) => ({ ...p, type: "markup" }))} columns={markupColumns} onOpen={onOpen} /></div>
      </section>
    </>
  );
}

function AppliedActionsPage({ onOpenAppliedAction }) {
  return (
    <section className="panel">
      <div className="panel__head">
        <div className="panel__title">Applied Actions / Post-mortem</div>
        <div className="panel__hint">Executed markdowns and markups, measured against rotation, revenue, margin, and updated inventory risk.</div>
      </div>
      <div className="panel__body"><AppliedActionsTable onOpen={onOpenAppliedAction} /></div>
    </section>
  );
}

function ProductListPage({ category, search, onCategoryChange, onSearchChange, onOpen }) {
  const filtered = useMemo(() => ALL_PRODUCTS.filter((row) => {
    if (category && row.type !== category) return false;
    if (!search) return true;
    return `${row.sku} ${row.name}`.toLowerCase().includes(search.toLowerCase());
  }), [category, search]);
  const marginMax = Math.max(...filtered.map((r) => Number(r.margin_up) || 0), 1);
  const columns = [
    { key: "sku", label: "SKU" }, { key: "name", label: "Name" },
    { key: "type", label: "Type", render: (v) => <span className="pill"><span className="dot" />{v}</span> },
    { key: "reco", label: "Recommendation", render: (v) => <RecoChip value={v} /> },
    { key: "curr", label: "Current price (EUR)", align: "num", render: fmtEUR },
    { key: "final_price", label: "Final price (EUR)", align: "num", render: fmtEUR },
    { key: "margin_up", label: "Margin upside (EUR)", align: "num", render: fmtEUR, cellClass: "upsideCell", max: marginMax },
  ];
  return (
    <section className="panel">
      <div className="panel__head panel__head--split">
        <div>
          <div className="panel__title">Product List</div>
          <div className="panel__hint">Click any row to open Product Detail.</div>
        </div>
        <div className="filters">
          <select className="select" value={category} onChange={(event) => onCategoryChange(event.target.value)}>
            <option value="">All types</option>
            <option value="markup">Markup</option>
            <option value="markdown">Markdown</option>
          </select>
          <input className="input" type="search" placeholder="Search SKU / name..." value={search} onChange={(event) => onSearchChange(event.target.value)} />
        </div>
      </div>
      <div className="panel__body">
        <DataTable rows={filtered} columns={columns} onOpen={onOpen} />
        <div className="footnote">{filtered.length} of {ALL_PRODUCTS.length} products shown.</div>
      </div>
    </section>
  );
}

function createDetailFromProduct(product) {
  const isMarkup = product.type === "markup";
  const scenarioKey = isMarkup ? "muReco" : "mdReco";
  const margin = Number(product.margin_up) || 0;
  const currentRevenue = Math.max((Number(product.rev_uplift) || margin) * 4, 1);
  const selectedRevenue = currentRevenue + (Number(product.rev_uplift) || 0);
  const currentMargin = Math.max(currentRevenue * 0.32, 1);
  const selectedMargin = currentMargin + margin;
  const currentIndex = Number(product.pct_comp) || 0;
  return {
    sku: product.sku,
    type: product.type,
    name: product.name,
    elasticity: isMarkup ? "Medium" : "High",
    curr_price: product.curr,
    comp_price: product.comp,
    curr_index_vs_comp: currentIndex,
    scenarioCurrent: {
      inv_units: isMarkup ? 0 : Math.round((Number(product.inv_risk_pct) || 0.1) * 250000),
      inv_eur: isMarkup ? 0 : Math.round((Number(product.inv_risk_pct) || 0.1) * 250000 * Number(product.curr || 0)),
      revenue: currentRevenue,
      cost: Math.round(currentRevenue * 0.55),
      margin: currentMargin,
    },
    defaultScenario: scenarioKey,
    scenarios: {
      [scenarioKey]: {
        label: `${product.reco} (Recommended)`,
        price: product.final_price,
        inv_units: isMarkup ? Math.round(currentRevenue * 0.002) : 0,
        inv_eur: isMarkup ? Math.round(currentRevenue * 0.002 * Number(product.final_price || 0)) : 0,
        revenue: selectedRevenue,
        cost: Math.round(currentRevenue * 0.55),
        margin: selectedMargin,
        margin_uplift: margin,
        proposed_index: Number(product.comp) ? (Number(product.final_price) - Number(product.comp)) / Number(product.comp) : currentIndex,
      },
    },
    series: [
      { d: 0, cur: 100, [scenarioKey]: 100 },
      { d: 30, cur: isMarkup ? 62 : 88, [scenarioKey]: isMarkup ? 64 : 86 },
      { d: 60, cur: isMarkup ? 38 : 78, [scenarioKey]: isMarkup ? 42 : 72 },
      { d: 90, cur: isMarkup ? 16 : 64, [scenarioKey]: isMarkup ? 24 : 48 },
      { d: 120, cur: isMarkup ? 2 : 46, [scenarioKey]: isMarkup ? 14 : 24 },
      { d: 150, cur: isMarkup ? 0 : 28, [scenarioKey]: isMarkup ? 6 : 8 },
      { d: 180, cur: isMarkup ? 0 : 18, [scenarioKey]: isMarkup ? 0 : 0 },
    ],
  };
}

function enrichDetail(product, detailExtra) {
  const detail = {
    sku: product.sku,
    type: product.type,
    name: product.name,
    elasticity: detailExtra.elasticity,
    curr_price: product.curr,
    comp_price: product.comp,
    curr_index_vs_comp: product.pct_comp,
    scenarioCurrent: detailExtra.scenarioCurrent,
    defaultScenario: detailExtra.defaultScenario,
    series: detailExtra.series,
    scenarios: {},
  };

  detail.scenarios = Object.fromEntries(
    Object.entries(detailExtra.scenarios).map(([key, scenario]) => {
      const isDefault = key === detail.defaultScenario;
      const price = scenario.price ?? (isDefault ? product.final_price : undefined);
      const marginUplift = scenario.margin_uplift ?? (isDefault ? product.margin_up : undefined);
      const proposedIndex = scenario.proposed_index ?? (
        price != null && product.comp ? (Number(price) - Number(product.comp)) / Number(product.comp) : undefined
      );

      return [
        key,
        {
          ...scenario,
          price,
          margin_uplift: marginUplift,
          proposed_index: proposedIndex,
        },
      ];
    })
  );

  return detail;
}

function getDetailForProduct(product) {
  if (!product) return null;
  const detailExtra = PRODUCT_DETAILS[product.sku];
  return detailExtra ? enrichDetail(product, detailExtra) : createDetailFromProduct(product);
}

function InventoryChart({ detail, scenarioKey }) {
  const W = 980;
  const H = 360;
  const pad = { l: 52, r: 16, t: 14, b: 32 };
  const toX = (day) => pad.l + (day / 180) * (W - pad.l - pad.r);
  const toY = (value) => pad.t + (1 - value / 100) * (H - pad.t - pad.b);
  const makePath = (field) => detail.series
    .filter((point) => point[field] != null && !Number.isNaN(Number(point[field])))
    .map((point, index) => `${index ? "L" : "M"}${toX(point.d).toFixed(1)} ${toY(point[field]).toFixed(1)}`)
    .join(" ");
  const xTicks = [0, 30, 60, 90, 120, 150, 180];
  const yTicks = [0, 25, 50, 75, 100];

  return (
    <svg className="chartSvg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Inventory evolution">
      {xTicks.map((x) => <line className="chartGrid" key={`x-${x}`} x1={toX(x)} y1={pad.t} x2={toX(x)} y2={H - pad.b} />)}
      {yTicks.map((y) => <line className="chartGrid" key={`y-${y}`} x1={pad.l} y1={toY(y)} x2={W - pad.r} y2={toY(y)} />)}
      <line x1={toX(60)} y1={pad.t} x2={toX(60)} y2={H - pad.b} stroke="rgba(255,255,255,0.20)" strokeDasharray="4 3" />
      <text x={toX(60) + 4} y={pad.t + 14} fontSize="10" fill="rgba(234,242,255,0.50)" fontWeight="700">Day 60</text>
      {yTicks.map((y) => <text className="chartAxisText" key={`yl-${y}`} x={pad.l - 8} y={toY(y) + 4} textAnchor="end">{y}%</text>)}
      {xTicks.map((x) => <text className="chartAxisText" key={`xl-${x}`} x={toX(x)} y={H - 8} textAnchor="middle">{x}</text>)}
      <path className="chartLineCur" d={makePath("cur")} />
      <path className="chartLineSel" d={makePath(scenarioKey)} />
    </svg>
  );
}

function ProductDetailPage({ selectedProduct, scenarioKey, onScenarioChange, onBack }) {
  const detail = getDetailForProduct(selectedProduct);
  const selectedKey = detail.scenarios[scenarioKey] ? scenarioKey : detail.defaultScenario;
  const scenario = detail.scenarios[selectedKey];
  const rows = [
    ["Obsolete inv. (units)", fmtInt(detail.scenarioCurrent.inv_units), fmtInt(scenario.inv_units)],
    ["Obsolete inv. (EUR)", fmtEUR(detail.scenarioCurrent.inv_eur), fmtEUR(scenario.inv_eur)],
    ["Revenue (EUR)", fmtEUR(detail.scenarioCurrent.revenue), fmtEUR(scenario.revenue)],
    ["Cost (EUR)", fmtEUR(detail.scenarioCurrent.cost), fmtEUR(scenario.cost)],
    ["Margin (EUR)", fmtEUR(detail.scenarioCurrent.margin), fmtEUR(scenario.margin)],
  ];

  return (
    <section className="panel">
      <div className="panel__head panel__head--split">
        <div><div className="panel__title">Product Detail</div></div>
        <button className="btn btn--ghost" onClick={onBack}>Back to Product List</button>
      </div>
      <div className="panel__body">
        <div className="detailShell">
          <div className="detailHeaderLarge detailHeaderLarge--kpi">
            <div className="detailTopBar">
              <div className="detailTopBarLeft">
                <button className="detailBackBtn" type="button" onClick={onBack}>Back to products</button>
                <div className="detailProductName">{detail.name}</div>
              </div>
              <div className="detailScenarioPill">
                <div className="detailScenarioPill__label">Scenario</div>
                <select className="detailScenarioPill__select" value={selectedKey} onChange={(event) => onScenarioChange(event.target.value)}>
                  {Object.entries(detail.scenarios).map(([key, value]) => <option value={key} key={key}>{value.label}</option>)}
                </select>
              </div>
            </div>
            <div className="detailHeroStats">
              <HeroStat label="Elasticity" value={detail.elasticity} purple />
              <div className="heroDivider" />
              <HeroStat label="SKU" value={detail.sku} sub={`Current price: ${fmtEUR(detail.curr_price)}`} />
              <div className="heroDivider" />
              <HeroStat label="Current price vs competitor" value={fmtIndex(detail.curr_index_vs_comp)} sub={`Competitor price: ${fmtEUR(detail.comp_price)}`} />
              <div className="heroDivider" />
              <HeroStat label="Proposed price vs competitor" value={fmtIndex(scenario.proposed_index)} sub={`Proposed price: ${fmtEUR(scenario.price)}`} blue />
            </div>
          </div>
          <div className="detailGrid2">
            <div className="detailCard">
              <div className="detailCardHead"><div className="detailCardTitle">Inventory Evolution <span className="muted">(% remaining, days 0-180)</span></div></div>
              <div className="detailCardBody">
                <InventoryChart detail={detail} scenarioKey={selectedKey} />
                <div className="chartLegend">
                  <div className="legendItem"><span className="legendSwatch cur" />Current scenario</div>
                  <div className="legendItem"><span className="legendSwatch sel" />{scenario.label}</div>
                </div>
              </div>
            </div>
            <div className="detailCard">
              <div className="detailCardHead"><div className="detailCardTitle">Scenario Comparison - End of Season</div></div>
              <div className="detailCardBody">
                <table className="detailTbl">
                  <thead><tr><th>Metric</th><th className="num">Current</th><th className="num">{scenario.label}</th></tr></thead>
                  <tbody>{rows.map(([label, current, selected]) => <tr key={label}><th>{label}</th><td className="num">{current}</td><td className="num">{selected}</td></tr>)}</tbody>
                </table>
                <div className="detailKpiRow">
                  <div className="detailKpiLabel">Incremental margin</div>
                  <div className="detailKpiVal" style={{ color: scenario.margin_uplift >= 0 ? "var(--accent)" : "#FF7070" }}>{fmtEUR(scenario.margin_uplift)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AppliedSalesChart({ action }) {
  const W = 980;
  const H = 360;
  const pad = { l: 52, r: 16, t: 14, b: 32 };
  const currentDay = 60;
  const fields = ["actual", "noAction", "noChange", "recommended"];
  const allValues = action.timeline.flatMap((point) => fields.map((field) => point[field]).filter((value) => value != null));
  const maxY = Math.max(100, Math.ceil(Math.max(...allValues, 1) / 25) * 25);
  const toX = (day) => pad.l + (day / 180) * (W - pad.l - pad.r);
  const toY = (value) => pad.t + (1 - value / maxY) * (H - pad.t - pad.b);
  const makePath = (field) => action.timeline
    .filter((point) => point[field] != null && !Number.isNaN(Number(point[field])))
    .map((point, index) => `${index ? "L" : "M"}${toX(point.d).toFixed(1)} ${toY(point[field]).toFixed(1)}`)
    .join(" ");
  const xTicks = [0, 30, 60, 90, 120, 150, 180];
  const yTicks = [0, 25, 50, 75, 100];
  const paths = [
    ["actual", "chartLineActual"],
    ["noAction", "chartLineNoAction"],
    ["noChange", "chartLineNoChange"],
    ["recommended", "chartLineRecommended"],
  ].map(([field, className]) => [makePath(field), className]);

  return (
    <svg className="chartSvg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Applied action post-mortem inventory chart">
      {xTicks.map((x) => <line className="chartGrid" key={`x-${x}`} x1={toX(x)} y1={pad.t} x2={toX(x)} y2={H - pad.b} />)}
      {yTicks.map((y) => <line className="chartGrid" key={`y-${y}`} x1={pad.l} y1={toY(y)} x2={W - pad.r} y2={toY(y)} />)}
      <line x1={toX(action.appliedDay)} y1={pad.t} x2={toX(action.appliedDay)} y2={H - pad.b} stroke="rgba(255,255,255,0.24)" strokeDasharray="4 3" />
      <text x={toX(action.appliedDay) + 4} y={pad.t + 14} fontSize="10" fill="rgba(234,242,255,0.55)" fontWeight="700">Action day {action.appliedDay}</text>
      <line x1={toX(currentDay)} y1={pad.t} x2={toX(currentDay)} y2={H - pad.b} stroke="rgba(66,217,200,0.38)" strokeDasharray="3 3" />
      <text x={toX(currentDay) + 4} y={pad.t + 29} fontSize="10" fill="rgba(66,217,200,0.70)" fontWeight="700">Today day 60</text>
      {yTicks.map((y) => <text className="chartAxisText" key={`yl-${y}`} x={pad.l - 8} y={toY(y) + 4} textAnchor="end">{y}%</text>)}
      {xTicks.map((x) => <text className="chartAxisText" key={`xl-${x}`} x={toX(x)} y={H - 8} textAnchor="middle">{x}</text>)}
      {paths.map(([path, className]) => path ? <path className={className} d={path} key={className} /> : null)}
    </svg>
  );
}

function AppliedActionDetailPage({ selectedAction, onBack }) {
  const action = selectedAction;
  const product = getProductBySku(action.sku);
  const hasRecommendedPath = action.timeline.some((point) => point.recommended != null);
  const rows = [
    ["Rotation before", fmtPctFromMult(action.preRotation)],
    ["Rotation after", fmtPctFromMult(action.postRotation)],
    ["Rotation delta", fmtSignedPct(action.rotationDelta)],
    ["Revenue impact", fmtEUR(action.revenueImpact)],
    ["Margin impact", fmtEUR(action.marginImpact)],
    ["Updated inventory forecast", fmtPct(action.updatedInventoryForecast)],
    ["Effectiveness score", fmtPct(action.effectiveness)],
  ];

  return (
    <section className="panel">
      <div className="panel__head panel__head--split">
        <div>
          <div className="panel__title">Applied Action Detail</div>
          <div className="panel__hint">Observed post-action performance and recommended next move.</div>
        </div>
        <button className="btn btn--ghost" onClick={onBack}>Back to Overview</button>
      </div>
      <div className="panel__body">
        <div className="detailShell">
          <div className="detailHeaderLarge detailHeaderLarge--kpi">
            <div className="detailTopBar">
              <div className="detailTopBarLeft">
                <button className="detailBackBtn" type="button" onClick={onBack}>Back to overview</button>
                <div className="detailProductName">{product?.name || action.sku}</div>
                <div className="appliedMeta">
                  <StatusChip value={action.outcome} tone={statusTone(action.outcome)} />
                  <StatusChip value={`Risk: ${action.riskStatus}`} tone={statusTone(action.riskStatus)} />
                </div>
              </div>
              <div className="detailScenarioPill">
                <div className="detailScenarioPill__label">Applied</div>
                <div className="appliedActionName">{action.action}</div>
              </div>
            </div>
            <div className="detailHeroStats">
              <HeroStat label="SKU" value={action.sku} sub={`Applied day: ${action.appliedDay}`} />
              <div className="heroDivider" />
              <HeroStat label="Price move" value={`${fmtEUR(action.oldPrice)} -> ${fmtEUR(action.newPrice)}`} />
              <div className="heroDivider" />
              <HeroStat label="Rotation delta" value={fmtSignedPct(action.rotationDelta)} sub={`${fmtPctFromMult(action.preRotation)} to ${fmtPctFromMult(action.postRotation)}`} blue={action.rotationDelta >= 0} />
              <div className="heroDivider" />
              <HeroStat label="Next action" value={action.nextAction} purple={statusTone(action.outcome) !== "good"} />
            </div>
          </div>
          <div className="detailGrid2">
            <div className="detailCard">
              <div className="detailCardHead">
                <div className="detailCardTitle">Inventory Response <span className="muted">(% remaining, days 0-180)</span></div>
              </div>
              <div className="detailCardBody">
                <AppliedSalesChart action={action} />
                <div className="chartLegend">
                  <div className="legendItem"><span className="legendSwatch actual" />Observed until today</div>
                  <div className="legendItem"><span className="legendSwatch noAction" />No-action counterfactual</div>
                  <div className="legendItem"><span className="legendSwatch noChange" />No further change forecast</div>
                  {hasRecommendedPath && <div className="legendItem"><span className="legendSwatch recommended" />Recommended action forecast</div>}
                </div>
              </div>
            </div>
            <div className="detailCard">
              <div className="detailCardHead"><div className="detailCardTitle">Pre / Post Metrics</div></div>
              <div className="detailCardBody">
                <table className="detailTbl">
                  <tbody>{rows.map(([label, value]) => <tr key={label}><th>{label}</th><td className="num">{value}</td></tr>)}</tbody>
                </table>
                <div className="insightBlock">
                  <div className="insightBlock__label">Insight</div>
                  <div className="insightBlock__text">{action.insight}</div>
                </div>
                <div className="detailKpiRow">
                  <div className="detailKpiLabel">Recommended next move</div>
                  <div className="detailKpiVal">{action.nextAction}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroStat({ label, value, sub, purple, blue }) {
  return (
    <div className="heroStat">
      <div className="heroStat__label">{label}</div>
      <div className={`heroStat__big ${purple ? "heroStat__big--purple" : ""}`} style={blue ? { color: "#7aa2ff" } : undefined}>{value}</div>
      {sub && <div className="heroStat__sub">{sub}</div>}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedAppliedAction, setSelectedAppliedAction] = useState(null);
  const [scenarioKey, setScenarioKey] = useState("md10");

  function openProduct(product) {
    setSelectedProduct(product);
    const detail = getDetailForProduct(product);
    setScenarioKey(detail.defaultScenario);
    setActiveTab("detail");
  }

  function openAppliedAction(action) {
    setSelectedAppliedAction(action);
    setActiveTab("applied-detail");
  }

  return (
    <div className="appShell">
      <Sidebar activeTab={activeTab} onNavigate={setActiveTab} />
      <div className="mainShell">
        <PageHeader activeTab={activeTab} />
        <main className="content">
          {activeTab === "overview" && <OverviewPage onOpen={openProduct} onOpenAppliedAction={openAppliedAction} />}
          {activeTab === "products" && <ProductListPage category={category} search={search} onCategoryChange={setCategory} onSearchChange={setSearch} onOpen={openProduct} />}
          {activeTab === "applied-actions" && <AppliedActionsPage onOpenAppliedAction={openAppliedAction} />}
          {activeTab === "detail" && selectedProduct && <ProductDetailPage selectedProduct={selectedProduct} scenarioKey={scenarioKey} onScenarioChange={setScenarioKey} onBack={() => setActiveTab("products")} />}
          {activeTab === "applied-detail" && selectedAppliedAction && <AppliedActionDetailPage selectedAction={selectedAppliedAction} onBack={() => setActiveTab("applied-actions")} />}
        </main>
      </div>
    </div>
  );
}
