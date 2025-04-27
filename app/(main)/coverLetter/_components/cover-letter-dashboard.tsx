"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PlusCircle,
  FileText,
  Briefcase,
  Calendar,
  Trash2,
  Eye,
  Download,
  Edit,
} from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteCoverLetter } from "@/actions/coverLetter";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import CreateCoverLetterForm from "./create-cover-letter-form";
import CoverLetterPreview from "./cover-letter-preview";
import { coverLetterProps } from "../page";

interface CoverLetterDashboardProps {
  coverLetters: coverLetterProps[];
}

export default function CoverLetterDashboard({
  coverLetters,
}: CoverLetterDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("my-letters");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<coverLetterProps | null>(
    null
  );
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [letterToDelete, setLetterToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  console.log(coverLetters);
  const handleCreateNew = () => {
    setShowCreateForm(true);
  };

  const handleViewLetter = (letter: coverLetterProps) => {
    setSelectedLetter(letter);
  };

  const handleDeleteLetter = async () => {
    if (!letterToDelete) return;

    setIsDeleting(true);
    try {
      await deleteCoverLetter(letterToDelete);
      toast.success("Cover letter deleted successfully");
      setShowDeleteDialog(false);
      setLetterToDelete(null);
      router.refresh();
    } catch (error) {
      console.log(error);
      toast.error("Failed to delete cover letter");
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = (id: string) => {
    setLetterToDelete(id);
    setShowDeleteDialog(true);
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.4 },
    },
  };

  return (
    <>
      <Tabs
        defaultValue="my-letters"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <div className="flex justify-between items-center mb-6">
          <TabsList>
            <TabsTrigger value="my-letters" className="px-6">
              <FileText className="h-4 w-4 mr-2" />
              My Cover Letters
            </TabsTrigger>
            <TabsTrigger value="templates" className="px-6">
              <FileText className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
          </TabsList>

          <Button onClick={handleCreateNew} className="gap-2">
            <PlusCircle className="h-4 w-4" />
            Create New Cover Letter
          </Button>
        </div>

        <TabsContent value="my-letters" className="mt-0">
          {coverLetters.length === 0 ? (
            <Card className="border-dashed border-2 bg-muted/50">
              <CardContent className="pt-10 pb-10 flex flex-col items-center justify-center text-center">
                <div className="rounded-full bg-primary/10 p-4 mb-4">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-medium mb-2">
                  No cover letters yet
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Create your first cover letter to get started. Our AI will
                  help you craft the perfect letter for your job application.
                </p>
                <Button onClick={handleCreateNew} className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  Create Your First Cover Letter
                </Button>
              </CardContent>
            </Card>
          ) : (
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {coverLetters?.map((letter: coverLetterProps) => (
                <motion.div key={letter.id} variants={itemVariants}>
                  <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg line-clamp-1">
                            {letter.jobTitle}
                          </CardTitle>
                          <CardDescription className="line-clamp-1">
                            {letter.companyName}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {letter.templateId || "Standard"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="py-2 flex-grow">
                      <div className="flex flex-col space-y-3">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4 mr-2" />
                          <span>
                            Created:{" "}
                            {format(new Date(letter.createdAt), "MMM d, yyyy")}
                          </span>
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Briefcase className="h-4 w-4 mr-2" />
                          <span className="line-clamp-1">
                            Job: {letter.jobTitle}
                          </span>
                        </div>
                        <div className="mt-2 p-3 bg-muted/50 rounded-md h-24 overflow-hidden relative">
                          <div className="text-sm line-clamp-4">
                            {letter.content.substring(0, 200)}...
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-muted/50 to-transparent"></div>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-2 flex justify-between border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewLetter(letter)}
                        className="gap-1"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(`/coverLetter/edit/${letter.id}`)
                          }
                          className="gap-1"
                        >
                          <Edit className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => confirmDelete(letter.id)}
                          className="text-destructive hover:text-destructive gap-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-0">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {[
              {
                id: "professional",
                name: "Professional",
                description:
                  "Formal and traditional style suitable for corporate roles",
              },
              {
                id: "modern",
                name: "Modern",
                description:
                  "Contemporary design with a clean, minimalist approach",
              },
              {
                id: "creative",
                name: "Creative",
                description: "Bold and unique style for creative industries",
              },
              {
                id: "executive",
                name: "Executive",
                description: "Sophisticated design for senior positions",
              },
              {
                id: "technical",
                name: "Technical",
                description: "Focused on technical skills and achievements",
              },
              {
                id: "entry-level",
                name: "Entry Level",
                description:
                  "Perfect for recent graduates and those new to the workforce",
              },
            ].map((template) => (
              <motion.div key={template.id} variants={itemVariants}>
                <Card
                  className="h-full flex flex-col hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setShowCreateForm(true);
                  }}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="py-2 flex-grow">
                    <div className="h-40 bg-muted/50 rounded-md flex items-center justify-center">
                      <div className="w-3/4 h-4/5 border border-border/50 bg-card rounded-sm flex flex-col p-2">
                        <div className="w-1/2 h-2 bg-primary/20 rounded-full mb-2"></div>
                        <div className="w-3/4 h-2 bg-muted-foreground/20 rounded-full mb-1"></div>
                        <div className="w-2/3 h-2 bg-muted-foreground/20 rounded-full mb-3"></div>
                        <div className="flex-grow flex flex-col justify-around">
                          {[1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className="w-full h-2 bg-muted-foreground/10 rounded-full"
                            ></div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1"
                      onClick={() => {
                        setShowCreateForm(true);
                      }}
                    >
                      <PlusCircle className="h-4 w-4" />
                      Use Template
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Create Cover Letter Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Cover Letter</DialogTitle>
            <DialogDescription>
              Fill in the details below to generate a personalized cover letter
            </DialogDescription>
          </DialogHeader>
          <CreateCoverLetterForm
            onSuccess={() => {
              setShowCreateForm(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* View Cover Letter Dialog */}
      <Dialog
        open={!!selectedLetter}
        onOpenChange={() => setSelectedLetter(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedLetter?.jobTitle}</DialogTitle>
            <DialogDescription>
              Cover letter for {selectedLetter?.companyName}
            </DialogDescription>
          </DialogHeader>
          {selectedLetter && (
            <>
              <div className="border rounded-lg p-6 bg-white">
                <CoverLetterPreview
                  content={selectedLetter.content}
                  template={selectedLetter.templateId || "professional"}
                />
              </div>
              <DialogFooter className="flex justify-between sm:justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    router.push(`/coverLetter/edit/${selectedLetter.id}`)
                  }
                  className="gap-1"
                >
                  <Edit className="h-4 w-4" />
                  Edit Cover Letter
                </Button>
                <Button
                  onClick={() => {
                    // Generate PDF functionality would go here
                    toast.success("PDF download started");
                  }}
                  className="gap-1"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Cover Letter</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this cover letter? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteLetter}
              disabled={isDeleting}
              className="gap-1"
            >
              {isDeleting ? (
                <>Deleting...</>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
