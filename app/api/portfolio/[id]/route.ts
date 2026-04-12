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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const updates = body as Partial<{
      title: string;
      description: string;
      contentUrl: string;
      skillsDemonstrated: string[];
      isPublic: boolean;
    }>;

    if (Object.prototype.hasOwnProperty.call(updates, "contentUrl")) {
      const normalizedContentUrl = normalizeUrl(updates.contentUrl);
      if ((updates.contentUrl ?? "").trim() && !normalizedContentUrl) {
        return NextResponse.json(
          { error: "Invalid content URL" },
          { status: 400 }
        );
      }
      updates.contentUrl = normalizedContentUrl ?? "";
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const artifact = await db.portfolioArtifact.update({
      where: { id, userId: user.id },
      data: {
        ...updates,
        ...(Object.prototype.hasOwnProperty.call(updates, "contentUrl")
          ? { contentUrl: updates.contentUrl || null }
          : {}),
      },
    });

    return NextResponse.json({ artifact });
  } catch (error) {
    console.error("Error updating artifact:", error);
    return NextResponse.json(
      { error: "Failed to update artifact" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await db.portfolioArtifact.delete({
      where: { id, userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting artifact:", error);
    return NextResponse.json(
      { error: "Failed to delete artifact" },
      { status: 500 }
    );
  }
}
