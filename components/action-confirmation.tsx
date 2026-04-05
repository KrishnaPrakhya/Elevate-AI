"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Mail,
  Briefcase,
  Users,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

export interface PendingAction {
  id: string;
  type: "email" | "calendar" | "mentorship" | "job_application" | "schedule";
  title: string;
  description: string;
  params: Record<string, any>;
  expiresAt: string;
  metadata?: {
    icon?: string;
    priority?: "low" | "medium" | "high";
  };
}

interface ActionConfirmationProps {
  action: PendingAction;
  onConfirm: () => void;
  onCancel: () => void;
  isOpen: boolean;
}

const actionIcons = {
  email: Mail,
  calendar: Calendar,
  mentorship: Users,
  job_application: Briefcase,
  schedule: Clock,
};

const actionColors = {
  email: "bg-blue-500/10 text-blue-600 border-blue-200",
  calendar: "bg-green-500/10 text-green-600 border-green-200",
  mentorship: "bg-purple-500/10 text-purple-600 border-purple-200",
  job_application: "bg-orange-500/10 text-orange-600 border-orange-200",
  schedule: "bg-cyan-500/10 text-cyan-600 border-cyan-200",
};

export function ActionConfirmation({
  action,
  onConfirm,
  onCancel,
  isOpen,
}: ActionConfirmationProps) {
  const [isExecuting, setIsExecuting] = useState(false);

  const Icon = actionIcons[action.type] || AlertCircle;

  const handleConfirm = async () => {
    setIsExecuting(true);
    try {
      await onConfirm();
    } finally {
      setIsExecuting(false);
    }
  };

  const formatParams = (params: Record<string, any>) => {
    return Object.entries(params)
      .filter(([key]) => !key.startsWith("_"))
      .map(([key, value]) => {
        if (key.includes("time") || key.includes("date")) {
          try {
            return (
              <div key={key} className="flex gap-2 text-sm">
                <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}:</span>
                <span className="font-medium">
                  {format(new Date(value), "PPP p")}
                </span>
              </div>
            );
          } catch {
            return null;
          }
        }
        if (typeof value === "boolean") {
          return (
            <div key={key} className="flex gap-2 text-sm">
              <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}:</span>
              <Badge variant={value ? "default" : "secondary"} className="text-xs">
                {value ? "Yes" : "No"}
              </Badge>
            </div>
          );
        }
        if (typeof value === "string" && value.length < 100) {
          return (
            <div key={key} className="flex gap-2 text-sm">
              <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}:</span>
              <span className="font-medium">{value}</span>
            </div>
          );
        }
        return null;
      })
      .filter(Boolean);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${actionColors[action.type]}`}>
              <Icon className="w-5 h-5" />
            </div>
            <DialogTitle className="text-xl">{action.title}</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            {action.description}
          </DialogDescription>
        </DialogHeader>

        <Card className="border-muted bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Action Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {formatParams(action.params)}
          </CardContent>
        </Card>

        {action.expiresAt && (
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded-lg">
            <Clock className="w-4 h-4" />
            <span>
              This action will expire on {format(new Date(action.expiresAt), "PPP p")}
            </span>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isExecuting}
            className="gap-2"
          >
            <XCircle className="w-4 h-4" />
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isExecuting}
            className="gap-2 bg-gradient-to-r from-primary to-cyan-600"
          >
            {isExecuting ? (
              <>
                <Clock className="w-4 h-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Confirm
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ActionListProps {
  actions: PendingAction[];
  onConfirm: (action: PendingAction) => void;
  onCancel: (actionId: string) => void;
}

export function ActionList({ actions, onConfirm, onCancel }: ActionListProps) {
  const [selectedAction, setSelectedAction] = useState<PendingAction | null>(null);

  const handleConfirm = (action: PendingAction) => {
    setSelectedAction(action);
  };

  const handleDialogConfirm = () => {
    if (selectedAction) {
      onConfirm(selectedAction);
      setSelectedAction(null);
    }
  };

  if (actions.length === 0) {
    return null;
  }

  return (
    <>
      <div className="space-y-3 mt-4">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Pending Actions
        </h3>
        {actions.map((action) => {
          const Icon = actionIcons[action.type] || AlertCircle;
          return (
            <Card
              key={action.id}
              className={`border-l-4 ${
                action.metadata?.priority === "high"
                  ? "border-l-red-500"
                  : "border-l-primary"
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`p-2 rounded-lg ${actionColors[action.type]}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{action.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {action.description}
                      </p>
                      {action.metadata?.priority && (
                        <Badge
                          variant={
                            action.metadata.priority === "high"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-xs mt-2"
                        >
                          {action.metadata.priority} priority
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onCancel(action.id)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleConfirm(action)}
                      className="bg-gradient-to-r from-primary to-cyan-600"
                    >
                      Confirm
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedAction && (
        <ActionConfirmation
          action={selectedAction}
          onConfirm={handleDialogConfirm}
          onCancel={() => setSelectedAction(null)}
          isOpen={true}
        />
      )}
    </>
  );
}
