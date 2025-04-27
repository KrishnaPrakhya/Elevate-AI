"use client";
import { useEffect, useState } from "react";
import type { assessmentsProps } from "./stats-cards";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChartDataPoint {
  date: string;
  score: number;
}

import { TooltipProps } from "recharts";
import {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

type CustomTooltipProps = TooltipProps<ValueType, NameType>;

// This is a client component, so it cannot be async
function PerformanceChart(props: assessmentsProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const { assessments } = props;

  useEffect(() => {
    if (assessments) {
      const formattedData = assessments.map((assessment) => ({
        date: format(new Date(assessment.createdAt), "MMM dd"),
        score: assessment.quizScore,
      }));
      setChartData(formattedData);
    }
  }, [assessments]);

  // Calculate average score
  const averageScore =
    chartData.length > 0
      ? chartData.reduce(
          (sum: number, item: ChartDataPoint) => sum + item.score,
          0
        ) / chartData.length
      : 0;

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md border-t-4 border-t-indigo-500">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-500" />
              <CardTitle>Performance Trend</CardTitle>
            </div>
            <CardDescription>Your quiz scores over time</CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="gap-1 text-xs">
            <span>Detailed Analysis</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 20, right: 20, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--muted-foreground))"
                opacity={0.2}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                axisLine={{
                  stroke: "hsl(var(--muted-foreground))",
                  opacity: 0.3,
                }}
                tickLine={{
                  stroke: "hsl(var(--muted-foreground))",
                  opacity: 0.3,
                }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "hsl(var(--muted-foreground))" }}
                axisLine={{
                  stroke: "hsl(var(--muted-foreground))",
                  opacity: 0.3,
                }}
                tickLine={{
                  stroke: "hsl(var(--muted-foreground))",
                  opacity: 0.3,
                }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                content={({ active, payload }: CustomTooltipProps) => {
                  if (active && payload && payload.length > 0) {
                    return (
                      <div className="bg-background border rounded-lg p-3 shadow-lg">
                        <p className="text-sm font-medium">
                          Score:{" "}
                          {typeof payload[0]?.value === "number"
                            ? payload[0].value.toFixed(1)
                            : "0"}
                          %
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payload[0].payload.date}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <ReferenceLine
                y={averageScore}
                stroke="hsl(var(--primary))"
                strokeDasharray="3 3"
                label={{
                  value: `Avg: ${averageScore.toFixed(1)}%`,
                  position: "right",
                  fill: "hsl(var(--primary))",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#scoreGradient)"
                activeDot={{
                  r: 6,
                  stroke: "hsl(var(--primary))",
                  strokeWidth: 2,
                  fill: "hsl(var(--background))",
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
      {chartData.length > 0 && (
        <CardFooter className="bg-muted/20 border-t px-6 py-3">
          <div className="flex justify-between w-full text-sm">
            <div>
              <span className="text-muted-foreground">First Quiz:</span>{" "}
              <span className="font-medium">{chartData[0]?.date}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Latest Score:</span>{" "}
              <span className="font-medium">
                {chartData[chartData.length - 1]?.score.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Improvement:</span>{" "}
              <span
                className={`font-medium ${
                  chartData.length > 1 &&
                  chartData[chartData.length - 1]?.score > chartData[0]?.score
                    ? "text-green-500"
                    : "text-amber-500"
                }`}
              >
                {chartData.length > 1
                  ? `${(
                      chartData[chartData.length - 1]?.score -
                      chartData[0]?.score
                    ).toFixed(1)}%`
                  : "N/A"}
              </span>
            </div>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}

export default PerformanceChart;
