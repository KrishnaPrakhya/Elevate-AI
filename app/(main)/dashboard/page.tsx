import { getDashboardInsights } from "@/actions/dashboard";
import { getOnboardingStatus } from "@/actions/user";
import { redirect } from "next/navigation";
import React from "react";
import DashBoardView, { IndustryInsights } from "./_components/DashBoardView";
import { IndustryInsight } from "@prisma/client";
export interface SalaryRange {
  role: string;
  min: number;
  max: number;
  median: number;
  location: string;
}

export interface DashboardInsights
  extends Omit<IndustryInsight, "salaryRanges"> {
  salaryRanges: SalaryRange[];
}

async function Page() {
  const { isOnBoardingStatus } = await getOnboardingStatus();
  if (!isOnBoardingStatus) redirect("/onboarding");
  const rawInsights = await getDashboardInsights();
  const insights: IndustryInsights = {
    ...rawInsights,
    salaryRanges: (rawInsights.salaryRanges as unknown as SalaryRange[]).filter(
      Boolean
    ),
  };
  return (
    <div className="container mx-auto">
      <DashBoardView insights={insights} />
    </div>
  );
}

export default Page;
