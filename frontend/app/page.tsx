"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login page on load
    router.push("/login");
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-black text-white">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-purple-500" size={48} />
        <h1 className="text-xl font-medium">Entering Query Vault 2.0...</h1>
      </div>
    </div>
  );
}
