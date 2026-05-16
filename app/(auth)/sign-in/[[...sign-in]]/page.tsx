import { SignIn } from "@clerk/nextjs";
import React from "react";

function Page() {
  return <SignIn fallbackRedirectUrl="/onboarding" />;
}

export default Page;
