import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/prisma";
import { JobsView } from "./_components/JobsView";

export default async function JobsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { id: true },
  });

  const jobs = user
    ? await db.jobApplication.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];

  const n8nConfigured = Boolean(process.env.N8N_WEBHOOK_URL);

  return (
    <JobsView
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialJobs={jobs as any}
      n8nConfigured={n8nConfigured}
    />
  );
}
