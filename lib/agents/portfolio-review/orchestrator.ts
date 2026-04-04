/**
 * Portfolio Review Orchestrator
 * Coordinates multiple specialized agents using a LangGraph-style state machine
 * Manages the flow between browser analysis, content analysis, and final synthesis
 */

import { BrowserAgent, type BrowserAnalysisResult } from './browser-agent';
import { ContentAnalyzerAgent, type ContentAnalysisResult } from './content-analyzer';
import OpenAI from 'openai';

// Use Ollama Cloud configuration (same as other AI integrations in the app)
const ollamaApiKey = process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || '';
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || 'https://ollama.com/v1';
const isOllamaConfigured = !!ollamaApiKey;

const ollamaClient = isOllamaConfigured
  ? new OpenAI({ apiKey: ollamaApiKey, baseURL: ollamaBaseUrl })
  : null;

// ============================================
// State Types for the Graph
// ============================================

export interface PortfolioReviewState {
  // Input
  artifactId: string;
  url: string | null;
  title: string;
  description: string;
  skillsDemonstrated: string[];
  userContext: UserContext;

  // Agent outputs
  browserAnalysis: BrowserAnalysisResult | null;
  contentAnalysis: ContentAnalysisResult | null;
  aiReview: AIReviewResult | null;

  // Graph state
  currentNode: string;
  errors: string[];
  warnings: string[];

  // Final output
  finalReview: PortfolioReviewResult | null;
}

export interface UserContext {
  name: string | null;
  industry: string | null;
  experience: number | null;
  currentSkills: string[];
  careerGoals?: string;
}

export interface AIReviewResult {
  score: number;
  feedback: string;
  suggestions: string[];
  technicalAssessment: TechnicalAssessment;
}

export interface TechnicalAssessment {
  codeQuality?: number;
  designPrinciples?: number;
  bestPractices?: number;
  scalability?: number;
}

export interface PortfolioReviewResult {
  // Overall scores
  overallScore: number;
  categoryScores: {
    content: number;
    design: number;
    technical: number;
    accessibility: number;
    professionalism: number;
  };

  // Detailed analysis
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];

  // Browser analysis summary
  technicalDetails: {
    loadTime: number;
    mobileResponsive: boolean;
    hasSSL: boolean;
    technologies: string[];
    accessibilityLevel: string;
    performanceScore: number;
  };

  // Content analysis summary
  contentDetails: {
    readabilityScore: number;
    hasMetrics: boolean;
    hasContactInfo: boolean;
    hasCallToAction: boolean;
    professionalismScore: number;
  };

  // AI-generated feedback
  aiFeedback: {
    score: number;
    feedback: string;
    suggestions: string[];
  };

  // Action items
  actionItems: ActionItem[];

  // Metadata
  analyzedAt: string;
  analysisDuration: number;
}

export interface ActionItem {
  priority: 'high' | 'medium' | 'low';
  category: 'content' | 'design' | 'technical' | 'accessibility';
  title: string;
  description: string;
  estimatedEffort: 'quick' | 'moderate' | 'significant';
}

// ============================================
// Graph Node Definitions
// ============================================

type GraphNode = (state: PortfolioReviewState) => Promise<Partial<PortfolioReviewState>>;

export class PortfolioReviewOrchestrator {
  private browserAgent: BrowserAgent;
  private contentAnalyzer: ContentAnalyzerAgent;
  private client: OpenAI | null;

  constructor() {
    this.browserAgent = new BrowserAgent();
    this.contentAnalyzer = new ContentAnalyzerAgent();
    this.client = ollamaClient;
  }

  // ============================================
  // Main Entry Point
  // ============================================

  async reviewPortfolio(input: {
    artifactId: string;
    url: string | null;
    title: string;
    description: string;
    skillsDemonstrated: string[];
    userContext: UserContext;
  }): Promise<PortfolioReviewResult> {
    const startTime = Date.now();

    // Initialize state
    let state: PortfolioReviewState = {
      ...input,
      browserAnalysis: null,
      contentAnalysis: null,
      aiReview: null,
      currentNode: 'start',
      errors: [],
      warnings: [],
      finalReview: null,
    };

    try {
      // Run the graph
      state = await this.runGraph(state);

      if (!state.finalReview) {
        throw new Error('Failed to generate final review');
      }

      return {
        ...state.finalReview,
        analyzedAt: new Date().toISOString(),
        analysisDuration: Date.now() - startTime,
      };
    } catch (error) {
      state.errors.push(`Review failed: ${(error as Error).message}`);

      // Return a fallback review
      return this.createFallbackReview(state, startTime);
    } finally {
      // Clean up browser
      await this.browserAgent.close().catch(() => {});
    }
  }

  // ============================================
  // Graph Execution
  // ============================================

  private async runGraph(state: PortfolioReviewState): Promise<PortfolioReviewState> {
    // Define the graph nodes and their transitions
    const graph: Record<string, { execute: GraphNode; next: string | null }> = {
      start: { execute: this.initializeAnalysis.bind(this), next: 'browser' },
      browser: { execute: this.runBrowserAnalysis.bind(this), next: 'content' },
      content: { execute: this.runContentAnalysis.bind(this), next: 'synthesize' },
      synthesize: { execute: this.synthesizeReview.bind(this), next: null },
    };

    // Execute nodes in sequence
    while (state.currentNode !== null && graph[state.currentNode]) {
      const node = graph[state.currentNode];
      const updates = await node.execute(state);
      state = { ...state, ...updates };

      // Move to next node
      state.currentNode = node.next!;
    }

    return state;
  }

  // ============================================
  // Node Implementations
  // ============================================

  private async initializeAnalysis(state: PortfolioReviewState): Promise<Partial<PortfolioReviewState>> {
    // Validate input
    if (!state.url && !state.description) {
      return {
        errors: [...state.errors, 'No URL or description provided for analysis'],
        currentNode: 'start',
      };
    }

    // Warn if no URL
    if (!state.url) {
      return {
        warnings: [...state.warnings, 'No URL provided - limited analysis will be performed'],
      };
    }

    return {};
  }

  private async runBrowserAnalysis(state: PortfolioReviewState): Promise<Partial<PortfolioReviewState>> {
    if (!state.url) {
      return {
        browserAnalysis: this.createEmptyBrowserResult(),
        warnings: [...state.warnings, 'Skipping browser analysis - no URL provided'],
      };
    }

    try {
      console.log('[Orchestrator] Starting browser analysis for URL:', state.url);
      const analysis = await this.browserAgent.analyze(state.url);
      console.log('[Orchestrator] Browser analysis completed, load time:', analysis.loadTime, 'ms');

      // Add warnings for critical issues
      const warnings = [...state.warnings];
      if (analysis.loadTime > 5000) {
        warnings.push(`Slow page load time: ${analysis.loadTime}ms`);
      }
      if (analysis.accessibilityIssues.length > 5) {
        warnings.push(`Multiple accessibility issues: ${analysis.accessibilityIssues.length}`);
      }
      if (!analysis.mobileResponsive) {
        warnings.push('Page is not mobile responsive');
      }

      return {
        browserAnalysis: analysis,
        warnings,
      };
    } catch (error) {
      return {
        browserAnalysis: this.createEmptyBrowserResult(),
        errors: [...state.errors, `Browser analysis failed: ${(error as Error).message}`],
      };
    }
  }

  private async runContentAnalysis(state: PortfolioReviewState): Promise<Partial<PortfolioReviewState>> {
    const textToAnalyze = `${state.title}\n\n${state.description}`;

    const analysis = this.contentAnalyzer.analyze(textToAnalyze, {
      title: state.title,
      description: state.description,
      skillsDemonstrated: state.skillsDemonstrated,
    });

    return {
      contentAnalysis: analysis,
    };
  }

  private async synthesizeReview(state: PortfolioReviewState): Promise<Partial<PortfolioReviewState>> {
    const { browserAnalysis, contentAnalysis } = state;

    if (!browserAnalysis || !contentAnalysis) {
      throw new Error('Missing analysis results for synthesis');
    }

    // Calculate category scores
    const contentScore = this.calculateContentScore(contentAnalysis);
    const designScore = this.calculateDesignScore(browserAnalysis);
    const technicalScore = this.calculateTechnicalScore(browserAnalysis);
    const accessibilityScore = this.calculateAccessibilityScore(browserAnalysis);
    const professionalismScore = contentAnalysis.professionalismScore;

    const overallScore = Math.round(
      (contentScore * 0.25) +
      (designScore * 0.20) +
      (technicalScore * 0.20) +
      (accessibilityScore * 0.15) +
      (professionalismScore * 0.20)
    );

    // Generate AI feedback if Ollama Cloud is available
    let aiFeedback: PortfolioReviewResult['aiFeedback'];

    if (this.client) {
      aiFeedback = await this.generateAIFeedback(state, {
        contentScore,
        designScore,
        technicalScore,
        accessibilityScore,
        overallScore,
      });
    } else {
      aiFeedback = this.generateFallbackAIFeedback(state, {
        contentScore,
        designScore,
        technicalScore,
        accessibilityScore,
        overallScore,
      });
    }

    // Compile strengths and weaknesses
    const strengths = [
      ...contentAnalysis.strengths,
      ...(browserAnalysis.hasSSL ? ['Secure HTTPS connection'] : []),
      ...(browserAnalysis.hasOpenGraph ? ['Proper social media metadata'] : []),
      ...(browserAnalysis.mobileResponsive ? ['Mobile responsive design'] : []),
    ];

    const weaknesses = [
      ...contentAnalysis.weaknesses,
      ...(browserAnalysis.accessibilityIssues.length > 3 ? ['Accessibility concerns detected'] : []),
      ...(!browserAnalysis.mobileResponsive ? ['Not mobile responsive'] : []),
      ...(!browserAnalysis.hasSSL ? ['Missing SSL certificate'] : []),
    ];

    // Generate recommendations
    const recommendations = [
      ...contentAnalysis.recommendations,
      ...this.generateTechnicalRecommendations(browserAnalysis),
    ];

    // Generate action items
    const actionItems = this.generateActionItems(state, {
      contentScore,
      designScore,
      technicalScore,
      accessibilityScore,
    });

    const finalReview: PortfolioReviewResult = {
      overallScore,
      categoryScores: {
        content: contentScore,
        design: designScore,
        technical: technicalScore,
        accessibility: accessibilityScore,
        professionalism: professionalismScore,
      },
      summary: this.generateSummary(overallScore, state),
      strengths,
      weaknesses,
      recommendations,
      technicalDetails: {
        loadTime: browserAnalysis.loadTime,
        mobileResponsive: browserAnalysis.mobileResponsive,
        hasSSL: browserAnalysis.hasSSL,
        technologies: browserAnalysis.technologies,
        accessibilityLevel: browserAnalysis.wcagLevel,
        performanceScore: this.calculatePerformanceScore(browserAnalysis),
      },
      contentDetails: {
        readabilityScore: contentAnalysis.readabilityScore,
        hasMetrics: contentAnalysis.hasMetrics,
        hasContactInfo: contentAnalysis.hasContactInfo,
        hasCallToAction: contentAnalysis.hasCallToAction,
        professionalismScore: contentAnalysis.professionalismScore,
      },
      aiFeedback,
      actionItems,
      analyzedAt: new Date().toISOString(),
      analysisDuration: 0,
    };

    return { finalReview };
  }

  // ============================================
  // Score Calculations
  // ============================================

  private calculateContentScore(analysis: ContentAnalysisResult): number {
    return Math.round(
      (analysis.readabilityScore * 0.3) +
      (analysis.professionalismScore * 0.3) +
      (analysis.specificityScore * 0.2) +
      (Math.min(100, analysis.actionVerbs.length * 15) * 0.2)
    );
  }

  private calculateDesignScore(analysis: BrowserAnalysisResult): number {
    let score = 100;

    if (!analysis.hasHeroSection) score -= 20;
    if (!analysis.hasNavigation) score -= 15;
    if (!analysis.hasProjectsSection) score -= 15;
    if (!analysis.mobileResponsive) score -= 20;
    if (analysis.colorContrastIssues > 0) score -= 10;
    if (analysis.headingStructure.h1.length !== 1) score -= 10;

    return Math.max(0, score);
  }

  private calculateTechnicalScore(analysis: BrowserAnalysisResult): number {
    let score = 100;

    if (analysis.loadTime > 5000) score -= 20;
    else if (analysis.loadTime > 3000) score -= 10;

    if (!analysis.hasSSL) score -= 25;
    if (!analysis.hasFavicon) score -= 10;
    if (analysis.links.filter(l => l.isBroken).length > 0) score -= 15;
    if (analysis.technologies.length === 0) score -= 10;

    return Math.max(0, score);
  }

  private calculateAccessibilityScore(analysis: BrowserAnalysisResult): number {
    const criticalIssues = analysis.accessibilityIssues.filter(i => i.severity === 'critical').length;
    const seriousIssues = analysis.accessibilityIssues.filter(i => i.severity === 'serious').length;
    const moderateIssues = analysis.accessibilityIssues.filter(i => i.severity === 'moderate').length;

    let score = 100;
    score -= criticalIssues * 25;
    score -= seriousIssues * 15;
    score -= moderateIssues * 5;

    if (analysis.wcagLevel === 'fail') score -= 20;

    return Math.max(0, score);
  }

  private calculatePerformanceScore(analysis: BrowserAnalysisResult): number {
    // HTTP-based agent doesn't have access to FCP/LCP metrics
    // Use load time as a proxy
    if (!analysis.loadTime) return 50;

    let score = 100;

    if (analysis.loadTime > 5000) score -= 30;
    else if (analysis.loadTime > 3000) score -= 15;
    else if (analysis.loadTime > 1500) score -= 5;

    // Check for compression as a performance indicator
    if (!analysis.performanceMetrics.hasCompression) score -= 10;

    return Math.max(0, score);
  }

  // ============================================
  // AI Feedback Generation
  // ============================================

  private async generateAIFeedback(
    state: PortfolioReviewState,
    scores: {
      contentScore: number;
      designScore: number;
      technicalScore: number;
      accessibilityScore: number;
      overallScore: number;
    }
  ): Promise<PortfolioReviewResult['aiFeedback']> {
    const prompt = `
      You are an expert portfolio reviewer. Analyze the following portfolio review data and provide insightful feedback.

      PORTFOLIO INFO:
      - Title: ${state.title}
      - Description: ${state.description.substring(0, 500)}
      - Skills: ${state.skillsDemonstrated.join(', ')}
      - User Industry: ${state.userContext.industry || 'Not specified'}
      - User Experience: ${state.userContext.experience || 0} years

      ANALYSIS RESULTS:
      - Overall Score: ${scores.overallScore}/100
      - Content Score: ${scores.contentScore}/100
      - Design Score: ${scores.designScore}/100
      - Technical Score: ${scores.technicalScore}/100
      - Accessibility Score: ${scores.accessibilityScore}/100

      BROWSER ANALYSIS:
      - Load Time: ${state.browserAnalysis?.loadTime}ms
      - Mobile Responsive: ${state.browserAnalysis?.mobileResponsive}
      - Has SSL: ${state.browserAnalysis?.hasSSL}
      - Technologies: ${state.browserAnalysis?.technologies.join(', ')}
      - Accessibility Level: ${state.browserAnalysis?.wcagLevel}
      - Accessibility Issues: ${state.browserAnalysis?.accessibilityIssues.length}

      CONTENT ANALYSIS:
      - Readability Score: ${state.contentAnalysis?.readabilityScore}/100
      - Has Metrics: ${state.contentAnalysis?.hasMetrics}
      - Has Contact Info: ${state.contentAnalysis?.hasContactInfo}
      - Has Call to Action: ${state.contentAnalysis?.hasCallToAction}
      - Professionalism Score: ${state.contentAnalysis?.professionalismScore}/100
      - Action Verbs Found: ${state.contentAnalysis?.actionVerbs.join(', ')}

      Provide a comprehensive review with:
      1. A 2-3 paragraph summary feedback
      2. 4-6 specific, actionable suggestions

      Return ONLY valid JSON in this format:
      {
        "score": number,
        "feedback": "string",
        "suggestions": ["string"]
      }
    `;

    try {
      const result = await this.client!.chat.completions.create({
        model: 'gpt-oss:20b-cloud', // Same model used across the app (Ollama Cloud)
        messages: [
          { role: 'system', content: 'You are an expert portfolio reviewer. Return only valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      });

      let content = result.choices[0]?.message?.content?.trim() || '';

      // Clean up markdown code blocks if present
      if (content.startsWith('```json') || content.startsWith('```')) {
        content = content.replace(/```json|```/g, '').trim();
      }

      // Extract JSON from content if wrapped in other text
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }

      const parsed = JSON.parse(content);

      return {
        score: parsed.score || scores.overallScore,
        feedback: parsed.feedback || 'Review completed.',
        suggestions: parsed.suggestions || [],
      };
    } catch (error) {
      console.error('AI feedback generation failed:', error);
      return this.generateFallbackAIFeedback(state, scores);
    }
  }

  private generateFallbackAIFeedback(
    state: PortfolioReviewState,
    scores: {
      contentScore: number;
      designScore: number;
      technicalScore: number;
      accessibilityScore: number;
      overallScore: number;
    }
  ): PortfolioReviewResult['aiFeedback'] {
    const suggestions: string[] = [];

    if (scores.contentScore < 70) {
      suggestions.push('Improve content clarity and add specific metrics to demonstrate impact');
    }
    if (scores.designScore < 70) {
      suggestions.push('Enhance visual design with a clear hero section and consistent styling');
    }
    if (scores.technicalScore < 70) {
      suggestions.push('Address technical issues like page load speed and SSL certificate');
    }
    if (scores.accessibilityScore < 70) {
      suggestions.push('Fix accessibility issues including alt text and proper headings');
    }

    if (suggestions.length === 0) {
      suggestions.push('Continue maintaining high quality standards', 'Consider adding more interactive elements');
    }

    return {
      score: scores.overallScore,
      feedback: this.generateSummary(scores.overallScore, state),
      suggestions,
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private generateSummary(score: number, state: PortfolioReviewState): string {
    const level = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Needs Improvement' : 'Poor';

    return `${level} portfolio (${score}/100). ${state.title} ${score >= 60 ? 'demonstrates solid' : 'could benefit from improving'} professional presentation. ${
      state.contentAnalysis?.hasMetrics ? 'Includes quantifiable achievements.' : 'Consider adding specific metrics.'
    } ${
      state.browserAnalysis?.mobileResponsive ? 'Mobile-friendly design.' : 'Mobile responsiveness needs work.'
    }`;
  }

  private generateTechnicalRecommendations(analysis: BrowserAnalysisResult): string[] {
    const recommendations: string[] = [];

    if (analysis.loadTime > 3000) {
      recommendations.push('Optimize page load speed by compressing images and minimizing resources');
    }
    if (!analysis.hasSSL) {
      recommendations.push('Add SSL certificate for secure HTTPS connection');
    }
    if (analysis.accessibilityIssues.length > 3) {
      recommendations.push('Address accessibility issues to improve inclusivity');
    }
    if (!analysis.hasOpenGraph) {
      recommendations.push('Add Open Graph metadata for better social media sharing');
    }
    if (analysis.links.filter(l => l.isBroken).length > 0) {
      recommendations.push('Fix broken links throughout the site');
    }

    return recommendations;
  }

  private generateActionItems(
    state: PortfolioReviewState,
    scores: {
      contentScore: number;
      designScore: number;
      technicalScore: number;
      accessibilityScore: number;
    }
  ): ActionItem[] {
    const items: ActionItem[] = [];

    // High priority items
    if (!state.browserAnalysis?.hasSSL) {
      items.push({
        priority: 'high',
        category: 'technical',
        title: 'Add SSL Certificate',
        description: 'Secure your site with HTTPS to protect visitors and improve SEO',
        estimatedEffort: 'moderate',
      });
    }

    if (scores.accessibilityScore < 50) {
      items.push({
        priority: 'high',
        category: 'accessibility',
        title: 'Fix Critical Accessibility Issues',
        description: `Address ${state.browserAnalysis?.accessibilityIssues.length || 0} accessibility issues including alt text and proper headings`,
        estimatedEffort: 'moderate',
      });
    }

    // Medium priority items
    if (!state.contentAnalysis?.hasMetrics) {
      items.push({
        priority: 'medium',
        category: 'content',
        title: 'Add Quantifiable Metrics',
        description: 'Include specific numbers, percentages, or outcomes to demonstrate impact',
        estimatedEffort: 'quick',
      });
    }

    if (!state.browserAnalysis?.mobileResponsive) {
      items.push({
        priority: 'medium',
        category: 'design',
        title: 'Improve Mobile Responsiveness',
        description: 'Ensure the site displays properly on mobile devices',
        estimatedEffort: 'significant',
      });
    }

    if (scores.contentScore < 60) {
      items.push({
        priority: 'medium',
        category: 'content',
        title: 'Improve Content Quality',
        description: 'Enhance writing clarity, add action verbs, and fix grammar issues',
        estimatedEffort: 'moderate',
      });
    }

    // Low priority items
    if (!state.browserAnalysis?.hasOpenGraph) {
      items.push({
        priority: 'low',
        category: 'technical',
        title: 'Add Social Media Metadata',
        description: 'Add Open Graph tags for better link previews on social platforms',
        estimatedEffort: 'quick',
      });
    }

    if (!state.contentAnalysis?.hasCallToAction) {
      items.push({
        priority: 'low',
        category: 'content',
        title: 'Add Call to Action',
        description: 'Include a clear next step for visitors (contact, LinkedIn, etc.)',
        estimatedEffort: 'quick',
      });
    }

    return items;
  }

  private createEmptyBrowserResult(): BrowserAnalysisResult {
    return {
      url: '',
      title: '',
      loadTime: 0,
      finalUrl: '',
      wordCount: 0,
      headingStructure: { h1: [], h2: [], h3: [] },
      images: [],
      links: [],
      accessibilityIssues: [],
      wcagLevel: 'fail',
      performanceMetrics: {},
      hasHeroSection: false,
      hasNavigation: false,
      hasContactSection: false,
      hasProjectsSection: false,
      colorContrastIssues: 0,
      mobileResponsive: false,
      technologies: [],
      hasAnalytics: false,
      hasSSL: false,
      hasFavicon: false,
      hasOpenGraph: false,
      screenshots: { fullPage: '', hero: '', navigation: '' },
      interactionResults: [],
      errors: ['No URL provided'],
    };
  }

  private createFallbackReview(state: PortfolioReviewState, startTime: number): PortfolioReviewResult {
    return {
      overallScore: 50,
      categoryScores: {
        content: 50,
        design: 50,
        technical: 50,
        accessibility: 50,
        professionalism: 50,
      },
      summary: 'Analysis encountered issues. Please check the URL and try again.',
      strengths: [],
      weaknesses: state.errors,
      recommendations: ['Ensure the URL is accessible', 'Check your internet connection'],
      technicalDetails: {
        loadTime: 0,
        mobileResponsive: false,
        hasSSL: false,
        technologies: [],
        accessibilityLevel: 'fail',
        performanceScore: 0,
      },
      contentDetails: {
        readabilityScore: 50,
        hasMetrics: false,
        hasContactInfo: false,
        hasCallToAction: false,
        professionalismScore: 50,
      },
      aiFeedback: {
        score: 50,
        feedback: 'Unable to complete full analysis. Please verify the portfolio URL is accessible.',
        suggestions: ['Verify the URL is correct', 'Ensure the site is publicly accessible'],
      },
      actionItems: [],
      analyzedAt: new Date().toISOString(),
      analysisDuration: Date.now() - startTime,
    };
  }
}
