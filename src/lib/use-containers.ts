"use client";

import { useCallback, useEffect, useState } from "react";
import { KnowledgeContainer, listContainers } from "./api";

const POLL_MS = 5000;

// Containers for the signed-in user; polls while any file is still being ingested
export function useContainers() {
  const [containers, setContainers] = useState<KnowledgeContainer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const list = await listContainers();
      setContainers(list);
      setError(null);
      return list;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const ingesting = containers.some(c => c.files.some(f => f.status === "processing" || f.status === "missing"));
  useEffect(() => {
    if (!ingesting) return;
    const t = setTimeout(reload, POLL_MS);
    return () => clearTimeout(t);
  }, [ingesting, containers, reload]);

  return { containers, loaded, error, reload };
}

const ACTIVE_KEY = "ndap_active_container";

export function loadActiveContainer(): string | null {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}

export function saveActiveContainer(id: string) {
  try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* storage unavailable */ }
}
