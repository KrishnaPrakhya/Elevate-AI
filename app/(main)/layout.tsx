import React from "react";

interface Props {
  children: React.ReactNode;
}

function Layout(props: Props) {
  const { children } = props;

  return <div className="container mx-auto mt-24 mb-20">{children}</div>;
}

export default Layout;
