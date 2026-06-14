"use client";

import { createContext, useContext, useState } from "react";

interface LanguageCtx {
  language: string;
  setLanguage: (lang: string) => void;
}

const LanguageContext = createContext<LanguageCtx>({
  language: "English",
  setLanguage: () => {},
});

export const useLanguage = () => useContext(LanguageContext);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState("en");
  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}
