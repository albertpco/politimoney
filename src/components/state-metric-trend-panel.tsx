"use client";

import { useMemo, useState } from "react";
import { TrendChart } from "@/components/ui-primitives";

type MetricKey =
  | "gdp"
  | "population"
  | "childPoverty"
  | "fertility"
  | "childMortality"
  | "suicideRate";

export type StateMetricControl = {
  key: MetricKey;
  label: string;
  value: string;
  delta: string;
  period: string;
  quality: "high" | "medium" | "partial";
  chartTitle: string;
  chartUnit: string;
  chartPoints: { label: string; value: number }[];
};

export function StateMetricTrendPanel({
  metrics,
}: {
  metrics: StateMetricControl[];
}) {
  const [selectedMetricKey, setSelectedMetricKey] = useState<MetricKey>(
    metrics[0]?.key ?? "gdp",
  );

  const selectedMetric = useMemo(
    () => metrics.find((metric) => metric.key === selectedMetricKey) ?? metrics[0],
    [metrics, selectedMetricKey],
  );

  if (!selectedMetric) return null;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        {metrics.map((metric) => {
          const isActive = metric.key === selectedMetric.key;
          return (
            <button
              key={metric.key}
              type="button"
              onClick={() => setSelectedMetricKey(metric.key)}
              className={`rounded-lg border bg-white p-3 text-left transition-colors ${
                isActive
                  ? "border-blue-500 ring-2 ring-blue-100"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {metric.label}
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{metric.value}</p>
              <p className="text-xs text-slate-600">
                {metric.delta} ({metric.period}) - coverage {metric.quality}
              </p>
            </button>
          );
        })}
      </div>
      <TrendChart
        title={selectedMetric.chartTitle}
        points={
          selectedMetric.chartPoints.length
            ? selectedMetric.chartPoints
            : [{ label: "No data", value: 0 }]
        }
      />
      <p className="text-xs text-slate-600">
        Unit: {selectedMetric.chartUnit}. Click a metric card above to update this chart.
      </p>
    </div>
  );
}
