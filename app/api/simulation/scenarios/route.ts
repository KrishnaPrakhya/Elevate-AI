import { NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:5000";

export async function GET() {
  try {
    const response = await fetch(`${FASTAPI_URL}/api/simulation/scenarios`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching scenarios:", error);
    // Return fallback scenarios
    return NextResponse.json({
      scenarios: [
        {
          id: "api-design",
          title: "API Rate Limiter Design",
          description: "Design a rate-limiter for a public API",
          difficulty: "intermediate",
          category: "system-design"
        },
        {
          id: "system-design",
          title: "URL Shortener Service",
          description: "Design a scalable URL shortening service",
          difficulty: "intermediate",
          category: "system-design"
        },
        {
          id: "debugging",
          title: "Production Debugging",
          description: "Debug random API latency spikes",
          difficulty: "advanced",
          category: "technical"
        },
        {
          id: "negotiation",
          title: "Technical Negotiation",
          description: "Negotiate testing standards with stakeholders",
          difficulty: "intermediate",
          category: "soft-skill"
        }
      ]
    });
  }
}
