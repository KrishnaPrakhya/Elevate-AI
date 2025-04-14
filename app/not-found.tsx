import React from "react";

interface Props {}

function NotFoundPage(props: Props) {
  const {} = props;

  return (
    <div className="flex relative justify-center items-center min-h-[100vh]">
      <div className="bg-background text-foreground top-24">
        <h1>I Am Not Found</h1>
      </div>
    </div>
  );
}

export default NotFoundPage;
