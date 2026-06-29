import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { getIndustryInsights, processOnboardingAI, redisKeepalive, renderKeepalive } from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    getIndustryInsights,
    processOnboardingAI,
    redisKeepalive,
    renderKeepalive,
  ],
});
