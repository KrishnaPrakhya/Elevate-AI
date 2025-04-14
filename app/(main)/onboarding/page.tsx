import React from "react";
import OnboardingFormPage from "./_components/onboarding-form";
import { industries } from "@/data/industries";
import { getOnboardingStatus } from "@/actions/user";
import { redirect } from "next/navigation";

interface Props {}

async function Page(props: Props) {
  const { isOnBoardingStatus } = await getOnboardingStatus();
  if (isOnBoardingStatus) redirect("/dashboard");
  return (
    <main>
      <OnboardingFormPage industries={industries} />
    </main>
  );
}

export default Page;
