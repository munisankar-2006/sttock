(() => {
  const $ = (id) => document.getElementById(id);
  const state = { symbol: "AAPL", range: "1M", type: "line", quote: null, yearData: null };

  const COLORS = { up: "#22c55e", down: "#ef4444", accent: "#4f8cff", text: "#e8eefc", grid: "#243252", muted: "#8fa0c4" };

  const fmtNum = (n, d = 2) =>
    n == null || isNaN(n) ? "—" : Number(n).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtBig = (n) => {
    if (n == null) return "—";
    const a = Math.abs(n);
    if (a >= 1e12) return (n / 1e12).toFixed(2) + "T";
    if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
    return Number(n).toLocaleString();
  };

  async function api(path) {
    const r = await fetch(path);
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Request failed");
    return j;
  }

  function showError(msg) {
    const e = $("error");
    e.textContent = msg;
    e.hidden = !msg;
  }

  function layoutBase(extra = {}) {
    return Object.assign(
      {
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        font: { color: COLORS.text, family: "Inter, system-ui, sans-serif" },
        margin: { l: 56, r: 24, t: 16, b: 48 },
        hovermode: "x unified",
        xaxis: { gridcolor: COLORS.grid, showspikes: true, spikemode: "across", spikethickness: 1 },
        yaxis: { gridcolor: COLORS.grid, tickformat: ",.2f", side: "right" },
      },
      extra
    );
  }

  /* ---------- Header ---------- */
  function renderHeader(q) {
    $("h-name").textContent = q.name;
    $("h-ticker").textContent = q.ticker;
    $("h-exchange").textContent = q.exchange;
    $("h-currency").textContent = q.currency;
    $("h-price").textContent = `${fmtNum(q.price)} ${q.currency}`;
    const up = q.change >= 0;
    const el = $("h-change");
    el.className = "change " + (up ? "up" : "down");
    el.textContent = `${up ? "▲" : "▼"} ${up ? "+" : ""}${fmtNum(q.change)} (${up ? "+" : ""}${fmtNum(q.changePercent)}%) today`;

    $("c-ticker").textContent = `${q.name} (${q.ticker})`;
    $("c-price").textContent = `${fmtNum(q.price)} ${q.currency}`;
    const cc = $("c-change");
    cc.className = up ? "up" : "down";
    cc.textContent = `${up ? "+" : ""}${fmtNum(q.change)} (${up ? "+" : ""}${fmtNum(q.changePercent)}%)`;
  }

  function renderOverview(q) {
    const items = [
      ["Company", q.name],
      ["Ticker", q.ticker],
      ["Exchange", q.exchange],
      ["Currency", q.currency],
      ["Current Price", fmtNum(q.price)],
      ["Daily Change", (q.change >= 0 ? "+" : "") + fmtNum(q.change)],
      ["Daily % Change", (q.changePercent >= 0 ? "+" : "") + fmtNum(q.changePercent) + "%"],
      ["Open", fmtNum(q.open)],
      ["Day High", fmtNum(q.dayHigh)],
      ["Day Low", fmtNum(q.dayLow)],
      ["Volume", fmtBig(q.volume)],
      ["Market Cap", fmtBig(q.marketCap)],
      ["P/E Ratio", q.peRatio != null ? fmtNum(q.peRatio) : "—"],
      ["52-Week High", fmtNum(q.fiftyTwoWeekHigh)],
      ["52-Week Low", fmtNum(q.fiftyTwoWeekLow)],
      ["Sector", q.sector || "—"],
      ["Industry", q.industry || "—"],
    ];
    $("stats").innerHTML = items
      .map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`)
      .join("");
    $("about").hidden = !q.summary;
    $("about-text").textContent = q.summary || "";
  }

  /* ---------- Charts ---------- */
  function renderHeaderGraph(h) {
    // Header graph: last 1 year, labelled Today / Previous day / N days ago
    const up = h.close[h.close.length - 1] >= h.close[0];
    const color = up ? COLORS.up : COLORS.down;
    Plotly.react(
      "header-graph",
      [
        {
          x: h.dates,
          y: h.close,
          text: h.labels,
          type: "scatter",
          mode: "lines",
          line: { color, width: 2 },
          fill: "tozeroy",
          fillcolor: up ? "rgba(34,197,94,.10)" : "rgba(239,68,68,.10)",
          hovertemplate: "%{text}<br>Close: %{y:,.2f}<extra></extra>",
        },
      ],
      layoutBase({ margin: { l: 10, r: 56, t: 6, b: 24 }, showlegend: false, yaxis: { side: "right", gridcolor: COLORS.grid, tickformat: ",.0f" } }),
      { displayModeBar: false, responsive: true }
    );

    Plotly.react(
      "spark",
      [{ x: h.dates, y: h.close, type: "scatter", mode: "lines", line: { color, width: 2 }, hoverinfo: "skip" }],
      { paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", margin: { l: 0, r: 0, t: 4, b: 4 }, xaxis: { visible: false }, yaxis: { visible: false }, showlegend: false },
      { displayModeBar: false, staticPlot: true, responsive: true }
    );
  }

  function renderMainChart(h) {
    const up = h.close[h.close.length - 1] >= h.close[0];
    const color = up ? COLORS.up : COLORS.down;
    const daily = h.interval === "1d";
    let traces;
    if (state.type === "candle") {
      traces = [
        {
          x: h.dates, open: h.open, high: h.high, low: h.low, close: h.close,
          type: "candlestick", name: "Price",
          increasing: { line: { color: COLORS.up } }, decreasing: { line: { color: COLORS.down } },
          text: h.labels, hoverinfo: "x+text",
        },
      ];
    } else {
      traces = [
        {
          x: h.dates, y: h.close, text: h.labels, type: "scatter", mode: "lines",
          name: "Close", line: { color, width: 2.4 },
          fill: "tozeroy", fillcolor: up ? "rgba(34,197,94,.08)" : "rgba(239,68,68,.08)",
          hovertemplate: "%{text}<br><b>Close: %{y:,.2f}</b><extra></extra>",
        },
      ];
    }
    traces.push({
      x: h.dates, y: h.volume, type: "bar", name: "Volume", yaxis: "y2",
      marker: { color: "rgba(79,140,255,.35)" }, hovertemplate: "Volume: %{y:,}<extra></extra>",
    });

    const minY = Math.min(...h.low), maxY = Math.max(...h.high);
    const pad = (maxY - minY) * 0.08 || 1;
    const layout = layoutBase({
      showlegend: false,
      yaxis: { gridcolor: COLORS.grid, side: "right", tickformat: ",.2f", range: [minY - pad, maxY + pad], domain: [0.22, 1] },
      yaxis2: { domain: [0, 0.18], showgrid: false, side: "right", tickformat: ".2s" },
      xaxis: {
        gridcolor: COLORS.grid, showspikes: true, spikemode: "across", spikethickness: 1,
        rangeslider: { visible: false },
        title: { text: daily ? "Date (hover to see Today / Previous day / N days ago)" : "Date", font: { size: 12, color: COLORS.muted } },
      },
      dragmode: "pan",
    });
    Plotly.react("main-chart", traces, layout, {
      responsive: true, displaylogo: false, scrollZoom: true,
      modeBarButtonsToRemove: ["lasso2d", "select2d"],
    });
  }

  function renderDailyTable(h) {
    const n = h.close.length;
    const rows = [];
    for (let i = n - 1; i >= 0; i--) {
      const label = i === n - 1 ? "Today" : i === n - 2 ? "Previous day" : `${n - 1 - i} days ago`;
      const prev = i > 0 ? h.close[i - 1] : h.close[i];
      const cls = h.close[i] >= prev ? "up" : "down";
      rows.push(
        `<tr><td>${label}</td><td>${h.dates[i]}</td><td>${fmtNum(h.open[i])}</td><td>${fmtNum(h.high[i])}</td><td>${fmtNum(h.low[i])}</td><td class="${cls}">${fmtNum(h.close[i])}</td><td>${fmtBig(h.volume[i])}</td></tr>`
      );
    }
    document.querySelector("#daily-table tbody").innerHTML = rows.join("");
  }

  /* ---------- Loading ---------- */
  async function loadRange() {
    try {
      const h = await api(`/api/history?symbol=${encodeURIComponent(state.symbol)}&range=${state.range}`);
      renderMainChart(h);
    } catch (e) {
      showError(e.message);
    }
  }

  async function loadAll(symbol) {
    showError("");
    state.symbol = symbol;
    try {
      const [q, y] = await Promise.all([
        api(`/api/quote?symbol=${encodeURIComponent(symbol)}`),
        api(`/api/history?symbol=${encodeURIComponent(symbol)}&range=1Y`),
      ]);
      state.quote = q;
      state.yearData = y;
      renderHeader(q);
      renderOverview(q);
      renderHeaderGraph(y);
      renderDailyTable(y);
      await loadRange();
    } catch (e) {
      showError(`Could not load "${symbol}": ${e.message}`);
    }
  }

  /* ---------- Events ---------- */
  $("search-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const s = $("symbol-input").value.trim().toUpperCase();
    if (s) loadAll(s);
  });

  document.querySelectorAll(".tab").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === b));
      document.querySelectorAll(".tabpane").forEach((p) => p.classList.toggle("active", p.id === "tab-" + b.dataset.tab));
      if (b.dataset.tab === "chart") {
        setTimeout(() => {
          Plotly.Plots.resize("main-chart");
          Plotly.Plots.resize("header-graph");
        }, 30);
      }
    })
  );

  $("ranges").addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    state.range = b.dataset.r;
    document.querySelectorAll("#ranges button").forEach((x) => x.classList.toggle("active", x === b));
    loadRange();
  });

  $("types").addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    state.type = b.dataset.t;
    document.querySelectorAll("#types button").forEach((x) => x.classList.toggle("active", x === b));
    loadRange();
  });

  loadAll(state.symbol);
  setInterval(() => loadAll(state.symbol), 60000);
})();
