"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { industries as staticIndustries } from "@/data/industries";
import { getRolesByIndustry } from "@/data/targetRoles";

export type IndustryOption = {
  id: string;
  name: string;
  subIndustries: string[];
};

export type RoleOption = {
  id: string;
  title: string;
};

function normalizeIndustryId(industry?: string | null): string {
  if (!industry) return "";
  return industry.split("-")[0].trim().toLowerCase();
}

function toTitleCase(input: string): string {
  return input
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toRoleId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export async function getIndustryOptions(): Promise<IndustryOption[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [insights, user] = await Promise.all([
    db.industryInsight.findMany({
      select: { industry: true },
      orderBy: { industry: "asc" },
      take: 200,
    }),
    db.user.findUnique({
      where: { clerkUserId: userId },
      select: { industry: true },
    }),
  ]);

  const staticMap = new Map(
    staticIndustries.map((item) => [
      item.id,
      {
        id: item.id,
        name: item.name,
        subIndustries: item.subIndustries,
      },
    ])
  );

  const ids = new Set<string>(staticMap.keys());

  insights.forEach((insight) => {
    const normalized = normalizeIndustryId(insight.industry);
    if (normalized) ids.add(normalized);
  });

  const userIndustryId = normalizeIndustryId(user?.industry);
  if (userIndustryId) ids.add(userIndustryId);

  return Array.from(ids)
    .sort((a, b) => a.localeCompare(b))
    .map((id) =>
      staticMap.get(id) ?? {
        id,
        name: toTitleCase(id),
        subIndustries: [],
      }
    );
}

export async function getRoleOptionsByIndustry(industryId?: string): Promise<RoleOption[]> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    select: { industry: true, targetRole: true },
  });

  const baseIndustry = normalizeIndustryId(industryId) || normalizeIndustryId(user?.industry);

  const staticRoleTitles = baseIndustry
    ? getRolesByIndustry(baseIndustry).map((role) => role.title)
    : [];

  const dbRoles = await db.user.findMany({
    where: {
      targetRole: { not: null },
      ...(baseIndustry
        ? {
            industry: {
              startsWith: baseIndustry,
              mode: "insensitive",
            },
          }
        : {}),
    },
    select: { targetRole: true },
    orderBy: { updatedAt: "desc" },
    take: 250,
  });

  const allTitles = [
    ...staticRoleTitles,
    ...dbRoles.map((item) => item.targetRole || "").filter(Boolean),
    user?.targetRole || "",
  ];

  const deduped = Array.from(
    new Set(
      allTitles
        .map((title) => title.trim())
        .filter(Boolean)
    )
  );

  return deduped.map((title) => ({
    id: toRoleId(title),
    title,
  }));
}
