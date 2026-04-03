import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Academy data...");

  // Create sample learning paths
  const paths = [
    {
      title: "Full Stack Development Fundamentals",
      description: "Master the essential skills for becoming a full stack developer. From frontend to backend, this path covers everything you need to start your career.",
      industry: "Technology",
      level: "BEGINNER",
      icon: "💻",
      estimatedHours: 40,
      isPublished: true,
      modules: {
        create: [
          {
            title: "HTML & CSS Foundations",
            description: "Learn the building blocks of web development",
            order: 1,
            estimatedHours: 8,
            lessons: {
              create: [
                { title: "Introduction to HTML", content: "HTML basics...", order: 1, type: "THEORY", estimatedMinutes: 30 },
                { title: "HTML Elements & Structure", content: "Deep dive into elements...", order: 2, type: "THEORY", estimatedMinutes: 45 },
                { title: "CSS Fundamentals", content: "CSS basics...", order: 3, type: "THEORY", estimatedMinutes: 30 },
                { title: "Flexbox & Grid", content: "Modern layouts...", order: 4, type: "VIDEO", estimatedMinutes: 45 },
                { title: "Building a Landing Page", content: "Practical project...", order: 5, type: "PROJECT", estimatedMinutes: 60 },
              ],
            },
            assignments: {
              create: [
                { title: "Create Your Portfolio Page", description: "Build a personal portfolio using HTML and CSS", dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), maxScore: 100 },
              ],
            },
          },
          {
            title: "JavaScript Essentials",
            description: "Dynamic web interactions with JavaScript",
            order: 2,
            estimatedHours: 12,
            lessons: {
              create: [
                { title: "JavaScript Basics", content: "Variables, data types...", order: 1, type: "THEORY", estimatedMinutes: 30 },
                { title: "Functions & Scope", content: "Understanding functions...", order: 2, type: "THEORY", estimatedMinutes: 45 },
                { title: "DOM Manipulation", content: "Interactive web pages...", order: 3, type: "VIDEO", estimatedMinutes: 45 },
                { title: "Async JavaScript", content: "Promises and async/await...", order: 4, type: "VIDEO", estimatedMinutes: 60 },
                { title: "Build a Todo App", content: "Apply your skills...", order: 5, type: "PROJECT", estimatedMinutes: 90 },
              ],
            },
          },
          {
            title: "React Fundamentals",
            description: "Building modern UIs with React",
            order: 3,
            estimatedHours: 15,
            lessons: {
              create: [
                { title: "Introduction to React", content: "Component-based architecture...", order: 1, type: "THEORY", estimatedMinutes: 30 },
                { title: "State & Props", content: "Managing data in React...", order: 2, type: "VIDEO", estimatedMinutes: 45 },
                { title: "Hooks Deep Dive", content: "useState, useEffect...", order: 3, type: "VIDEO", estimatedMinutes: 60 },
                { title: "Build a Weather App", content: "API integration project...", order: 4, type: "PROJECT", estimatedMinutes: 90 },
              ],
            },
          },
        ],
      },
    },
    {
      title: "Data Science Essentials",
      description: "Start your data science journey with Python, statistics, and machine learning fundamentals.",
      industry: "Data Science",
      level: "BEGINNER",
      icon: "📊",
      estimatedHours: 50,
      isPublished: true,
      modules: {
        create: [
          {
            title: "Python for Data Science",
            description: "Python programming essentials",
            order: 1,
            estimatedHours: 15,
            lessons: {
              create: [
                { title: "Python Basics", content: "Syntax and data types...", order: 1, type: "THEORY", estimatedMinutes: 30 },
                { title: "NumPy Fundamentals", content: "Numerical computing...", order: 2, type: "VIDEO", estimatedMinutes: 45 },
                { title: "Pandas Data Analysis", content: "Data manipulation...", order: 3, type: "VIDEO", estimatedMinutes: 60 },
                { title: "Data Visualization", content: "Matplotlib and Seaborn...", order: 4, type: "VIDEO", estimatedMinutes: 45 },
              ],
            },
          },
          {
            title: "Statistics & Probability",
            description: "Foundational statistics for data science",
            order: 2,
            estimatedHours: 20,
            lessons: {
              create: [
                { title: "Descriptive Statistics", content: "Mean, median, mode...", order: 1, type: "THEORY", estimatedMinutes: 45 },
                { title: "Probability Distributions", content: "Normal, binomial...", order: 2, type: "VIDEO", estimatedMinutes: 60 },
                { title: "Hypothesis Testing", content: "Statistical testing...", order: 3, type: "VIDEO", estimatedMinutes: 60 },
              ],
            },
          },
        ],
      },
    },
    {
      title: "Career Acceleration Program",
      description: "A comprehensive program to accelerate your career growth with resume building, interview prep, and professional networking.",
      industry: null,
      level: "INTERMEDIATE",
      icon: "🚀",
      estimatedHours: 30,
      isPublished: true,
      modules: {
        create: [
          {
            title: "Personal Branding",
            description: "Build your professional brand",
            order: 1,
            estimatedHours: 6,
            lessons: {
              create: [
                { title: "LinkedIn Optimization", content: "Profile best practices...", order: 1, type: "THEORY", estimatedMinutes: 30 },
                { title: "Personal Website", content: "Portfolio website creation...", order: 2, type: "VIDEO", estimatedMinutes: 45 },
                { title: "Networking Strategy", content: "Build professional connections...", order: 3, type: "VIDEO", estimatedMinutes: 40 },
              ],
            },
          },
          {
            title: "Interview Mastery",
            description: "Ace your next interview",
            order: 2,
            estimatedHours: 12,
            lessons: {
              create: [
                { title: "Behavioral Questions", content: "STAR method...", order: 1, type: "VIDEO", estimatedMinutes: 30 },
                { title: "Technical Interviews", content: "Problem solving...", order: 2, type: "VIDEO", estimatedMinutes: 60 },
                { title: "Salary Negotiation", content: "Get what you deserve...", order: 3, type: "VIDEO", estimatedMinutes: 30 },
              ],
            },
          },
        ],
      },
    },
  ];

  for (const pathData of paths) {
    await prisma.learningPath.upsert({
      where: { id: pathData.title.toLowerCase().replace(/\s+/g, "-") },
      update: {},
      create: {
        id: pathData.title.toLowerCase().replace(/\s+/g, "-"),
        ...pathData,
      },
    });
    console.log(`Created: ${pathData.title}`);
  }

  // Create achievements
  const achievements = [
    { title: "First Steps", description: "Complete your first lesson", icon: "🎯", category: "LEARNING", points: 10, threshold: 1, criteria: { type: "LESSONS" } },
    { title: "Fast Learner", description: "Complete 10 lessons", icon: "📚", category: "LEARNING", points: 50, threshold: 10, criteria: { type: "LESSONS" } },
    { title: "Knowledge Seeker", description: "Complete 50 lessons", icon: "🧠", category: "LEARNING", points: 100, threshold: 50, criteria: { type: "LESSONS" } },
    { title: "Week Warrior", description: "Maintain a 7-day streak", icon: "🔥", category: "STREAK", points: 30, threshold: 7, criteria: { type: "STREAK" } },
    { title: "Month Master", description: "Maintain a 30-day streak", icon: "💎", category: "STREAK", points: 100, threshold: 30, criteria: { type: "STREAK" } },
    { title: "Assignment Ace", description: "Submit 5 assignments", icon: "✅", category: "ASSIGNMENT", points: 25, threshold: 5, criteria: { type: "ASSIGNMENT", minScore: 60 } },
    { title: "Perfect Score", description: "Score 100% on an assignment", icon: "💯", category: "ASSIGNMENT", points: 50, threshold: 1, criteria: { type: "ASSIGNMENT_SCORE", minScore: 100 } },
    { title: "Quiz Champion", description: "Complete 10 quizzes", icon: "🏆", category: "QUIZ", points: 30, threshold: 10, criteria: { type: "QUIZ" } },
    { title: "First Achievement", description: "Earn your first badge", icon: "🌟", category: "MILESTONE", points: 10, threshold: 1, criteria: { type: "ACHIEVEMENTS" } },
    { title: "Dedicated Learner", description: "Earn 10 achievements", icon: "🎓", category: "MILESTONE", points: 75, threshold: 10, criteria: { type: "ACHIEVEMENTS" } },
    { title: "Helpful Hand", description: "Help a fellow learner", icon: "🤝", category: "COMMUNITY", points: 20, threshold: 1, criteria: { type: "COMMUNITY" } },
    { title: "Early Bird", description: "Log activity before 9 AM", icon: "🐦", category: "STREAK", points: 5, threshold: 1, criteria: { type: "EARLY_BIRD" } },
  ];

  for (const achievement of achievements) {
    await prisma.achievement.upsert({
      where: { id: achievement.title.toLowerCase().replace(/\s+/g, "-") },
      update: {},
      create: {
        id: achievement.title.toLowerCase().replace(/\s+/g, "-"),
        ...achievement,
        isActive: true,
      },
    });
    console.log(`Created achievement: ${achievement.title}`);
  }

  // Create sample cohorts
  const cohorts = [
    {
      name: "April 2026 Cohort",
      description: "Join fellow learners for a structured 12-week program",
      industry: "Technology",
      startsAt: new Date("2026-04-15"),
      endsAt: new Date("2026-07-15"),
      maxMembers: 30,
      isActive: true,
    },
    {
      name: "Data Science Spring Batch",
      description: "Intensive data science program for aspiring data scientists",
      industry: "Data Science",
      startsAt: new Date("2026-04-20"),
      endsAt: new Date("2026-07-20"),
      maxMembers: 25,
      isActive: true,
    },
  ];

  for (const cohort of cohorts) {
    await prisma.cohort.upsert({
      where: { id: cohort.name.toLowerCase().replace(/\s+/g, "-") },
      update: {},
      create: {
        id: cohort.name.toLowerCase().replace(/\s+/g, "-"),
        ...cohort,
      },
    });
    console.log(`Created cohort: ${cohort.name}`);
  }

  console.log("Academy seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });