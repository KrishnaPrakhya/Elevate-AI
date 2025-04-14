import { getDashboardInsights } from "@/actions/dashboard";
import { getOnboardingStatus } from "@/actions/user";
import { redirect } from "next/navigation";
import React from "react";
import DashBoardView from "./_components/DashBoardView";

interface Props {}

async function Page(props: Props) {
  const {} = props;
  const { isOnBoardingStatus } = await getOnboardingStatus();
  if (!isOnBoardingStatus) redirect("/onboarding");
  const insights = await getDashboardInsights();
  return (
    <div className="container mx-auto">
      <DashBoardView insights={insights} />
    </div>
  );
}

export default Page;
