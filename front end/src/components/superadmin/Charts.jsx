import React from "react";
import { BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const formatShort = (value) => {
  const number = Number(value || 0);
  if (number >= 100000) return `${(number / 100000).toFixed(1)}L`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}k`;
  return number;
};

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const wrapClinicName = (value, maxLineLength = 9) => {
  const lines = [];
  let line = "";

  String(value || "").split(/\s+/).filter(Boolean).forEach((word) => {
    if (line && `${line} ${word}`.length > maxLineLength) {
      lines.push(line);
      line = "";
    }
    line = line ? `${line} ${word}` : word;
  });

  if (line) lines.push(line);
  return lines.slice(0, 3);
};

const ClinicNameTick = ({ x = 0, y = 0, payload }) => {
  const label = String(payload?.value || "");
  const lines = wrapClinicName(label);

  return (
    <g transform={`translate(${x},${y})`}>
      <title>{label}</title>
      <text textAnchor="middle" fill="#475569" fontSize={9}>
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x="0" dy={index === 0 ? 0 : 11}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
};

function Charts({ data = [], type = "bar", dataKey = "revenue", secondaryKey, tertiaryKey, metrics = [] }) {
  const hasData = Array.isArray(data) && data.length > 0;
  const chartMargin = { top: 30, right: 24, left: 0, bottom: 68 };
  const xAxisProps = {
    dataKey: "name",
    axisLine: false,
    tickLine: false,
    interval: 0,
    minTickGap: 0,
    height: 70,
    tickMargin: 12,
    tick: <ClinicNameTick />,
  };

  if (!hasData) {
    return (
      <div className="sa-chart sa-chart--empty">
        <div className="sa-empty-state">
          <span className="sa-empty-state-icon">
            <BarChart3 size={28} />
          </span>
          <b>No Data Available</b>
          <p>Charts will appear once revenue and user data is collected across clinics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sa-chart">
      {metrics.length ? (
        <div className="sa-chart-summary-grid sa-chart-summary-grid--dashboard">
          {metrics.map(({ label, value, icon: MetricIcon, tone }) => (
            <div className={`sa-chart-summary-card sa-chart-summary-card--compact sa-chart-summary-card--${tone || "blue"}`} key={label}>
              <span className="sa-chart-summary-icon">
                {MetricIcon ? <MetricIcon size={19} /> : null}
              </span>
              <div className="sa-chart-summary-copy">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="sa-chart-plot">
        <ResponsiveContainer width="100%" height="100%">
          {type === "line" ? (
            <LineChart data={data} margin={chartMargin}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis {...xAxisProps} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={formatShort} tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey={dataKey} stroke="#0f766e" strokeWidth={3} dot={{ r: 4 }} />
              {secondaryKey ? <Line type="monotone" dataKey={secondaryKey} stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} /> : null}
              {tertiaryKey ? <Line type="monotone" dataKey={tertiaryKey} stroke="#b45309" strokeWidth={3} dot={{ r: 4 }} /> : null}
            </LineChart>
          ) : (
            <BarChart data={data} margin={chartMargin} barCategoryGap="10%" barGap={4}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis {...xAxisProps} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={formatShort} tick={{ fill: "#64748b", fontSize: 12 }} />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Bar dataKey={dataKey} fill="#0f766e" radius={[8, 8, 0, 0]}>
                <LabelList dataKey={dataKey} position="top" formatter={formatCurrency} fill="#334155" fontSize={11} fontWeight={700} />
              </Bar>
              {secondaryKey ? <Bar dataKey={secondaryKey} fill="#2563eb" radius={[8, 8, 0, 0]} /> : null}
              {tertiaryKey ? <Bar dataKey={tertiaryKey} fill="#b45309" radius={[8, 8, 0, 0]} /> : null}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default Charts;

