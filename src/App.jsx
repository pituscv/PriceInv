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

function getScenarioHeaderLabel(label) {
  return String(label).replace(/\s*\(Recommended\)\s*/i, "");
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
    ["recommendations-markdown", "Markdown"],
    ["recommendations-markup", "Markup"],
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
            <span>Proposed policies</span>
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
    overview: "Portfolio overview",
    products: "Products",
    recommendations: "Proposed policies",
    "recommendations-markdown": "Proposed markdown policies",
    "recommendations-markup": "Proposed markup policies",
    "applied-actions": "Applied Actions",
    "applied-markdown": "Applied Markdowns",
    "applied-markup": "Applied Markups",
    detail: "Product Detail",
    "applied-detail": "Applied Action Detail",
    "matrix-detail": "Matrix Detail",
    "matrix-keep-markdown-detail": "Matrix Detail",
    "matrix-new-markup-detail": "Matrix Detail",
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
  const [hoveredCell, setHoveredCell] = useState(null);
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
    const neutral = [186, 190, 194];
    const markdown = [235, 96, 96];
    const markup = [75, 190, 120];
    const tone = pct < 0
      ? mixColor(neutral, markdown, Math.min(Math.abs(pct) / 60, 1))
      : mixColor(neutral, markup, Math.min(pct / 60, 1));
    const glow = pct < 0 ? "rgba(235, 96, 96, 0.20)" : pct > 0 ? "rgba(75, 190, 120, 0.20)" : "rgba(234, 242, 255, 0.14)";
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
        <table className="matrix" onMouseLeave={() => setHoveredCell(null)}>
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
                <th
                  className={`matrix__columnHeader ${hoveredCell?.col === index ? "is-hovered-column" : ""}`}
                  key={col}
                  onMouseEnter={() => setHoveredCell({ row: null, col: index })}
                >
                  <span className={`band band--policy ${index === 0 ? "band--first" : ""} ${index === cols.length - 1 ? "band--last" : ""}`} style={policyBandStyle(col)}>{policyBandLabel(col)}</span>
                </th>
              ))}
              <th className="matrix__totalHeader" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr className={hoveredCell?.row === ri ? "is-hovered-row" : ""} key={row}>
                {ri === 0 && (
                  <th className="matrix__yAxis" rowSpan={rows.length + 1}>
                    <span>Proposed policy week 9</span>
                  </th>
                )}
                <th className={`rowhdr ${hoveredCell?.row === ri ? "is-hovered-row" : ""}`}>
                  <span className={`band band--policy ${ri === 0 ? "band--top" : ""} ${ri === rows.length - 1 ? "band--bottom" : ""}`} style={policyBandStyle(row)}>{policyBandLabel(row)}</span>
                </th>
                {values[ri].map((value, ci) => {
                  const n = Number(value) || 0;
                  const rowPct = parseInt(row, 10);
                  const isDiagonal = ri === ci;
                  const isZero = n === 0;
                  const clickTarget = row === "-20%" && cols[ci] === "-10%" && n === 21
                    ? "markdown"
                    : row === "-20%" && cols[ci] === "-20%" && n === 557
                      ? "keepMarkdown"
                      : row === "+20%" && cols[ci] === "0%" && n === 10
                        ? "newMarkup"
                        : row === "+10%" && cols[ci] === "+10%" && n === 142
                          ? "markup"
                          : null;
                  const isClickableCell = Boolean(clickTarget);
                  const alpha = isZero ? 0 : isDiagonal ? 0.18 : clamp(Math.log1p(n) / Math.log1p(heatMax), 0.08, 1);
                  const actionClass = isDiagonal ? "matrixCell--diagonal" : rowPct < 0 ? "matrixCell--markdown" : rowPct > 0 ? "matrixCell--markup" : "matrixCell--neutral";
                  return (
                    <td
                      className={`matrixCell matrixCell--interactive ${actionClass} ${!isDiagonal && !isZero ? "matrixCell--action" : ""} ${isClickableCell ? "matrixCell--clickable" : ""} ${hoveredCell?.col === ci ? "is-hovered-column" : ""} ${hoveredCell?.row === ri && hoveredCell?.col === ci ? "is-hovered-cell" : ""}`}
                      key={cols[ci]}
                      onMouseEnter={() => setHoveredCell({ row: ri, col: ci })}
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
                      {fmtInt(n)}
                    </td>
                  );
                })}
                <td className="totalCell">{fmtInt(rowTotals[ri])}</td>
              </tr>
            ))}
            <tr>
              <th className="rowhdr">Total</th>
              {colTotals.map((total, i) => (
                <td
                  className={`totalCell ${hoveredCell?.col === i ? "is-hovered-column" : ""}`}
                  key={cols[i]}
                  onMouseEnter={() => setHoveredCell({ row: null, col: i })}
                >
                  {fmtInt(total)}
                </td>
              ))}
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

function inferProductCategory(name) {
  const value = String(name).toLowerCase();
  if (value.includes("shoe")) return "Footwear";
  if (
    value.includes("sock")
    || value.includes("cap")
    || value.includes("mat")
    || value.includes("glove")
    || value.includes("bag")
    || value.includes("bottle")
    || value.includes("headband")
    || value.includes("sweatband")
    || value.includes("visor")
    || value.includes("backpack")
  ) return "Accessories";
  return "Clothing";
}

function exactPctFromPolicy(policy) {
  const match = String(policy).match(/([-+]?\d+(?:\.\d+)?)%/);
  return match ? Number(match[1]) / 100 : null;
}

function dedupeBySku(rows) {
  const bySku = new Map();
  rows.forEach((row) => {
    if (!bySku.has(row.sku)) bySku.set(row.sku, row);
  });
  return [...bySku.values()];
}

function parseMarkdownPolicyRows(rawRows, source) {
  return rawRows.trim().split("\n").map((line) => {
    const [name, sku, curr, comp, pctComp, riskW0, policyW8, riskW8, performanceW8, recommendedAction, policyW9, finalPrice, finalPctComp, uplift, revUplift, marginUp] = line.split("|");
    const proposedPolicy = policyW9 || recommendedAction;
    return {
      id: `${source}-${sku}`,
      name,
      sku,
      type: "markdown",
      category: inferProductCategory(name),
      curr: Number(curr),
      comp: Number(comp),
      pct_comp: Number(pctComp) / 100,
      inv_risk_pct: Number(riskW0) / 100,
      policyW8,
      riskW8: Number(riskW8) / 100,
      performanceW8,
      recommendedAction,
      reco: proposedPolicy,
      exact_action_pct: proposedPolicy === "Keep markdown" ? null : exactPctFromPolicy(proposedPolicy),
      obsolete: 0,
      final_price: Number(finalPrice),
      final_pct_comp: Number(finalPctComp) / 100,
      uplift: Number(uplift) / 100,
      rev_uplift: Number(revUplift),
      margin_up: Number(marginUp),
      matrixSource: source,
    };
  });
}

function parseMarkupPolicyRows(rawRows, source) {
  return rawRows.trim().split("\n").map((line) => {
    const [name, sku, curr, comp, pctComp, riskW0, policyW8, performanceW8, recommendedAction, policyW9, finalPrice, finalPctComp, uplift, revUplift, marginUp] = line.split("|");
    return {
      id: `${source}-${sku}`,
      name,
      sku,
      type: "markup",
      category: inferProductCategory(name),
      curr: Number(curr),
      comp: Number(comp),
      pct_comp: Number(pctComp) / 100,
      inv_risk_pct: Number(riskW0) / 100,
      policyW8,
      performanceW8,
      recommendedAction,
      policyW9,
      reco: "Mark-up +10%",
      exact_action_pct: exactPctFromPolicy(policyW9),
      rot: 1 + (Number(uplift) / 100),
      final_price: Number(finalPrice),
      final_pct_comp: Number(finalPctComp) / 100,
      uplift: Number(uplift) / 100,
      rev_uplift: Number(revUplift),
      margin_up: Number(marginUp),
      matrixSource: source,
    };
  });
}

const MATRIX_ADDITIONAL_MARKDOWN_PRODUCTS = parseMarkdownPolicyRows(`
Active Training T-Shirt|AT-93847|22.47|20.9|7.5|20.0|Markdown -5.8%|12.0|Not enough|Additional markdown|Markdown -11.4%|19.9|-4.8|30.0|38200|12531
Sleeveless Training Top|ST-35780|24.54|22.9|7.2|14.0|Markdown -7.6%|9.5|Not enough|Additional markdown|Markdown -18.9%|19.9|-13.1|20.0|15300|5400
Performance Running Shorts|RS-11234|35.47|31.9|11.2|18.0|Markdown -6.3%|11.5|Not enough|Additional markdown|Markdown -15.7%|29.9|-6.3|25.0|27100|9150
Lightweight Hoodie|LH-22345|48.05|44.9|7.0|22.0|Markdown -5.4%|14.0|Not enough|Additional markdown|Markdown -12.8%|41.9|-6.7|28.0|44250|15100
Compression Leggings|GL-33456|40.39|36.9|9.5|19.0|Markdown -5.9%|13.0|Not enough|Additional markdown|Markdown -13.6%|34.9|-5.4|27.0|33950|11200
Breathable Tank Top|TT-44567|17.49|15.9|10.0|15.0|Markdown -6.7%|10.0|Not enough|Additional markdown|Markdown -14.8%|14.9|-6.3|22.0|10650|3900
Running Zip Jacket|TZ-55678|55.23|49.9|10.7|25.0|Markdown -8.4%|17.0|Not enough|Additional markdown|Markdown -18.7%|44.9|-10.0|32.0|51200|17300
Sports Socks Pack|SS-66789|11.31|9.9|14.2|12.0|Markdown -5.2%|8.5|Not enough|Additional markdown|Markdown -12.4%|9.9|0.0|18.0|7600|2600
Fitness Cap|FC-77890|19.95|17.9|11.5|16.0|Markdown -6.8%|11.0|Not enough|Additional markdown|Markdown -15.3%|16.9|-5.6|21.0|12300|4450
Yoga Mat|YM-88901|29.77|26.9|10.7|17.0|Markdown -7.2%|12.5|Not enough|Additional markdown|Markdown -16.4%|24.9|-7.4|26.0|20850|7250
Running Shoes|RS-99012|84.89|79.9|6.2|23.0|Markdown -5.1%|16.0|Not enough|Additional markdown|Markdown -10.6%|75.9|-5.0|29.0|75000|26000
Sports Bra|SB-10123|27.95|24.9|12.2|14.0|Markdown -6.4%|9.0|Not enough|Additional markdown|Markdown -14.5%|23.9|-4.0|23.0|16750|5600
Training Shorts|CS-11234|44.78|39.9|12.2|20.0|Markdown -7.3%|14.0|Not enough|Additional markdown|Markdown -17.6%|36.9|-7.5|27.0|30400|10150
Track Pants|TP-12345|49.83|45.9|8.6|18.0|Markdown -6.2%|12.0|Not enough|Additional markdown|Markdown -13.9%|42.9|-6.5|25.0|36050|12000
Windbreaker Jacket|WJ-13456|65.23|59.9|8.9|21.0|Markdown -7.5%|15.0|Not enough|Additional markdown|Markdown -15.8%|54.9|-8.3|28.0|47700|16250
Training Gloves|TG-14567|13.87|12.9|7.5|13.0|Markdown -6.6%|9.0|Not enough|Additional markdown|Markdown -14.2%|11.9|-7.8|20.0|9450|3250
Gym Bag|GB-15678|37.77|34.9|8.2|17.0|Markdown -5.7%|11.5|Not enough|Additional markdown|Markdown -12.9%|32.9|-5.7|24.0|23600|8000
Water Bottle|WB-16789|9.04|8.9|1.6|12.0|Markdown -5.3%|8.0|Not enough|Additional markdown|Markdown -12.6%|7.9|-11.2|19.0|6250|2150
Headband|HB-17890|7.83|6.9|13.5|10.0|Markdown -5.5%|7.0|Not enough|Additional markdown|Markdown -11.8%|6.9|0.0|15.0|4600|1550
Ankle Socks|AS-18901|5.50|4.9|12.2|11.0|Markdown -5.1%|7.5|Not enough|Additional markdown|Markdown -10.9%|4.9|0.0|14.0|4350|1450
Sweatband|SB-19012|7.91|7.9|0.1|12.0|Markdown -5.9%|8.5|Not enough|Additional markdown|Markdown -12.7%|6.9|-12.7|16.0|5400|1800
`, "Additional markdown");

const MATRIX_KEEP_MARKDOWN_PRODUCTS = parseMarkdownPolicyRows(`
Performance Running Shorts|RS-11234|30.87|29.9|3.2|18.0|Markdown -12.9%|1.8|Working as expected|Keep markdown|Keep markdown|26.9|-10.0|18.0|15200|5200
Lightweight Training Hoodie|LH-22345|46.29|43.9|5.4|16.5|Markdown -11.6%|2.2|Working as expected|Keep markdown|Keep markdown|40.9|-6.8|17.0|16800|5600
Gym Compression Leggings|GL-33456|37.05|35.9|3.2|14.0|Markdown -11.2%|1.5|Working as expected|Keep markdown|Keep markdown|32.9|-8.4|16.0|12400|4100
Breathable Tank Top|TT-44567|17.79|17.9|-0.6|13.5|Markdown -10.6%|2.1|Working as expected|Keep markdown|Keep markdown|15.9|-11.2|15.0|9800|3300
Training Zip Jacket|TZ-55678|54.83|51.9|5.6|21.0|Markdown -10.8%|1.6|Working as expected|Keep markdown|Keep markdown|48.9|-5.8|20.0|22400|7400
Sports Socks Pack|SS-66789|9.95|9.9|0.5|12.0|Markdown -10.6%|0.9|Working as expected|Keep markdown|Keep markdown|8.9|-10.1|14.0|7600|2600
Fitness Cap|FC-77890|18.25|17.9|2.0|15.0|Markdown -12.9%|1.8|Working as expected|Keep markdown|Keep markdown|15.9|-11.2|16.0|12300|4450
Yoga Mat|YM-88901|26.90|25.9|3.9|17.0|Markdown -11.2%|2.3|Working as expected|Keep markdown|Keep markdown|23.9|-7.7|17.0|20850|7250
Running Shoes|RS-99012|82.02|78.9|4.0|20.0|Markdown -11.1%|2.1|Working as expected|Keep markdown|Keep markdown|72.9|-7.6|19.0|75000|26000
Sports Bra|SB-10123|25.43|24.9|2.1|14.0|Markdown -13.9%|1.3|Working as expected|Keep markdown|Keep markdown|21.9|-12.0|15.0|16750|5600
Cycling Shorts|CS-11234|42.45|39.9|6.4|19.0|Markdown -10.7%|1.9|Working as expected|Keep markdown|Keep markdown|37.9|-5.0|19.0|30400|10150
Track Pants|TP-12345|48.18|45.9|5.0|18.0|Markdown -11.0%|1.3|Working as expected|Keep markdown|Keep markdown|42.9|-6.5|18.0|36050|12000
Windbreaker Jacket|WJ-13456|63.69|59.9|6.3|21.0|Markdown -10.7%|2.6|Working as expected|Keep markdown|Keep markdown|56.9|-5.0|20.0|47700|16250
Training Gloves|TG-14567|13.12|12.4|5.8|13.0|Markdown -16.9%|0.9|Working as expected|Keep markdown|Keep markdown|10.9|-12.1|14.0|9450|3250
Gym Bag|GB-15678|36.73|34.9|5.2|17.0|Markdown -10.4%|1.5|Working as expected|Keep markdown|Keep markdown|32.9|-5.7|17.0|23600|8000
Water Bottle|WB-16789|8.34|8.9|-6.3|12.0|Markdown -17.3%|1.3|Working as expected|Keep markdown|Keep markdown|6.9|-22.5|13.0|6250|2150
Headband|HB-17890|6.21|6.9|-10.0|10.0|Markdown -14.7%|1.6|Working as expected|Keep markdown|Keep markdown|5.3|-23.2|12.0|4600|1550
Ankle Socks|AS-18901|4.72|4.9|-3.7|11.0|Markdown -17.4%|0.9|Working as expected|Keep markdown|Keep markdown|3.9|-20.4|12.0|4350|1450
Sweatband|SB-19012|7.57|7.9|-4.2|12.0|Markdown -15.5%|1.5|Working as expected|Keep markdown|Keep markdown|6.4|-19.0|13.0|5400|1800
Thermal Running Top|RT-20123|32.66|31.9|2.4|16.0|Markdown -11.5%|1.7|Working as expected|Keep markdown|Keep markdown|28.9|-9.4|17.0|15000|5000
Padded Training Vest|TV-21234|58.15|54.9|5.9|19.5|Markdown -10.7%|2.9|Working as expected|Keep markdown|Keep markdown|51.9|-5.5|19.0|38400|12800
Seamless Training Top|ST-22345|23.70|21.9|8.2|14.5|Markdown -10.2%|0.3|Working as expected|Keep markdown|Keep markdown|21.3|-2.7|15.0|11800|3900
Long Sleeve Base Layer|BL-23456|30.65|28.9|6.0|15.5|Markdown -11.0%|2.6|Working as expected|Keep markdown|Keep markdown|27.3|-5.5|16.0|14200|4700
Lightweight Running Jacket|LJ-24567|69.86|65.9|6.0|22.0|Markdown -10.2%|0.9|Working as expected|Keep markdown|Keep markdown|62.9|-4.6|20.0|49800|16900
Training Crew Socks|TC-25678|11.01|10.4|5.9|12.5|Markdown -10.1%|1.5|Working as expected|Keep markdown|Keep markdown|9.9|-4.8|13.0|7100|2450
Athletic Polo Shirt|AP-26789|29.71|27.9|6.5|16.0|Markdown -10.1%|1.3|Working as expected|Keep markdown|Keep markdown|26.9|-3.6|16.0|15300|5100
Running Visor|RV-27890|15.97|14.9|7.2|11.5|Markdown -10.2%|1.6|Working as expected|Keep markdown|Keep markdown|14.3|-4.0|13.0|6900|2300
Training Backpack|TB-28901|43.37|40.9|6.0|18.0|Markdown -10.2%|1.5|Working as expected|Keep markdown|Keep markdown|38.9|-4.9|18.0|27500|9300
Quick Dry T-Shirt|QT-29012|20.54|18.9|8.7|13.5|Markdown -10.2%|2.1|Working as expected|Keep markdown|Keep markdown|18.4|-2.6|14.0|10200|3400
Training Sweatshirt|TS-30123|41.41|38.9|6.5|17.5|Markdown -10.2%|1.6|Working as expected|Keep markdown|Keep markdown|37.2|-4.4|17.0|22100|7400
Performance Joggers|PJ-31234|47.66|44.9|6.1|18.5|Markdown -10.2%|0.9|Working as expected|Keep markdown|Keep markdown|42.8|-4.7|18.0|28900|9700
`, "Keep markdown");

const MATRIX_NEW_MARKUP_PRODUCTS = parseMarkupPolicyRows(`
Athletic Track Pants|TP-92614|54.50|65.90|-17.3|8.0|None|Sell through +12pp vs expected|Increase price|Markup +15.4%|62.9|-0.45|8.0|18500|9200
Basic Running Shoes|RS-71058|69.90|79.90|-12.5|9.0|None|Sell through +10pp vs expected|Increase price|Markup +10.0%|76.9|-3.8|9.0|24000|12000
Performance Running Shorts|PR-57291|34.90|39.90|-12.5|7.5|None|Sell through +9pp vs expected|Increase price|Markup +11.5%|38.9|-2.5|7.0|13500|6800
Windbreaker Jacket|WJ-64821|62.90|69.90|-10.0|8.5|None|Sell through +8pp vs expected|Increase price|Markup +9.5%|68.9|-1.4|8.0|21000|10500
Lightweight Sports Hoodie|LH-66109|52.90|59.90|-11.7|8.0|None|Sell through +9pp vs expected|Increase price|Markup +11.3%|58.9|-1.7|8.0|19800|9800
Performance Polo|PP-77465|39.90|44.90|-11.1|7.0|None|Sell through +7pp vs expected|Increase price|Markup +10.3%|43.9|-2.2|7.0|15000|7500
Compression Shorts|CS-83920|29.90|34.90|-14.3|6.5|None|Sell through +8pp vs expected|Increase price|Markup +13.4%|33.9|-2.9|6.5|14200|7100
Active Training T-Shirt|AT-93847|21.90|24.90|-12.0|7.5|None|Sell through +9pp vs expected|Increase price|Markup +13.7%|24.9|0.0|7.0|12000|6000
High-Waist Leggings|HL-80426|44.90|49.90|-10.0|8.0|None|Sell through +8pp vs expected|Increase price|Markup +11.1%|49.9|0.0|8.0|17500|8800
Thermal Sports Jacket|TJ-46813|66.90|74.90|-10.7|9.5|None|Sell through +11pp vs expected|Increase price|Markup +11.9%|74.9|0.0|9.0|26000|13000
`, "New markup");

const MATRIX_EXISTING_MARKUP_PRODUCTS = [{
  id: "Existing markup-RS-71058",
  name: "Basic Running Shoes",
  sku: "RS-71058",
  type: "markup",
  category: "Footwear",
  curr: 88.9,
  comp: 98.9,
  pct_comp: -0.1,
  rot: 1.82,
  policyW8: "Mark-up +10.1%",
  performanceW8: "Sell through +82pp vs expected",
  recommendedAction: "Keep markup",
  policyW9: "Markup +10.1%",
  reco: "Mark-up +10%",
  exact_action_pct: 0.101,
  final_price: 97.9,
  final_pct_comp: -0.01,
  uplift: 0.1,
  rev_uplift: 29300,
  margin_up: 29300,
  matrixSource: "Existing markup",
}];

const PROPOSED_MARKDOWN_PRODUCTS = [...MATRIX_ADDITIONAL_MARKDOWN_PRODUCTS, ...MATRIX_KEEP_MARKDOWN_PRODUCTS]
  .sort((a, b) => (Number(b.margin_up) || 0) - (Number(a.margin_up) || 0));
const PROPOSED_MARKUP_PRODUCTS = [...MATRIX_NEW_MARKUP_PRODUCTS, ...MATRIX_EXISTING_MARKUP_PRODUCTS]
  .sort((a, b) => (Number(b.margin_up) || 0) - (Number(a.margin_up) || 0));
const MATRIX_PRODUCT_LIST = dedupeBySku([...PROPOSED_MARKDOWN_PRODUCTS, ...PROPOSED_MARKUP_PRODUCTS])
  .sort((a, b) => a.name.localeCompare(b.name));

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

function getProposedPolicyRows(type) {
  if (type === "markdown") return PROPOSED_MARKDOWN_PRODUCTS;
  if (type === "markup") return PROPOSED_MARKUP_PRODUCTS;
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
  const rows = getProposedPolicyRows(type).filter((row) => !categoryFilter || row.category === categoryFilter);
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
  const rows = [
    { name: "Active Training T-Shirt", sku: "AT-93847", curr: 22.47, comp: 20.9, pct_comp: 0.075, inv_risk_pct: 0.2, policyW8: "Markdown -5.8%", riskW8: 0.12, performanceW8: "Not enough", reco: "Markdown -11.4%", exact_action_pct: -0.114, obsolete: 0, final_price: 19.9, final_pct_comp: -0.048, uplift: 0.3, rev_uplift: 38200, margin_up: 12531 },
    { name: "Sleeveless Training Top", sku: "ST-35780", curr: 24.54, comp: 22.9, pct_comp: 0.072, inv_risk_pct: 0.14, policyW8: "Markdown -7.6%", riskW8: 0.095, performanceW8: "Not enough", reco: "Markdown -18.9%", exact_action_pct: -0.189, obsolete: 0, final_price: 19.9, final_pct_comp: -0.131, uplift: 0.2, rev_uplift: 15300, margin_up: 5400 },
    { name: "Performance Running Shorts", sku: "RS-11234", curr: 35.47, comp: 31.9, pct_comp: 0.112, inv_risk_pct: 0.18, policyW8: "Markdown -6.3%", riskW8: 0.115, performanceW8: "Not enough", reco: "Markdown -15.7%", exact_action_pct: -0.157, obsolete: 0, final_price: 29.9, final_pct_comp: -0.063, uplift: 0.25, rev_uplift: 27100, margin_up: 9150 },
    { name: "Lightweight Hoodie", sku: "LH-22345", curr: 48.05, comp: 44.9, pct_comp: 0.07, inv_risk_pct: 0.22, policyW8: "Markdown -5.4%", riskW8: 0.14, performanceW8: "Not enough", reco: "Markdown -12.8%", exact_action_pct: -0.128, obsolete: 0, final_price: 41.9, final_pct_comp: -0.067, uplift: 0.28, rev_uplift: 44250, margin_up: 15100 },
    { name: "Compression Leggings", sku: "GL-33456", curr: 40.39, comp: 36.9, pct_comp: 0.095, inv_risk_pct: 0.19, policyW8: "Markdown -5.9%", riskW8: 0.13, performanceW8: "Not enough", reco: "Markdown -13.6%", exact_action_pct: -0.136, obsolete: 0, final_price: 34.9, final_pct_comp: -0.054, uplift: 0.27, rev_uplift: 33950, margin_up: 11200 },
    { name: "Breathable Tank Top", sku: "TT-44567", curr: 17.49, comp: 15.9, pct_comp: 0.1, inv_risk_pct: 0.15, policyW8: "Markdown -6.7%", riskW8: 0.1, performanceW8: "Not enough", reco: "Markdown -14.8%", exact_action_pct: -0.148, obsolete: 0, final_price: 14.9, final_pct_comp: -0.063, uplift: 0.22, rev_uplift: 10650, margin_up: 3900 },
    { name: "Running Zip Jacket", sku: "TZ-55678", curr: 55.23, comp: 49.9, pct_comp: 0.107, inv_risk_pct: 0.25, policyW8: "Markdown -8.4%", riskW8: 0.17, performanceW8: "Not enough", reco: "Markdown -18.7%", exact_action_pct: -0.187, obsolete: 0, final_price: 44.9, final_pct_comp: -0.1, uplift: 0.32, rev_uplift: 51200, margin_up: 17300 },
    { name: "Sports Socks Pack", sku: "SS-66789", curr: 11.31, comp: 9.9, pct_comp: 0.142, inv_risk_pct: 0.12, policyW8: "Markdown -5.2%", riskW8: 0.085, performanceW8: "Not enough", reco: "Markdown -12.4%", exact_action_pct: -0.124, obsolete: 0, final_price: 9.9, final_pct_comp: 0, uplift: 0.18, rev_uplift: 7600, margin_up: 2600 },
    { name: "Fitness Cap", sku: "FC-77890", curr: 19.95, comp: 17.9, pct_comp: 0.115, inv_risk_pct: 0.16, policyW8: "Markdown -6.8%", riskW8: 0.11, performanceW8: "Not enough", reco: "Markdown -15.3%", exact_action_pct: -0.153, obsolete: 0, final_price: 16.9, final_pct_comp: -0.056, uplift: 0.21, rev_uplift: 12300, margin_up: 4450 },
    { name: "Yoga Mat", sku: "YM-88901", curr: 29.77, comp: 26.9, pct_comp: 0.107, inv_risk_pct: 0.17, policyW8: "Markdown -7.2%", riskW8: 0.125, performanceW8: "Not enough", reco: "Markdown -16.4%", exact_action_pct: -0.164, obsolete: 0, final_price: 24.9, final_pct_comp: -0.074, uplift: 0.26, rev_uplift: 20850, margin_up: 7250 },
    { name: "Running Shoes", sku: "RS-99012", curr: 84.89, comp: 79.9, pct_comp: 0.062, inv_risk_pct: 0.23, policyW8: "Markdown -5.1%", riskW8: 0.16, performanceW8: "Not enough", reco: "Markdown -10.6%", exact_action_pct: -0.106, obsolete: 0, final_price: 75.9, final_pct_comp: -0.05, uplift: 0.29, rev_uplift: 75000, margin_up: 26000 },
    { name: "Sports Bra", sku: "SB-10123", curr: 27.95, comp: 24.9, pct_comp: 0.122, inv_risk_pct: 0.14, policyW8: "Markdown -6.4%", riskW8: 0.09, performanceW8: "Not enough", reco: "Markdown -14.5%", exact_action_pct: -0.145, obsolete: 0, final_price: 23.9, final_pct_comp: -0.04, uplift: 0.23, rev_uplift: 16750, margin_up: 5600 },
    { name: "Training Shorts", sku: "CS-11234", curr: 44.78, comp: 39.9, pct_comp: 0.122, inv_risk_pct: 0.2, policyW8: "Markdown -7.3%", riskW8: 0.14, performanceW8: "Not enough", reco: "Markdown -17.6%", exact_action_pct: -0.176, obsolete: 0, final_price: 36.9, final_pct_comp: -0.075, uplift: 0.27, rev_uplift: 30400, margin_up: 10150 },
    { name: "Track Pants", sku: "TP-12345", curr: 49.83, comp: 45.9, pct_comp: 0.086, inv_risk_pct: 0.18, policyW8: "Markdown -6.2%", riskW8: 0.12, performanceW8: "Not enough", reco: "Markdown -13.9%", exact_action_pct: -0.139, obsolete: 0, final_price: 42.9, final_pct_comp: -0.065, uplift: 0.25, rev_uplift: 36050, margin_up: 12000 },
    { name: "Windbreaker Jacket", sku: "WJ-13456", curr: 65.23, comp: 59.9, pct_comp: 0.089, inv_risk_pct: 0.21, policyW8: "Markdown -7.5%", riskW8: 0.15, performanceW8: "Not enough", reco: "Markdown -15.8%", exact_action_pct: -0.158, obsolete: 0, final_price: 54.9, final_pct_comp: -0.083, uplift: 0.28, rev_uplift: 47700, margin_up: 16250 },
    { name: "Training Gloves", sku: "TG-14567", curr: 13.87, comp: 12.9, pct_comp: 0.075, inv_risk_pct: 0.13, policyW8: "Markdown -6.6%", riskW8: 0.09, performanceW8: "Not enough", reco: "Markdown -14.2%", exact_action_pct: -0.142, obsolete: 0, final_price: 11.9, final_pct_comp: -0.078, uplift: 0.2, rev_uplift: 9450, margin_up: 3250 },
    { name: "Gym Bag", sku: "GB-15678", curr: 37.77, comp: 34.9, pct_comp: 0.082, inv_risk_pct: 0.17, policyW8: "Markdown -5.7%", riskW8: 0.115, performanceW8: "Not enough", reco: "Markdown -12.9%", exact_action_pct: -0.129, obsolete: 0, final_price: 32.9, final_pct_comp: -0.057, uplift: 0.24, rev_uplift: 23600, margin_up: 8000 },
    { name: "Water Bottle", sku: "WB-16789", curr: 9.04, comp: 8.9, pct_comp: 0.016, inv_risk_pct: 0.12, policyW8: "Markdown -5.3%", riskW8: 0.08, performanceW8: "Not enough", reco: "Markdown -12.6%", exact_action_pct: -0.126, obsolete: 0, final_price: 7.9, final_pct_comp: -0.112, uplift: 0.19, rev_uplift: 6250, margin_up: 2150 },
    { name: "Headband", sku: "HB-17890", curr: 7.83, comp: 6.9, pct_comp: 0.135, inv_risk_pct: 0.1, policyW8: "Markdown -5.5%", riskW8: 0.07, performanceW8: "Not enough", reco: "Markdown -11.8%", exact_action_pct: -0.118, obsolete: 0, final_price: 6.9, final_pct_comp: 0, uplift: 0.15, rev_uplift: 4600, margin_up: 1550 },
    { name: "Ankle Socks", sku: "AS-18901", curr: 5.5, comp: 4.9, pct_comp: 0.122, inv_risk_pct: 0.11, policyW8: "Markdown -5.1%", riskW8: 0.075, performanceW8: "Not enough", reco: "Markdown -10.9%", exact_action_pct: -0.109, obsolete: 0, final_price: 4.9, final_pct_comp: 0, uplift: 0.14, rev_uplift: 4350, margin_up: 1450 },
    { name: "Sweatband", sku: "SB-19012", curr: 7.91, comp: 7.9, pct_comp: 0.001, inv_risk_pct: 0.12, policyW8: "Markdown -5.9%", riskW8: 0.085, performanceW8: "Not enough", reco: "Markdown -12.7%", exact_action_pct: -0.127, obsolete: 0, final_price: 6.9, final_pct_comp: -0.127, uplift: 0.16, rev_uplift: 5400, margin_up: 1800 },
  ].map((row) => ({ ...row, type: "markdown" }));
  const revMax = Math.max(...rows.map((row) => Number(row.rev_uplift) || 0), 1);
  const marginMax = Math.max(...rows.map((row) => Number(row.margin_up) || 0), 1);
  const riskMax = Math.max(...rows.map((row) => Number(row.inv_risk_pct) || 0), 1);
  const riskW8Max = Math.max(...rows.map((row) => Number(row.riskW8) || 0), 1);
  const fmtMoneyNumber = (value) => value == null || Number.isNaN(Number(value)) ? "-" : Number(value).toLocaleString("en-US", { minimumFractionDigits: String(value).includes(".") ? Math.min(String(value).split(".")[1].length, 2) : 0, maximumFractionDigits: 2 });
  const columns = [
    { key: "name", label: "Name" },
    { key: "sku", label: "SKU" },
    { key: "curr", label: "Initial (EUR)", align: "num", render: fmtMoneyNumber },
    { key: "comp", label: "Competitor (EUR)", align: "num", render: fmtMoneyNumber },
    { key: "pct_comp", label: "Price vs competitor", align: "num", render: fmtPct },
    { key: "inv_risk_pct", label: "Inventory at risk W0", align: "num", render: fmtPct, cellClass: "riskCell", max: riskMax },
    { key: "policyW8", label: "Policy W8" },
    { key: "riskW8", label: "Inventory at risk W8", align: "num", render: fmtPct, cellClass: "riskCell", max: riskW8Max },
    { key: "performanceW8", label: "W8 performance" },
    { key: "reco", label: "Policy W9 (proposed)", render: (_, row) => <RecoChipForProduct product={row} /> },
    { key: "obsolete", label: "Inventory at risk end of season", align: "num", render: fmtPct },
    { key: "final_price", label: "Price W9 (EUR)", align: "num", render: fmtMoneyNumber },
    { key: "final_pct_comp", label: "Final vs competitor", align: "num", render: fmtIndex },
    { key: "uplift", label: "Uplift", align: "num", render: fmtPct },
    { key: "rev_uplift", label: "Revenue Uplift (EUR)", align: "num", render: fmtEUR, cellClass: "upsideCell", max: revMax },
    { key: "margin_up", label: "Margin Uplift (EUR)", align: "num", render: fmtEUR, cellClass: "upsideCell", max: marginMax },
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
        <div className="footnote">{rows.length} products shown from the selected matrix transition.</div>
      </div>
    </section>
  );
}

function MatrixKeepMarkdownDetailPage({ onOpen, onBack }) {
  const rows = `
Performance Running Shorts|RS-11234|30.87|29.9|3.2|18.0|Markdown -12.9%|1.8|Working as expected|Keep markdown|26.9|-10.0|18.0|15200|5200
Lightweight Training Hoodie|LH-22345|46.29|43.9|5.4|16.5|Markdown -11.6%|2.2|Working as expected|Keep markdown|40.9|-6.8|17.0|16800|5600
Gym Compression Leggings|GL-33456|37.05|35.9|3.2|14.0|Markdown -11.2%|1.5|Working as expected|Keep markdown|32.9|-8.4|16.0|12400|4100
Breathable Tank Top|TT-44567|17.79|17.9|-0.6|13.5|Markdown -10.6%|2.1|Working as expected|Keep markdown|15.9|-11.2|15.0|9800|3300
Training Zip Jacket|TZ-55678|54.83|51.9|5.6|21.0|Markdown -10.8%|1.6|Working as expected|Keep markdown|48.9|-5.8|20.0|22400|7400
Sports Socks Pack|SS-66789|9.95|9.9|0.5|12.0|Markdown -10.6%|0.9|Working as expected|Keep markdown|8.9|-10.1|14.0|7600|2600
Fitness Cap|FC-77890|18.25|17.9|2.0|15.0|Markdown -12.9%|1.8|Working as expected|Keep markdown|15.9|-11.2|16.0|12300|4450
Yoga Mat|YM-88901|26.90|25.9|3.9|17.0|Markdown -11.2%|2.3|Working as expected|Keep markdown|23.9|-7.7|17.0|20850|7250
Running Shoes|RS-99012|82.02|78.9|4.0|20.0|Markdown -11.1%|2.1|Working as expected|Keep markdown|72.9|-7.6|19.0|75000|26000
Sports Bra|SB-10123|25.43|24.9|2.1|14.0|Markdown -13.9%|1.3|Working as expected|Keep markdown|21.9|-12.0|15.0|16750|5600
Cycling Shorts|CS-11234|42.45|39.9|6.4|19.0|Markdown -10.7%|1.9|Working as expected|Keep markdown|37.9|-5.0|19.0|30400|10150
Track Pants|TP-12345|48.18|45.9|5.0|18.0|Markdown -11.0%|1.3|Working as expected|Keep markdown|42.9|-6.5|18.0|36050|12000
Windbreaker Jacket|WJ-13456|63.69|59.9|6.3|21.0|Markdown -10.7%|2.6|Working as expected|Keep markdown|56.9|-5.0|20.0|47700|16250
Training Gloves|TG-14567|13.12|12.4|5.8|13.0|Markdown -16.9%|0.9|Working as expected|Keep markdown|10.9|-12.1|14.0|9450|3250
Gym Bag|GB-15678|36.73|34.9|5.2|17.0|Markdown -10.4%|1.5|Working as expected|Keep markdown|32.9|-5.7|17.0|23600|8000
Water Bottle|WB-16789|8.34|8.9|-6.3|12.0|Markdown -17.3%|1.3|Working as expected|Keep markdown|6.9|-22.5|13.0|6250|2150
Headband|HB-17890|6.21|6.9|-10.0|10.0|Markdown -14.7%|1.6|Working as expected|Keep markdown|5.3|-23.2|12.0|4600|1550
Ankle Socks|AS-18901|4.72|4.9|-3.7|11.0|Markdown -17.4%|0.9|Working as expected|Keep markdown|3.9|-20.4|12.0|4350|1450
Sweatband|SB-19012|7.57|7.9|-4.2|12.0|Markdown -15.5%|1.5|Working as expected|Keep markdown|6.4|-19.0|13.0|5400|1800
Thermal Running Top|RT-20123|32.66|31.9|2.4|16.0|Markdown -11.5%|1.7|Working as expected|Keep markdown|28.9|-9.4|17.0|15000|5000
Padded Training Vest|TV-21234|58.15|54.9|5.9|19.5|Markdown -10.7%|2.9|Working as expected|Keep markdown|51.9|-5.5|19.0|38400|12800
Seamless Training Top|ST-22345|23.70|21.9|8.2|14.5|Markdown -10.2%|0.3|Working as expected|Keep markdown|21.3|-2.7|15.0|11800|3900
Long Sleeve Base Layer|BL-23456|30.65|28.9|6.0|15.5|Markdown -11.0%|2.6|Working as expected|Keep markdown|27.3|-5.5|16.0|14200|4700
Lightweight Running Jacket|LJ-24567|69.86|65.9|6.0|22.0|Markdown -10.2%|0.9|Working as expected|Keep markdown|62.9|-4.6|20.0|49800|16900
Training Crew Socks|TC-25678|11.01|10.4|5.9|12.5|Markdown -10.1%|1.5|Working as expected|Keep markdown|9.9|-4.8|13.0|7100|2450
Athletic Polo Shirt|AP-26789|29.71|27.9|6.5|16.0|Markdown -10.1%|1.3|Working as expected|Keep markdown|26.9|-3.6|16.0|15300|5100
Running Visor|RV-27890|15.97|14.9|7.2|11.5|Markdown -10.2%|1.6|Working as expected|Keep markdown|14.3|-4.0|13.0|6900|2300
Training Backpack|TB-28901|43.37|40.9|6.0|18.0|Markdown -10.2%|1.5|Working as expected|Keep markdown|38.9|-4.9|18.0|27500|9300
Quick Dry T-Shirt|QT-29012|20.54|18.9|8.7|13.5|Markdown -10.2%|2.1|Working as expected|Keep markdown|18.4|-2.6|14.0|10200|3400
Training Sweatshirt|TS-30123|41.41|38.9|6.5|17.5|Markdown -10.2%|1.6|Working as expected|Keep markdown|37.2|-4.4|17.0|22100|7400
Performance Joggers|PJ-31234|47.66|44.9|6.1|18.5|Markdown -10.2%|0.9|Working as expected|Keep markdown|42.8|-4.7|18.0|28900|9700
`.trim().split("\n").map((line) => {
    const [name, sku, curr, comp, pctComp, riskW0, policyW8, riskW8, performanceW8, recommendedAction, finalPrice, finalPctComp, uplift, revUplift, marginUp] = line.split("|");
    return {
      name,
      sku,
      type: "markdown",
      curr: Number(curr),
      comp: Number(comp),
      pct_comp: Number(pctComp) / 100,
      inv_risk_pct: Number(riskW0) / 100,
      policyW8,
      riskW8: Number(riskW8) / 100,
      performanceW8,
      recommendedAction,
      final_price: Number(finalPrice),
      final_pct_comp: Number(finalPctComp) / 100,
      uplift: Number(uplift) / 100,
      rev_uplift: Number(revUplift),
      margin_up: Number(marginUp),
    };
  });
  const revMax = Math.max(...rows.map((row) => Number(row.rev_uplift) || 0), 1);
  const marginMax = Math.max(...rows.map((row) => Number(row.margin_up) || 0), 1);
  const riskMax = Math.max(...rows.map((row) => Number(row.inv_risk_pct) || 0), 1);
  const riskW8Max = Math.max(...rows.map((row) => Number(row.riskW8) || 0), 1);
  const fmtMoneyNumber = (value) => value == null || Number.isNaN(Number(value)) ? "-" : Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const columns = [
    { key: "name", label: "Name" },
    { key: "sku", label: "SKU" },
    { key: "curr", label: "Initial (EUR)", align: "num", render: fmtMoneyNumber },
    { key: "comp", label: "Competitor (EUR)", align: "num", render: fmtMoneyNumber },
    { key: "pct_comp", label: "Price vs competitor", align: "num", render: fmtPct },
    { key: "inv_risk_pct", label: "Inventory at risk W0", align: "num", render: fmtPct, cellClass: "riskCell", max: riskMax },
    { key: "policyW8", label: "Policy W8" },
    { key: "riskW8", label: "Inventory at risk W8", align: "num", render: fmtPct, cellClass: "riskCell", max: riskW8Max },
    { key: "performanceW8", label: "W8 performance" },
    { key: "recommendedAction", label: "Recommended action" },
    { key: "final_price", label: "Price Week 9 (EUR)", align: "num", render: fmtMoneyNumber },
    { key: "final_pct_comp", label: "Final vs competitor", align: "num", render: fmtIndex },
    { key: "uplift", label: "Uplift", align: "num", render: fmtPct },
    { key: "rev_uplift", label: "Revenue Uplift (EUR)", align: "num", render: fmtEUR, cellClass: "upsideCell", max: revMax },
    { key: "margin_up", label: "Margin Uplift (EUR)", align: "num", render: fmtEUR, cellClass: "upsideCell", max: marginMax },
  ];
  return (
    <section className="panel">
      <div className="panel__head panel__head--split">
        <div>
          <div className="panel__title">Matrix keep-markdown actions</div>
          <div className="panel__hint">Products where the Week 8 markdown is working as expected.</div>
        </div>
        <button className="btn btn--ghost btn--compact" type="button" onClick={onBack}>Back to Dashboard</button>
      </div>
      <div className="panel__body">
        <DataTable rows={rows} columns={columns} onOpen={onOpen} />
        <div className="footnote">{rows.length} products shown from the selected matrix transition.</div>
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

function MatrixNewMarkupDetailPage({ onOpen, onBack }) {
  const rows = `
Athletic Track Pants|TP-92614|54.50|65.90|-17.3|8.0|None|Sell through +12pp vs expected|Increase price|Markup +15.4%|62.9|-0.45|8.0|18500|9200
Basic Running Shoes|RS-71058|69.90|79.90|-12.5|9.0|None|Sell through +10pp vs expected|Increase price|Markup +10.0%|76.9|-3.8|9.0|24000|12000
Performance Running Shorts|PR-57291|34.90|39.90|-12.5|7.5|None|Sell through +9pp vs expected|Increase price|Markup +11.5%|38.9|-2.5|7.0|13500|6800
Windbreaker Jacket|WJ-64821|62.90|69.90|-10.0|8.5|None|Sell through +8pp vs expected|Increase price|Markup +9.5%|68.9|-1.4|8.0|21000|10500
Lightweight Sports Hoodie|LH-66109|52.90|59.90|-11.7|8.0|None|Sell through +9pp vs expected|Increase price|Markup +11.3%|58.9|-1.7|8.0|19800|9800
Performance Polo|PP-77465|39.90|44.90|-11.1|7.0|None|Sell through +7pp vs expected|Increase price|Markup +10.3%|43.9|-2.2|7.0|15000|7500
Compression Shorts|CS-83920|29.90|34.90|-14.3|6.5|None|Sell through +8pp vs expected|Increase price|Markup +13.4%|33.9|-2.9|6.5|14200|7100
Active Training T-Shirt|AT-93847|21.90|24.90|-12.0|7.5|None|Sell through +9pp vs expected|Increase price|Markup +13.7%|24.9|0.0|7.0|12000|6000
High-Waist Leggings|HL-80426|44.90|49.90|-10.0|8.0|None|Sell through +8pp vs expected|Increase price|Markup +11.1%|49.9|0.0|8.0|17500|8800
Thermal Sports Jacket|TJ-46813|66.90|74.90|-10.7|9.5|None|Sell through +11pp vs expected|Increase price|Markup +11.9%|74.9|0.0|9.0|26000|13000
`.trim().split("\n").map((line) => {
    const [name, sku, curr, comp, pctComp, riskW0, policyW8, performanceW8, recommendedAction, policyW9, finalPrice, finalPctComp, uplift, revUplift, marginUp] = line.split("|");
    const exactActionMatch = policyW9.match(/([-+]?\d+(?:\.\d+)?)%/);
    return {
      name,
      sku,
      type: "markup",
      curr: Number(curr),
      comp: Number(comp),
      pct_comp: Number(pctComp) / 100,
      inv_risk_pct: Number(riskW0) / 100,
      policyW8,
      performanceW8,
      recommendedAction,
      policyW9,
      reco: "Mark-up +10%",
      exact_action_pct: exactActionMatch ? Number(exactActionMatch[1]) / 100 : null,
      final_price: Number(finalPrice),
      final_pct_comp: Number(finalPctComp) / 100,
      uplift: Number(uplift) / 100,
      rev_uplift: Number(revUplift),
      margin_up: Number(marginUp),
    };
  });
  const revMax = Math.max(...rows.map((row) => Number(row.rev_uplift) || 0), 1);
  const marginMax = Math.max(...rows.map((row) => Number(row.margin_up) || 0), 1);
  const riskMax = Math.max(...rows.map((row) => Number(row.inv_risk_pct) || 0), 1);
  const fmtMoneyNumber = (value) => value == null || Number.isNaN(Number(value)) ? "-" : Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const columns = [
    { key: "name", label: "Name" },
    { key: "sku", label: "SKU" },
    { key: "curr", label: "Initial (EUR)", align: "num", render: fmtMoneyNumber },
    { key: "comp", label: "Competitor (EUR)", align: "num", render: fmtMoneyNumber },
    { key: "pct_comp", label: "Price vs competitor", align: "num", render: fmtPct },
    { key: "inv_risk_pct", label: "Inventory at risk", align: "num", render: fmtPct, cellClass: "riskCell", max: riskMax },
    { key: "policyW8", label: "Policy W8" },
    { key: "performanceW8", label: "W8 performance" },
    { key: "recommendedAction", label: "Recommended action" },
    { key: "policyW9", label: "Policy W9 (proposed)", render: (_, row) => <RecoChipForProduct product={row} /> },
    { key: "final_price", label: "Price Week 9 (EUR)", align: "num", render: fmtMoneyNumber },
    { key: "final_pct_comp", label: "Final vs competitor", align: "num", render: fmtIndex },
    { key: "uplift", label: "Uplift", align: "num", render: fmtPct },
    { key: "rev_uplift", label: "Revenue Uplift (EUR)", align: "num", render: fmtEUR, cellClass: "upsideCell", max: revMax },
    { key: "margin_up", label: "Margin Uplift (EUR)", align: "num", render: fmtEUR, cellClass: "upsideCell", max: marginMax },
  ];
  return (
    <section className="panel">
      <div className="panel__head panel__head--split">
        <div>
          <div className="panel__title">Matrix new markup actions</div>
          <div className="panel__hint">Products moving from no current markup to a Week 9 markup recommendation.</div>
        </div>
        <button className="btn btn--ghost btn--compact" type="button" onClick={onBack}>Back to Dashboard</button>
      </div>
      <div className="panel__body">
        <DataTable rows={rows} columns={columns} onOpen={onOpen} />
        <div className="footnote">{rows.length} products shown from the selected matrix transition.</div>
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
        title="Proposed Markdown Policies"
        hint="Markdown policies from the matrix drilldowns, ranked by expected margin impact and inventory risk."
      />
    );
  }
  if (type === "markup") {
    return (
      <RecommendationTableSection
        type="markup"
        onOpen={onOpen}
        title="Proposed Markup Policies"
        hint="Markup policies from the matrix drilldowns, ranked by expected margin upside."
      />
    );
  }
  return (
    <>
      <RecommendationTableSection
        type="markdown"
        onOpen={onOpen}
        title="Proposed Markdown Policies"
        hint="Markdown policies from the matrix drilldowns, ranked by expected margin impact and inventory risk."
      />
      <RecommendationTableSection
        type="markup"
        onOpen={onOpen}
        title="Proposed Markup Policies"
        hint="Markup policies from the matrix drilldowns, ranked by expected margin upside."
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
  const filtered = useMemo(() => MATRIX_PRODUCT_LIST.filter((row) => {
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
    { key: "matrixSource", label: "Matrix status", render: (value) => <StatusChip value={value} tone={value === "Additional markdown" ? "warn" : "good"} /> },
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
          <div className="panel__hint">All products available from the matrix drilldowns.</div>
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
        <div className="footnote">{filtered.length} of {MATRIX_PRODUCT_LIST.length} products shown.</div>
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
    currentDay: detailExtra.currentDay,
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
  const currentDay = detail.currentDay ?? CURRENT_DAY;
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
  const pPre = makePath("cur", (point) => point.d <= currentDay);
  const pNoChange = makePath("cur", (point) => point.d >= currentDay);
  const pScenario = makePath(scenarioKey, (point) => point.d >= currentDay);

  return (
    <svg className="chartSvg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Inventory evolution">
      {xTicks.map((x) => <line className="chartGrid" key={`x-${x}`} x1={toX(x)} y1={pad.t} x2={toX(x)} y2={H - pad.b} />)}
      {yTicks.map((y) => <line className="chartGrid" key={`y-${y}`} x1={pad.l} y1={toY(y)} x2={W - pad.r} y2={toY(y)} />)}
      <line x1={toX(currentDay)} y1={pad.t} x2={toX(currentDay)} y2={H - pad.b} stroke="rgba(255,255,255,0.20)" strokeDasharray="4 3" />
      <text x={toX(currentDay) + 4} y={pad.t + 14} fontSize="10" fill="rgba(234,242,255,0.50)" fontWeight="700">Day {currentDay}</text>
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
  const currentDay = detail.currentDay ?? CURRENT_DAY;
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
                  <div className="legendItem"><span className="legendSwatch productPre" />Observed until day {currentDay}</div>
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
                        <th className="num is-selectedScenario" title={scenario.label}>
                          <span className="scenarioHeaderBadge">Proposed policy</span>
                          <span className="scenarioHeaderLabel">{getScenarioHeaderLabel(scenario.label)}</span>
                        </th>
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
  const isMarkdownScenarioChart = action.sku === "AT-93847";
  const fields = ["actual", "noAction", "noChange", scenarioField];
  const allValues = action.timeline.flatMap((point) => fields.map((field) => point[field]).filter((value) => value != null));
  const maxY = Math.max(100, Math.ceil(Math.max(...allValues, 1) / 25) * 25);
  const toX = (day) => pad.l + (day / 180) * (W - pad.l - pad.r);
  const toY = (value) => pad.t + (1 - value / maxY) * (H - pad.t - pad.b);
  const makePath = (field, includePoint = () => true) => action.timeline
    .filter((point) => includePoint(point) && point[field] != null && !Number.isNaN(Number(point[field])))
    .map((point, index) => `${index ? "L" : "M"}${toX(point.d).toFixed(1)} ${toY(point[field]).toFixed(1)}`)
    .join(" ");
  const xTicks = [0, 30, 60, 90, 120, 150, 180];
  const yTicks = [0, 25, 50, 75, 100];
  const paths = isMarkdownScenarioChart
    ? [
      [makePath("noAction", (point) => point.d <= action.appliedDay), "chartLineNoActionPre"],
      [makePath("noAction", (point) => point.d >= action.appliedDay), "chartLineNoAction"],
      [makePath("noChange"), "chartLineNoChange"],
      [makePath(scenarioField, (point) => point.d >= currentDay), "chartLineRecommended"],
    ]
    : [
      [makePath("actual"), "chartLineActual"],
      [makePath("noAction"), "chartLineNoAction"],
      [makePath("noChange"), "chartLineNoChange"],
      [makePath(scenarioField), "chartLineRecommended"],
    ];

  return (
    <svg className={`chartSvg ${isMarkdownScenarioChart ? "chartSvg--markdownScenario" : ""}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Applied action inventory chart">
      {xTicks.map((x) => <line className="chartGrid" key={`x-${x}`} x1={toX(x)} y1={pad.t} x2={toX(x)} y2={H - pad.b} />)}
      {yTicks.map((y) => <line className="chartGrid" key={`y-${y}`} x1={pad.l} y1={toY(y)} x2={W - pad.r} y2={toY(y)} />)}
      <line x1={toX(action.appliedDay)} y1={pad.t} x2={toX(action.appliedDay)} y2={H - pad.b} stroke="rgba(255,255,255,0.24)" strokeDasharray="4 3" />
      <text x={toX(action.appliedDay) + 4} y={pad.t + 14} fontSize="10" fill="rgba(234,242,255,0.55)" fontWeight="700">Action day {action.appliedDay}</text>
      <line x1={toX(currentDay)} y1={pad.t} x2={toX(currentDay)} y2={H - pad.b} stroke="rgba(66,217,200,0.38)" strokeDasharray="3 3" />
      <text x={toX(currentDay) + 4} y={pad.t + 29} fontSize="10" fill="rgba(66,217,200,0.70)" fontWeight="700">Week 9</text>
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
  const currentPriceIndex = action.currentPriceIndex ?? product?.pct_comp ?? (Number(product?.comp) ? (Number(action.oldPrice) - Number(product.comp)) / Number(product.comp) : null);
  const detailElasticity = PRODUCT_DETAILS[product?.sku]?.elasticity || "High";
  const incrementalMargin = hasScenarioComparison
    ? Number(selectedScenario.margin_uplift || 0) - Number(action.scenarioCurrent.margin_uplift || 0)
    : null;

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
                  {action.sku === "AT-93847" ? (
                    <>
                      <div className="legendItem"><span className="legendSwatch noAction" />No-action counterfactual</div>
                      <div className="legendItem"><span className="legendSwatch markdownCurrent" />Markdown -5.8%</div>
                      {hasRecommendedPath && <div className="legendItem"><span className="legendSwatch markdownRecommended" />Markdown -11.4% (Recommended policy)</div>}
                    </>
                  ) : (
                    <>
                      <div className="legendItem"><span className="legendSwatch actual" />Observed until today</div>
                      <div className="legendItem"><span className="legendSwatch noAction" />No-action counterfactual</div>
                      <div className="legendItem"><span className="legendSwatch noChange" />No further change forecast</div>
                      {hasRecommendedPath && <div className="legendItem"><span className="legendSwatch recommended" />{selectedScenario?.label || "Recommended action forecast"}</div>}
                    </>
                  )}
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
                            <th className="num is-selectedScenario">
                              <span className="scenarioHeaderBadge">Proposed policy</span>
                              <span className="scenarioHeaderLabel">{selectedScenario.label}</span>
                            </th>
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
                    {selectedScenario.incremental_revenue != null && (
                      <div className="detailKpiRow scenarioKpiRow scenarioKpiRow--good">
                        <div className="detailKpiLabel">Incremental revenue</div>
                        <div className="detailKpiVal">{fmtEURWhole(selectedScenario.incremental_revenue)}</div>
                      </div>
                    )}
                    <div className={`detailKpiRow scenarioKpiRow ${incrementalMargin < -30000 ? "scenarioKpiRow--bad" : incrementalMargin < 0 ? "scenarioKpiRow--warn" : "scenarioKpiRow--good"}`}>
                      <div className="detailKpiLabel">Incremental margin</div>
                      <div className="detailKpiVal">{fmtEURWhole(incrementalMargin)}</div>
                    </div>
                  </>
                ) : (
                  <table className="detailTbl">
                    <tbody>{rows.map(([label, value]) => <tr key={label}><th>{label}</th><td className="num">{value}</td></tr>)}</tbody>
                  </table>
                )}
                {!hasScenarioComparison && (
                  <div className="insightBlock">
                    <div className="insightBlock__label">Insight</div>
                    <div className="insightBlock__text">{action.insight}</div>
                  </div>
                )}
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
    setActiveTab(type === "markup" ? "matrix-markup-detail" : type === "keepMarkdown" ? "matrix-keep-markdown-detail" : type === "newMarkup" ? "matrix-new-markup-detail" : "matrix-detail");
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
          {activeTab === "matrix-keep-markdown-detail" && <MatrixKeepMarkdownDetailPage onOpen={openProduct} onBack={() => setActiveTab("overview")} />}
          {activeTab === "matrix-new-markup-detail" && <MatrixNewMarkupDetailPage onOpen={openProduct} onBack={() => setActiveTab("overview")} />}
          {activeTab === "matrix-markup-detail" && <MatrixMarkupDetailPage onOpen={openProduct} onBack={() => setActiveTab("overview")} />}
          {activeTab === "detail" && selectedProduct && <ProductDetailPage selectedProduct={selectedProduct} scenarioKey={scenarioKey} onScenarioChange={setScenarioKey} onBack={() => setActiveTab("products")} />}
          {activeTab === "applied-detail" && selectedAppliedAction && <AppliedActionDetailPage selectedAction={selectedAppliedAction} onBack={() => setActiveTab(appliedBackTab)} />}
        </main>
      </div>
    </div>
  );
}
