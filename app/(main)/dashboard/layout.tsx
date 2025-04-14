import { PageHeader } from "@/components/page-header";
import React from "react";
import { BarLoader } from "react-spinners";
import { Suspense } from "react";
interface Props {
  children: React.ReactNode;
}

function Layout(props: Props) {
  const { children } = props;

  return (
    <div className="px-5">
      <div className="flex items-center justify-between pb-2">
        <PageHeader title="Industry Insights" size="lg" />
      </div>

      <Suspense fallback={<BarLoader className="mt-4" width={100} />}>
        {children}
      </Suspense>
    </div>
  );
}

export default Layout;
