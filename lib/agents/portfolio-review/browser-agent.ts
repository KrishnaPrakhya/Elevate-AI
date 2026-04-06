/**
 * Browser Agent - Analyzes portfolio websites using HTTP requests + Cheerio
 * Performs comprehensive UX/UI analysis, accessibility checks, and content fetching
 * Uses lightweight HTTP-based analysis instead of browser automation for reliability
 */

import * as cheerio from 'cheerio';

export interface BrowserAnalysisResult {
  // Basic page info
  url: string;
  title: string;
  loadTime: number;
  finalUrl: string;

  // Content analysis
  wordCount: number;
  headingStructure: { h1: string[]; h2: string[]; h3: string[] };
  images: { src: string; alt: string; hasAlt: boolean }[];
  links: { href: string; text: string; isExternal: boolean; isBroken: boolean }[];

  // Accessibility
  accessibilityIssues: AccessibilityIssue[];
  wcagLevel: 'A' | 'AA' | 'AAA' | 'fail';

  // Performance metrics (estimated from headers)
  performanceMetrics: {
    contentLength?: number;
    hasCompression?: boolean;
  };

  // Visual/UX analysis
  hasHeroSection: boolean;
  hasNavigation: boolean;
  hasContactSection: boolean;
  hasProjectsSection: boolean;
  colorContrastIssues: number;
  mobileResponsive: boolean;

  // Technical analysis
  technologies: string[];
  hasAnalytics: boolean;
  hasSSL: boolean;
  hasFavicon: boolean;
  hasOpenGraph: boolean;

  // Screenshots (not available in HTTP mode)
  screenshots: {
    fullPage: string;
    hero: string;
    navigation: string;
  };

  // Interaction tests (limited in HTTP mode)
  interactionResults: InteractionTestResult[];

  // Errors encountered
  errors: string[];
}

export interface AccessibilityIssue {
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  rule: string;
  description: string;
  element?: string;
  wcagCriterion?: string;
}

export interface InteractionTestResult {
  test: string;
  passed: boolean;
  details?: string;
}

export class BrowserAgent {
  async analyze(url: string): Promise<BrowserAnalysisResult> {
    const errors: string[] = [];
    const startTime = Date.now();

    console.log('[BrowserAgent] Starting HTTP-based analysis for URL:', url);

    try {
      const controller = new AbortController();
      const timeoutMs = 20000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // Fetch the page
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ElevateAI-Portfolio-Reviewer/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
        signal: controller.signal,
      }).finally(() => {
        clearTimeout(timeoutId);
      });

      const loadTime = Date.now() - startTime;
      const finalUrl = response.url || url;

      console.log('[BrowserAgent] Page fetched in', loadTime, 'ms, status:', response.status);

      if (!response.ok) {
        return this.createErrorResult(url, [`HTTP ${response.status}: ${response.statusText}`]);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        return this.createErrorResult(url, [`Unsupported content type: ${contentType}`]);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Get page title
      const title = $('title').first().text().trim() || 'No title';

      // Get word count
      const text = $('body').text().replace(/\s+/g, ' ');
      const wordCount = text.split(' ').filter(w => w.length > 0).length;

      // Get heading structure
      const headingStructure = {
        h1: $('h1').map((_, el) => $(el).text().trim()).get(),
        h2: $('h2').map((_, el) => $(el).text().trim()).get(),
        h3: $('h3').map((_, el) => $(el).text().trim()).get(),
      };

      // Get images
      const images = $('img').map((_, el) => ({
        src: $(el).attr('src') || '',
        alt: $(el).attr('alt') || '',
        hasAlt: $(el).attr('alt') !== undefined,
      })).get();

      // Get links
      const links = $('a[href]').map((_, el) => {
        const href = $(el).attr('href') || '';
        const isExternal = href.startsWith('http') && !href.includes(new URL(url).hostname);
        return {
          href,
          text: $(el).text().trim(),
          isExternal,
          isBroken: false, // Can't check without additional requests
        };
      }).get();

      // Accessibility analysis
      const accessibilityIssues = this.checkAccessibility($);
      const wcagLevel = this.determineWcagLevel(accessibilityIssues);

      // Performance metrics
      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
      const hasCompression = response.headers.get('content-encoding') !== null;

      // Visual/UX analysis
      const hasHeroSection = $('header, .hero, [class*="hero"], [class*="banner"]').length > 0;
      const hasNavigation = $('nav, .nav, [class*="navigation"], header ul').length > 0;
      const hasContactSection = text.toLowerCase().includes('contact') ||
        $('[class*="contact"], footer a[href^="mailto"]').length > 0;
      const hasProjectsSection = text.toLowerCase().includes('project') ||
        text.toLowerCase().includes('portfolio') ||
        $('[class*="project"], [class*="portfolio"], [class*="work"]').length > 0;

      // Mobile responsiveness check
      const mobileResponsive = $('meta[name="viewport"]').length > 0;

      // Technical analysis
      const technologies = this.detectTechnologies($);
      const hasAnalytics = $('script[src*="google-analytics"], script[src*="analytics"]').length > 0 ||
        $('[data-ga-id]').length > 0;
      const hasSSL = url.startsWith('https://');
      const hasFavicon = $('link[rel="icon"], link[rel="shortcut icon"]').length > 0;
      const hasOpenGraph = $('meta[property="og:title"], meta[property="og:description"]').length > 0;

      // Interaction tests (limited)
      const interactionResults: InteractionTestResult[] = [
        { test: 'Has navigation links', passed: links.length > 0 },
        { test: 'Has internal links', passed: links.some(l => !l.isExternal) },
        { test: 'Page loads successfully', passed: response.ok },
        { test: 'Not a 404 page', passed: !text.toLowerCase().includes('404 not found') },
      ];

      return {
        url,
        title,
        loadTime,
        finalUrl,
        wordCount,
        headingStructure,
        images,
        links: links.slice(0, 50), // Limit to 50 links
        accessibilityIssues,
        wcagLevel,
        performanceMetrics: {
          contentLength,
          hasCompression,
        },
        hasHeroSection,
        hasNavigation,
        hasContactSection,
        hasProjectsSection,
        colorContrastIssues: 0, // Can't check without rendering
        mobileResponsive,
        technologies,
        hasAnalytics,
        hasSSL,
        hasFavicon,
        hasOpenGraph,
        screenshots: { fullPage: '', hero: '', navigation: '' },
        interactionResults,
        errors,
      };
    } catch (error) {
      console.error('[BrowserAgent] Analysis failed:', error);
      if ((error as Error).name === 'AbortError') {
        errors.push('Analysis timed out after 20 seconds while fetching the URL');
      } else {
        errors.push(`Analysis failed: ${(error as Error).message}`);
      }
      return this.createErrorResult(url, errors);
    }
  }

  private checkAccessibility($: cheerio.CheerioAPI): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = [];

    // Check for images without alt text
    const imagesWithoutAlt = $('img').filter((_, el) => !$(el).attr('alt')).length;
    if (imagesWithoutAlt > 0) {
      issues.push({
        severity: 'serious',
        rule: 'image-alt',
        description: `${imagesWithoutAlt} image(s) missing alt text`,
        wcagCriterion: '1.1.1',
      });
    }

    // Check for form labels
    const unlabeledInputs = $('input:not([type="hidden"]):not([type="submit"]):not([type="button"])').filter((_, el) => {
      const id = $(el).attr('id');
      if (id && $(`label[for="${id}"]`).length > 0) return false;
      return $(el).closest('label').length === 0;
    }).length;
    if (unlabeledInputs > 0) {
      issues.push({
        severity: 'serious',
        rule: 'form-label',
        description: `${unlabeledInputs} form input(s) missing labels`,
        wcagCriterion: '1.3.1',
      });
    }

    // Check for missing lang attribute
    const hasLang = $('html').attr('lang') !== undefined;
    if (!hasLang) {
      issues.push({
        severity: 'moderate',
        rule: 'html-lang',
        description: 'HTML element missing lang attribute',
        wcagCriterion: '3.1.1',
      });
    }

    // Check for skip links
    const hasSkipLink = $('a[href="#main"], a[href="#content"], [class*="skip"]').length > 0;
    if (!hasSkipLink) {
      issues.push({
        severity: 'minor',
        rule: 'skip-link',
        description: 'No skip navigation link found',
        wcagCriterion: '2.4.1',
      });
    }

    return issues;
  }

  private determineWcagLevel(issues: AccessibilityIssue[]): 'A' | 'AA' | 'AAA' | 'fail' {
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const seriousCount = issues.filter(i => i.severity === 'serious').length;

    if (criticalCount > 0) return 'fail';
    if (seriousCount > 2) return 'fail';
    if (seriousCount > 0) return 'A';
    if (issues.length > 5) return 'A';
    if (issues.length > 2) return 'AA';
    return 'AAA';
  }

  private detectTechnologies($: cheerio.CheerioAPI): string[] {
    const technologies: string[] = [];

    // Check for common frameworks via script tags
    const scripts = $('script[src]');
    scripts.each((_, el) => {
      const src = $(el).attr('src') || '';
      if (src.includes('react')) technologies.push('React');
      if (src.includes('vue')) technologies.push('Vue');
      if (src.includes('angular')) technologies.push('Angular');
      if (src.includes('jquery')) technologies.push('jQuery');
      if (src.includes('next')) technologies.push('Next.js');
      if (src.includes('bootstrap')) technologies.push('Bootstrap');
      if (src.includes('tailwind')) technologies.push('Tailwind CSS');
    });

    // Check for meta generators
    const generator = $('meta[name="generator"]').attr('content');
    if (generator) {
      technologies.push(generator);
    }

    // Check for inline styles that suggest frameworks
    const styles = $('link[rel="stylesheet"]');
    styles.each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.includes('bootstrap')) technologies.push('Bootstrap');
      if (href.includes('tailwind')) technologies.push('Tailwind CSS');
      if (href.includes('material')) technologies.push('Material UI');
    });

    return [...new Set(technologies)];
  }

  private createErrorResult(url: string, errors: string[]): BrowserAnalysisResult {
    return {
      url,
      title: 'Error',
      loadTime: 0,
      finalUrl: url,
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
      hasSSL: url.startsWith('https://'),
      hasFavicon: false,
      hasOpenGraph: false,
      screenshots: { fullPage: '', hero: '', navigation: '' },
      interactionResults: [],
      errors,
    };
  }

  /**
   * Close the agent (no-op for HTTP-based agent, kept for API compatibility)
   */
  async close(): Promise<void> {
    // No cleanup needed for HTTP-based agent
  }
}
