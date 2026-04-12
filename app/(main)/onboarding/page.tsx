import React from "react";
import OnboardingFormPage from "./_components/onboarding-form";
import { industries } from "@/data/industries";
import { getOnboardingStatus } from "@/actions/user";
import { getIndustryOptions } from "@/actions/profile-options";
import { redirect } from "next/navigation";

async function Page() {
  const { isOnBoardingStatus } = await getOnboardingStatus();
  if (isOnBoardingStatus) redirect("/dashboard");

  const industryOptions = await getIndustryOptions().catch(() => industries);

  return (
    <main>
      <OnboardingFormPage
        industries={industryOptions.length > 0 ? industryOptions : industries}
      />
    </main>
  );
}

export default Page;
