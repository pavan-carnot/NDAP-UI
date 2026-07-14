"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import { getChartList, getChartData, ChartConfig, ChartDataPoint } from "@/lib/api";

// ── Color palette ────────────────────────────────────────────────────────────
const GROUP_COLORS: Record<string, { bar: string; line: string; light: string }> = {
  "State-wise Capacity": { bar: "#1565C0", line: "#1565C0", light: "#E3F2FD" },
  "Performance & Trends": { bar: "#00695C", line: "#00897B", light: "#E0F2F1" },
};

const CHART_COLORS = [
  "#1565C0", "#2E7D32", "#C62828", "#6A1B9A", "#E65100",
  "#00695C", "#AD1457", "#0277BD", "#558B2F",
  "#283593", "#BF360C",
];

// ── Tooltip ──────────────────────────────────────────────────────────────────
function CustomTooltip({
  active, payload, label, unit,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
  unit?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 text-sm max-w-xs">
      <p className="font-semibold text-gray-800 mb-1 truncate">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-[#1565C0] font-bold">
          {typeof p.value === "number"
            ? p.value.toLocaleString(undefined, { maximumFractionDigits: 2 })
            : p.value}
          {unit ? <span className="text-gray-400 font-normal ml-1">{unit}</span> : null}
        </p>
      ))}
    </div>
  );
}

// ── Chart renderer ───────────────────────────────────────────────────────────
function ChartPanel({
  config,
  data,
  loading,
}: {
  config: ChartConfig;
  data: ChartDataPoint[];
  loading: boolean;
}) {
  const colors = GROUP_COLORS[config.group] ?? GROUP_COLORS["State-wise Capacity"];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ minHeight: 380 }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#1565C0] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading chart data…</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ minHeight: 380 }}>
        <p className="text-gray-400 text-sm">No data available for this chart.</p>
      </div>
    );
  }

  // State bar chart — horizontal bars (both bar_state and bar_state_timeaskey)
  if (config.chart_type === "bar_state" || config.chart_type === "bar_state_timeaskey") {
    const sorted = [...data]
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      .slice(0, 20);
    const chartHeight = Math.max(360, sorted.length * 26);
    return (
      <div style={{ height: 480, overflowY: "auto" }}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ top: 8, right: 50, left: 170, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E3F2FD" />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#555" }}
              tickFormatter={(v) =>
                v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
              }
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: "#333" }}
              width={165}
            />
            <Tooltip content={<CustomTooltip unit={config.unit} />} />
            <Bar dataKey="value" fill={colors.bar} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Horizontal bar chart (KPIs like mission outcomes)
  if (config.chart_type === "bar_horizontal") {
    const chartHeight = Math.max(300, data.length * 55);
    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 50, left: 210, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E0F2F1" />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#555" }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: "#333" }}
            width={205}
          />
          <Tooltip content={<CustomTooltip unit={config.unit} />} />
          <Bar dataKey="value" fill={colors.bar} radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Line chart
  if (config.chart_type === "line") {
    const states = [...new Set(data.map((d) => d.state).filter(Boolean))] as string[];
    if (states.length > 1) {
      // Multi-series: pivot by state
      const pivotMap: Record<string, Record<string, number | null>> = {};
      data.forEach((d) => {
        if (!pivotMap[d.name]) pivotMap[d.name] = {};
        if (d.state) pivotMap[d.name][d.state] = d.value;
      });
      const pivotData = Object.entries(pivotMap).map(([name, vals]) => ({
        name,
        ...vals,
      }));
      return (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={pivotData} margin={{ top: 8, right: 30, left: 20, bottom: 70 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E0F2F1" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "#555" }}
              angle={-35}
              textAnchor="end"
              height={70}
            />
            <YAxis tick={{ fontSize: 11, fill: "#555" }} />
            <Tooltip content={<CustomTooltip unit={config.unit} />} />
            <Legend />
            {states.map((s, i) => (
              <Line
                key={s}
                type="monotone"
                dataKey={s}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }
    return (
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={data} margin={{ top: 8, right: 30, left: 20, bottom: 70 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E0F2F1" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "#555" }}
            angle={-35}
            textAnchor="end"
            height={70}
          />
          <YAxis tick={{ fontSize: 11, fill: "#555" }} />
          <Tooltip content={<CustomTooltip unit={config.unit} />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={colors.line}
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Default vertical bar chart
  return (
    <ResponsiveContainer width="100%" height={380}>
      <BarChart data={data} margin={{ top: 8, right: 20, left: 20, bottom: 80 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E3F2FD" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: "#555" }}
          angle={-35}
          textAnchor="end"
          height={80}
        />
        <YAxis tick={{ fontSize: 11, fill: "#555" }} />
        <Tooltip content={<CustomTooltip unit={config.unit} />} />
        <Bar dataKey="value" fill={colors.bar} radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ChartsPage() {
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [currentConfig, setCurrentConfig] = useState<ChartConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarLoading, setSidebarLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const list = await getChartList();
        setCharts(list);
        if (list.length > 0) setSelectedId(list[0].id);
      } catch (e) {
        console.error("Failed to load chart list:", e);
      } finally {
        setSidebarLoading(false);
      }
    }
    load();
  }, []);

  const fetchChartData = useCallback(async (chartId: string) => {
    setLoading(true);
    setChartData([]);
    setCurrentConfig(null);
    try {
      const res = await getChartData(chartId);
      setChartData(res.data);
      setCurrentConfig(res.config);
    } catch (e) {
      console.error("Failed to load chart data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) fetchChartData(selectedId);
  }, [selectedId, fetchChartData]);

  const groups = charts.reduce<Record<string, ChartConfig[]>>((acc, c) => {
    if (!acc[c.group]) acc[c.group] = [];
    acc[c.group].push(c);
    return acc;
  }, {});

  const chartTypeLabel: Record<string, string> = {
    bar_state: "State Bar",
    bar_state_timeaskey: "State Bar",
    bar: "Bar",
    bar_horizontal: "H-Bar",
    line: "Line",
  };

  const chartTypeBadgeColor: Record<string, string> = {
    bar_state: "bg-blue-100 text-blue-700",
    bar_state_timeaskey: "bg-blue-100 text-blue-700",
    bar: "bg-teal-100 text-teal-700",
    bar_horizontal: "bg-orange-100 text-orange-700",
    line: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="flex h-[calc(100vh-96px)] bg-[#F7F9FC] overflow-hidden">

      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-72 flex-shrink-0 bg-white border-r border-[#C5D8F0] flex flex-col overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-[#E3F2FD] bg-[#F0F5FB]">
          <h2 className="text-[13px] font-bold text-[#003087] uppercase tracking-wider flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Visual Analytics
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {charts.length} charts · MNRE datasets
          </p>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {sidebarLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-[#1565C0] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            Object.entries(groups).map(([group, items]) => (
              <div key={group} className="mb-1">
                <div className="px-5 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {group}
                </div>
                {items.map((chart) => {
                  const active = chart.id === selectedId;
                  return (
                    <button
                      key={chart.id}
                      id={`chart-btn-${chart.id}`}
                      onClick={() => setSelectedId(chart.id)}
                      className={`w-full text-left px-4 py-2.5 flex items-start gap-2.5 transition-all duration-150 border-l-2 ${
                        active
                          ? "bg-[#E3F2FD] border-[#1565C0] text-[#003087]"
                          : "border-transparent text-gray-600 hover:bg-[#F0F5FB] hover:text-[#003087]"
                      }`}
                    >
                      <span
                        className={`mt-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap ${
                          chartTypeBadgeColor[chart.chart_type] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {chartTypeLabel[chart.chart_type] ?? chart.chart_type}
                      </span>
                      <span className="text-[12px] leading-snug font-medium">{chart.title}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        {currentConfig && !loading && (
          <div className="flex-shrink-0 px-8 py-5 bg-white border-b border-[#C5D8F0] shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    chartTypeBadgeColor[currentConfig.chart_type] ?? "bg-gray-100 text-gray-600"
                  }`}>
                    {chartTypeLabel[currentConfig.chart_type]}
                  </span>
                  <span className="text-[11px] text-gray-400 font-medium">{currentConfig.group}</span>
                </div>
                <h1 className="text-xl font-bold text-[#003087] leading-tight">{currentConfig.title}</h1>
                <p className="text-sm text-gray-500 mt-1 max-w-2xl">{currentConfig.description}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                {currentConfig.unit && currentConfig.unit !== "various" && (
                  <span className="inline-block bg-[#E3F2FD] text-[#1565C0] text-xs font-semibold px-3 py-1 rounded-full">
                    Unit: {currentConfig.unit}
                  </span>
                )}
                {chartData.length > 0 && (
                  <p className="text-[11px] text-gray-400 mt-1">{chartData.length} data points</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Chart area */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {!currentConfig && !loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-[#E3F2FD] flex items-center justify-center">
                <svg className="w-8 h-8 text-[#1565C0]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <p className="text-gray-400 text-sm">Select a chart from the left panel to visualise data</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-[#E3F2FD] p-6">
              <ChartPanel
                config={currentConfig ?? charts.find(c => c.id === selectedId) ?? charts[0]}
                data={chartData}
                loading={loading}
              />
              {!loading && chartData.length > 0 && currentConfig && (
                <p className="text-[10px] text-gray-400 mt-4 text-right">
                  Source: <span className="font-medium">MNRE · visual_timeseries · metric: {currentConfig.metric}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
