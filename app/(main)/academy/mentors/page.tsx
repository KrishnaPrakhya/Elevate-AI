"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { toast } from "sonner";
import axios from "axios";
import {
  Users,
  Star,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  Filter,
  Search,
  Award,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";

interface Mentor {
  id: string;
  userId: string;
  bio: string | null;
  expertise: string[];
  yearsExperience: number | null;
  rating: number | null;
  totalSessions: number;
  isAvailable: boolean;
  user: {
    name: string | null;
    email: string;
    imageUrl: string | null;
    bio: string | null;
    skills: string[];
  };
  completedSessions: number;
  averageRating: number;
}

interface Session {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  mentor: {
    user: {
      name: string | null;
      imageUrl: string | null;
    };
  };
}

export default function MentorsPage() {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExpertise, setSelectedExpertise] = useState<string>("all");
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [userSessions, setUserSessions] = useState<Session[]>([]);
  const [showMySessions, setShowMySessions] = useState(false);

  useEffect(() => {
    loadMentors();
    if (showMySessions) {
      loadMySessions();
    }
  }, [showMySessions]);

  const loadMentors = async () => {
    try {
      const response = await axios.get("/api/academy/mentors");
      setMentors(response.data.mentors || []);
    } catch (error) {
      console.error("Error loading mentors:", error);
      toast.error("Failed to load mentors");
    } finally {
      setLoading(false);
    }
  };

  const loadMySessions = async () => {
    try {
      const response = await axios.get("/api/academy/mentorship");
      setUserSessions(response.data.sessions || []);
    } catch (error) {
      console.error("Error loading sessions:", error);
    }
  };

  const bookSession = async () => {
    if (!selectedMentor || !scheduledDate || !scheduledTime) {
      toast.error("Please select date and time");
      return;
    }

    setIsBooking(true);
    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      await axios.post("/api/academy/mentorship", {
        mentorId: selectedMentor.id,
        scheduledAt,
        durationMinutes: 30,
      });
      toast.success("Session booked successfully!");
      setIsBookingDialogOpen(false);
      loadMySessions();
    } catch (error) {
      console.error("Error booking session:", error);
      toast.error("Failed to book session");
    } finally {
      setIsBooking(false);
    }
  };

  const cancelSession = async (sessionId: string) => {
    try {
      await axios.delete(`/api/academy/mentorship/${sessionId}`);
      toast.success("Session canceled");
      loadMySessions();
    } catch (error) {
      console.error("Error canceling session:", error);
      toast.error("Failed to cancel session");
    }
  };

  const filteredMentors = mentors.filter((mentor) => {
    const matchesSearch =
      mentor.user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mentor.expertise.some((skill) =>
        skill.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesExpertise =
      selectedExpertise === "all" ||
      mentor.expertise.includes(selectedExpertise);

    return matchesSearch && matchesExpertise;
  });

  const allExpertise = Array.from(
    new Set(mentors.flatMap((m) => m.expertise))
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <PageHeader title="Mentorship" description="Loading mentors..." />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-muted rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <PageHeader
        title="Mentorship Program"
        description="Connect with experienced mentors for personalized guidance"
        size="lg"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Mentors</p>
                <p className="text-2xl font-bold">{mentors.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Star className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Rating</p>
                <p className="text-2xl font-bold">
                  {mentors.length > 0
                    ? (
                        mentors.reduce((sum, m) => sum + (m.averageRating || 0), 0) /
                        mentors.length
                      ).toFixed(1)
                    : "0"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sessions Done</p>
                <p className="text-2xl font-bold">
                  {mentors.reduce((sum, m) => sum + m.completedSessions, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Award className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">My Sessions</p>
                <p className="text-2xl font-bold">{userSessions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search mentors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-[250px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedExpertise}
              onChange={(e) => setSelectedExpertise(e.target.value)}
              className="px-3 py-2 rounded-md border border-primary/20 bg-background text-sm"
            >
              <option value="all">All Expertise</option>
              {allExpertise.map((skill) => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button
          variant={showMySessions ? "default" : "outline"}
          onClick={() => setShowMySessions(!showMySessions)}
        >
          <Calendar className="w-4 h-4 mr-2" />
          {showMySessions ? "Browse Mentors" : "My Sessions"}
        </Button>
      </div>

      {/* My Sessions View */}
      {showMySessions && userSessions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <h2 className="text-xl font-bold">My Mentorship Sessions</h2>
          {userSessions.map((session) => (
            <Card key={session.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src={session.mentor.user.imageUrl || ""} />
                      <AvatarFallback>
                        {session.mentor.user.name?.[0] || "M"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{session.mentor.user.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {new Date(session.scheduledAt).toLocaleDateString()}
                        <Clock className="w-3 h-3 ml-2" />
                        {session.durationMinutes} min
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        session.status === "COMPLETED"
                          ? "default"
                          : session.status === "CANCELLED"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {session.status}
                    </Badge>
                    {session.status === "SCHEDULED" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cancelSession(session.id)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {/* Mentors Grid */}
      {!showMySessions && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredMentors.map((mentor) => (
            <motion.div key={mentor.id} variants={itemVariants}>
              <Card className="h-full flex flex-col hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={mentor.user.imageUrl || ""} />
                      <AvatarFallback>
                        {mentor.user.name?.[0] || "M"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{mentor.user.name}</CardTitle>
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        <span className="font-medium">
                          {mentor.averageRating.toFixed(1)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          ({mentor.completedSessions} sessions)
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {mentor.bio || mentor.user.bio || "Experienced professional ready to help you grow"}
                  </p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {mentor.expertise.slice(0, 4).map((skill, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {mentor.expertise.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{mentor.expertise.length - 4}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      {mentor.yearsExperience || 0} years exp.
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {mentor.totalSessions} total
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Dialog
                    open={isBookingDialogOpen && selectedMentor?.id === mentor.id}
                    onOpenChange={(open) => {
                      setIsBookingDialogOpen(open);
                      if (open) setSelectedMentor(mentor);
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button className="w-full" disabled={!mentor.isAvailable}>
                        {mentor.isAvailable ? (
                          <>
                            <Calendar className="w-4 h-4 mr-2" />
                            Book Session
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 mr-2" />
                            Not Available
                          </>
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Book Session with {mentor.user.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Select Date
                          </label>
                          <Input
                            type="date"
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            min={new Date().toISOString().split("T")[0]}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Select Time
                          </label>
                          <Input
                            type="time"
                            value={scheduledTime}
                            onChange={(e) => setScheduledTime(e.target.value)}
                          />
                        </div>
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                          <p className="text-sm font-medium">Session Details</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Duration: 30 minutes
                          </p>
                        </div>
                        <Button
                          onClick={bookSession}
                          className="w-full"
                          disabled={isBooking || !scheduledDate || !scheduledTime}
                        >
                          {isBooking ? "Booking..." : "Confirm Booking"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {filteredMentors.length === 0 && !showMySessions && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No mentors found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filters
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
