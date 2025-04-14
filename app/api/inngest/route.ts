import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { getIndustryInsights } from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    getIndustryInsights
  ],
});
