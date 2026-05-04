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

const scenarioColors = ["#42d9c8", "#9f7cff", "#f4b84a", "#ff7aa2"];
const CATEGORY_OPTIONS = ["Clothing", "Footwear", "Accessories"];
const CURRENT_DAY = 56;

function getScenarioColor(index) {
  return scenarioColors[index % scenarioColors.length];
}

function RecoChip({ value, colorKey = value }) {
  const fallback = String(value).startsWith("Markdown")
    ? ["rgba(20,184,166,0.15)", "rgba(20,184,166,0.50)", "#5eead4"]
    : String(value).startsWith("Mark-up")
      ? ["rgba(168,85,247,0.15)", "rgba(168,85,247,0.50)", "#d8b4fe"]
      : ["rgba(255,255,255,0.06)", "rgba(255,255,255,0.20)", "rgba(234,242,255,0.80)"];
  const [bg, border, color] = recoPalette[colorKey] || recoPalette[value] || fallback;
  return <span className="recoChip" style={{ background: bg, borderColor: border, color }}>{value}</span>;
}

function StatusChip({ value, tone = "neutral" }) {
  return <span className={`statusChip statusChip--${tone}`}>{value}</span>;
}

function CategoryChip({ value }) {
  return <span className="categoryChip">{value || "-"}</span>;
}

function getProductBySku(sku) {
  return ALL_PRODUCTS.find((product) => product.sku === sku);
}

function fmtSignedPct(x) {
  if (x == null || Number.isNaN(Number(x))) return "-";
  const sign = Number(x) >= 0 ? "+" : "";
  return `${sign}${(Number(x) * 100).toFixed(1)}%`;
}

function fmtEURWhole(x) {
  if (x == null || Number.isNaN(Number(x))) return "-";
  return Number(x).toLocaleString("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function fmtCompactEUR(x) {
  if (x == null || Number.isNaN(Number(x))) return "-";
  return Number(x).toLocaleString("en-US", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

function formatActionPct(x) {
  if (x == null || Number.isNaN(Number(x))) return null;
  const sign = Number(x) >= 0 ? "+" : "";
  return `${sign}${(Number(x) * 100).toFixed(1)}%`;
}

function getExactActionLabel(product) {
  const exactPct = formatActionPct(product.exact_action_pct);
  if (!exactPct) return product.reco;
  return `${product.type === "markup" ? "Mark-up" : "Markdown"} ${exactPct}`;
}

function getCompactScenarioLabel(label) {
  return String(label)
    .replace(/\s*\(Recommended\)\s*/i, "")
    .replace(/^Markdown\s+/i, "")
    .replace(/^Mark-up\s+/i, "");
}

function RecoChipForProduct({ product }) {
  return <RecoChip value={getExactActionLabel(product)} colorKey={product.reco} />;
}

function actionTone(type) {
  return type === "markup" ? "markup" : "markdown";
}

function statusTone(value) {
  const normalized = String(value).toLowerCase();
  if (normalized.includes("effective") || normalized === "low") return "good";
  if (normalized.includes("watch") || normalized === "medium") return "warn";
  if (normalized.includes("over") || normalized.includes("follow") || normalized === "high") return "bad";
  return "neutral";
}

function competitorIndexTone(index) {
  if (index <= -0.05) return "good";
  if (index <= 0) return "warn";
  return "bad";
}

function competitorIndexLabel(index) {
  if (index <= -0.05) return "target";
  if (index <= 0) return "below target";
  return "above competitor";
}

function PriceMove({ oldPrice, newPrice, competitorPrice, variant = "table" }) {
  const competitorIndex = competitorPrice ? (Number(newPrice) - Number(competitorPrice)) / Number(competitorPrice) : null;
  const tone = competitorIndex == null ? "neutral" : competitorIndexTone(competitorIndex);
  const direction = Number(newPrice) >= Number(oldPrice) ? "up" : "down";

  return (
    <div className={`priceMove priceMove--${variant}`}>
      <div className="priceMove__row">
        <span>{fmtEUR(oldPrice)}</span>
        <span className={`priceMove__arrow priceMove__arrow--${direction}`} aria-hidden="true" />
        <span>{fmtEUR(newPrice)}</span>
      </div>
      {competitorIndex != null && (
        <div className={`priceMove__competitor priceMove__competitor--${tone}`}>
          New price is {fmtSignedPct(competitorIndex)} vs competitor price
        </div>
      )}
    </div>
  );
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
  const mdActionsNeeded = mdRowIdxs.reduce((sum, ri) => sum + values[ri].reduce((rowSum, value, ci) => rowSum + (ri === ci ? 0 : Number(value) || 0), 0), 0);
  const muActionsNeeded = muRowIdxs.reduce((sum, ri) => sum + values[ri].reduce((rowSum, value, ci) => rowSum + (ri === ci ? 0 : Number(value) || 0), 0), 0);
  const inventoryAtRisk = Math.round(mdRequired * 27.5 * 70);
  const marginUpside = Math.round(inventoryAtRisk * 0.238);
  return { mdRequired, muRequired, mdApplied, muApplied, mdActionsNeeded, muActionsNeeded, inventoryAtRisk, marginUpside };
}

function sumBy(rows, getter) {
  return rows.reduce((sum, row) => sum + (Number(getter(row)) || 0), 0);
}

function avgNumbers(values) {
  const valid = values.filter((value) => value != null && !Number.isNaN(Number(value)));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + Number(value), 0) / valid.length;
}

function timelinePoint(action, day) {
  return action.timeline.find((point) => point.d === day);
}

function getDashboardMetrics() {
  const matrixStats = computeMatrixStats();
  const recommendations = [...MARKDOWN_LIST, ...MARKUP_LIST];
  const appliedRevenue = sumBy(APPLIED_ACTIONS, (action) => action.revenueImpact);
  const appliedMargin = sumBy(APPLIED_ACTIONS, (action) => action.marginImpact);
  const expectedRevenue = sumBy(recommendations, (product) => product.rev_uplift);
  const expectedMargin = sumBy(recommendations, (product) => product.margin_up);
  const successfulActions = APPLIED_ACTIONS.filter((action) => Number(action.effectiveness) >= 0.65).length;
  const successRate = APPLIED_ACTIONS.length ? successfulActions / APPLIED_ACTIONS.length : 0;
  const remainingToday = avgNumbers(APPLIED_ACTIONS.map((action) => timelinePoint(action, CURRENT_DAY)?.actual));
  const sellThrough = remainingToday == null ? null : 1 - remainingToday / 100;
  const noChangeEnd = avgNumbers(APPLIED_ACTIONS.map((action) => timelinePoint(action, 180)?.noChange));
  const recommendedEnd = avgNumbers(APPLIED_ACTIONS.map((action) => {
    const point = timelinePoint(action, 180);
    return point?.recommended ?? point?.noChange;
  }));
  const currentAboveCompetitor = ALL_PRODUCTS.filter((product) => Number(product.pct_comp) > 0).length;
  const avgPriceIndex = avgNumbers(ALL_PRODUCTS.map((product) => product.pct_comp)) ?? 0;
  const recommendationUpsideTotal = 463648;
  const actionsNeededTotal = matrixStats.mdActionsNeeded + matrixStats.muActionsNeeded;
  const markdownUpside = actionsNeededTotal ? Math.round(recommendationUpsideTotal * (matrixStats.mdActionsNeeded / actionsNeededTotal)) : 0;
  const markupUpside = recommendationUpsideTotal - markdownUpside;
  const appliedActionTotal = matrixStats.mdApplied + matrixStats.muApplied;
  const highRiskApplied = Math.round(appliedActionTotal * 0.0335);
  const mediumRiskApplied = Math.round(appliedActionTotal * 0.1216);
  const lowRiskApplied = appliedActionTotal - highRiskApplied - mediumRiskApplied;
  const riskRows = [
    { label: "High", count: highRiskApplied, tone: "high" },
    { label: "Medium", count: mediumRiskApplied, tone: "medium" },
    { label: "Low", count: lowRiskApplied, tone: "low" },
  ];
  const recommendationMix = [
    {
      label: "Markdown",
      count: matrixStats.mdActionsNeeded,
      margin: markdownUpside,
      tone: "markdown",
    },
    {
      label: "Markup",
      count: matrixStats.muActionsNeeded,
      margin: markupUpside,
      tone: "markup",
    },
  ];

  return {
    matrixStats,
    appliedRevenue,
    appliedMargin,
    expectedRevenue,
    expectedMargin,
    successfulActions,
    successRate,
    remainingToday,
    sellThrough,
    noChangeEnd,
    recommendedEnd,
    currentAboveCompetitor,
    avgPriceIndex,
    riskRows,
    recommendationMix,
    totalApplied: appliedActionTotal,
    totalRecommendations: recommendations.length,
  };
}

function Sidebar({ activeTab, onNavigate }) {
  const [openGroups, setOpenGroups] = useState({ recommendations: true, applied: true });
  const activeSection = activeTab === "products" || activeTab === "detail"
    ? "products"
    : activeTab.startsWith("applied") || activeTab === "applied-detail"
      ? "applied-actions"
      : activeTab.startsWith("recommendations")
        ? "recommendations"
      : "overview";
  const recommendationTabs = [
    ["recommendations-markdown", "Markdowns"],
    ["recommendations-markup", "Markups"],
  ];
  const appliedTabs = [
    ["applied-markdown", "Markdowns"],
    ["applied-markup", "Markups"],
  ];
  function toggleGroup(group) {
    setOpenGroups((current) => ({ ...current, [group]: !current[group] }));
  }

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
        <button
          className={`sidebar__item ${activeSection === "overview" ? "is-active" : ""}`}
          type="button"
          onClick={() => onNavigate("overview")}
        >
          <span className="sidebar__icon sidebar__icon--dashboard" />
          <span>Dashboard</span>
        </button>
        <div className={`sidebar__group ${activeSection === "recommendations" ? "is-active" : ""}`}>
          <button
            className="sidebar__item sidebar__item--parent"
            type="button"
            onClick={() => {
              toggleGroup("recommendations");
              onNavigate("recommendations");
            }}
          >
            <span className="sidebar__icon sidebar__icon--recommendations" />
            <span>Recommendations</span>
            <span className={`sidebar__disclosure ${openGroups.recommendations ? "is-open" : ""}`} />
          </button>
          {openGroups.recommendations && (
            <div className="sidebar__submenu">
              {recommendationTabs.map(([key, label]) => (
                <button className={`sidebar__subitem ${activeTab === key ? "is-active" : ""}`} key={key} type="button" onClick={() => onNavigate(key)}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className={`sidebar__group ${activeSection === "applied-actions" ? "is-active" : ""}`}>
          <button
            className="sidebar__item sidebar__item--parent"
            type="button"
            onClick={() => {
              toggleGroup("applied");
              onNavigate("applied-actions");
            }}
          >
            <span className="sidebar__icon sidebar__icon--applied" />
            <span>Applied Actions</span>
            <span className={`sidebar__disclosure ${openGroups.applied ? "is-open" : ""}`} />
          </button>
          {openGroups.applied && (
            <div className="sidebar__submenu">
              {appliedTabs.map(([key, label]) => (
                <button className={`sidebar__subitem ${activeTab === key ? "is-active" : ""}`} key={key} type="button" onClick={() => onNavigate(key)}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className={`sidebar__item ${activeSection === "products" ? "is-active" : ""}`}
          type="button"
          onClick={() => onNavigate("products")}
        >
          <span className="sidebar__icon sidebar__icon--products" />
          <span>Products</span>
        </button>
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
    products: "Products",
    recommendations: "Recommendations",
    "recommendations-markdown": "Markdown Recommendations",
    "recommendations-markup": "Markup Recommendations",
    "applied-actions": "Applied Actions",
    "applied-markdown": "Applied Markdowns",
    "applied-markup": "Applied Markups",
    detail: "Product Detail",
    "applied-detail": "Applied Action Detail",
    "matrix-detail": "Matrix Detail",
    "matrix-markup-detail": "Matrix Detail",
  };

  return (
    <header className="pageHeader">
      <div>
        <h1>{titles[activeTab] || "Dashboard"}</h1>
        <p>Current season day {CURRENT_DAY}</p>
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

function TransitionMatrix({ onOpenCell }) {
  const { cols, rows, values } = MATRIX;
  const rowTotals = values.map((row) => row.reduce((s, v) => s + (Number(v) || 0), 0));
  const colTotals = cols.map((_, ci) => values.reduce((s, row) => s + (Number(row[ci]) || 0), 0));
  const offDiagonalValues = values.flatMap((row, ri) => row.map((value, ci) => (ri === ci ? 0 : Number(value) || 0))).filter((value) => value > 0);
  const heatMax = Math.max(...offDiagonalValues, 1);
  function mixColor(a, b, t) {
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return [r, g, bl];
  }
  function policyBandStyle(label) {
    const pct = parseInt(label, 10);
    const neutral = [190, 198, 207];
    const markdown = [122, 162, 255];
    const markup = [66, 217, 200];
    const tone = pct < 0
      ? mixColor(neutral, markdown, Math.min(Math.abs(pct) / 60, 1))
      : mixColor(neutral, markup, Math.min(pct / 60, 1));
    const glow = pct < 0 ? "rgba(122, 162, 255, 0.20)" : pct > 0 ? "rgba(66, 217, 200, 0.20)" : "rgba(234, 242, 255, 0.14)";
    return {
      "--policy-bg": `linear-gradient(180deg, rgba(${tone[0]}, ${tone[1]}, ${tone[2]}, 0.92), rgba(${tone[0]}, ${tone[1]}, ${tone[2]}, 0.70))`,
      "--policy-glow": glow,
    };
  }
  function policyBandLabel(label) {
    const pct = parseInt(label, 10);
    if (pct === 0) return "0.0%";
    if (pct < 0) return `${(pct + 9.9).toFixed(1)}% to ${pct}%`;
    return `${(pct - 9.9).toFixed(1)}% to ${pct}%`;
  }
  return (
    <>
      <div className="table-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th className="matrix__axisCorner" colSpan="2" />
              <th className="matrix__superHeader" colSpan={cols.length}>Current policy week 8</th>
              <th className="matrix__totalHeader">Total</th>
            </tr>
            <tr>
              <th className="matrix__axisSpacer" />
              <th className="rowhdr matrix__rowAxisLabel" />
              {cols.map((col, index) => (
                <th key={col}>
                  <span className={`band band--policy ${index === 0 ? "band--first" : ""} ${index === cols.length - 1 ? "band--last" : ""}`} style={policyBandStyle(col)}>{policyBandLabel(col)}</span>
                </th>
              ))}
              <th className="matrix__totalHeader" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={row}>
                {ri === 0 && (
                  <th className="matrix__yAxis" rowSpan={rows.length + 1}>
                    <span>Proposed policy week 9</span>
                  </th>
                )}
                <th className="rowhdr">
                  <span className={`band band--policy ${ri === 0 ? "band--top" : ""} ${ri === rows.length - 1 ? "band--bottom" : ""}`} style={policyBandStyle(row)}>{policyBandLabel(row)}</span>
                </th>
                {values[ri].map((value, ci) => {
                  const n = Number(value) || 0;
                  const rowPct = parseInt(row, 10);
                  const isDiagonal = ri === ci;
                  const isZero = n === 0;
                  const clickTarget = row === "-20%" && cols[ci] === "-10%" && n === 21
                    ? "markdown"
                    : row === "+10%" && cols[ci] === "+10%" && n === 142
                      ? "markup"
                      : null;
                  const isClickableCell = Boolean(clickTarget);
                  const alpha = isZero ? 0 : isDiagonal ? 0.18 : clamp(Math.log1p(n) / Math.log1p(heatMax), 0.08, 1);
                  const actionClass = isDiagonal ? "matrixCell--diagonal" : rowPct < 0 ? "matrixCell--markdown" : rowPct > 0 ? "matrixCell--markup" : "matrixCell--neutral";
                  return (
                    <td
                      className={`matrixCell ${actionClass} ${!isDiagonal && !isZero ? "matrixCell--action" : ""} ${isClickableCell ? "matrixCell--clickable" : ""}`}
                      key={cols[ci]}
                      onClick={isClickableCell ? () => onOpenCell?.(clickTarget) : undefined}
                      role={isClickableCell ? "button" : undefined}
                      tabIndex={isClickableCell ? 0 : undefined}
                      onKeyDown={isClickableCell ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onOpenCell?.(clickTarget);
                        }
                      } : undefined}
                      style={{ "--heat": alpha }}
                    >
                      {n > 0 ? fmtInt(n) : ""}
                    </td>
                  );
                })}
                <td className="totalCell">{fmtInt(rowTotals[ri])}</td>
              </tr>
            ))}
            <tr>
              <th className="rowhdr">Total</th>
              {colTotals.map((total, i) => <td className="totalCell" key={cols[i]}>{fmtInt(total)}</td>)}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <div className="matrixLegend" aria-label="Transition matrix legend">
        <div className="matrixLegend__item"><span className="matrixLegend__swatch matrixLegend__swatch--diagonal" />Aligned policy</div>
        <div className="matrixLegend__item"><span className="matrixLegend__swatch matrixLegend__swatch--action" />Action required</div>
        <div className="matrixLegend__item"><span className="matrixLegend__swatch matrixLegend__swatch--heat" />Darker cell means higher SKU count</div>
      </div>
    </>
  );
}

function ImpactTiles() {
  const stats = computeMatrixStats();
  const tiles = [
    ["Current Season Day", CURRENT_DAY],
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

const PRICING_ACTION_SUMMARY = [
  {
    action: "Markup",
    tone: "markup",
    applied: { skus: "826", rot: "-3%", rev: "€328,399", margin: "4.55", iar: "€73,770" },
    proposed: { skus: "792", rot: "-3%", rev: "€314,882", margin: "4.55", iar: "€70,734" },
  },
  {
    action: "Markdown",
    tone: "markdown",
    applied: { skus: "2,043", rot: "90%", rev: "€9,274,219", margin: "-8.82", iar: "€608,201" },
    proposed: { skus: "1,801", rot: "98.0%", rev: "€8,175,658", margin: "-8.82", iar: "€536,158" },
  },
  {
    action: "Net",
    tone: "net",
    applied: { skus: "2,869", rot: "63.2%", rev: "€9,602,618", margin: "-4.97", iar: "€681,971" },
    proposed: { skus: "2,593", rot: "67.2%", rev: "€8,490,539", margin: "-4.74", iar: "€606,891" },
  },
];

function DeltaValue({ value }) {
  const normalized = String(value);
  const isNegative = normalized.startsWith("-");
  const isPositive = !isNegative && normalized !== "-";
  return <span className={`pricingSummary__delta ${isPositive ? "is-positive" : ""} ${isNegative ? "is-negative" : ""}`}>{value}</span>;
}

function PricingActionsSummary() {
  return (
    <section className="pricingSummary">
      <div className="pricingSummary__header">
        <div>
          <div className="pricingSummary__title">Up to date pricing actions summary</div>
          <div className="pricingSummary__subtitle">Applied performance and today&apos;s proposed pricing actions</div>
        </div>
        <div className="pricingSummary__count">28,790 SKUs</div>
      </div>
      <div className="pricingSummary__tableWrap">
        <table className="pricingSummary__table">
          <thead>
            <tr>
              <th className="pricingSummary__actionHead" rowSpan="2">Action</th>
              <th className="pricingSummary__groupHead" colSpan="5">Applied (cumulative)</th>
              <th className="pricingSummary__groupHead pricingSummary__groupHead--proposed" colSpan="5">Proposed (today)</th>
            </tr>
            <tr>
              <th>SKUs</th>
              <th>Δ rot</th>
              <th>Δ rev</th>
              <th>Δ margin</th>
              <th>IaR</th>
              <th className="pricingSummary__proposedStart">SKUs</th>
              <th>Δ rot</th>
              <th>Δ rev</th>
              <th>Δ margin</th>
              <th>IaR</th>
            </tr>
          </thead>
          <tbody>
            {PRICING_ACTION_SUMMARY.map((row) => (
              <tr className={row.tone === "net" ? "pricingSummary__netRow" : ""} key={row.action}>
                <th>
                  <span className={`pricingSummary__actionDot pricingSummary__actionDot--${row.tone}`} />
                  {row.action}
                </th>
                <td>{row.applied.skus}</td>
                <td><DeltaValue value={row.applied.rot} /></td>
                <td><DeltaValue value={row.applied.rev} /></td>
                <td><DeltaValue value={row.applied.margin} /></td>
                <td>{row.applied.iar}</td>
                <td className="pricingSummary__proposedStart">{row.proposed.skus}</td>
                <td><DeltaValue value={row.proposed.rot} /></td>
                <td><DeltaValue value={row.proposed.rev} /></td>
                <td><DeltaValue value={row.proposed.margin} /></td>
                <td>{row.proposed.iar}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const SEASON_OVERVIEW = [
  { metric: "Forecast Revenue (EUR)", day0: "112,831,475", day30: "108,656,710", day60: "111,139,003" },
  { metric: "vs Plan", day0: "-", day30: "-4,174,765", day60: "-1,692,472", type: "variance" },
  { metric: "Forecast Margin (EUR)", day0: "40,168,005", day30: "38,681,789", day60: "39,565,485" },
  { metric: "vs Plan", day0: "-", day30: "-1,486,216", day60: "-602,520", type: "variance" },
  { metric: "Markdown SKUs (#)", day0: "-", day30: "1,634", day60: "2,043" },
  { metric: "Markup SKUs (#)", day0: "-", day30: "688", day60: "826" },
  { metric: "Inventory Forecast (EUR)", day0: "-", day30: "3,753,623", day60: "3,265,652" },
  { metric: "Inventory Risk", day0: "-", day30: "High", day60: "Medium", type: "risk" },
];

const WEEKLY_OVERVIEW_COLUMNS = [
  { week: "Week 0", day: "Day 0" },
  { week: "Week 1", day: "Day 7" },
  { week: "Week 2", day: "Day 14" },
  { week: "Week 3", day: "Day 21" },
  { week: "Week 4", day: "Day 28" },
  { week: "Week 5", day: "Day 35" },
  { week: "Week 6", day: "Day 42" },
  { week: "Week 7", day: "Day 49" },
  { week: "Week 8", day: "Day 56", current: true },
  { week: "Week 9", day: "Day 63", forecast: true },
];

const WEEKLY_OVERVIEW_ROWS = [
  { label: "Forecast Revenue (EUR)", values: ["112,831,475", "111,900,000", "110,800,000", "109,900,000", "108,656,710", "109,200,000", "110,000,000", "110,600,000", "110,900,000", "111,139,003"] },
  { label: "vs Plan", values: ["-", "931", "-2,031,475", "-2,931,475", "-4,174,765", "-3,631,475", "-2,831,475", "-2,231,475", "-1,931,475", "-1,692,472"], type: "variance" },
  { label: "Forecast Margin (EUR)", values: ["40,168,005", "39,900,000", "39,300,000", "39,000,000", "38,681,789", "38,950,000", "39,200,000", "39,350,000", "39,450,000", "39,565,485"] },
  { label: "vs Plan", values: ["-", "268", "868", "-1,168,005", "-1,486,216", "-1,218,005", "-968", "-818", "-718", "-603"], type: "variance" },
  { label: "Markdown Recommendation SKUs (#)", values: ["-", "917", "1,183", "1,322", "1,419", "1,771", "1,846", "1,913", "1,987", "2,132"], tone: "markdown" },
  { label: "Markup Recommendation SKUs (#)", values: ["-", "201", "263", "309", "334", "362", "377", "391", "403", "439"], tone: "markup" },
  { label: "Cumulative Sell-Through Rate", values: ["0%", "4%", "9%", "14%", "19%", "24%", "29%", "33%", "36%", "40%"], type: "rate" },
  { label: "vs Plan", values: ["-", "-1pp", "-2pp", "-3pp", "-4pp", "-3pp", "-2pp", "-2pp", "-2pp", "-1pp"], type: "variance" },
];

const SEASON_STATUS = {
  appliedWeek8: [
    { label: "Total Markdowns", value: "1,987", tone: "markdown" },
    { label: "Total Markups", value: "403", tone: "markup" },
  ],
  incrementalWeek9: [
    { label: "Incremental Markdowns", total: "145", alreadyImplemented: "64", requiringAction: "81", tone: "markdown" },
    { label: "Incremental Markups", total: "36", alreadyImplemented: "16", requiringAction: "20", tone: "markup" },
  ],
  totalWeek9: [
    { label: "Total Markdowns", value: "2,132", tone: "markdown" },
    { label: "Total Markups", value: "439", tone: "markup" },
  ],
};

const PRICING_ACTION_DETAIL = [
  {
    group: "Markdowns",
    action: "Total Markdowns",
    tone: "markdown",
    isTotal: true,
    day30: { skus: "2,043", share: "-", rotation: "11%", revenue: "1,985,834", margin: "265,109" },
    day60: { skus: "3,055", share: "-", rotation: "12%", revenue: "1,066,257", margin: "671,742" },
  },
  {
    group: "Markdowns",
    action: "Markdowns no modification",
    tone: "markdown",
    day30: { skus: "1,176", share: "72%", rotation: "8.0%", revenue: "1,143,840", margin: "152,703" },
    day60: { skus: "1,254", share: "61%", rotation: "12%", revenue: "654,632", margin: "329,854" },
  },
  {
    group: "Markdowns",
    action: "Markdown modification",
    tone: "markdown",
    day30: { skus: "458", share: "28%", rotation: "13.0%", revenue: "256,220", margin: "34,205" },
    day60: { skus: "789", share: "39%", rotation: "11%", revenue: "252,879", margin: "101,911" },
  },
  {
    group: "Markdowns",
    action: "Markdown new action",
    tone: "markdown",
    day30: { skus: "409", share: "25%", rotation: "16.0%", revenue: "51,244", margin: "6,841" },
    day60: { skus: "1,012", share: "50%", rotation: "14%", revenue: "125,294", margin: "40,385" },
  },
  {
    group: "Markups",
    action: "Total Markups",
    tone: "markup",
    isTotal: true,
    startsGroup: true,
    day30: { skus: "826", share: "-", rotation: "3%", revenue: "496,458", margin: "618,587" },
    day60: { skus: "1,383", share: "-", rotation: "2%", revenue: "626,215", margin: "222,932" },
  },
  {
    group: "Markups",
    action: "Markups no modification",
    tone: "markup",
    day30: { skus: "413", share: "60%", rotation: "2.0%", revenue: "100,337", margin: "296,922" },
    day60: { skus: "591", share: "72%", rotation: "1%", revenue: "18,119", margin: "127,606" },
  },
  {
    group: "Markups",
    action: "Markup modification",
    tone: "markup",
    day30: { skus: "275", share: "40%", rotation: "3.8%", revenue: "13,519", margin: "95,015" },
    day60: { skus: "235", share: "28%", rotation: "3%", revenue: "2,085", margin: "29,043" },
  },
  {
    group: "Markups",
    action: "Markup new action",
    tone: "markup",
    day30: { skus: "138", share: "20%", rotation: "3.0%", revenue: "911", margin: "15,202" },
    day60: { skus: "557", share: "67%", rotation: "3%", revenue: "568,114", margin: "15,657" },
  },
  {
    group: "Net",
    action: "Net",
    tone: "net",
    isNet: true,
    day30: { skus: "2,869", share: "-", rotation: "-", revenue: "2,482,292", margin: "883,696" },
    day60: { skus: "-", share: "-", rotation: "9%", revenue: "1,692,472", margin: "602,520" },
  },
];

function DashboardValue({ value, type }) {
  const text = String(value);
  const isNegative = text.trim().startsWith("-");
  const riskTone = text === "High" ? "high" : text === "Medium" ? "medium" : text === "Low" ? "low" : "";
  if (type === "risk" && riskTone) {
    return <span className={`dashboardRisk dashboardRisk--${riskTone}`}>{text}</span>;
  }
  return <span className={isNegative ? "dashboardValue dashboardValue--negative" : "dashboardValue"}>{text}</span>;
}

function ImpactValue({ value }) {
  const text = String(value);
  const isNegative = text.trim().startsWith("-");
  const isEmpty = text === "-";
  return <span className={`dashboardImpactValue ${isNegative ? "is-negative" : ""} ${!isNegative && !isEmpty ? "is-positive" : ""}`}>{text}</span>;
}

const SEASON_SNAPSHOT = [
  { label: "Revenue forecast", value: "EUR 111.1M", detail: "Day 56 vs plan", delta: "-EUR 1.69M", tone: "negative", fill: 86 },
  { label: "Margin forecast", value: "EUR 39.6M", detail: "Day 56 vs plan", delta: "-EUR 0.60M", tone: "negative", fill: 88 },
  { label: "Pricing actions monitored", value: "2,869", detail: "2,043 markdowns / 826 markups", delta: "Active SKUs", tone: "neutral", fill: 72 },
  { label: "Inventory position", value: "EUR 3.27M", detail: "Forecast inventory", delta: "Medium risk", tone: "warning", fill: 58 },
];

const SEASON_CHECKPOINTS = [
  { label: "Start", day: "Day 0", revenue: "112.8M", margin: "40.2M", markdowns: "-", markups: "-", inventory: "-", risk: "-" },
  { label: "Mid-season", day: "Day 30", revenue: "108.7M", margin: "38.7M", markdowns: "1,634", markups: "688", inventory: "3.75M", risk: "High", riskTone: "high" },
  { label: "Today", day: "Day 56", revenue: "111.1M", margin: "39.6M", markdowns: "2,043", markups: "826", inventory: "3.27M", risk: "Medium", riskTone: "medium", current: true },
];

const ACTION_STAGE_SUMMARY = [
  {
    title: "Applied performance to date",
    subtitle: "Actions proposed at day 30 and measured today",
    markdownShare: 71,
    markupShare: 29,
    netRevenue: "EUR 2,482,292",
    netMargin: "EUR 883,696",
    rotation: "Net rotation +9%",
    markdown: { skus: "2,043", rotation: "11%", revenue: "EUR 1,985,834", margin: "EUR 265,109" },
    markup: { skus: "826", rotation: "3%", revenue: "EUR 496,458", margin: "EUR 618,587" },
  },
  {
    title: "Proposed today",
    subtitle: "Recommended actions for the next pricing cycle",
    markdownShare: 69,
    markupShare: 31,
    netRevenue: "EUR 1,692,472",
    netMargin: "EUR 602,520",
    rotation: "Expected rotation +9%",
    markdown: { skus: "3,055", rotation: "12%", revenue: "EUR 1,066,257", margin: "EUR 671,742" },
    markup: { skus: "1,383", rotation: "2%", revenue: "EUR 626,215", margin: "EUR 222,932" },
  },
];

function SnapshotCard({ item }) {
  return (
    <div className={`snapshotCard snapshotCard--${item.tone}`}>
      <div className="snapshotCard__label">{item.label}</div>
      <div className="snapshotCard__value">{item.value}</div>
      <div className="snapshotCard__meta">
        <span>{item.detail}</span>
        <strong>{item.delta}</strong>
      </div>
      <div className="snapshotCard__track">
        <span style={{ width: `${item.fill}%` }} />
      </div>
    </div>
  );
}

function CheckpointCard({ checkpoint }) {
  return (
    <div className={`checkpointCard ${checkpoint.current ? "is-current" : ""}`}>
      <div className="checkpointCard__head">
        <div>
          <div className="checkpointCard__label">{checkpoint.label}</div>
          <div className="checkpointCard__day">{checkpoint.day}</div>
        </div>
        {checkpoint.riskTone ? <span className={`dashboardRisk dashboardRisk--${checkpoint.riskTone}`}>{checkpoint.risk}</span> : <span className="checkpointCard__muted">Plan</span>}
      </div>
      <div className="checkpointCard__metrics">
        <div><span>Revenue</span><strong>EUR {checkpoint.revenue}</strong></div>
        <div><span>Margin</span><strong>EUR {checkpoint.margin}</strong></div>
        <div><span>Markdown SKUs</span><strong>{checkpoint.markdowns}</strong></div>
        <div><span>Markup SKUs</span><strong>{checkpoint.markups}</strong></div>
        <div><span>Inventory</span><strong>{checkpoint.inventory === "-" ? "-" : `EUR ${checkpoint.inventory}`}</strong></div>
      </div>
    </div>
  );
}

function ActionStageCard({ stage }) {
  return (
    <div className="actionStageCard">
      <div className="actionStageCard__head">
        <div>
          <div className="actionStageCard__title">{stage.title}</div>
          <div className="actionStageCard__subtitle">{stage.subtitle}</div>
        </div>
        <div className="actionStageCard__rotation">{stage.rotation}</div>
      </div>
      <div className="actionMixBar" aria-hidden="true">
        <span className="actionMixBar__markdown" style={{ width: `${stage.markdownShare}%` }} />
        <span className="actionMixBar__markup" style={{ width: `${stage.markupShare}%` }} />
      </div>
      <div className="actionStageCard__rows">
        <div className="actionStageRow">
          <div><span className="pricingSummary__actionDot pricingSummary__actionDot--markdown" />Markdowns</div>
          <strong>{stage.markdown.skus}</strong>
          <span>{stage.markdown.rotation}</span>
          <span>{stage.markdown.revenue}</span>
          <span>{stage.markdown.margin}</span>
        </div>
        <div className="actionStageRow">
          <div><span className="pricingSummary__actionDot pricingSummary__actionDot--markup" />Markups</div>
          <strong>{stage.markup.skus}</strong>
          <span>{stage.markup.rotation}</span>
          <span>{stage.markup.revenue}</span>
          <span>{stage.markup.margin}</span>
        </div>
      </div>
      <div className="actionStageCard__net">
        <span>Net impact</span>
        <strong>{stage.netRevenue}</strong>
        <strong>{stage.netMargin}</strong>
      </div>
    </div>
  );
}

function DashboardSection({ title, subtitle, meta, children }) {
  return (
    <section className="dashboardSection">
      <div className="dashboardSection__header">
        <div>
          <div className="dashboardSection__title">{title}</div>
          {subtitle ? <div className="dashboardSection__subtitle">{subtitle}</div> : null}
        </div>
        {meta ? <div className="dashboardSection__meta">{meta}</div> : null}
      </div>
      <div className="dashboardTableWrap">{children}</div>
    </section>
  );
}

function SeasonOverviewSummary() {
  return (
    <DashboardSection
      title="Season planning overview"
      subtitle="High-level forecast deviation vs plan across the main season checkpoints."
      meta={`Current day ${CURRENT_DAY}`}
    >
      <table className="dashboardTable dashboardTable--overview">
        <thead>
          <tr>
            <th>KPI</th>
            <th>Day 0 (Forecast)</th>
            <th>Day 30</th>
            <th className="dashboardTable__today">Day {CURRENT_DAY} (Today)</th>
          </tr>
        </thead>
        <tbody>
          {SEASON_OVERVIEW.map((row) => (
            <tr key={`${row.metric}-${row.day60}`}>
              <th>{row.metric}</th>
              <td><DashboardValue value={row.day0} type={row.type} /></td>
              <td><DashboardValue value={row.day30} type={row.type} /></td>
              <td className="dashboardTable__today"><DashboardValue value={row.day60} type={row.type} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </DashboardSection>
  );
}

function WeeklyValue({ value, type }) {
  const text = String(value);
  const isNegative = text.trim().startsWith("-");
  const isEmpty = text === "-";
  return <span className={`weeklyValue ${isNegative ? "is-negative" : ""} ${!isNegative && !isEmpty && type === "variance" ? "is-positive" : ""}`}>{text}</span>;
}

function WeeklyDashboardOverview() {
  return (
    <DashboardSection
      title="Weekly season overview"
      subtitle=""
      meta={`Today: Week 8 / Day ${CURRENT_DAY}`}
    >
      <table className="dashboardTable weeklyTable">
        <thead>
          <tr>
            <th className="weeklyTable__kpiHead">KPI</th>
            {WEEKLY_OVERVIEW_COLUMNS.map((column) => (
              <th className={`${column.current ? "weeklyTable__current" : ""} ${column.forecast ? "weeklyTable__forecast" : ""}`} key={column.week}>
                {column.forecast ? <span className="weeklyTable__tag">Forecast</span> : null}
                <span className="weeklyTable__week">{column.week}</span>
                <span className="weeklyTable__day">{column.day}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEKLY_OVERVIEW_ROWS.map((row, rowIndex) => (
            <tr className={`${row.type === "variance" ? "weeklyTable__varianceRow" : ""} ${row.tone ? `weeklyTable__${row.tone}Row` : ""}`} key={`${row.label}-${rowIndex}`}>
              <th>{row.label}</th>
              {row.values.map((value, index) => (
                <td className={`${WEEKLY_OVERVIEW_COLUMNS[index].current ? "weeklyTable__current" : ""} ${WEEKLY_OVERVIEW_COLUMNS[index].forecast ? "weeklyTable__forecast" : ""}`} key={`${row.label}-${index}`}>
                  <WeeklyValue value={value} type={row.type} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </DashboardSection>
  );
}

function SeasonStatusSummary() {
  return (
    <DashboardSection
      title="Season status"
      subtitle=""
      meta="Week 8 → Week 9"
    >
      <div className="seasonStatus">
        <div className="seasonStatusCard">
          <div className="seasonStatusCard__eyebrow">Applied base</div>
          <div className="seasonStatusCard__title">Week 8</div>
          <div className="seasonStatusRows">
            {SEASON_STATUS.appliedWeek8.map((row) => (
              <div className="seasonStatusRow" key={row.label}>
                <span><span className={`pricingSummary__actionDot pricingSummary__actionDot--${row.tone}`} />{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="seasonStatusCard seasonStatusCard--wide">
          <div className="seasonStatusCard__eyebrow">Incremental proposal</div>
          <div className="seasonStatusCard__title">Week 9 actions</div>
          <div className="seasonStatusBreakdown">
            {SEASON_STATUS.incrementalWeek9.map((row) => (
              <div className="seasonStatusBreakdownItem" key={row.label}>
                <div className="seasonStatusBreakdownItem__main">
                  <span><span className={`pricingSummary__actionDot pricingSummary__actionDot--${row.tone}`} />{row.label}</span>
                  <span className={`seasonStatusDelta seasonStatusDelta--${row.tone}`}>+{row.total} ↗</span>
                </div>
                <div className="seasonStatusSubRows">
                  <div className="seasonStatusSubRow">
                    <span>Modifications</span>
                    <strong>{row.alreadyImplemented}</strong>
                  </div>
                  <div className="seasonStatusSubRow">
                    <span>New actions</span>
                    <strong>{row.requiringAction}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="seasonStatusCard seasonStatusCard--result">
          <div className="seasonStatusCard__eyebrow">After proposal</div>
          <div className="seasonStatusCard__title">Week 9</div>
          <div className="seasonStatusRows">
            {SEASON_STATUS.totalWeek9.map((row) => (
              <div className="seasonStatusRow" key={row.label}>
                <span><span className={`pricingSummary__actionDot pricingSummary__actionDot--${row.tone}`} />{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardSection>
  );
}

function PricingActionsDetail() {
  const groupCounts = PRICING_ACTION_DETAIL.reduce((acc, row) => {
    acc[row.group] = (acc[row.group] || 0) + 1;
    return acc;
  }, {});
  const seenGroups = {};
  return (
    <DashboardSection
      title="Pricing actions impact"
      subtitle="Applied markdown and markup performance, plus the actions proposed today and their expected impact."
      meta="Applied vs proposed"
    >
      <table className="dashboardTable dashboardTable--actions">
        <thead>
          <tr>
            <th rowSpan="2">Type</th>
            <th rowSpan="2">Action</th>
            <th className="dashboardTable__group" colSpan="2">Proposed at day 30</th>
            <th className="dashboardTable__group" colSpan="3">Applied performance to date</th>
            <th className="dashboardTable__group dashboardTable__today" colSpan="2">Proposed today - day {CURRENT_DAY}</th>
            <th className="dashboardTable__group" colSpan="3">Expected impact</th>
          </tr>
          <tr>
            <th>SKUs</th>
            <th>% of previous set</th>
            <th>Rotation impact</th>
            <th>Revenue impact (EUR)</th>
            <th>Margin impact (EUR)</th>
            <th className="dashboardTable__today">SKUs</th>
            <th>% of current set</th>
            <th>Rotation impact</th>
            <th>Revenue impact (EUR)</th>
            <th>Margin impact (EUR)</th>
          </tr>
        </thead>
        <tbody>
          {PRICING_ACTION_DETAIL.map((row) => {
            const showGroup = !seenGroups[row.group];
            seenGroups[row.group] = true;
            return (
              <tr className={`${row.isTotal ? "dashboardTable__totalRow" : ""} ${row.isNet ? "dashboardTable__netRow" : ""} ${row.startsGroup ? "dashboardTable__groupStart" : ""}`} key={`${row.group}-${row.action}`}>
                {showGroup ? (
                  <th className={`dashboardTable__typeCell dashboardTable__typeCell--${row.tone}`} rowSpan={groupCounts[row.group]}>
                    <span className={`pricingSummary__actionDot pricingSummary__actionDot--${row.tone}`} />
                    {row.group}
                  </th>
                ) : null}
                <th className="dashboardTable__actionCell">{row.action}</th>
                <td>{row.day30.skus}</td>
                <td>{row.day30.share}</td>
                <td><ImpactValue value={row.day30.rotation} /></td>
                <td><ImpactValue value={row.day30.revenue} /></td>
                <td><ImpactValue value={row.day30.margin} /></td>
                <td className="dashboardTable__today">{row.day60.skus}</td>
                <td>{row.day60.share}</td>
                <td><ImpactValue value={row.day60.rotation} /></td>
                <td><ImpactValue value={row.day60.revenue} /></td>
                <td><ImpactValue value={row.day60.margin} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </DashboardSection>
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

function AppliedActionsTable({ onOpen, type = "", categoryFilter = "", showCategory = true }) {
  const rows = APPLIED_ACTIONS.map((action) => {
    const product = getProductBySku(action.sku);
    return {
      ...action,
      name: product?.name || action.sku,
      category: product?.category || "-",
      competitorPrice: product?.comp,
      priceVsCompetitor: product?.comp ? (Number(action.newPrice) - Number(product.comp)) / Number(product.comp) : null,
    };
  }).filter((action) => {
    if (type && action.type !== type) return false;
    if (categoryFilter && action.category !== categoryFilter) return false;
    return true;
  });
  const maxRevenue = Math.max(...rows.map((row) => Math.abs(row.revenueImpact) || 0), 1);
  const maxMargin = Math.max(...rows.map((row) => Math.abs(row.marginImpact) || 0), 1);
  const categoryColumn = showCategory ? [{ key: "category", label: "Category", render: (value) => <CategoryChip value={value} /> }] : [];
  const columns = [
    { key: "name", label: "Name" },
    { key: "sku", label: "SKU" },
    ...categoryColumn,
    { key: "action", label: "Applied action", render: (value) => <RecoChip value={value} /> },
    { key: "appliedDay", label: "Applied day", align: "num", render: (value) => `Day ${value}` },
    { key: "priceVsCompetitor", label: "Price vs competitor", align: "num", render: (value) => (value == null ? "-" : fmtSignedPct(value)) },
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

function getRecommendationRows(type) {
  if (type === "markdown") {
    return [...MARKDOWN_LIST]
      .sort((a, b) => (Number(b.margin_up) || 0) - (Number(a.margin_up) || 0))
      .map((product) => ({ ...product, type: "markdown" }));
  }
  if (type === "markup") {
    return [...MARKUP_LIST]
      .sort((a, b) => (Number(b.margin_up) || 0) - (Number(a.margin_up) || 0))
      .map((product) => ({ ...product, type: "markup" }));
  }
  return [];
}

function getRecommendationColumns(type, rows, showCategory = true) {
  const marginMax = Math.max(...rows.map((row) => Number(row.margin_up) || 0), 1);
  const categoryColumn = showCategory ? [{ key: "category", label: "Category", render: (value) => <CategoryChip value={value} /> }] : [];
  if (type === "markdown") {
    return [
      { key: "name", label: "Name" }, { key: "sku", label: "SKU" },
      ...categoryColumn,
      { key: "curr", label: "Initial (EUR)", align: "num", render: fmtEUR },
      { key: "comp", label: "Competitor (EUR)", align: "num", render: fmtEUR },
      { key: "pct_comp", label: "Price vs competitor", align: "num", render: fmtPct },
      { key: "inv_risk_pct", label: "Inventory at risk", align: "num", render: fmtPct, cellClass: "riskCell", max: Math.max(...rows.map((row) => row.inv_risk_pct || 0), 1) },
      { key: "reco", label: "Policy", render: (_, row) => <RecoChipForProduct product={row} /> },
      { key: "final_price", label: "Final (EUR)", align: "num", render: fmtEUR },
      { key: "uplift", label: "Uplift", align: "num", render: fmtPct },
      { key: "margin_up", label: "Margin Uplift (EUR)", align: "num", render: fmtEUR, cellClass: "upsideCell", max: marginMax },
    ];
  }
  return [
    { key: "name", label: "Name" }, { key: "sku", label: "SKU" },
    ...categoryColumn,
    { key: "curr", label: "Initial (EUR)", align: "num", render: fmtEUR },
    { key: "comp", label: "Competitor (EUR)", align: "num", render: fmtEUR },
    { key: "pct_comp", label: "Price vs competitor", align: "num", render: fmtPct },
    { key: "rot", label: "Rotation vs Forecast", align: "num", render: fmtPctFromMult },
    { key: "reco", label: "Policy", render: (_, row) => <RecoChipForProduct product={row} /> },
    { key: "final_price", label: "Final (EUR)", align: "num", render: fmtEUR },
    { key: "margin_up", label: "Margin Uplift (EUR)", align: "num", render: fmtEUR, cellClass: "upsideCell", max: marginMax },
  ];
}

function RecommendationTableSection({ type, onOpen, title, hint, showCategory = true, showCategoryFilter = true }) {
  const [categoryFilter, setCategoryFilter] = useState("");
  const rows = getRecommendationRows(type).filter((row) => !categoryFilter || row.category === categoryFilter);
  const columns = getRecommendationColumns(type, rows, showCategory);
  return (
    <section className="panel">
      <div className="panel__head panel__head--split">
        <div>
          <div className="panel__title">{title}</div>
          {hint && <div className="panel__hint">{hint}</div>}
        </div>
        {showCategoryFilter && (
          <div className="filters">
            <select className="select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">All categories</option>
              {CATEGORY_OPTIONS.map((category) => <option value={category} key={category}>{category}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="panel__body"><DataTable rows={rows} columns={columns} onOpen={onOpen} /></div>
    </section>
  );
}

function MatrixDetailPage({ onOpen, onBack }) {
  const matrixDetailSkus = ["AT-93847", "ST-35780"];
  const matrixDetailOverrides = {
    "AT-93847": {
      rev_uplift: 456400,
      margin_up: 75062,
      final_pct_comp: -0.05,
    },
  };
  const recommendationRows = getRecommendationRows("markdown");
  const rows = matrixDetailSkus
    .map((sku) => recommendationRows.find((row) => row.sku === sku))
    .filter(Boolean)
    .map((row) => {
      const merged = { ...row, ...(matrixDetailOverrides[row.sku] || {}) };
      return {
        ...merged,
        final_pct_comp: merged.final_pct_comp ?? (Number(merged.comp) ? (Number(merged.final_price) - Number(merged.comp)) / Number(merged.comp) : null),
      };
    });
  const revMax = Math.max(...rows.map((row) => Number(row.rev_uplift) || 0), 1);
  const marginMax = Math.max(...rows.map((row) => Number(row.margin_up) || 0), 1);
  const riskMax = Math.max(...rows.map((row) => Number(row.inv_risk_pct) || 0), 1);
  const columns = [
    { key: "name", label: "Name" },
    { key: "sku", label: "SKU" },
    { key: "curr", label: "Initial (EUR)", align: "num", render: fmtEUR },
    { key: "comp", label: "Competitor (EUR)", align: "num", render: fmtEUR },
    { key: "pct_comp", label: "Price vs competitor", align: "num", render: fmtPct },
    { key: "inv_risk_pct", label: "Inventory at risk", align: "num", render: fmtPct, cellClass: "riskCell", max: riskMax },
    { key: "reco", label: "Policy", render: (_, row) => <RecoChipForProduct product={row} /> },
    { key: "final_price", label: "Final (EUR)", align: "num", render: fmtEUR },
    { key: "uplift", label: "Uplift", align: "num", render: fmtPct },
    { key: "obsolete", label: "Obsolete post", align: "num", render: fmtPct },
    { key: "rev_uplift", label: "Revenue Uplift (EUR)", align: "num", render: fmtEUR, cellClass: "upsideCell", max: revMax },
    { key: "margin_up", label: "Margin Uplift (EUR)", align: "num", render: fmtEUR, cellClass: "upsideCell", max: marginMax },
    { key: "final_pct_comp", label: "Final vs competitor", align: "num", render: fmtIndex },
  ];
  return (
    <section className="panel">
      <div className="panel__head panel__head--split">
        <div>
          <div className="panel__title">Matrix markdown actions</div>
          <div className="panel__hint">Products behind the selected Week 8 to Week 9 markdown transition.</div>
        </div>
        <button className="btn btn--ghost btn--compact" type="button" onClick={onBack}>Back to Dashboard</button>
      </div>
      <div className="panel__body">
        <DataTable rows={rows} columns={columns} onOpen={onOpen} />
        <div className="footnote">{rows.length} products shown from Top Markdowns.</div>
      </div>
    </section>
  );
}

function MatrixMarkupDetailPage({ onOpen, onBack }) {
  const baseRow = getRecommendationRows("markup").find((row) => row.sku === "RS-71058");
  const rows = baseRow ? [{
    ...baseRow,
    pct_comp: -0.10,
    rot: 1.82,
    exact_action_pct: 0.101,
    final_pct_comp: -0.01,
  }] : [];
  const marginMax = Math.max(...rows.map((row) => Number(row.margin_up) || 0), 1);
  const revenueMax = Math.max(...rows.map((row) => Number(row.rev_uplift) || 0), 1);
  const rotationMax = Math.max(...rows.map((row) => Number(row.rot) || 0), 1);
  const fmtWholePct = (value) => value == null || Number.isNaN(Number(value)) ? "-" : `${Math.round(Number(value) * 100)}%`;
  const columns = [
    { key: "name", label: "Name" },
    { key: "sku", label: "SKU" },
    { key: "curr", label: "Initial (EUR)", align: "num", render: fmtEUR },
    { key: "comp", label: "Competitor (EUR)", align: "num", render: fmtEUR },
    { key: "pct_comp", label: "Price vs competitor", align: "num", render: fmtWholePct },
    { key: "rot", label: "Rotation vs Forecast", align: "num", render: fmtPctFromMult, cellClass: "upsideCell", max: rotationMax },
    { key: "reco", label: "Policy", render: (_, row) => <RecoChipForProduct product={row} /> },
    { key: "final_price", label: "Final (EUR)", align: "num", render: fmtEUR },
    { key: "rev_uplift", label: "Revenue Uplift (EUR)", align: "num", render: fmtEUR, cellClass: "upsideCell", max: revenueMax },
    { key: "margin_up", label: "Margin Uplift (EUR)", align: "num", render: fmtEUR, cellClass: "upsideCell", max: marginMax },
    { key: "final_pct_comp", label: "Final vs competitor", align: "num", render: fmtWholePct },
  ];
  return (
    <section className="panel">
      <div className="panel__head panel__head--split">
        <div>
          <div className="panel__title">Matrix markup actions</div>
          <div className="panel__hint">Product behind the selected Week 8 to Week 9 markup transition.</div>
        </div>
        <button className="btn btn--ghost btn--compact" type="button" onClick={onBack}>Back to Dashboard</button>
      </div>
      <div className="panel__body">
        <DataTable rows={rows} columns={columns} onOpen={onOpen} />
        <div className="footnote">{rows.length} product shown from Top Markups.</div>
      </div>
    </section>
  );
}

function RecommendationsPage({ type = "", onOpen }) {
  if (type === "markdown") {
    return (
      <RecommendationTableSection
        type="markdown"
        onOpen={onOpen}
        title="Markdown Recommendations"
        hint="Priority markdown actions ranked by expected margin impact and inventory risk."
      />
    );
  }
  if (type === "markup") {
    return (
      <RecommendationTableSection
        type="markup"
        onOpen={onOpen}
        title="Markup Recommendations"
        hint="Priority markup actions ranked by expected margin upside."
      />
    );
  }
  return (
    <>
      <RecommendationTableSection
        type="markdown"
        onOpen={onOpen}
        title="Markdown Recommendations"
        hint="Priority markdown actions ranked by expected margin impact and inventory risk."
      />
      <RecommendationTableSection
        type="markup"
        onOpen={onOpen}
        title="Markup Recommendations"
        hint="Priority markup actions ranked by expected margin upside."
      />
    </>
  );
}

function OverviewPage({ onOpenMatrixCell }) {
  return (
    <>
      <WeeklyDashboardOverview />
      <SeasonStatusSummary />
      <section className="panel">
        <div className="panel__head">
          <div className="panel__title panel__title--dashboard">Transition matrix</div>
        </div>
        <div className="panel__body"><TransitionMatrix onOpenCell={onOpenMatrixCell} /></div>
      </section>
    </>
  );
}

function AppliedActionsPage({ onOpenAppliedAction, type = "" }) {
  const [categoryFilter, setCategoryFilter] = useState("");
  const title = type === "markdown" ? "Applied Markdowns" : type === "markup" ? "Applied Markups" : "Applied Actions";
  const hint = type
    ? `Executed ${type === "markdown" ? "markdowns" : "markups"}, measured against rotation, revenue, margin, and updated inventory risk.`
    : "Executed markdowns and markups, measured against rotation, revenue, margin, and updated inventory risk.";
  return (
    <section className="panel">
      <div className="panel__head panel__head--split">
        <div>
          <div className="panel__title">{title}</div>
          <div className="panel__hint">{hint}</div>
        </div>
        <div className="filters">
          <select className="select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((category) => <option value={category} key={category}>{category}</option>)}
          </select>
        </div>
      </div>
      <div className="panel__body"><AppliedActionsTable onOpen={onOpenAppliedAction} type={type} categoryFilter={categoryFilter} /></div>
    </section>
  );
}

function ProductListPage({ typeFilter, categoryFilter, search, onTypeChange, onCategoryChange, onSearchChange, onOpen }) {
  const filtered = useMemo(() => ALL_PRODUCTS.filter((row) => {
    if (typeFilter && row.type !== typeFilter) return false;
    if (categoryFilter && row.category !== categoryFilter) return false;
    if (!search) return true;
    return `${row.sku} ${row.name} ${row.category}`.toLowerCase().includes(search.toLowerCase());
  }), [typeFilter, categoryFilter, search]);
  const marginMax = Math.max(...filtered.map((r) => Number(r.margin_up) || 0), 1);
  const columns = [
    { key: "sku", label: "SKU" }, { key: "name", label: "Name" },
    { key: "category", label: "Category", render: (value) => <CategoryChip value={value} /> },
    { key: "type", label: "Type", render: (v) => <span className="pill"><span className="dot" />{v}</span> },
    { key: "reco", label: "Recommendation", render: (_, row) => <RecoChipForProduct product={row} /> },
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
          <select className="select" value={typeFilter} onChange={(event) => onTypeChange(event.target.value)}>
            <option value="">All types</option>
            <option value="markup">Markup</option>
            <option value="markdown">Markdown</option>
          </select>
          <select className="select" value={categoryFilter} onChange={(event) => onCategoryChange(event.target.value)}>
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((category) => <option value={category} key={category}>{category}</option>)}
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
        label: `${getExactActionLabel(product)} (Recommended)`,
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
      const label = isDefault ? `${getExactActionLabel(product)} (Recommended)` : scenario.label;

      return [
        key,
        {
          ...scenario,
          label,
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

function InventoryChart({ detail, scenarioKey, scenarioColor }) {
  const W = 980;
  const H = 360;
  const pad = { l: 38, r: 12, t: 14, b: 32 };
  const toX = (day) => pad.l + (day / 180) * (W - pad.l - pad.r);
  const toY = (value) => pad.t + (1 - value / 100) * (H - pad.t - pad.b);
  function makePath(field, includePoint) {
    const points = [];
    for (const point of detail.series) {
      if (!includePoint(point)) continue;
      const value = point[field];
      if (value == null || Number.isNaN(Number(value))) continue;
      points.push(point);
      if (Number(value) <= 0) break;
    }
    return points
      .map((point, index) => `${index ? "L" : "M"}${toX(point.d).toFixed(1)} ${toY(point[field]).toFixed(1)}`)
      .join(" ");
  }
  const xTicks = [0, 30, 60, 90, 120, 150, 180];
  const yTicks = [0, 25, 50, 75, 100];
  const pPre = makePath("cur", (point) => point.d <= CURRENT_DAY);
  const pNoChange = makePath("cur", (point) => point.d >= CURRENT_DAY);
  const pScenario = makePath(scenarioKey, (point) => point.d >= CURRENT_DAY);

  return (
    <svg className="chartSvg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Inventory evolution">
      {xTicks.map((x) => <line className="chartGrid" key={`x-${x}`} x1={toX(x)} y1={pad.t} x2={toX(x)} y2={H - pad.b} />)}
      {yTicks.map((y) => <line className="chartGrid" key={`y-${y}`} x1={pad.l} y1={toY(y)} x2={W - pad.r} y2={toY(y)} />)}
      <line x1={toX(CURRENT_DAY)} y1={pad.t} x2={toX(CURRENT_DAY)} y2={H - pad.b} stroke="rgba(255,255,255,0.20)" strokeDasharray="4 3" />
      <text x={toX(CURRENT_DAY) + 4} y={pad.t + 14} fontSize="10" fill="rgba(234,242,255,0.50)" fontWeight="700">Day {CURRENT_DAY}</text>
      {yTicks.map((y) => <text className="chartAxisText" key={`yl-${y}`} x={pad.l - 8} y={toY(y) + 4} textAnchor="end">{y}%</text>)}
      {xTicks.map((x) => <text className="chartAxisText" key={`xl-${x}`} x={toX(x)} y={H - 8} textAnchor="middle">{x}</text>)}
      {pPre && <path className="chartLineProductPre" d={pPre} />}
      {pNoChange && <path className="chartLineProductNoChange" d={pNoChange} />}
      {pScenario && <path className="chartLineProductScenario is-active" d={pScenario} style={{ "--scenario-color": scenarioColor }} />}
    </svg>
  );
}

function ProductDetailPage({ selectedProduct, scenarioKey, onScenarioChange, onBack }) {
  const detail = getDetailForProduct(selectedProduct);
  const selectedKey = detail.scenarios[scenarioKey] ? scenarioKey : detail.defaultScenario;
  const scenario = detail.scenarios[selectedKey];
  const scenarioEntries = Object.entries(detail.scenarios);
  const selectedScenarioIndex = Math.max(0, scenarioEntries.findIndex(([key]) => key === selectedKey));
  const selectedScenarioColor = getScenarioColor(selectedScenarioIndex);
  const rows = [
    { label: "Obsolete inv. (units)", current: fmtInt(detail.scenarioCurrent.inv_units), getValue: (s) => fmtInt(s.inv_units) },
    { label: "Obsolete inv. (EUR)", current: fmtEURWhole(detail.scenarioCurrent.inv_eur), getValue: (s) => fmtEURWhole(s.inv_eur) },
    { label: "Revenue (EUR)", current: fmtEURWhole(detail.scenarioCurrent.revenue), getValue: (s) => fmtEURWhole(s.revenue) },
    { label: "Cost (EUR)", current: fmtEURWhole(detail.scenarioCurrent.cost), getValue: (s) => fmtEURWhole(s.cost) },
    { label: "Margin (EUR)", current: fmtEURWhole(detail.scenarioCurrent.margin), getValue: (s) => fmtEURWhole(s.margin) },
    { label: "Incremental margin", current: "-", getValue: (s) => fmtEURWhole(s.margin_uplift) },
  ];

  return (
    <section className="panel">
      <div className="panel__head panel__head--split">
        <div><div className="panel__title">Product Detail</div></div>
        <button className="btn btn--ghost btn--compact" onClick={onBack}>Back to Product List</button>
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
              <HeroStat label="Proposed price vs competitor" value={fmtIndex(scenario.proposed_index)} sub={`Proposed price: ${fmtEUR(scenario.price)}`} color={selectedScenarioColor} />
            </div>
          </div>
          <div className="detailGrid2">
            <div className="detailCard">
              <div className="detailCardHead"><div className="detailCardTitle">Inventory Evolution <span className="muted">(% remaining, days 0-180)</span></div></div>
              <div className="detailCardBody">
                <InventoryChart detail={detail} scenarioKey={selectedKey} scenarioColor={selectedScenarioColor} />
                <div className="chartLegend">
                  <div className="legendItem"><span className="legendSwatch productPre" />Observed until day {CURRENT_DAY}</div>
                  <div className="legendItem"><span className="legendSwatch productNoChange" />No-change forecast</div>
                  <div className="legendItem"><span className="legendSwatch productScenario" style={{ "--scenario-color": selectedScenarioColor }} />{scenario.label}</div>
                </div>
              </div>
            </div>
            <div className="detailCard">
              <div className="detailCardHead"><div className="detailCardTitle">Scenario Comparison - End of Season</div></div>
              <div className="detailCardBody">
                <div className="table-wrap">
                  <table className="detailTbl">
                    <colgroup>
                      <col style={{ width: "42%" }} />
                      <col style={{ width: "29%" }} />
                      <col style={{ width: "29%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Metric</th>
                        <th className="num">Current</th>
                        <th className="num is-selectedScenario" title={scenario.label}>{getCompactScenarioLabel(scenario.label)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.label}>
                          <th>{row.label}</th>
                          <td className="num">{row.current}</td>
                          <td className="num is-selectedScenario">{row.getValue(scenario)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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

function AppliedSalesChart({ action, scenarioField = "recommended" }) {
  const W = 980;
  const H = 360;
  const pad = { l: 52, r: 16, t: 14, b: 32 };
  const currentDay = action.currentDay ?? CURRENT_DAY;
  const fields = ["actual", "noAction", "noChange", scenarioField];
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
    [scenarioField, "chartLineRecommended"],
  ].map(([field, className]) => [makePath(field), className]);

  return (
    <svg className="chartSvg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Applied action inventory chart">
      {xTicks.map((x) => <line className="chartGrid" key={`x-${x}`} x1={toX(x)} y1={pad.t} x2={toX(x)} y2={H - pad.b} />)}
      {yTicks.map((y) => <line className="chartGrid" key={`y-${y}`} x1={pad.l} y1={toY(y)} x2={W - pad.r} y2={toY(y)} />)}
      <line x1={toX(action.appliedDay)} y1={pad.t} x2={toX(action.appliedDay)} y2={H - pad.b} stroke="rgba(255,255,255,0.24)" strokeDasharray="4 3" />
      <text x={toX(action.appliedDay) + 4} y={pad.t + 14} fontSize="10" fill="rgba(234,242,255,0.55)" fontWeight="700">Action day {action.appliedDay}</text>
      <line x1={toX(currentDay)} y1={pad.t} x2={toX(currentDay)} y2={H - pad.b} stroke="rgba(66,217,200,0.38)" strokeDasharray="3 3" />
      <text x={toX(currentDay) + 4} y={pad.t + 29} fontSize="10" fill="rgba(66,217,200,0.70)" fontWeight="700">Today day {currentDay}</text>
      {yTicks.map((y) => <text className="chartAxisText" key={`yl-${y}`} x={pad.l - 8} y={toY(y) + 4} textAnchor="end">{y}%</text>)}
      {xTicks.map((x) => <text className="chartAxisText" key={`xl-${x}`} x={toX(x)} y={H - 8} textAnchor="middle">{x}</text>)}
      {paths.map(([path, className]) => path ? <path className={className} d={path} key={className} /> : null)}
    </svg>
  );
}

function AppliedActionDetailPage({ selectedAction, onBack }) {
  const action = selectedAction;
  const product = getProductBySku(action.sku);
  const scenarioEntries = Object.entries(action.scenarios || {});
  const [selectedScenarioKey, setSelectedScenarioKey] = useState(action.defaultScenario || scenarioEntries[0]?.[0] || "");
  const selectedScenario = action.scenarios?.[selectedScenarioKey] || scenarioEntries[0]?.[1] || null;
  const selectedScenarioIndex = Math.max(0, scenarioEntries.findIndex(([key]) => key === selectedScenarioKey));
  const selectedScenarioColor = getScenarioColor(selectedScenarioIndex);
  const selectedScenarioField = selectedScenario?.field || "recommended";
  const hasRecommendedPath = action.timeline.some((point) => point[selectedScenarioField] != null);
  const rows = [
    ["Rotation before", fmtPctFromMult(action.preRotation)],
    ["Rotation after", fmtPctFromMult(action.postRotation)],
    ["Rotation delta", fmtSignedPct(action.rotationDelta)],
    ["Revenue impact", fmtEUR(action.revenueImpact)],
    ["Margin impact", fmtEUR(action.marginImpact)],
    ["Updated inventory forecast", fmtPct(action.updatedInventoryForecast)],
    ...(action.recommendedInventoryForecast != null ? [["Recommended inventory forecast", fmtPct(action.recommendedInventoryForecast)]] : []),
    ["Effectiveness score", fmtPct(action.effectiveness)],
    ...(action.recommendedRotation != null ? [["Recommended rotation factor", fmtPctFromMult(action.recommendedRotation)]] : []),
  ];
  const hasScenarioComparison = Boolean(action.scenarioCurrent && selectedScenario);
  const fmtEURScenario = (value) => Number(value) === 0 ? "-" : fmtEURWhole(value);
  const scenarioRows = hasScenarioComparison ? [
    { label: "Obsolete inventory units", current: fmtInt(action.scenarioCurrent.inv_units), selected: fmtInt(selectedScenario.inv_units) },
    { label: "Obsolete inventory euros", current: fmtEURScenario(action.scenarioCurrent.inv_eur), selected: fmtEURScenario(selectedScenario.inv_eur) },
    { label: "Revenue uplift", current: fmtEURWhole(action.scenarioCurrent.revenue_uplift), selected: fmtEURWhole(selectedScenario.revenue_uplift) },
    { label: "Margin uplift", current: fmtEURWhole(action.scenarioCurrent.margin_uplift), selected: fmtEURWhole(selectedScenario.margin_uplift) },
  ] : [];
  const currentPriceIndex = product?.pct_comp ?? (Number(product?.comp) ? (Number(action.oldPrice) - Number(product.comp)) / Number(product.comp) : null);
  const detailElasticity = PRODUCT_DETAILS[product?.sku]?.elasticity || "High";

  return (
    <section className="panel">
      <div className="panel__head panel__head--split">
        <div>
          <div className="panel__title">Applied Action Detail</div>
          <div className="panel__hint">Observed post-action performance and recommended next move.</div>
        </div>
        <button className="btn btn--ghost btn--compact" onClick={onBack}>Back to Overview</button>
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
                <div className="detailScenarioPill__label">{hasScenarioComparison ? "Scenario" : "Applied"}</div>
                {hasScenarioComparison ? (
                  <select className="detailScenarioPill__select" value={selectedScenarioKey} onChange={(event) => setSelectedScenarioKey(event.target.value)}>
                    {scenarioEntries.map(([key, scenario]) => <option value={key} key={key}>{scenario.label}</option>)}
                  </select>
                ) : (
                  <div className="appliedActionName">{action.action}</div>
                )}
              </div>
            </div>
            <div className="detailHeroStats">
              {hasScenarioComparison ? (
                <>
                  <HeroStat label="Elasticity" value={detailElasticity} purple />
                  <div className="heroDivider" />
                  <HeroStat label="SKU" value={action.sku} sub={`Current price: ${fmtEUR(action.oldPrice)}`} />
                  <div className="heroDivider" />
                  <HeroStat label="Current price vs competitor" value={fmtIndex(currentPriceIndex)} sub={`Competitor price: ${fmtEUR(product?.comp)}`} />
                  <div className="heroDivider" />
                  <HeroStat label="Proposed price vs competitor" value={fmtIndex(selectedScenario.proposed_index)} sub={`Proposed price: ${fmtEUR(selectedScenario.price)}`} color={selectedScenarioColor} />
                </>
              ) : (
                <>
                  <HeroStat label="SKU" value={action.sku} sub={`Applied day: ${action.appliedDay}`} />
                  <div className="heroDivider" />
                  <HeroStat label="Price move" value={<PriceMove oldPrice={action.oldPrice} newPrice={action.newPrice} competitorPrice={product?.comp} variant="hero" />} />
                  <div className="heroDivider" />
                  <HeroStat label="Rotation delta" value={fmtSignedPct(action.rotationDelta)} sub={`${fmtPctFromMult(action.preRotation)} to ${fmtPctFromMult(action.postRotation)}`} blue={action.rotationDelta >= 0} />
                  <div className="heroDivider" />
                  <HeroStat label="Next action" value={action.nextAction} purple={statusTone(action.outcome) !== "good"} />
                </>
              )}
            </div>
          </div>
          <div className="detailGrid2">
            <div className="detailCard">
              <div className="detailCardHead">
                <div className="detailCardTitle">Inventory Response <span className="muted">(% remaining, days 0-180)</span></div>
              </div>
              <div className="detailCardBody">
                <AppliedSalesChart action={action} scenarioField={selectedScenarioField} />
                <div className="chartLegend">
                  <div className="legendItem"><span className="legendSwatch actual" />Observed until today</div>
                  <div className="legendItem"><span className="legendSwatch noAction" />No-action counterfactual</div>
                  <div className="legendItem"><span className="legendSwatch noChange" />No further change forecast</div>
                  {hasRecommendedPath && <div className="legendItem"><span className="legendSwatch recommended" />{selectedScenario?.label || "Recommended action forecast"}</div>}
                </div>
              </div>
            </div>
            <div className="detailCard">
              <div className="detailCardHead"><div className="detailCardTitle">{hasScenarioComparison ? "Scenario Comparison - End of Season" : "Pre / Post Metrics"}</div></div>
              <div className="detailCardBody">
                {hasScenarioComparison ? (
                  <>
                    <div className="table-wrap">
                      <table className="detailTbl">
                        <colgroup>
                          <col style={{ width: "42%" }} />
                          <col style={{ width: "29%" }} />
                          <col style={{ width: "29%" }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Metric</th>
                            <th className="num">Current</th>
                            <th className="num is-selectedScenario">{getCompactScenarioLabel(selectedScenario.label)}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scenarioRows.map((row) => (
                            <tr key={row.label}>
                              <th>{row.label}</th>
                              <td className="num">{row.current}</td>
                              <td className="num is-selectedScenario">{row.selected}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className={`detailKpiRow scenarioKpiRow ${selectedScenario.margin_uplift < -30000 ? "scenarioKpiRow--bad" : selectedScenario.margin_uplift < -11000 ? "scenarioKpiRow--warn" : "scenarioKpiRow--good"}`}>
                      <div className="detailKpiLabel">Incremental margin</div>
                      <div className="detailKpiVal">{fmtEUR(selectedScenario.margin_uplift)}</div>
                    </div>
                  </>
                ) : (
                  <table className="detailTbl">
                    <tbody>{rows.map(([label, value]) => <tr key={label}><th>{label}</th><td className="num">{value}</td></tr>)}</tbody>
                  </table>
                )}
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

function HeroStat({ label, value, sub, purple, blue, tone, color }) {
  return (
    <div className="heroStat">
      <div className="heroStat__label">{label}</div>
      <div className={`heroStat__big ${purple ? "heroStat__big--purple" : ""} ${tone ? `heroStat__big--${tone}` : ""}`} style={color ? { color } : blue ? { color: "#7aa2ff" } : undefined}>{value}</div>
      {sub && <div className="heroStat__sub">{sub}</div>}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [typeFilter, setTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedAppliedAction, setSelectedAppliedAction] = useState(null);
  const [appliedBackTab, setAppliedBackTab] = useState("applied-actions");
  const [scenarioKey, setScenarioKey] = useState("md10");

  function openProduct(product) {
    if (product?.sku === "AT-93847") {
      const appliedAction = APPLIED_ACTIONS.find((action) => action.sku === product.sku);
      if (appliedAction) {
        setSelectedAppliedAction(appliedAction);
        setAppliedBackTab(activeTab === "matrix-detail" ? "matrix-detail" : "applied-actions");
        setActiveTab("applied-detail");
        return;
      }
    }
    setSelectedProduct(product);
    const detail = getDetailForProduct(product);
    setScenarioKey(detail.defaultScenario);
    setActiveTab("detail");
  }

  function openAppliedAction(action) {
    setSelectedAppliedAction(action);
    setAppliedBackTab(activeTab.startsWith("applied") ? activeTab : "applied-actions");
    setActiveTab("applied-detail");
  }

  function openMatrixDetail(type = "markdown") {
    setActiveTab(type === "markup" ? "matrix-markup-detail" : "matrix-detail");
  }

  return (
    <div className="appShell">
      <Sidebar activeTab={activeTab} onNavigate={setActiveTab} />
      <div className="mainShell">
        <PageHeader activeTab={activeTab} />
        <main className="content">
          {activeTab === "overview" && <OverviewPage onOpenMatrixCell={openMatrixDetail} />}
          {activeTab === "recommendations" && <RecommendationsPage onOpen={openProduct} />}
          {activeTab === "recommendations-markdown" && <RecommendationsPage type="markdown" onOpen={openProduct} />}
          {activeTab === "recommendations-markup" && <RecommendationsPage type="markup" onOpen={openProduct} />}
          {activeTab === "products" && <ProductListPage typeFilter={typeFilter} categoryFilter={categoryFilter} search={search} onTypeChange={setTypeFilter} onCategoryChange={setCategoryFilter} onSearchChange={setSearch} onOpen={openProduct} />}
          {activeTab === "applied-actions" && <AppliedActionsPage onOpenAppliedAction={openAppliedAction} />}
          {activeTab === "applied-markdown" && <AppliedActionsPage type="markdown" onOpenAppliedAction={openAppliedAction} />}
          {activeTab === "applied-markup" && <AppliedActionsPage type="markup" onOpenAppliedAction={openAppliedAction} />}
          {activeTab === "matrix-detail" && <MatrixDetailPage onOpen={openProduct} onBack={() => setActiveTab("overview")} />}
          {activeTab === "matrix-markup-detail" && <MatrixMarkupDetailPage onOpen={openProduct} onBack={() => setActiveTab("overview")} />}
          {activeTab === "detail" && selectedProduct && <ProductDetailPage selectedProduct={selectedProduct} scenarioKey={scenarioKey} onScenarioChange={setScenarioKey} onBack={() => setActiveTab("products")} />}
          {activeTab === "applied-detail" && selectedAppliedAction && <AppliedActionDetailPage selectedAction={selectedAppliedAction} onBack={() => setActiveTab(appliedBackTab)} />}
        </main>
      </div>
    </div>
  );
}
