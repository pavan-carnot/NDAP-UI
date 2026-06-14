"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";

const HIDE_HEADER_PATHS = ["/login"];

export default function ConditionalHeader() {
  const path = usePathname();
  if (HIDE_HEADER_PATHS.some((p) => path.startsWith(p))) return null;
  return <Header />;
}
