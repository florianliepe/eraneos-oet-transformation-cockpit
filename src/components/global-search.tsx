"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PmoDocument } from "@/lib/pmo-schema";
import { Icons } from "./icons";

type SearchView = "plan" | "risks" | "registers" | "meetings" | "activity";
type SearchItem = { id: string; title: string; detail: string; kind: string; view: SearchView };
const STORAGE_KEY = "transformation-cockpit:saved-searches";

function searchable(data: PmoDocument): SearchItem[] {
  return [
    ...data.deliverables.map((item) => ({ id: item.id, title: item.title, detail: `${item.owner} · ${item.status}`, kind: "Deliverable", view: "plan" as const })),
    ...data.risks.map((item) => ({ id: item.id, title: item.title, detail: `${item.owner} · ${item.state}`, kind: "Risk", view: "risks" as const })),
    ...data.issues.map((item) => ({ id: item.id, title: item.title, detail: `${item.owner} · ${item.status}`, kind: "Issue", view: "registers" as const })),
    ...data.actions.map((item) => ({ id: item.id, title: item.title, detail: `${item.owner} · ${item.status}`, kind: "Action", view: "registers" as const })),
    ...data.decisions.map((item) => ({ id: item.id, title: item.title, detail: `${item.owner} · ${item.status}`, kind: "Decision", view: "registers" as const })),
    ...data.dependencies.map((item) => ({ id: item.id, title: item.title, detail: `${item.owner} · ${item.status}`, kind: "Dependency", view: "registers" as const })),
    ...data.assumptions.map((item) => ({ id: item.id, title: item.title, detail: `${item.owner} · ${item.status}`, kind: "Assumption", view: "registers" as const })),
    ...data.changeRequests.map((item) => ({ id: item.id, title: item.title, detail: `${item.owner} · ${item.status}`, kind: "Change request", view: "registers" as const })),
    ...data.meetings.map((item) => ({ id: item.id, title: item.title, detail: `${item.date} · ${item.type}`, kind: "Meeting", view: "meetings" as const })),
  ];
}

export function GlobalSearch({ data, value, onChange, onNavigate }: {
  data: PmoDocument;
  value: string;
  onChange: (value: string) => void;
  onNavigate: (view: SearchView, query: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  });
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try { setSaved(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")); } catch { setSaved([]); }
    });
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); input.current?.focus(); setOpen(true); }
      if (event.key === "Escape") { setOpen(false); input.current?.blur(); }
    };
    window.addEventListener("keydown", shortcut);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("keydown", shortcut); };
  }, []);
  const results = useMemo(() => {
    const needle = value.trim().toLowerCase();
    if (!needle) return [];
    return searchable(data).filter((item) => `${item.id} ${item.title} ${item.detail} ${item.kind}`.toLowerCase().includes(needle)).slice(0, 8);
  }, [data, value]);
  function saveFilter() {
    const query = value.trim();
    if (!query || saved.includes(query)) return;
    const next = [...saved, query].slice(-6);
    setSaved(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  function removeFilter(query: string) {
    const next = saved.filter((item) => item !== query);
    setSaved(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return <div className="global-search"><div className="search-box"><Icons.search/><input ref={input} role="combobox" aria-autocomplete="list" value={value} onFocus={() => setOpen(true)} onChange={(event) => { onChange(event.target.value); setOpen(true); }} placeholder="Search all project records..." aria-label="Search project" aria-expanded={open} aria-controls="global-search-results"/><kbd>Ctrl K</kbd></div>{open && <div className="search-popover" id="global-search-results"><header><span>{value.trim() ? `${results.length} matching records` : "Saved filters"}</span>{value.trim() && <button onClick={saveFilter}>Save filter</button>}</header>{value.trim() ? <div role="listbox" aria-label="Project search results">{results.map((item) => <button role="option" aria-selected="false" key={`${item.kind}:${item.id}`} onClick={() => { onNavigate(item.view, item.title); setOpen(false); }}><span>{item.kind}</span><b>{item.title}</b><small>{item.id} · {item.detail}</small></button>)}{results.length === 0 && <p>No governed project records match “{value}”.</p>}</div> : <div className="saved-searches">{saved.map((query) => <span key={query}><button onClick={() => { onChange(query); setOpen(true); }}>{query}</button><button aria-label={`Remove saved filter ${query}`} onClick={() => removeFilter(query)}>×</button></span>)}{saved.length === 0 && <p>Press Ctrl K anywhere, then search by title, ID, owner, status or record type.</p>}</div>}<footer><button onClick={() => { onChange(""); setOpen(false); }}>Clear and close</button></footer></div>}</div>;
}
