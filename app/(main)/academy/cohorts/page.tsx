"use client";

import { useEffect, useState } from "react";
import { getCohorts, joinCohort, getUserCohort } from "@/actions/academy";
import { Loader2, Users, Calendar, Clock, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface Cohort {
  id: string;
  name: string;
  description: string | null;
  industry: string | null;
  startsAt: Date | string;
  endsAt: Date | string;
  maxMembers: number;
  members: CohortMember[];
  _count: { members: number };
}

interface CohortMember {
  id: string;
  user: {
    name: string | null;
    email: string;
    imageUrl: string | null;
  };
}

export default function CohortsPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [userCohort, setUserCohort] = useState<Cohort | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      try {
        const [cohortsData, userCohortData] = await Promise.all([
          getCohorts(),
          getUserCohort(),
        ]);
        setCohorts(cohortsData);
        setUserCohort(userCohortData);
      } catch (error) {
        console.error("Error loading cohorts:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleJoin = async (cohortId: string) => {
    setJoining(cohortId);
    try {
      await joinCohort(cohortId);
      const [cohortsData, userCohortData] = await Promise.all([getCohorts(), getUserCohort()]);
      setCohorts(cohortsData);
      setUserCohort(userCohortData);
    } catch (error) {
      console.error("Error joining cohort:", error);
    } finally {
      setJoining(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Learning Cohorts</h1>
        <p className="text-muted-foreground">Join a group of learners on the same journey</p>
      </div>

      {/* User's Current Cohort */}
      {userCohort && (
        <Card className="border-2 border-primary bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Your Cohort
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">{userCohort.name}</h3>
                {userCohort.description && (
                  <p className="text-muted-foreground mt-1">{userCohort.description}</p>
                )}
                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Starts {new Date(userCohort.startsAt).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Ends {new Date(userCohort.endsAt).toLocaleDateString()}
                  </span>
                  <Badge>{userCohort._count?.members || 0} members</Badge>
                </div>
              </div>
              <Button onClick={() => router.push(`/academy/cohorts/${userCohort.id}`)}>
                View Cohort <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {/* Members */}
            <div className="mt-6">
              <h4 className="font-medium mb-3">Members</h4>
              <div className="flex gap-2 flex-wrap">
                {userCohort.members?.slice(0, 10).map((member) => (
                  <div key={member.id} className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs">
                      {member.user.name?.[0] || member.user.email[0]}
                    </div>
                    <span className="text-sm">{member.user.name || "Anonymous"}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Cohorts */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Available Cohorts</h2>
        {cohorts.length === 0 ? (
          <div className="text-center py-12 bg-muted/50 rounded-xl">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No cohorts available right now</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cohorts
              .filter((c) => c.id !== userCohort?.id)
              .map((cohort) => {
                const isFull = (cohort._count?.members || 0) >= cohort.maxMembers;
                return (
                  <Card key={cohort.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{cohort.name}</CardTitle>
                          {cohort.industry && (
                            <Badge variant="outline" className="mt-2">
                              {cohort.industry}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {cohort.description && (
                        <p className="text-sm text-muted-foreground mb-4">{cohort.description}</p>
                      )}
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {new Date(cohort.startsAt).toLocaleDateString()} -{" "}
                            {new Date(cohort.endsAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {cohort._count?.members || 0} / {cohort.maxMembers}
                          </span>
                          {isFull ? (
                            <Badge variant="destructive">Full</Badge>
                          ) : (
                            <Badge variant="secondary">Open</Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        className="w-full mt-4"
                        onClick={() => handleJoin(cohort.id)}
                        disabled={isFull || joining === cohort.id}
                      >
                        {joining === cohort.id ? "Joining..." : isFull ? "Cohort Full" : "Join Cohort"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}