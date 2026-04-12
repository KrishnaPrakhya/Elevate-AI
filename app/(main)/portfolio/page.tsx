"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import axios from "axios";
import {
  AIResponseFormatter,
  formatAIResponse,
} from "@/components/ai-response-formatter";
import {
  FolderOpen,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  Sparkles,
  FileText,
  Code,
  Image,
  ExternalLink,
  Search,
  Filter,
  Star,
  TrendingUp,
  RefreshCw,
  Clock,
  CheckCircle,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";

interface PortfolioArtifact {
  id: string;
  title: string;
  description: string;
  contentUrl?: string | null;
  skillsDemonstrated: string[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  aiReview?: {
    score: number;
    feedback: string;
    suggestions: string[];
  } | null;
}

interface PortfolioArtifactApiResponse extends Omit<
  PortfolioArtifact,
  "skillsDemonstrated" | "aiReview"
> {
  skillsDemonstrated?: unknown;
  aiReview?: unknown;
}

const normalizeAiReview = (
  rawReview: unknown,
): PortfolioArtifact["aiReview"] => {
  if (!rawReview) return null;

  let parsedReview = rawReview;
  if (typeof rawReview === "string") {
    try {
      parsedReview = JSON.parse(rawReview);
    } catch {
      return null;
    }
  }

  if (
    !parsedReview ||
    typeof parsedReview !== "object" ||
    Array.isArray(parsedReview)
  ) {
    return null;
  }

  const review = parsedReview as Record<string, unknown>;
  const scoreRaw = review.score;
  const numericScore =
    typeof scoreRaw === "number" ? scoreRaw : Number(scoreRaw);

  if (!Number.isFinite(numericScore)) {
    return null;
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(numericScore))),
    feedback: typeof review.feedback === "string" ? review.feedback : "",
    suggestions: Array.isArray(review.suggestions)
      ? review.suggestions.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
  };
};

const normalizeArtifact = (
  rawArtifact: PortfolioArtifactApiResponse,
): PortfolioArtifact => ({
  ...rawArtifact,
  skillsDemonstrated: Array.isArray(rawArtifact.skillsDemonstrated)
    ? rawArtifact.skillsDemonstrated.filter(
        (item): item is string => typeof item === "string",
      )
    : [],
  aiReview: normalizeAiReview(rawArtifact.aiReview),
});

export default function PortfolioPage() {
  const [artifacts, setArtifacts] = useState<PortfolioArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPublic, setFilterPublic] = useState<
    "all" | "public" | "private"
  >("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "score">("newest");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [selectedArtifact, setSelectedArtifact] =
    useState<PortfolioArtifact | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewingArtifactId, setReviewingArtifactId] = useState<string | null>(
    null,
  );

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    contentUrl: "",
    skillsDemonstrated: "",
    isPublic: true,
  });

  useEffect(() => {
    loadArtifacts();
  }, []);

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

  const loadArtifacts = async () => {
    try {
      const response = await axios.get("/api/portfolio");
      const normalizedArtifacts = (
        (response.data.artifacts || []) as PortfolioArtifactApiResponse[]
      ).map(normalizeArtifact);
      setArtifacts(normalizedArtifacts);
    } catch (error) {
      console.error("Error loading portfolio:", error);
      toast.error("Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  };

  const createArtifact = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error("Title and description are required");
      return;
    }

    const normalizedContentUrl = normalizeUrl(formData.contentUrl);
    if (formData.contentUrl.trim() && !normalizedContentUrl) {
      toast.error(
        "Please enter a valid URL (example: https://buildbybrain.vercel.app)",
      );
      return;
    }

    try {
      await axios.post("/api/portfolio", {
        ...formData,
        contentUrl: normalizedContentUrl,
        skillsDemonstrated: formData.skillsDemonstrated
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });

      toast.success("Portfolio artifact created");
      setFormData({
        title: "",
        description: "",
        contentUrl: "",
        skillsDemonstrated: "",
        isPublic: true,
      });
      setIsCreateDialogOpen(false);
      loadArtifacts();
    } catch (error) {
      console.error("Error creating artifact:", error);
      toast.error("Failed to create artifact");
    }
  };

  const updateArtifact = async (
    id: string,
    updates: Partial<PortfolioArtifact>,
  ) => {
    try {
      await axios.patch(`/api/portfolio/${id}`, updates);
      toast.success("Artifact updated");
      loadArtifacts();
    } catch (error) {
      console.error("Error updating artifact:", error);
      toast.error("Failed to update artifact");
    }
  };

  const deleteArtifact = async (id: string) => {
    try {
      await axios.delete(`/api/portfolio/${id}`);
      toast.success("Artifact deleted");
      loadArtifacts();
    } catch (error) {
      console.error("Error deleting artifact:", error);
      toast.error("Failed to delete artifact");
    }
  };

  const openStoredReview = (artifact: PortfolioArtifact) => {
    setSelectedArtifact(artifact);
    setIsReviewDialogOpen(true);
  };

  const requestAIReview = async (
    artifact: PortfolioArtifact,
    options?: { forceRefresh?: boolean },
  ) => {
    if (artifact.aiReview && !options?.forceRefresh) {
      openStoredReview(artifact);
      return;
    }

    setIsReviewing(true);
    setReviewingArtifactId(artifact.id);
    try {
      const response = await axios.post(`/api/portfolio/${artifact.id}/review`);
      const normalizedReviewedArtifact = normalizeArtifact(
        response.data.artifact as PortfolioArtifactApiResponse,
      );

      setArtifacts((prevArtifacts) =>
        prevArtifacts.map((existingArtifact) =>
          existingArtifact.id === normalizedReviewedArtifact.id
            ? {
                ...existingArtifact,
                ...normalizedReviewedArtifact,
              }
            : existingArtifact,
        ),
      );

      toast.success("AI review completed");
      setSelectedArtifact(normalizedReviewedArtifact);
      setIsReviewDialogOpen(true);
    } catch (error) {
      console.error("Error getting AI review:", error);
      const errorMessage = axios.isAxiosError(error)
        ? (error.response?.data?.error as string | undefined) ||
          "Failed to get AI review"
        : "Failed to get AI review";
      toast.error(errorMessage);
    } finally {
      setIsReviewing(false);
      setReviewingArtifactId(null);
    }
  };

  const filteredArtifacts = artifacts
    .filter((artifact) => {
      const matchesSearch =
        artifact.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        artifact.description
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        artifact.skillsDemonstrated.some((skill) =>
          skill.toLowerCase().includes(searchQuery.toLowerCase()),
        );

      const matchesFilter =
        filterPublic === "all"
          ? true
          : filterPublic === "public"
            ? artifact.isPublic
            : !artifact.isPublic;

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case "oldest":
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case "score":
          return (b.aiReview?.score || 0) - (a.aiReview?.score || 0);
        default:
          return 0;
      }
    });

  const stats = {
    total: artifacts.length,
    public: artifacts.filter((a) => a.isPublic).length,
    reviewed: artifacts.filter((a) => a.aiReview).length,
    avgScore:
      artifacts.filter((a) => a.aiReview).length > 0
        ? Math.round(
            artifacts.reduce((sum, a) => sum + (a.aiReview?.score || 0), 0) /
              artifacts.filter((a) => a.aiReview).length,
          )
        : 0,
  };

  const getArtifactIcon = (artifact: PortfolioArtifact) => {
    if (artifact.contentUrl?.includes("github.com"))
      return <Code className="w-5 h-5" aria-hidden />;
    if (artifact.contentUrl?.match(/\.(png|jpg|jpeg|gif|svg)$/i))
      return <Image className="w-5 h-5" aria-hidden />;
    if (
      artifact.contentUrl?.includes("drive.google.com") ||
      artifact.contentUrl?.includes("dropbox.com")
    )
      return <FileText className="w-5 h-5" aria-hidden />;
    return <FolderOpen className="w-5 h-5" aria-hidden />;
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-8 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <PageHeader
        title="Portfolio"
        description="Showcase your projects and get AI-powered feedback"
        size="lg"
        align="left"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FolderOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Artifacts</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Eye className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Public</p>
                <p className="text-2xl font-bold">{stats.public}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Sparkles className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">AI Reviewed</p>
                <p className="text-2xl font-bold">{stats.reviewed}</p>
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
                <p className="text-sm text-muted-foreground">Avg Score</p>
                <p className="text-2xl font-bold">{stats.avgScore}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search portfolio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-[250px]"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                {filterPublic === "all"
                  ? "All"
                  : filterPublic === "public"
                    ? "Public"
                    : "Private"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterPublic("all")}>
                All
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterPublic("public")}>
                Public
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterPublic("private")}>
                Private
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Clock className="w-4 h-4" />
                {sortBy === "newest"
                  ? "Newest"
                  : sortBy === "oldest"
                    ? "Oldest"
                    : "Score"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSortBy("newest")}>
                Newest First
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("oldest")}>
                Oldest First
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("score")}>
                Highest Score
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Artifact
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Portfolio Artifact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Title *
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="My Awesome Project"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Description *
                </label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Describe your project, what you built, and the impact..."
                  rows={4}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Content URL
                </label>
                <Input
                  value={formData.contentUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, contentUrl: e.target.value })
                  }
                  placeholder="https://github.com/..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Link to GitHub, live demo, Google Drive, Dropbox, or any
                  relevant URL
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Skills Demonstrated
                </label>
                <Input
                  value={formData.skillsDemonstrated}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      skillsDemonstrated: e.target.value,
                    })
                  }
                  placeholder="React, TypeScript, Node.js (comma-separated)"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium">Make Public</label>
                  <p className="text-xs text-muted-foreground">
                    Public artifacts can be shared with recruiters
                  </p>
                </div>
                <Switch
                  checked={formData.isPublic}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isPublic: checked })
                  }
                />
              </div>
              <Button onClick={createArtifact} className="w-full">
                <Upload className="w-4 h-4 mr-2" />
                Add to Portfolio
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Portfolio Grid */}
      {filteredArtifacts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No portfolio artifacts yet
            </h3>
            <p className="text-muted-foreground mb-4">
              Start building your portfolio by adding your first project
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Artifact
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredArtifacts.map((artifact) => (
              <motion.div
                key={artifact.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="h-full flex flex-col hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        {getArtifactIcon(artifact)}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() =>
                              updateArtifact(artifact.id, {
                                isPublic: !artifact.isPublic,
                              })
                            }
                          >
                            {artifact.isPublic ? (
                              <EyeOff className="w-4 h-4 mr-2" />
                            ) : (
                              <Eye className="w-4 h-4 mr-2" />
                            )}
                            {artifact.isPublic ? "Make Private" : "Make Public"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setFormData({
                                title: artifact.title,
                                description: artifact.description,
                                contentUrl: artifact.contentUrl || "",
                                skillsDemonstrated:
                                  artifact.skillsDemonstrated.join(", "),
                                isPublic: artifact.isPublic,
                              });
                              setSelectedArtifact(artifact);
                              setIsCreateDialogOpen(true);
                            }}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deleteArtifact(artifact.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardTitle className="text-lg mt-3">
                      {artifact.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {artifact.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <div className="flex flex-wrap gap-1 mb-4">
                      {artifact.skillsDemonstrated
                        .slice(0, 4)
                        .map((skill, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      {artifact.skillsDemonstrated.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{artifact.skillsDemonstrated.length - 4}
                        </Badge>
                      )}
                    </div>

                    {artifact.aiReview && (
                      <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-4 h-4 text-primary" />
                          <span className="text-xs font-medium">AI Review</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-muted-foreground">
                                Score
                              </span>
                              <span className="font-medium">
                                {artifact.aiReview.score}%
                              </span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${artifact.aiReview.score}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {new Date(artifact.createdAt).toLocaleDateString()}
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        {artifact.contentUrl &&
                          normalizeUrl(artifact.contentUrl) && (
                            <Button variant="ghost" size="sm" asChild>
                              <a
                                href={normalizeUrl(artifact.contentUrl) ?? "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Open ${artifact.title} link`}
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                Visit Site
                              </a>
                            </Button>
                          )}
                        {artifact.aiReview ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openStoredReview(artifact)}
                              className="cursor-pointer whitespace-nowrap"
                            >
                              <Sparkles className="w-3 h-3 mr-1" />
                              View Review
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                requestAIReview(artifact, {
                                  forceRefresh: true,
                                })
                              }
                              disabled={
                                isReviewing &&
                                reviewingArtifactId === artifact.id
                              }
                              className="cursor-pointer whitespace-nowrap"
                            >
                              <RefreshCw
                                className={`w-3 h-3 mr-1 ${
                                  isReviewing &&
                                  reviewingArtifactId === artifact.id
                                    ? "animate-spin"
                                    : ""
                                }`}
                              />
                              {isReviewing &&
                              reviewingArtifactId === artifact.id
                                ? "Re-reviewing..."
                                : "Re-review"}
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => requestAIReview(artifact)}
                            disabled={isReviewing}
                            className="cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3 mr-1" />
                            Get Review
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* AI Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI Portfolio Review
            </DialogTitle>
          </DialogHeader>
          {selectedArtifact?.aiReview && (
            <div className="space-y-6 py-4">
              <div className="flex items-center gap-4">
                <div className="relative w-24 h-24">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="hsl(var(--muted))"
                      strokeWidth="8"
                      fill="none"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke={`hsl(${selectedArtifact.aiReview.score >= 70 ? 142 : selectedArtifact.aiReview.score >= 50 ? 45 : 0}, 70%, 50%)`}
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${(selectedArtifact.aiReview.score / 100) * 251} 251`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold">
                      {selectedArtifact.aiReview.score}%
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">
                    {selectedArtifact.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {Array.isArray(selectedArtifact.skillsDemonstrated)
                      ? selectedArtifact.skillsDemonstrated.join(", ")
                      : ""}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  Overall Feedback
                </h4>
                <AIResponseFormatter
                  content={formatAIResponse(selectedArtifact.aiReview.feedback)}
                  variant="chat"
                />
              </div>

              <div>
                <h4 className="font-semibold mb-3">
                  Suggestions for Improvement
                </h4>
                <ul className="space-y-2">
                  {selectedArtifact.aiReview.suggestions.map(
                    (suggestion, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <TrendingUp className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        {suggestion}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
