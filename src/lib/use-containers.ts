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

// Per user, so two people sharing a browser don't open each other's last container
const activeKey = (username: string) => `ndap_active_container:${username}`;

export function loadActiveContainer(username: string): string | null {
  try { return localStorage.getItem(activeKey(username)); } catch { return null; }
}

export function saveActiveContainer(username: string, id: string) {
  try { localStorage.setItem(activeKey(username), id); } catch { /* storage unavailable */ }
}
