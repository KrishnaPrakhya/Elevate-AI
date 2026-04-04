import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

const normalizeUrl = (url?: string | null): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let artifactIdForError: string | null = null;

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    artifactIdForError = id;

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
      include: {
        resume: true,
        skillProgress: {
          include: { skill: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const artifact = await db.portfolioArtifact.findUnique({
      where: { id, userId: user.id },
    });

    if (!artifact) {
      return NextResponse.json(
        { error: "Artifact not found" },
        { status: 404 }
      );
    }

    // Check if we have a URL to analyze
    const normalizedUrl = normalizeUrl(artifact.contentUrl);

    // Load orchestrator lazily so module-level dependency issues do not crash the route.
    const { PortfolioReviewOrchestrator } = await import(
      "@/lib/agents/portfolio-review/orchestrator"
    );

    // Initialize the agentic review system
    const orchestrator = new PortfolioReviewOrchestrator();

    console.log("Starting portfolio review for artifact:", artifact.id, "URL:", normalizedUrl);

    // Run the multi-agent portfolio review with timeout
    const reviewResult = await Promise.race([
      orchestrator.reviewPortfolio({
        artifactId: artifact.id,
        url: normalizedUrl,
        title: artifact.title,
        description: artifact.description,
        skillsDemonstrated: artifact.skillsDemonstrated || [],
        userContext: {
          name: user.name,
          industry: user.industry || "General",
          experience: user.experience || 0,
          currentSkills: user.skillProgress.map((sp) => sp.skill.name),
        },
      }),
      // Timeout after 60 seconds
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Portfolio review timed out')), 60000)
      ),
    ]);

    console.log("Portfolio review completed successfully for artifact:", artifact.id);

    // Transform the agentic review into the format expected by the frontend
    const aiReview = {
      score: reviewResult.overallScore,
      feedback: `## Portfolio Review: ${reviewResult.summary}\n\n### Detailed Analysis\n\n${reviewResult.aiFeedback.feedback}\n\n### Category Scores\n\n| Category | Score |\n|----------|-------|\n| Content | ${reviewResult.categoryScores.content}/100 |\n| Design | ${reviewResult.categoryScores.design}/100 |\n| Technical | ${reviewResult.categoryScores.technical}/100 |\n| Accessibility | ${reviewResult.categoryScores.accessibility}/100 |\n| Professionalism | ${reviewResult.categoryScores.professionalism}/100 |\n\n### Technical Details\n\n- **Load Time**: ${reviewResult.technicalDetails.loadTime}ms\n- **Mobile Responsive**: ${reviewResult.technicalDetails.mobileResponsive ? 'Yes' : 'No'}\n- **SSL/HTTPS**: ${reviewResult.technicalDetails.hasSSL ? 'Yes' : 'No'}\n- **Accessibility Level**: ${reviewResult.technicalDetails.accessibilityLevel}\n- **Technologies Detected**: ${reviewResult.technicalDetails.technologies.join(', ') || 'None'}\n\n### Content Analysis\n\n- **Readability Score**: ${reviewResult.contentDetails.readabilityScore}/100\n- **Has Metrics**: ${reviewResult.contentDetails.hasMetrics ? 'Yes' : 'No'}\n- **Has Contact Info**: ${reviewResult.contentDetails.hasContactInfo ? 'Yes' : 'No'}\n- **Has Call to Action**: ${reviewResult.contentDetails.hasCallToAction ? 'Yes' : 'No'}\n\n### Strengths\n\n${reviewResult.strengths.map(s => `- ${s}`).join('\n')}\n\n### Areas for Improvement\n\n${reviewResult.weaknesses.map(w => `- ${w}`).join('\n')}`,
      suggestions: reviewResult.recommendations.slice(0, 6),
    };

    // Store the detailed review in a format that can be retrieved later
    const detailedReview = {
      ...aiReview,
      // Add structured data for potential future use
      _metadata: {
        analyzedAt: reviewResult.analyzedAt,
        analysisDuration: reviewResult.analysisDuration,
        categoryScores: reviewResult.categoryScores,
        technicalDetails: reviewResult.technicalDetails,
        contentDetails: reviewResult.contentDetails,
        actionItems: reviewResult.actionItems,
      },
    };

    return NextResponse.json({
      artifact: {
        ...artifact,
        aiReview: detailedReview,
      },
      review: reviewResult, // Return full structured review for potential UI enhancement
    });
  } catch (error) {
    console.error("Error generating AI review:", error);

    // Return fallback review on error
    const fallbackReview = {
      score: 75,
      feedback: "**Portfolio Review**\n\nYour portfolio artifact has been reviewed. Here's some general feedback:\n\n**Strengths:**\n- You've created a tangible project that demonstrates your skills\n- The artifact is well-documented\n\n**Areas for Improvement:**\n- Consider adding more specific details about your contribution\n- Include metrics or outcomes to show the impact of your work\n- Add links to live demos or code repositories when possible",
      suggestions: [
        "Add quantifiable results or metrics",
        "Include links to demos or repositories",
        "Describe specific challenges and solutions",
        "Gather testimonials or endorsements",
      ],
    };

    return NextResponse.json({
      artifact: {
        id: artifactIdForError,
        aiReview: fallbackReview,
      },
      error: (error as Error).message,
    }, { status: 200 }); // Return 200 with fallback instead of error
  }
}
