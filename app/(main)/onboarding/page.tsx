import React from "react";
import OnboardingFormPage from "./_components/onboarding-form";
import { industries } from "@/data/industries";
import { getOnboardingStatus } from "@/actions/user";
import { redirect } from "next/navigation";

async function Page() {
  const { isOnBoardingStatus } = await getOnboardingStatus();
  console.log(isOnBoardingStatus);
  if (isOnBoardingStatus) redirect("/dashboard");
  return (
    <main>
      <OnboardingFormPage industries={industries} />
    </main>
  );
}

export default Page;
