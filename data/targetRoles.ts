// Centralized target roles based on industry specializations
// Used for onboarding, career planning, and AI personalization

export interface TargetRole {
  id: string;
  title: string;
  industry: string;
  category: string;
  description?: string;
}

export const targetRoles: TargetRole[] = [
  // Technology
  { id: "frontend-dev", title: "Frontend Developer", industry: "tech", category: "Engineering" },
  { id: "backend-dev", title: "Backend Developer", industry: "tech", category: "Engineering" },
  { id: "fullstack-dev", title: "Full Stack Developer", industry: "tech", category: "Engineering" },
  { id: "devops-engineer", title: "DevOps Engineer", industry: "tech", category: "Infrastructure" },
  { id: "cloud-architect", title: "Cloud Architect", industry: "tech", category: "Architecture" },
  { id: "security-engineer", title: "Security Engineer", industry: "tech", category: "Security" },
  { id: "ml-engineer", title: "Machine Learning Engineer", industry: "tech", category: "AI/ML" },
  { id: "data-scientist", title: "Data Scientist", industry: "tech", category: "Data" },
  { id: "data-engineer", title: "Data Engineer", industry: "tech", category: "Data" },
  { id: "ai-researcher", title: "AI Researcher", industry: "tech", category: "AI/ML" },
  { id: "mobile-dev", title: "Mobile Developer", industry: "tech", category: "Engineering" },
  { id: "qa-engineer", title: "QA Engineer", industry: "tech", category: "Quality" },
  { id: "tech-lead", title: "Technical Lead", industry: "tech", category: "Leadership" },
  { id: "engineering-manager", title: "Engineering Manager", industry: "tech", category: "Leadership" },
  { id: "product-manager-tech", title: "Technical Product Manager", industry: "tech", category: "Product" },
  { id: "solutions-architect", title: "Solutions Architect", industry: "tech", category: "Architecture" },
  { id: "blockchain-dev", title: "Blockchain Developer", industry: "tech", category: "Emerging" },
  { id: "iot-engineer", title: "IoT Engineer", industry: "tech", category: "Hardware" },

  // Finance
  { id: "financial-analyst", title: "Financial Analyst", industry: "finance", category: "Analysis" },
  { id: "investment-banker", title: "Investment Banker", industry: "finance", category: "Banking" },
  { id: "quant-analyst", title: "Quantitative Analyst", industry: "finance", category: "Analysis" },
  { id: "risk-manager", title: "Risk Manager", industry: "finance", category: "Risk" },
  { id: "fintech-dev", title: "FinTech Developer", industry: "finance", category: "Engineering" },
  { id: "portfolio-manager", title: "Portfolio Manager", industry: "finance", category: "Investment" },
  { id: "wealth-advisor", title: "Wealth Advisor", industry: "finance", category: "Advisory" },
  { id: "compliance-officer", title: "Compliance Officer", industry: "finance", category: "Compliance" },
  { id: "actuary", title: "Actuary", industry: "finance", category: "Analysis" },
  { id: "trader", title: "Trader", industry: "finance", category: "Trading" },

  // Healthcare
  { id: "healthcare-analyst", title: "Healthcare Data Analyst", industry: "healthcare", category: "Data" },
  { id: "bioinformatician", title: "Bioinformatician", industry: "healthcare", category: "Research" },
  { id: "clinical-researcher", title: "Clinical Researcher", industry: "healthcare", category: "Research" },
  { id: "healthtech-dev", title: "HealthTech Developer", industry: "healthcare", category: "Engineering" },
  { id: "medical-writer", title: "Medical Writer", industry: "healthcare", category: "Communications" },
  { id: "pharma-pm", title: "Pharmaceutical PM", industry: "healthcare", category: "Product" },
  { id: "healthcare-consultant", title: "Healthcare Consultant", industry: "healthcare", category: "Consulting" },
  { id: "biotech-researcher", title: "Biotech Researcher", industry: "healthcare", category: "Research" },

  // Manufacturing
  { id: "manufacturing-engineer", title: "Manufacturing Engineer", industry: "manufacturing", category: "Engineering" },
  { id: "quality-engineer", title: "Quality Engineer", industry: "manufacturing", category: "Quality" },
  { id: "supply-chain-analyst", title: "Supply Chain Analyst", industry: "manufacturing", category: "Operations" },
  { id: "automation-engineer", title: "Automation Engineer", industry: "manufacturing", category: "Engineering" },
  { id: "process-engineer", title: "Process Engineer", industry: "manufacturing", category: "Engineering" },
  { id: "industrial-designer", title: "Industrial Designer", industry: "manufacturing", category: "Design" },

  // Retail/E-commerce
  { id: "ecommerce-manager", title: "E-commerce Manager", industry: "retail", category: "Management" },
  { id: "digital-marketer", title: "Digital Marketing Specialist", industry: "retail", category: "Marketing" },
  { id: "growth-hacker", title: "Growth Hacker", industry: "retail", category: "Marketing" },
  { id: "ux-designer", title: "UX Designer", industry: "retail", category: "Design" },
  { id: "merchandising-analyst", title: "Merchandising Analyst", industry: "retail", category: "Analysis" },

  // Media/Entertainment
  { id: "game-dev", title: "Game Developer", industry: "media", category: "Engineering" },
  { id: "motion-graphics", title: "Motion Graphics Designer", industry: "media", category: "Design" },
  { id: "video-editor", title: "Video Editor", industry: "media", category: "Creative" },
  { id: "sound-engineer", title: "Sound Engineer", industry: "media", category: "Audio" },
  { id: "content-strategist", title: "Content Strategist", industry: "media", category: "Strategy" },
  { id: "social-media-manager", title: "Social Media Manager", industry: "media", category: "Marketing" },
  { id: "esports-coach", title: "Esports Coach", industry: "media", category: "Gaming" },

  // Education
  { id: "instructional-designer", title: "Instructional Designer", industry: "education", category: "Design" },
  { id: "learning-engineer", title: "Learning Engineer", industry: "education", category: "Engineering" },
  { id: "curriculum-dev", title: "Curriculum Developer", industry: "education", category: "Content" },
  { id: "education-pm", title: "Education Product Manager", industry: "education", category: "Product" },
  { id: "online-tutor", title: "Online Tutor", industry: "education", category: "Teaching" },
  { id: "corporate-trainer", title: "Corporate Trainer", industry: "education", category: "Training" },

  // Energy
  { id: "renewable-engineer", title: "Renewable Energy Engineer", industry: "energy", category: "Engineering" },
  { id: "solar-engineer", title: "Solar Engineer", industry: "energy", category: "Engineering" },
  { id: "energy-analyst", title: "Energy Analyst", industry: "energy", category: "Analysis" },
  { id: "sustainability-manager", title: "Sustainability Manager", industry: "energy", category: "Management" },

  // Consulting
  { id: "management-consultant", title: "Management Consultant", industry: "consulting", category: "Consulting" },
  { id: "strategy-consultant", title: "Strategy Consultant", industry: "consulting", category: "Consulting" },
  { id: "digital-consultant", title: "Digital Transformation Consultant", industry: "consulting", category: "Consulting" },
  { id: "it-consultant", title: "IT Consultant", industry: "consulting", category: "Consulting" },
  { id: "hr-consultant", title: "HR Consultant", industry: "consulting", category: "Consulting" },
  { id: "business-analyst", title: "Business Analyst", industry: "consulting", category: "Analysis" },

  // Telecom
  { id: "network-engineer", title: "Network Engineer", industry: "telecom", category: "Engineering" },
  { id: "telecom-engineer", title: "Telecom Engineer", industry: "telecom", category: "Engineering" },
  { id: "5g-specialist", title: "5G Specialist", industry: "telecom", category: "Engineering" },
  { id: "rf-engineer", title: "RF Engineer", industry: "telecom", category: "Engineering" },

  // Transportation
  { id: "logistics-manager", title: "Logistics Manager", industry: "transportation", category: "Operations" },
  { id: "supply-chain-manager", title: "Supply Chain Manager", industry: "transportation", category: "Operations" },
  { id: "ev-engineer", title: "EV Engineer", industry: "transportation", category: "Engineering" },
  { id: "autonomous-systems", title: "Autonomous Systems Engineer", industry: "transportation", category: "Engineering" },
  { id: "aviation-engineer", title: "Aviation Engineer", industry: "transportation", category: "Engineering" },

  // Agriculture
  { id: "agtech-engineer", title: "AgTech Engineer", industry: "agriculture", category: "Engineering" },
  { id: "precision-ag-specialist", title: "Precision Agriculture Specialist", industry: "agriculture", category: "Operations" },
  { id: "food-scientist", title: "Food Scientist", industry: "agriculture", category: "Research" },

  // Construction
  { id: "project-manager-construction", title: "Construction PM", industry: "construction", category: "Management" },
  { id: "civil-engineer", title: "Civil Engineer", industry: "construction", category: "Engineering" },
  { id: "architect", title: "Architect", industry: "construction", category: "Design" },
  { id: " BIM-specialist", title: "BIM Specialist", industry: "construction", category: "Technology" },
  { id: "real-estate-analyst", title: "Real Estate Analyst", industry: "construction", category: "Analysis" },

  // Hospitality
  { id: "hotel-manager", title: "Hotel Manager", industry: "hospitality", category: "Management" },
  { id: "event-planner", title: "Event Planner", industry: "hospitality", category: "Events" },
  { id: "chef", title: "Chef", industry: "hospitality", category: "Culinary" },
  { id: "travel-consultant", title: "Travel Consultant", industry: "hospitality", category: "Advisory" },

  // Non-Profit
  { id: "program-manager-nonprofit", title: "Program Manager", industry: "nonprofit", category: "Management" },
  { id: "grant-writer", title: "Grant Writer", industry: "nonprofit", category: "Writing" },
  { id: "community-organizer", title: "Community Organizer", industry: "nonprofit", category: "Organizing" },
  { id: "fundraising-manager", title: "Fundraising Manager", industry: "nonprofit", category: "Fundraising" },
];

// Helper functions
export function getRolesByIndustry(industryId: string): TargetRole[] {
  return targetRoles.filter((role) => role.industry === industryId);
}

export function getRoleById(id: string): TargetRole | undefined {
  return targetRoles.find((role) => role.id === id);
}

export function getAllRoleTitles(): string[] {
  return targetRoles.map((role) => role.title);
}

export function searchRoles(query: string): TargetRole[] {
  const lowerQuery = query.toLowerCase();
  return targetRoles.filter(
    (role) =>
      role.title.toLowerCase().includes(lowerQuery) ||
      role.category.toLowerCase().includes(lowerQuery) ||
      role.industry.toLowerCase().includes(lowerQuery)
  );
}
