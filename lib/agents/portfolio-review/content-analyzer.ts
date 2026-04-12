/**
 * Content Analyzer Agent - Analyzes portfolio content quality
 * Evaluates writing quality, clarity, impact, and professional presentation
 */

export interface ContentAnalysisResult {
  // Writing quality
  readabilityScore: number; // 0-100
  grammarIssues: GrammarIssue[];
  toneAnalysis: ToneAnalysis;

  // Content structure
  hasClearIntroduction: boolean;
  hasClearConclusion: boolean;
  paragraphStructure: 'good' | 'needs-improvement' | 'poor';
  sentenceVariety: number; // 0-100

  // Content quality
  specificityScore: number; // 0-100 - how specific/concrete vs vague
  hasMetrics: boolean;
  metricsCount: number;
  actionVerbs: string[];
  passiveVoiceCount: number;

  // Professional presentation
  professionalismScore: number; // 0-100
  hasTypos: boolean;
  hasContactInfo: boolean;
  hasCallToAction: boolean;

  // Skills demonstration
  claimedSkills: string[];
  skillsWithEvidence: string[];
  skillsWithoutEvidence: string[];

  // Overall assessment
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface GrammarIssue {
  type: 'spelling' | 'grammar' | 'punctuation' | 'style';
  message: string;
  suggestion?: string;
  context?: string;
}

export interface ToneAnalysis {
  overall: 'professional' | 'casual' | 'academic' | 'creative' | 'mixed';
  confidence: number; // 0-100
  attributes: {
    formal: number; // 0-100
    friendly: number; // 0-100
    authoritative: number; // 0-100
    enthusiastic: number; // 0-100
  };
}

export class ContentAnalyzerAgent {
  analyze(text: string, context?: {
    title?: string;
    description?: string;
    skillsDemonstrated?: string[];
  }): ContentAnalysisResult {
    const results: ContentAnalysisResult = {
      readabilityScore: this.calculateReadabilityScore(text),
      grammarIssues: this.detectGrammarIssues(text),
      toneAnalysis: this.analyzeTone(text),
      hasClearIntroduction: this.hasClearIntroduction(text),
      hasClearConclusion: this.hasClearConclusion(text),
      paragraphStructure: this.evaluateParagraphStructure(text),
      sentenceVariety: this.calculateSentenceVariety(text),
      specificityScore: this.calculateSpecificityScore(text),
      hasMetrics: this.hasMetrics(text),
      metricsCount: this.countMetrics(text),
      actionVerbs: this.extractActionVerbs(text),
      passiveVoiceCount: this.countPassiveVoice(text),
      professionalismScore: 0, // calculated below
      hasTypos: this.hasTypos(text),
      hasContactInfo: this.hasContactInfo(text),
      hasCallToAction: this.hasCallToAction(text),
      claimedSkills: context?.skillsDemonstrated || [],
      skillsWithEvidence: [],
      skillsWithoutEvidence: [],
      strengths: [],
      weaknesses: [],
      recommendations: [],
    };

    // Calculate skills with/without evidence
    results.skillsWithEvidence = results.claimedSkills.filter(skill =>
      this.hasSkillEvidence(text, skill)
    );
    results.skillsWithoutEvidence = results.claimedSkills.filter(skill =>
      !this.hasSkillEvidence(text, skill)
    );

    // Calculate professionalism score
    results.professionalismScore = this.calculateProfessionalismScore(results);

    // Generate strengths, weaknesses, recommendations
    results.strengths = this.generateStrengths(results);
    results.weaknesses = this.generateWeaknesses(results);
    results.recommendations = this.generateRecommendations(results);

    return results;
  }

  private calculateReadabilityScore(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const syllables = words.reduce((sum, word) => sum + this.countSyllables(word), 0);

    if (sentences.length === 0 || words.length === 0) return 50;

    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;

    // Flesch Reading Ease formula
    const score = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);

    // Normalize to 0-100
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private countSyllables(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;

    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
  }

  private detectGrammarIssues(text: string): GrammarIssue[] {
    const issues: GrammarIssue[] = [];

    // Check for multiple spaces
    const multipleSpaces = text.match(/  +/g);
    if (multipleSpaces && multipleSpaces.length > 2) {
      issues.push({
        type: 'style',
        message: 'Multiple instances of multiple spaces detected',
        suggestion: 'Use single spaces between words',
      });
    }

    // Check for excessive capitalization
    const allCapsWords = text.match(/\b[A-Z]{4,}\b/g);
    if (allCapsWords && allCapsWords.length > 3) {
      issues.push({
        type: 'style',
        message: 'Excessive use of all-caps words',
        suggestion: 'Use title case or sentence case instead',
      });
    }

    // Check for very long sentences
    const sentences = text.split(/[.!?]+/);
    const longSentences = sentences.filter(s => s.split(/\s+/).length > 40);
    if (longSentences.length > 0) {
      issues.push({
        type: 'style',
        message: `${longSentences.length} sentence(s) exceed 40 words`,
        suggestion: 'Break long sentences into shorter ones for clarity',
      });
    }

    // Check for common typos
    const commonTypos: Record<string, string> = {
      'teh': 'the',
      'adn': 'and',
      'tha': 'that',
      'wiht': 'with',
      'recieve': 'receive',
      'occured': 'occurred',
      'seperate': 'separate',
    };

    Object.entries(commonTypos).forEach(([typo, correction]) => {
      if (new RegExp(`\\b${typo}\\b`, 'i').test(text)) {
        issues.push({
          type: 'spelling',
          message: `Possible typo: "${typo}"`,
          suggestion: correction,
        });
      }
    });

    return issues;
  }

  private analyzeTone(text: string): ToneAnalysis {
    const lowerText = text.toLowerCase();

    // Calculate tone attributes
    const formalIndicators = ['therefore', 'furthermore', 'consequently', 'nevertheless', 'utilize', 'demonstrate', 'implement'];
    const friendlyIndicators = ['hello', 'welcome', 'great', 'awesome', 'love', 'excited', 'thrilled'];
    const authoritativeIndicators = ['must', 'should', 'always', 'never', 'expert', 'professional', 'certified'];
    const enthusiasticIndicators = ['!', 'amazing', 'incredible', 'fantastic', 'passionate', 'enthusiastic'];

    const formalCount = formalIndicators.filter(word => lowerText.includes(word)).length;
    const friendlyCount = friendlyIndicators.filter(word => lowerText.includes(word)).length;
    const authoritativeCount = authoritativeIndicators.filter(word => lowerText.includes(word)).length;
    const enthusiasticCount = (lowerText.match(/!/g) || []).length + enthusiasticIndicators.filter(word => lowerText.includes(word)).length;

    const total = formalCount + friendlyCount + authoritativeCount + enthusiasticCount || 1;

    // Determine overall tone
    const scores = { formal: formalCount, friendly: friendlyCount, authoritative: authoritativeCount, enthusiastic: enthusiasticCount };
    const maxScore = Math.max(...Object.values(scores));
    const overall = maxScore === formalCount ? 'professional' :
                    maxScore === friendlyCount ? 'casual' :
                    maxScore === authoritativeCount ? 'academic' :
                    maxScore === enthusiasticCount ? 'creative' : 'mixed';

    return {
      overall,
      confidence: Math.round((maxScore / total) * 100),
      attributes: {
        formal: Math.round((formalCount / total) * 100),
        friendly: Math.round((friendlyCount / total) * 100),
        authoritative: Math.round((authoritativeCount / total) * 100),
        enthusiastic: Math.round((enthusiasticCount / total) * 100),
      },
    };
  }

  private hasClearIntroduction(text: string): boolean {
    const firstParagraph = text.split(/\n\n+/)[0] || '';
    return firstParagraph.length > 50 && firstParagraph.length < 300;
  }

  private hasClearConclusion(text: string): boolean {
    const paragraphs = text.split(/\n\n+/);
    const lastParagraph = paragraphs[paragraphs.length - 1] || '';
    return lastParagraph.length > 30 && lastParagraph.length < 200;
  }

  private evaluateParagraphStructure(text: string): 'good' | 'needs-improvement' | 'poor' {
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);

    if (paragraphs.length < 2) return 'poor';

    const avgLength = text.split(/\s+/).length / paragraphs.length;

    if (paragraphs.length >= 3 && avgLength >= 3 && avgLength <= 150) return 'good';
    if (paragraphs.length >= 2 && avgLength >= 2 && avgLength <= 200) return 'needs-improvement';
    return 'poor';
  }

  private calculateSentenceVariety(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length < 2) return 50;

    const lengths = sentences.map(s => s.split(/\s+/).length);
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avg, 2), 0) / lengths.length;
    const stdDev = Math.sqrt(variance);

    // Higher variance = more variety, cap at 100
    return Math.min(100, Math.round(50 + stdDev * 5));
  }

  private calculateSpecificityScore(text: string): number {
    const vagueWords = ['some', 'many', 'various', 'several', 'things', 'stuff', 'things', 'etc', 'and more'];
    const specificIndicators = ['%', '$', 'users', 'customers', 'increased', 'reduced', 'from', 'to', 'within'];

    const lowerText = text.toLowerCase();
    const vagueCount = vagueWords.filter(word => lowerText.includes(word)).length;
    const specificCount = specificIndicators.filter(indicator => text.includes(indicator)).length;

    const total = vagueCount + specificCount || 1;
    return Math.round((specificCount / total) * 100);
  }

  private hasMetrics(text: string): boolean {
    return /[\d]+%/.test(text) ||
           /[\d]+\s*(users|customers|revenue|growth|increase|decrease)/i.test(text) ||
           /from\s*[\d,]+\s*to\s*[\d,]+/i.test(text);
  }

  private countMetrics(text: string): number {
    const percentageMatches = text.match(/[\d]+%/g) || [];
    const numberMatches = text.match(/\b[\d,]+\b/g) || [];
    return percentageMatches.length + Math.min(numberMatches.length, 10);
  }

  private extractActionVerbs(text: string): string[] {
    const actionVerbs = [
      'developed', 'created', 'built', 'designed', 'implemented', 'led', 'managed',
      'improved', 'optimized', 'reduced', 'increased', 'launched', 'delivered',
      'architected', 'engineered', 'deployed', 'automated', 'integrated', 'migrated',
      'refactored', 'debugged', 'tested', 'documented', 'mentored', 'collaborated',
    ];

    const lowerText = text.toLowerCase();
    return actionVerbs.filter(verb => lowerText.includes(verb));
  }

  private countPassiveVoice(text: string): number {
    const passivePatterns = [
      /\b(was|were|is|are|been|being)\s+\w+ed\b/gi,
      /\b(was|were|is|are|been|being)\s+\w+en\b/gi,
    ];

    let count = 0;
    passivePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) count += matches.length;
    });

    return count;
  }

  private hasTypos(text: string): boolean {
    const commonTypos = ['teh', 'adn', 'tha', 'wiht', 'recieve', 'occured', 'seperate', 'definately'];
    return commonTypos.some(typo => new RegExp(`\\b${typo}\\b`, 'i').test(text));
  }

  private hasContactInfo(text: string): boolean {
    return /\w+@\w+\.\w+/.test(text) || // email
           /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(text) || // phone
           /linkedin\.com|github\.com|twitter\.com/.test(text.toLowerCase());
  }

  private hasCallToAction(text: string): boolean {
    const ctaPatterns = [
      /contact me/i, /get in touch/i, /reach out/i, /let'?s talk/i,
      /view my work/i, /see my portfolio/i, /hire me/i,
      /download my resume/i, /connect with me/i,
    ];
    return ctaPatterns.some(pattern => pattern.test(text));
  }

  private hasSkillEvidence(text: string, skill: string): boolean {
    const skillLower = skill.toLowerCase();
    const patterns = [
      new RegExp(`${skillLower}.*(?:developed|created|built|implemented)`, 'i'),
      new RegExp(`(?:using|with|via|through)\\s+${skillLower}`, 'i'),
      new RegExp(`${skillLower}.*(?:project|application|system|feature)`, 'i'),
    ];
    return patterns.some(pattern => pattern.test(text));
  }

  private calculateProfessionalismScore(results: ContentAnalysisResult): number {
    let score = 100;

    // Deduct for grammar issues
    score -= results.grammarIssues.length * 5;

    // Deduct for typos
    if (results.hasTypos) score -= 15;

    // Deduct for poor paragraph structure
    if (results.paragraphStructure === 'poor') score -= 20;
    else if (results.paragraphStructure === 'needs-improvement') score -= 10;

    // Deduct for low specificity
    if (results.specificityScore < 50) score -= 15;

    // Deduct for no metrics
    if (!results.hasMetrics) score -= 10;

    // Deduct for no contact info
    if (!results.hasContactInfo) score -= 10;

    // Deduct for high passive voice
    if (results.passiveVoiceCount > 5) score -= 10;

    // Bonus for action verbs
    score += Math.min(results.actionVerbs.length * 3, 15);

    return Math.max(0, Math.min(100, score));
  }

  private generateStrengths(results: ContentAnalysisResult): string[] {
    const strengths: string[] = [];

    if (results.readabilityScore >= 70) {
      strengths.push('Clear and readable writing style');
    }

    if (results.hasMetrics) {
      strengths.push('Includes quantifiable metrics and outcomes');
    }

    if (results.actionVerbs.length >= 5) {
      strengths.push('Strong use of action verbs to describe accomplishments');
    }

    if (results.professionalismScore >= 80) {
      strengths.push('Professional tone and presentation');
    }

    if (results.hasContactInfo) {
      strengths.push('Clear contact information for recruiters');
    }

    if (results.hasCallToAction) {
      strengths.push('Effective call-to-action for next steps');
    }

    if (results.skillsWithEvidence.length > 0) {
      strengths.push(`Demonstrates ${results.skillsWithEvidence.length} skill(s) with concrete examples`);
    }

    return strengths;
  }

  private generateWeaknesses(results: ContentAnalysisResult): string[] {
    const weaknesses: string[] = [];

    if (results.readabilityScore < 50) {
      weaknesses.push('Writing may be difficult to read or understand');
    }

    if (!results.hasMetrics) {
      weaknesses.push('Lacks quantifiable metrics to demonstrate impact');
    }

    if (results.actionVerbs.length < 3) {
      weaknesses.push('Could use more action-oriented language');
    }

    if (results.professionalismScore < 60) {
      weaknesses.push('Professional presentation needs improvement');
    }

    if (!results.hasContactInfo) {
      weaknesses.push('Missing contact information');
    }

    if (results.skillsWithoutEvidence.length > 0) {
      weaknesses.push(`${results.skillsWithoutEvidence.length} claimed skill(s) lack supporting evidence`);
    }

    if (results.passiveVoiceCount > 5) {
      weaknesses.push('Overuse of passive voice reduces impact');
    }

    if (results.grammarIssues.length > 3) {
      weaknesses.push('Multiple grammar and style issues detected');
    }

    return weaknesses;
  }

  private generateRecommendations(results: ContentAnalysisResult): string[] {
    const recommendations: string[] = [];

    if (!results.hasMetrics) {
      recommendations.push('Add specific metrics (%, $, numbers) to quantify your impact');
    }

    if (results.actionVerbs.length < 3) {
      recommendations.push('Start bullet points with strong action verbs like "Developed", "Built", "Led"');
    }

    if (results.skillsWithoutEvidence.length > 0) {
      recommendations.push(`Provide concrete examples for: ${results.skillsWithoutEvidence.slice(0, 3).join(', ')}`);
    }

    if (!results.hasContactInfo) {
      recommendations.push('Add email, LinkedIn, or GitHub links for easy contact');
    }

    if (!results.hasCallToAction) {
      recommendations.push('Add a clear call-to-action (e.g., "Feel free to reach out")');
    }

    if (results.passiveVoiceCount > 3) {
      recommendations.push('Convert passive voice to active voice for stronger impact');
    }

    if (results.grammarIssues.length > 2) {
      recommendations.push('Review and fix grammar/style issues identified above');
    }

    if (!results.hasClearIntroduction) {
      recommendations.push('Add a clear introduction that summarizes who you are');
    }

    if (!results.hasClearConclusion) {
      recommendations.push('Add a conclusion with next steps or call-to-action');
    }

    return recommendations;
  }
}
