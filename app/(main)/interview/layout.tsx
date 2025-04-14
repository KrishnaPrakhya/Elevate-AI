import type React from "react";
import { BarLoader } from "react-spinners";
import { Suspense } from "react";

interface Props {
  children: React.ReactNode;
}

function Layout(props: Props) {
  const { children } = props;

  return (
    <div className="relative min-h-screen bg-background">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 opacity-[0.02] dark:opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        ></div>
      </div>

      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="text-center mb-4">
              <h3 className="text-lg font-medium mb-2">
                Loading your interview data...
              </h3>
              <p className="text-sm text-muted-foreground">
                This will just take a moment
              </p>
            </div>
            <BarLoader color="hsl(var(--primary))" width={200} />
          </div>
        }
      >
        {children}
      </Suspense>
    </div>
  );
}

export default Layout;
