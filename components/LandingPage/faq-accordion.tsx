"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function FaqAccordion() {
  const [openItem, setOpenItem] = useState<string | null>(null);

  const faqItems = [
    {
      question: "Is Elevate AI free to use?",
      answer:
        "Yes. There are no paid tiers, subscriptions, or credit card requirements — every feature described on this page, from the career planner to the voice interview simulator, is available once you sign up.",
    },
    {
      question: "What does \"agentic\" actually mean here?",
      answer:
        "Requests are routed through a supervisor to specialized agents — a scheduler that creates real Google Calendar events, a job searcher that runs live web searches, a document improver, and others — each shown live in the diagram above. The AI doesn't just describe next steps; specific agents carry them out, with your confirmation before anything is created.",
    },
    {
      question: "Will my career plan and progress actually persist?",
      answer:
        "Your active career plan, skill mastery, assessments, and portfolio are stored in Postgres, not just cached in memory. Skill gaps identified in your plan automatically seed trackable progress in your dashboard, so growth compounds instead of resetting between sessions.",
    },
    {
      question: "How does the voice interview simulator work?",
      answer:
        "It runs a real-time voice call (LiveKit) where speech is transcribed and answered by the AI interviewer, with feedback generated after each session — closer to a real interview than typing answers into a text box.",
    },
    {
      question: "Can it help me find and track job openings?",
      answer:
        "Yes — an automated search pipeline matches openings against your target role and skill gaps, scores relevance, and drops them into an application tracker where you can move each one from tracking to applied, interviewing, or offer.",
    },
    {
      question: "Do I need to connect anything before I start?",
      answer:
        "No setup is required to use the core tools. Connecting Google Calendar is optional and only needed if you want the scheduling agent to create events on your behalf.",
    },
  ];

  const handleItemClick = (value: string) => {
    setOpenItem(openItem === value ? null : value);
  };

  return (
    <Accordion
      type="single"
      collapsible
      className="w-full"
      value={openItem || undefined}
    >
      {faqItems.map((item, index) => (
        <AccordionItem
          key={index}
          value={`item-${index}`}
          className="mb-3 rounded-md border bg-card px-6 data-[state=open]:border-primary/30"
        >
          <AccordionTrigger
            className="py-4 text-left hover:no-underline"
            onClick={() => handleItemClick(`item-${index}`)}
          >
            <span className="font-display text-base font-semibold">
              {item.question}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-1 text-sm leading-relaxed text-muted-foreground">
            {item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
