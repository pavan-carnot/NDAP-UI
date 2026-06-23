"use client";

// Login page commented out — redirects directly to /chat
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/chat"); }, [router]);
  return null;
}
