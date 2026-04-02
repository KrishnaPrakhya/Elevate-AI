import React from "react";
import ProfileForm from "./_components/profile-form";
import { industries } from "@/data/industries";
import { getUser } from "@/actions/user";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";

async function ProfilePage() {
  let user;
  try {
    user = await getUser();
  } catch (error) {
    redirect("/sign-in");
  }

  // user object has: industry, experience, bio, skills
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
        <ProfileForm initialUser={user} industries={industries} />
      </div>
    </main>
  );
}

export default ProfilePage;
