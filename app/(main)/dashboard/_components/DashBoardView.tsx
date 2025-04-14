"use client";
import {
  Brain,
  Briefcase,
  LineChart,
  TrendingDown,
  TrendingUp,
  Calendar,
  Clock,
  Info,
  ChevronRight,
  ArrowUpRight,
  Lightbulb,
  Award,
  Zap,
  DollarSign,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Tooltip as TooltipUI,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type salaryInsights = {
  max: number;
  min: number;
  role: string;
  median: number;
  location: string;
};

type IndustryInsights = {
  id: string;
  industry: string;
  salaryRanges: salaryInsights[];
  growthRate: number;
  demandLevel: string;
  topSkills: string[];
  marketOutLook: string;
  keyTrends: string[];
  recommendedSkills: string[];
  lastUpdated: any;
  nextUpdated: any;
};

interface Props {
  insights: IndustryInsights;
}

function DashBoardView(props: Props) {
  const { insights } = props;
  const [activeTab, setActiveTab] = useState("overview");
  console.log(insights);
  const salaryData = insights.salaryRanges.map((range: any, index: number) => ({
    name: range.role,
    min: range.min / 1000,
    max: range.max / 1000,
    median: range.median / 1000,
    color: getColorByIndex(index),
  }));

  function getColorByIndex(index: number) {
    const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316"];
    return colors[index % colors.length];
  }

  const getDemandColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "high":
        return {
          bg: "bg-emerald-500/20 dark:bg-emerald-500/30",
          text: "text-emerald-600 dark:text-emerald-400",
          border: "border-emerald-500/30",
          fill: "bg-emerald-500",
        };
      case "medium":
        return {
          bg: "bg-amber-500/20 dark:bg-amber-500/30",
          text: "text-amber-600 dark:text-amber-400",
          border: "border-amber-500/30",
          fill: "bg-amber-500",
        };
      case "low":
        return {
          bg: "bg-rose-500/20 dark:bg-rose-500/30",
          text: "text-rose-600 dark:text-rose-400",
          border: "border-rose-500/30",
          fill: "bg-rose-500",
        };
      default:
        return {
          bg: "bg-slate-500/20",
          text: "text-slate-600 dark:text-slate-400",
          border: "border-slate-500/30",
          fill: "bg-slate-500",
        };
    }
  };

  const getMarketOutlookInfo = (outlook: string) => {
    outlook = outlook.toLowerCase();
    switch (outlook) {
      case "positive":
        return {
          icon: TrendingUp,
          color: "text-emerald-600 dark:text-emerald-400",
          bg: "bg-emerald-500/20 dark:bg-emerald-500/30",
          border: "border-emerald-500/30",
        };
      case "neutral":
        return {
          icon: LineChart,
          color: "text-amber-600 dark:text-amber-400",
          bg: "bg-amber-500/20 dark:bg-amber-500/30",
          border: "border-amber-500/30",
        };
      case "negative":
        return {
          icon: TrendingDown,
          color: "text-rose-600 dark:text-rose-400",
          bg: "bg-rose-500/20 dark:bg-rose-500/30",
          border: "border-rose-500/30",
        };
      default:
        return {
          icon: LineChart,
          color: "text-slate-600 dark:text-slate-400",
          bg: "bg-slate-500/20",
          border: "border-slate-500/30",
        };
    }
  };

  const OutlookInfo = getMarketOutlookInfo(insights.marketOutLook);
  const OutlookIcon = OutlookInfo.icon;
  const demandColors = getDemandColor(insights.demandLevel);

  const lastUpdatedDate = format(new Date(insights.lastUpdated), "MMM d, yyyy");
  const nextUpdatedDate = formatDistanceToNow(new Date(insights.nextUpdated), {
    addSuffix: true,
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.4 },
    },
  };

  return (
    <div className="space-y-6 pb-10">
      <motion.div
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight gradient-text mb-1">
            {insights.industry} Insights
          </h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span className="text-sm">Last updated: {lastUpdatedDate}</span>
            <TooltipProvider>
              <TooltipUI>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Next update {nextUpdatedDate}</p>
                </TooltipContent>
              </TooltipUI>
            </TooltipProvider>
          </div>
        </div>

        {/* <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1">
            <Clock className="h-4 w-4" />
            <span>Historical Data</span>
          </Button>
          <Button size="sm" className="gap-1">
            <ArrowUpRight className="h-4 w-4" />
            <span>Export Report</span>
          </Button>
        </div> */}
      </motion.div>

      <Tabs
        defaultValue="overview"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid grid-cols-3 w-full max-w-md mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="salary">Salary Data</TabsTrigger>
          <TabsTrigger value="skills">Skills & Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants}>
              <Card
                className="overflow-hidden border-t-4 transition-all hover:shadow-md"
                style={{
                  borderTopColor: OutlookInfo.color.includes("emerald")
                    ? "#10b981"
                    : OutlookInfo.color.includes("amber")
                    ? "#f59e0b"
                    : OutlookInfo.color.includes("rose")
                    ? "#f43f5e"
                    : "#64748b",
                }}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">
                    Market Outlook
                  </CardTitle>
                  <div className={cn("p-1.5 rounded-full", OutlookInfo.bg)}>
                    <OutlookIcon className={cn("h-4 w-4", OutlookInfo.color)} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <div className="text-2xl font-bold">
                      {insights.marketOutLook}
                    </div>
                    <div
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        OutlookInfo.bg,
                        OutlookInfo.color
                      )}
                    >
                      Trend
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Next update {nextUpdatedDate}
                  </p>
                </CardContent>
                <div className={cn("h-1.5", OutlookInfo.bg)}></div>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="overflow-hidden border-t-4 border-t-indigo-500 transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">
                    Industry Growth
                  </CardTitle>
                  <div className="p-1.5 rounded-full bg-indigo-500/20 dark:bg-indigo-500/30">
                    <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <div className="text-2xl font-bold">
                      {insights.growthRate.toFixed(1)}%
                    </div>
                    <div className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 dark:bg-indigo-500/30 text-indigo-600 dark:text-indigo-400">
                      Annual
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Growth Rate</span>
                      <span className="font-medium">
                        {insights.growthRate.toFixed(1)}%
                      </span>
                    </div>
                    <Progress
                      value={Number(insights.growthRate.toFixed(1))}
                      className="h-2"
                      indicatorClassName="bg-indigo-500"
                    />
                  </div>
                </CardContent>
                <div className="h-1.5 bg-indigo-500/20 dark:bg-indigo-500/30"></div>
              </Card>
            </motion.div>

            {/* Demand Level Card */}
            <motion.div variants={itemVariants}>
              <Card
                className={cn(
                  "overflow-hidden border-t-4 transition-all hover:shadow-md"
                )}
                style={{
                  borderTopColor: demandColors.text.includes("emerald")
                    ? "#10b981"
                    : demandColors.text.includes("amber")
                    ? "#f59e0b"
                    : demandColors.text.includes("rose")
                    ? "#f43f5e"
                    : "#64748b",
                }}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">
                    Demand Level
                  </CardTitle>
                  <div className={cn("p-1.5 rounded-full", demandColors.bg)}>
                    <Briefcase className={cn("h-4 w-4", demandColors.text)} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <div className="text-2xl font-bold">
                      {insights.demandLevel}
                    </div>
                    <div
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        demandColors.bg,
                        demandColors.text
                      )}
                    >
                      Current
                    </div>
                  </div>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Demand Indicator</span>
                      <span className={cn("font-medium", demandColors.text)}>
                        {insights.demandLevel}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", demandColors.fill)}
                        style={{
                          width:
                            insights.demandLevel.toLowerCase() === "high"
                              ? "90%"
                              : insights.demandLevel.toLowerCase() === "medium"
                              ? "60%"
                              : "30%",
                        }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
                <div className={cn("h-1.5", demandColors.bg)}></div>
              </Card>
            </motion.div>

            {/* Top Skills Card */}
            <motion.div variants={itemVariants}>
              <Card className="overflow-hidden border-t-4 border-t-purple-500 transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium">
                    Top Skills
                  </CardTitle>
                  <div className="p-1.5 rounded-full bg-purple-500/20 dark:bg-purple-500/30">
                    <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {insights.topSkills.map((skill, index) => (
                      <Badge
                        key={skill}
                        variant="secondary"
                        className="bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 transition-colors"
                      >
                        {skill}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                    <Award className="h-3 w-3" />
                    Most in-demand skills
                  </p>
                </CardContent>
                <div className="h-1.5 bg-purple-500/20 dark:bg-purple-500/30"></div>
              </Card>
            </motion.div>
          </motion.div>

          {/* Salary Chart */}
          <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="visible"
          >
            <Card className="overflow-hidden transition-all hover:shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      Salary Ranges by Role
                    </CardTitle>
                    <CardDescription>
                      Displaying minimum, median, and maximum salaries (in
                      thousands)
                    </CardDescription>
                  </div>
                  {/* <Button variant="outline" size="sm" className="gap-1">
                    <ArrowUpRight className="h-4 w-4" />
                    <span>Full Report</span>
                  </Button> */}
                </div>
              </CardHeader>

              <CardContent>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={salaryData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      barGap={8}
                      barSize={20}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#888"
                        strokeOpacity={0.2}
                      />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#888", fontSize: 12 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#888", fontSize: 12 }}
                        tickFormatter={(value) => `${value}K`}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-background border rounded-lg p-3 shadow-lg">
                                <p className="font-medium text-sm mb-2">
                                  {label}
                                </p>
                                {payload.map((item) => (
                                  <div
                                    key={item.name}
                                    className="flex items-center justify-between gap-4 text-sm"
                                  >
                                    <span className="flex items-center gap-1">
                                      <span
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: item.color }}
                                      ></span>
                                      {item.name}:
                                    </span>
                                    <span className="font-medium">
                                      {item.value}K
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 12, paddingTop: 20 }}
                      />
                      <Bar
                        dataKey="min"
                        name="Min Salary"
                        radius={[4, 4, 0, 0]}
                      >
                        {salaryData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={`${getColorByIndex(index)}80`}
                          />
                        ))}
                      </Bar>
                      <Bar
                        dataKey="median"
                        name="Median Salary"
                        radius={[4, 4, 0, 0]}
                      >
                        {salaryData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={getColorByIndex(index)}
                          />
                        ))}
                      </Bar>
                      <Bar
                        dataKey="max"
                        name="Max Salary"
                        radius={[4, 4, 0, 0]}
                      >
                        {salaryData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={`${getColorByIndex(index)}B0`}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Salary Data Tab */}
        <TabsContent value="salary" className="space-y-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants}>
              <Card className="overflow-hidden transition-all hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        Detailed Salary Analysis
                      </CardTitle>
                      <CardDescription>
                        Comprehensive breakdown of salary data across different
                        roles
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={salaryData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#888"
                          strokeOpacity={0.2}
                        />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#888", fontSize: 12 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#888", fontSize: 12 }}
                          tickFormatter={(value) => `${value}K`}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-background border rounded-lg p-3 shadow-lg">
                                  <p className="font-medium text-sm mb-2">
                                    {label}
                                  </p>
                                  {payload.map((item) => (
                                    <div
                                      key={item.name}
                                      className="flex items-center justify-between gap-4 text-sm"
                                    >
                                      <span className="flex items-center gap-1">
                                        <span
                                          className="w-2 h-2 rounded-full"
                                          style={{
                                            backgroundColor: item.color,
                                          }}
                                        ></span>
                                        {item.name}:
                                      </span>
                                      <span className="font-medium">
                                        {item.value}K
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: 12, paddingTop: 20 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="min"
                          name="Min Salary"
                          stroke="#6366f180"
                          fill="#6366f120"
                          activeDot={{ r: 6 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="median"
                          name="Median Salary"
                          stroke="#8b5cf680"
                          fill="#8b5cf620"
                          activeDot={{ r: 6 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="max"
                          name="Max Salary"
                          stroke="#ec489980"
                          fill="#ec489920"
                          activeDot={{ r: 6 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>

                <CardFooter className="border-t bg-muted/20 px-6 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                    {insights.salaryRanges.map((range, index) => (
                      <div key={index} className="flex flex-col space-y-1">
                        <div className="text-sm font-medium">{range.role}</div>
                        <div className="text-xs text-muted-foreground">
                          {range.location}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="text-xs">Range:</div>
                          <div className="text-sm font-medium">
                            {(range.min / 1000).toFixed(0)}K -
                            {(range.max / 1000).toFixed(0)}K
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardFooter>
              </Card>
            </motion.div>
          </motion.div>
        </TabsContent>

        {/* Skills & Trends Tab */}
        <TabsContent value="skills" className="space-y-6">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Key Industry Trends */}
            <motion.div variants={itemVariants}>
              <Card className="h-full overflow-hidden transition-all hover:shadow-md border-t-4 border-t-rose-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-rose-500" />
                    Key Industry Trends
                  </CardTitle>
                  <CardDescription>
                    Current trends shaping the industry
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {insights.keyTrends.map((trend, index) => (
                    <div
                      key={index}
                      className="flex gap-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20"
                    >
                      <div className="mt-0.5">
                        <div className="h-6 w-6 rounded-full bg-rose-500/20 flex items-center justify-center">
                          <ChevronRight className="h-4 w-4 text-rose-500" />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm">{trend}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
                <CardFooter className="border-t bg-muted/20 px-6 py-4">
                  <Button variant="outline" size="sm" className="gap-1 w-full">
                    <ArrowUpRight className="h-4 w-4" />
                    <span>View Industry Report</span>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>

            {/* Recommended Skills */}
            <motion.div variants={itemVariants}>
              <Card className="h-full overflow-hidden transition-all hover:shadow-md border-t-4 border-t-amber-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-amber-500" />
                    Recommended Skills
                  </CardTitle>
                  <CardDescription>
                    Skills to consider developing for career advancement
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {insights.recommendedSkills.map((skill, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 transition-all hover:bg-amber-500/20 cursor-pointer"
                      >
                        <Zap className="h-4 w-4 text-amber-500 flex-shrink-0" />
                        <span className="text-sm font-medium">{skill}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="border-t bg-muted/20 px-6 py-4">
                  <Button variant="outline" size="sm" className="gap-1 w-full">
                    <ArrowUpRight className="h-4 w-4" />
                    <span>Find Learning Resources</span>
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default DashBoardView;
