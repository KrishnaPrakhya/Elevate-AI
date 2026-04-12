import React from "react";
import ProfileForm from "./_components/profile-form";
import { getUser } from "@/actions/user";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";

async function ProfilePage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  let user;
  try {
    user = await getUser();
  } catch {
    redirect("/sign-in");
  }

  // user object has: industry, experience, bio, skills, clerkUserId
  return (
    <main className="container mx-auto px-4 py-8">
      <PageHeader
        title="Profile Settings"
        description="Update your professional information and career preferences"
        align="left"
        size="lg"
        className="mb-8"
      />
      <div className="max-w-4xl mx-auto">
        <ProfileForm initialUser={{ ...user, clerkUserId: userId }} />
      </div>
    </main>
  );
}

export default ProfilePage;
