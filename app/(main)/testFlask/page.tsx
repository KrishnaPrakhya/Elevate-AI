"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [data, setData] = useState<{ message: string } | null>(null);

  useEffect(() => {
    fetch("/api/data")
      .then((res) => res.json())
      .then((data) => setData(data));
  }, []);

  return (
    <div>
      <h1>Next.js + Flask</h1>
      <p>Data from Flask: {data ? data?.message : "Loading..."}</p>
    </div>
  );
}
