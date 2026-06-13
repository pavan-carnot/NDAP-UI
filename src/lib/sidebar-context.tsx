"use client";

import { createContext, useContext, useState } from "react";

interface SidebarCtx {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
}

const SidebarContext = createContext<SidebarCtx>({
  sidebarOpen: true,
  setSidebarOpen: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  return (
    <SidebarContext.Provider value={{ sidebarOpen, setSidebarOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}
