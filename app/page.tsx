"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle,
  FileText,
  MessageSquare,
  Star,
  Target,
  Sparkles,
  TrendingUp,
  Zap,
  BarChart,
  Users,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import TestimonialCard from "@/components/LandingPage/testimonial-card";
import FeatureCard from "@/components/LandingPage/feature-card";
import PricingCard from "@/components/LandingPage/pricing-card";
import FaqAccordion from "@/components/LandingPage/faq-accordion";
import StatCard from "@/components/LandingPage/stat-card";
import AnimatedGradient from "@/components/LandingPage/animated-gradient";
import { useMobile } from "@/hooks/use-mobile";
import { motion } from "framer-motion";
import { redirect } from "next/navigation";
import Image from "next/image";

export default function Home() {
  const currentYear = new Date().getFullYear();
  const isMobile = useMobile();
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  const fadeInUpVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  };

  const staggerContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const floatAnimation = {
    initial: { y: 0 },
    animate: {
      y: [0, -10, 0],
      transition: {
        duration: 3,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      },
    },
  };

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        {/* Hero Section with animated gradient background */}
        <section
          className="relative overflow-hidden dark:bg-background/50 pt-16 min-h-[calc(100svh-4rem)] flex items-center"
          ref={heroRef}
        >
          <AnimatedGradient />

          {/* Decorative elements */}
          <div className="absolute top-20 left-10 w-24 h-24 rounded-full bg-primary/10 dark:bg-primary/5 blur-xl"></div>
          <div className="absolute bottom-40 right-10 w-32 h-32 rounded-full bg-primary/10 dark:bg-primary/5 blur-xl"></div>
          <div className="absolute top-1/3 right-1/4 w-8 h-8 rounded-full bg-primary/30 dark:bg-primary/20 blur-sm"></div>
          <div className="absolute bottom-1/4 left-1/3 w-6 h-6 rounded-full bg-primary/20 dark:bg-primary/10 blur-sm"></div>

          {/* Floating shapes */}
          <motion.div
            className="absolute top-40 right-[15%] w-12 h-12 rounded-lg rotate-12 border border-primary/20 dark:border-primary/10 hidden lg:block"
            initial={{ y: 0, rotate: 12 }}
            animate={{
              y: [0, -15, 0],
              rotate: [12, 20, 12],
              transition: {
                y: {
                  duration: 3,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                },
                rotate: {
                  duration: 5,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                },
              },
            }}
          />

          <motion.div
            className="absolute bottom-32 left-[20%] w-10 h-10 rounded-full border border-primary/20 hidden lg:block"
            initial={{ y: 0 }}
            animate={{
              y: [0, 15, 0],
              transition: {
                duration: 4,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              },
            }}
          />

          <div className="container mx-auto relative z-10 px-4 md:px-6 py-10 md:py-14">
            <motion.div
              className="grid gap-6 items-center lg:grid-cols-2 lg:items-start lg:gap-12"
              initial="hidden"
              animate="visible"
              variants={staggerContainerVariants}
            >
              <motion.div
                className="flex flex-col justify-center space-y-6"
                variants={fadeInUpVariants}
              >
                <div className="inline-block w-fit rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary backdrop-blur-sm border border-primary/20">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Built For Serious Job Search
                  </span>
                </div>
                <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
                  Your <span className="text-primary relative">Personal</span>{" "}
                  AI Career Coach
                </h1>
                <p className="max-w-[600px] text-muted-foreground text-lg md:text-xl">
                  Build stronger resumes, prepare for interviews, and get
                  practical career direction with clear, actionable guidance.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    onClick={() => {
                      redirect("/dashboard");
                    }}
                    size="lg"
                    className="gap-1.5 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all group relative overflow-hidden"
                  >
                    <span className="relative z-10">Open Dashboard</span>
                    <ArrowRight className="h-4 w-4 relative z-10" />
                    <span className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors duration-300"></span>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link href="#features">Explore Features</Link>
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-4">
                  <span className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
                    Resume review workflows
                  </span>
                  <span className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
                    Interview preparation tracks
                  </span>
                  <span className="rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
                    Personalized action plans
                  </span>
                </div>
              </motion.div>
              <motion.div
                className="flex w-full justify-center lg:justify-end lg:pl-6 lg:pt-2"
                variants={fadeInUpVariants}
                {...floatAnimation}
              >
                <div className="relative">
                  <div className="absolute -top-6 -left-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl"></div>
                  <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl"></div>

                  <div className="relative bg-gradient-to-br from-background to-background/80 backdrop-blur-sm border rounded-2xl shadow-xl p-2 md:p-3 max-w-[500px]">
                    <Image
                      width={1000}
                      height={100}
                      alt="AI Career Coach Dashboard"
                      className="rounded-xl w-full"
                      src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80"
                    />

                    <div className="absolute -top-4 -right-4 bg-background rounded-lg border shadow-lg p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        </div>
                        <div className="text-sm">
                          <p className="font-medium">Resume Review Ready</p>
                          <p className="text-xs text-muted-foreground">
                            Structured feedback generated
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="absolute -bottom-6 -left-6 bg-background rounded-lg border shadow-lg p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Target className="h-4 w-4 text-primary" />
                        </div>
                        <div className="text-sm">
                          <p className="font-medium">Interview Preparation</p>
                          <p className="text-xs text-muted-foreground">
                            Questions and feedback organized
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Curved divider */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 1440 120"
              className="w-full h-auto"
            >
              <path
                fill="currentColor"
                fillOpacity="1"
                d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,120L1360,120C1280,120,1120,120,960,120C800,120,640,120,480,120C320,120,160,120,80,120L0,120Z"
                className="text-background"
              ></path>
            </svg>
          </div>
        </section>

        {/* Stats Section */}
        <section
          className="py-16 relative dark:bg-background/50"
          ref={statsRef}
        >
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl"></div>
            <div className="absolute top-1/2 right-0 w-60 h-60 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl"></div>

            {/* Grid pattern */}
            <div
              className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
                backgroundSize: "40px 40px",
              }}
            ></div>
          </div>

          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <motion.div
              className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainerVariants}
            >
              <StatCard
                value="87%"
                label="Interview Success Rate"
                icon={<MessageSquare className="h-5 w-5 text-primary" />}
                variants={fadeInUpVariants}
              />
              <StatCard
                value="3.2x"
                label="More Job Offers"
                icon={<Award className="h-5 w-5 text-primary" />}
                variants={fadeInUpVariants}
              />
              <StatCard
                value="$12K+"
                label="Avg. Salary Increase"
                icon={<Target className="h-5 w-5 text-primary" />}
                variants={fadeInUpVariants}
              />
              <StatCard
                value="24/7"
                label="AI Coach Availability"
                icon={<Star className="h-5 w-5 text-primary" />}
                variants={fadeInUpVariants}
              />
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section
          id="features"
          className="py-20 md:py-32 relative overflow-hidden"
          ref={featuresRef}
        >
          {/* Background decoration */}
          <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl"></div>

          {/* Decorative elements */}
          <div className="absolute top-1/4 left-1/4 w-4 h-4 bg-primary/20 rounded-full"></div>
          <div className="absolute top-1/3 right-1/3 w-6 h-6 bg-primary/10 rounded-full"></div>
          <div className="absolute bottom-1/4 right-1/4 w-5 h-5 bg-primary/15 rounded-full"></div>

          {/* Animated shapes */}
          <motion.div
            className="absolute top-1/4 right-1/4 w-16 h-16 border border-primary/20 rounded-lg hidden lg:block"
            initial={{ rotate: 0 }}
            animate={{
              rotate: 360,
              transition: {
                duration: 20,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              },
            }}
          />

          <motion.div
            className="absolute bottom-1/3 left-1/3 w-12 h-12 border border-primary/10 rounded-full hidden lg:block"
            initial={{ scale: 1 }}
            animate={{
              scale: [1, 1.2, 1],
              transition: {
                duration: 8,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              },
            }}
          />

          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <motion.div
              className="flex flex-col items-center justify-center space-y-4 text-center mb-16"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainerVariants}
            >
              <motion.div className="space-y-2" variants={fadeInUpVariants}>
                <div className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary border border-primary/20">
                  <span className="flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" />
                    Key Features
                  </span>
                </div>
                <h2 className="text-3xl font-bold tracking-tighter md:text-5xl">
                  Everything You Need to Advance Your Career
                </h2>
                <p className="max-w-[700px] text-muted-foreground md:text-xl/relaxed mx-auto">
                  Our AI-powered platform provides comprehensive career guidance
                  tailored to your unique goals and skills.
                </p>
              </motion.div>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainerVariants}
            >
              <FeatureCard
                icon={<FileText className="h-10 w-10 text-primary" />}
                title="Resume Building"
                description="Get AI-powered feedback on your resume with specific suggestions to make it stand out to recruiters and ATS systems."
                variants={fadeInUpVariants}
              />
              <FeatureCard
                icon={<MessageSquare className="h-10 w-10 text-primary" />}
                title="Interview Preparation"
                description="Practice with our AI interviewer that simulates real interviews and provides instant feedback on your responses."
                variants={fadeInUpVariants}
              />
              <FeatureCard
                icon={<Target className="h-10 w-10 text-primary" />}
                title="Career Planning"
                description="Receive personalized career path recommendations based on your skills, experience, and goals."
                variants={fadeInUpVariants}
              />
              <FeatureCard
                icon={<BookOpen className="h-10 w-10 text-primary" />}
                title="Skill Development"
                description="Identify skill gaps and get customized learning resources to enhance your professional profile."
                variants={fadeInUpVariants}
              />
              <FeatureCard
                icon={<Award className="h-10 w-10 text-primary" />}
                title="Salary Negotiation"
                description="Learn effective negotiation strategies with market-based salary insights for your role and location."
                variants={fadeInUpVariants}
              />
              <FeatureCard
                icon={<Star className="h-10 w-10 text-primary" />}
                title="24/7 Career Advice"
                description="Get instant answers to your career questions anytime, anywhere with our always-available AI coach."
                variants={fadeInUpVariants}
              />
            </motion.div>
          </div>
        </section>

        {/* How It Works Section */}
        <section
          id="how-it-works"
          className="py-20 md:py-32 bg-muted/30 relative overflow-hidden"
        >
          {/* Decorative elements */}
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          ></div>

          <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-background to-transparent"></div>
          <div className="absolute bottom-0 left-0 w-full h-20 bg-gradient-to-t from-background to-transparent"></div>

          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <motion.div
              className="flex flex-col items-center justify-center space-y-4 text-center mb-16"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainerVariants}
            >
              <motion.div className="space-y-2" variants={fadeInUpVariants}>
                <div className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary border border-primary/20">
                  <span className="flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Simple Process
                  </span>
                </div>
                <h2 className="text-3xl font-bold tracking-tighter md:text-5xl">
                  How Career AI Works
                </h2>
                <p className="max-w-[700px] text-muted-foreground md:text-xl/relaxed mx-auto">
                  Our platform makes career advancement simple with just a few
                  easy steps.
                </p>
              </motion.div>
            </motion.div>

            <div className="relative">
              {/* Connection line */}
              {!isMobile && (
                <div className="absolute top-24 left-[calc(16.666%-8px)] right-[calc(16.666%-8px)] h-0.5 bg-primary/20">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-primary"></div>
                  <div className="absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-primary"></div>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-primary"></div>
                </div>
              )}

              <motion.div
                className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={staggerContainerVariants}
              >
                <motion.div
                  className="flex flex-col items-center text-center relative"
                  variants={fadeInUpVariants}
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-6 relative border border-primary/20 shadow-lg">
                    <span className="text-3xl font-bold text-primary">1</span>
                    {isMobile && (
                      <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 h-8 w-0.5 bg-primary/20"></div>
                    )}
                  </div>
                  <h3 className="text-xl font-bold mb-3">
                    Create Your Profile
                  </h3>
                  <p className="text-muted-foreground">
                    Upload your resume and answer a few questions about your
                    career goals and preferences.
                  </p>
                </motion.div>

                <motion.div
                  className="flex flex-col items-center text-center relative"
                  variants={fadeInUpVariants}
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-6 relative border border-primary/20 shadow-lg">
                    <span className="text-3xl font-bold text-primary">2</span>
                    {isMobile && (
                      <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 h-8 w-0.5 bg-primary/20"></div>
                    )}
                  </div>
                  <h3 className="text-xl font-bold mb-3">
                    Receive Personalized Guidance
                  </h3>
                  <p className="text-muted-foreground">
                    Our AI analyzes your profile and provides tailored
                    recommendations and feedback.
                  </p>
                </motion.div>

                <motion.div
                  className="flex flex-col items-center text-center"
                  variants={fadeInUpVariants}
                >
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-6 relative border border-primary/20 shadow-lg">
                    <span className="text-3xl font-bold text-primary">3</span>
                  </div>
                  <h3 className="text-xl font-bold mb-3">
                    Implement and Succeed
                  </h3>
                  <p className="text-muted-foreground">
                    Apply the insights, practice with our tools, and track your
                    progress as you advance your career.
                  </p>
                </motion.div>
              </motion.div>
            </div>

            {/* Demo/Screenshot */}
            <motion.div
              className="mt-20 md:mt-32 bg-background rounded-2xl border shadow-xl overflow-hidden"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <div className="p-1">
                <div className="w-full bg-muted/30 h-8 rounded-t-lg flex items-center px-4">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                </div>
                <Image
                  width={1000}
                  height={100}
                  src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2072&q=80"
                  alt="Career AI Dashboard"
                  className="w-full rounded-b-lg"
                />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section
          id="testimonials"
          className="py-20 md:py-32 relative overflow-hidden"
        >
          {/* Background decoration */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl"></div>

          {/* Decorative elements */}
          <div className="absolute top-20 right-20 w-40 h-40 rounded-full border border-primary/10 opacity-30"></div>
          <div className="absolute bottom-40 left-20 w-60 h-60 rounded-full border border-primary/10 opacity-20"></div>

          {/* Animated dots */}
          <motion.div
            className="absolute top-1/4 right-1/4 w-2 h-2 rounded-full bg-primary/40 hidden lg:block"
            animate={{
              opacity: [0.4, 0.8, 0.4],
              scale: [1, 1.2, 1],
              transition: {
                duration: 3,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              },
            }}
          />

          <motion.div
            className="absolute bottom-1/3 left-1/3 w-3 h-3 rounded-full bg-primary/30 hidden lg:block"
            animate={{
              opacity: [0.3, 0.7, 0.3],
              scale: [1, 1.3, 1],
              transition: {
                duration: 4,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
                delay: 1,
              },
            }}
          />

          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <motion.div
              className="flex flex-col items-center justify-center space-y-4 text-center mb-16"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainerVariants}
            >
              <motion.div className="space-y-2" variants={fadeInUpVariants}>
                <div className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary border border-primary/20">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Success Stories
                  </span>
                </div>
                <h2 className="text-3xl font-bold tracking-tighter md:text-5xl">
                  Real Outcomes From Real Job Searches
                </h2>
                <p className="max-w-[700px] text-muted-foreground md:text-xl/relaxed mx-auto">
                  Practical results from candidates using ElevateAI to improve
                  resumes, interview performance, and role targeting.
                </p>
              </motion.div>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainerVariants}
            >
              <TestimonialCard
                quote="The rewrite suggestions made my resume easier to scan and much more relevant to each role I applied for."
                name="Platform Member"
                title="Software Engineer"
                avatarSrc="https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=256&q=80"
                variants={fadeInUpVariants}
              />
              <TestimonialCard
                quote="Interview practice gave me a repeatable structure for answers, and that made my responses clearer and more confident."
                name="Career Switcher"
                title="Marketing Professional"
                avatarSrc="https://images.unsplash.com/photo-1560250097-0b93528c311a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=256&q=80"
                variants={fadeInUpVariants}
              />
              <TestimonialCard
                quote="The skill-gap checklist helped me focus my preparation, and I stopped wasting time on roles that were a weak fit."
                name="Early-Career Candidate"
                title="Data Analyst"
                avatarSrc="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=256&q=80"
                variants={fadeInUpVariants}
              />
            </motion.div>

            {/* Video testimonial */}
            <div className="mt-16 bg-background">
              <div className="max-w-6xl mx-auto">
                {/* <motion.h1
                  className="text-4xl md:text-5xl font-bold text-center text-foreground mb-8"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                >
                  Elevate Your Career with AI
                </motion.h1> */}

                <div className="relative">
                  <motion.div
                    className="mt-16 md:mt-24  rounded-2xl overflow-hidden relative"
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                  >
                    <div className="flex justify-center items-center aspect-video relative p-3">
                      <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-[90vh] h-[50vh] border rounded-lg shadow-2xl"
                      >
                        <source
                          src="elevate-ai-showcase.mp4"
                          type="video/mp4"
                        />
                      </video>
                    </div>
                  </motion.div>

                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-xl border bg-background p-4 text-left">
                      <p className="text-sm font-semibold">Resume Refinement</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Structured, ATS-conscious feedback aligned to target
                        roles.
                      </p>
                    </div>
                    <div className="rounded-xl border bg-background p-4 text-left">
                      <p className="text-sm font-semibold">
                        Interview Practice
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Guided question sets with response-quality feedback.
                      </p>
                    </div>
                    <div className="rounded-xl border bg-background p-4 text-left">
                      <p className="text-sm font-semibold">Role Targeting</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Prioritized job-fit guidance based on profile and goals.
                      </p>
                    </div>
                    <div className="rounded-xl border bg-background p-4 text-left">
                      <p className="text-sm font-semibold">Action Planning</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Clear next-step checklists to keep your search focused.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section
          id="pricing"
          className="py-20 md:py-32 bg-muted/30 relative overflow-hidden"
        >
          {/* Decorative elements */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
              backgroundSize: "30px 30px",
            }}
          ></div>

          <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-background to-transparent"></div>
          <div className="absolute bottom-0 left-0 w-full h-20 bg-gradient-to-t from-background to-transparent"></div>

          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <motion.div
              className="flex flex-col items-center justify-center space-y-4 text-center mb-16"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainerVariants}
            >
              <motion.div className="space-y-2" variants={fadeInUpVariants}>
                <div className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary border border-primary/20">
                  <span className="flex items-center gap-1.5">
                    <BarChart className="h-3.5 w-3.5" />
                    Pricing Plans
                  </span>
                </div>
                <h2 className="text-3xl font-bold tracking-tighter md:text-5xl">
                  Choose the Right Plan for You
                </h2>
                <p className="max-w-[700px] text-muted-foreground md:text-xl/relaxed mx-auto">
                  Affordable options to support your career journey at every
                  stage.
                </p>
              </motion.div>
            </motion.div>

            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainerVariants}
            >
              <PricingCard
                title="Starter"
                price="$9.99"
                period="per month"
                description="Perfect for those just beginning their career journey"
                features={[
                  "Resume analysis and feedback",
                  "Basic interview preparation",
                  "Career path recommendations",
                  "Email support",
                ]}
                buttonText="Choose Starter"
                buttonHref="/sign-up"
                popular={false}
                variants={fadeInUpVariants}
              />
              <PricingCard
                title="Professional"
                price="$19.99"
                period="per month"
                description="Comprehensive support for career advancement"
                features={[
                  "Everything in Starter",
                  "Advanced interview simulation",
                  "Salary negotiation coaching",
                  "Personalized skill development plan",
                  "Priority support",
                ]}
                buttonText="Choose Professional"
                buttonHref="/sign-up"
                popular={true}
                variants={fadeInUpVariants}
              />
              <PricingCard
                title="Executive"
                price="$39.99"
                period="per month"
                description="Premium guidance for senior professionals"
                features={[
                  "Everything in Professional",
                  "Executive coaching sessions",
                  "Leadership skill development",
                  "Network expansion strategies",
                  "24/7 priority support",
                  "Quarterly career strategy review",
                ]}
                buttonText="Contact Sales"
                buttonHref="/sign-up"
                popular={false}
                variants={fadeInUpVariants}
              />
            </motion.div>

            {/* Guarantee */}
            <motion.div
              className="mt-16 flex flex-col md:flex-row items-center justify-center gap-6 p-8 rounded-2xl bg-background border shadow-sm"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center md:text-left">
                <h3 className="text-xl font-bold mb-2">
                  14-Day Money-Back Guarantee
                </h3>
                <p className="text-muted-foreground">
                  Try Career AI risk-free. If you&apos;re not completely
                  satisfied within 14 days, we&apos;ll refund your payment. No
                  questions asked.
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* FAQ Section */}
        <section
          id="faq"
          className="py-20 md:py-32 relative dark:bg-background/50"
        >
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl -z-10"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl -z-10"></div>

          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <motion.div
              className="flex flex-col items-center justify-center space-y-4 text-center mb-16"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              variants={staggerContainerVariants}
            >
              <motion.div className="space-y-2" variants={fadeInUpVariants}>
                <div className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary border border-primary/20">
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" />
                    FAQ
                  </span>
                </div>
                <h2 className="text-3xl font-bold tracking-tighter md:text-5xl">
                  Frequently Asked Questions
                </h2>
                <p className="max-w-[700px] text-muted-foreground md:text-xl/relaxed mx-auto">
                  Find answers to common questions about our AI career coaching
                  platform.
                </p>
              </motion.div>
            </motion.div>

            <motion.div
              className="mx-auto max-w-3xl"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <FaqAccordion />
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 md:py-32 bg-primary/5 dark:bg-primary/10 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-[600px] h-[600px] bg-primary/10 dark:bg-primary/15 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-[600px] h-[600px] bg-primary/10 dark:bg-primary/15 rounded-full blur-3xl"></div>

          {/* Animated shapes */}
          <motion.div
            className="absolute top-1/3 left-1/4 w-16 h-16 border border-primary/20 rounded-full hidden lg:block"
            animate={{
              y: [0, -20, 0],
              x: [0, 10, 0],
              transition: {
                duration: 5,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              },
            }}
          />

          <motion.div
            className="absolute bottom-1/3 right-1/4 w-12 h-12 border border-primary/10 rounded-lg rotate-12 hidden lg:block"
            animate={{
              y: [0, 15, 0],
              rotate: [12, -5, 12],
              transition: {
                duration: 6,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              },
            }}
          />

          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <motion.div
              className="max-w-4xl mx-auto bg-background rounded-2xl shadow-xl border p-8 md:p-12"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Target className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tighter">
                  Ready to Transform Your Career?
                </h2>
                <p className="max-w-[700px] text-muted-foreground md:text-xl/relaxed">
                  Join thousands of professionals who have accelerated their
                  career growth with Career AI.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md text-center justify-center items-center">
                  <Button
                    size="lg"
                    className=" shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all group relative overflow-hidden"
                    asChild
                  >
                    <Link href="/sign-up">
                      <span className="relative z-10">Create Free Account</span>
                      <span className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors duration-300"></span>
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="group relative overflow-hidden"
                    asChild
                  >
                    <Link href="#features">
                      <span className="relative z-10">Explore Platform</span>
                      <span className="absolute inset-0 bg-background/0 group-hover:bg-primary/5 transition-colors duration-300"></span>
                    </Link>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Start free and upgrade when you need more advanced guidance.
                </p>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background">
        <div className="container mx-auto py-12 md:py-16 px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2 font-bold text-xl mb-4">
                <span className="text-primary">Elevate</span>
                <span>AI</span>
              </div>
              <p className="text-muted-foreground mb-4 max-w-xs">
                Empowering professionals to advance their careers with
                AI-powered guidance and tools.
              </p>
              <div className="flex space-x-4">
                <a
                  href="#features"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                    <rect width="4" height="12" x="2" y="9"></rect>
                    <circle cx="4" cy="4" r="2"></circle>
                  </svg>
                </a>
                <a
                  href="#faq"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
                  </svg>
                </a>
                <Link
                  href="/sign-up"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <rect
                      width="20"
                      height="20"
                      x="2"
                      y="2"
                      rx="5"
                      ry="5"
                    ></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line>
                  </svg>
                </Link>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-medium mb-2">Product</h3>
              <Link
                href="#features"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Features
              </Link>
              <Link
                href="#pricing"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Pricing
              </Link>
              <Link
                href="#testimonials"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Testimonials
              </Link>
              <Link
                href="#faq"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                FAQ
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-medium mb-2">Company</h3>
              <Link
                href="#how-it-works"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                About
              </Link>
              <Link
                href="#features"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Blog
              </Link>
              <Link
                href="#pricing"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Careers
              </Link>
              <a
                href="mailto:support@elevateai.app"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Contact
              </a>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-medium mb-2">Resources</h3>
              <Link
                href="/resume"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Career Guide
              </Link>
              <Link
                href="/resume"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Resume Templates
              </Link>
              <Link
                href="/interview"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Interview Tips
              </Link>
              <Link
                href="/chatbot"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Skill Development
              </Link>
            </div>
          </div>
          <div className="border-t mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {currentYear} Elevate AI. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link
                href="/sign-in"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/sign-in"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                href="/sign-in"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
