"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SignOutButton } from "@clerk/nextjs";
import {
  Archive, BookOpen, Check, ChevronDown, ChevronRight, CircleHelp,
  FileText, GripVertical, Heading1, Heading2, List, LoaderCircle,
  Menu, MoreHorizontal, PanelLeftClose, Plus, Quote, Search, Star,
  Text, Trash2, X, Code2, SquareCheck, LogOut, Download, Moon, Sun, Smartphone,
} from "lucide-react";
import type { Block, BlockType, Page } from "../lib/workspace-db";
import { usePWA } from "../lib/use-pwa";
import { InstallModal } from "./install-modal";

type Snapshot = { pages: Page[]; blocks: Block[] };
type Action = Record<string, unknown> & { action: string };
type SaveState = "saved" | "saving" | "error";

const blockOptions: Array<{ type: BlockType; label: string; icon: typeof Text }> = [
  { type: "paragraph", label: "Text", icon: Text },
  { type: "heading1", label: "Heading 1", icon: Heading1 },
  { type: "heading2", label: "Heading 2", icon: Heading2 },
  { type: "bullet", label: "Bulleted list", icon: List },
  { type: "todo", label: "To-do", icon: SquareCheck },
  { type: "quote", label: "Quote", icon: Quote },
  { type: "code", label: "Code", icon: Code2 },
];
const icons = ["📄", "✦", "💡", "📚", "🌱", "📝", "🎯", "🗂️", "✨"];

async function apiAction<T>(input: Action): Promise<T> {
  const response = await fetch("/api/workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "Could not save changes");
  return result;
}

function relativeTime(iso: string) {
  const elapsed = Date.now() - new Date(iso).getTime();
  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} hr ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function WorkspaceApp({ userName }: { userName: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [typeMenu, setTypeMenu] = useState<string | null>(null);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pending = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const blockRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const searchRef = useRef<HTMLInputElement>(null);
  const { platform, isMobile, isStandalone, canInstallNative, promptInstall } = usePWA();
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("fieldnotes-pwa-banner-dismissed") === "true";
    } catch {
      return false;
    }
  });

  const showMobileBanner = isMobile && !isStandalone && !bannerDismissed;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      try { if (window.localStorage.getItem("fieldnotes-theme")) return; } catch { return; }
      const next = media.matches ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      setTheme(next);
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try { window.localStorage.setItem("fieldnotes-theme", next); } catch { /* Theme still changes for this visit. */ }
  }

  useEffect(() => {
    let mounted = true;
    fetch("/api/workspace", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as Snapshot & { error?: string };
        if (!response.ok) throw new Error(data.error || "Unable to load workspace");
        return data;
      })
      .then((data) => {
        if (!mounted) return;
        setSnapshot(data);
        const savedId = window.localStorage.getItem("fieldnotes-active-page");
        setActivePageId(data.pages.find((page) => page.id === savedId)?.id || data.pages[0]?.id || null);
      })
      .catch((cause) => mounted && setError(cause instanceof Error ? cause.message : "Unable to load workspace"))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (activePageId) window.localStorage.setItem("fieldnotes-active-page", activePageId);
  }, [activePageId]);

  const markError = useCallback((cause: unknown) => {
    setSaveState("error");
    setError(cause instanceof Error ? cause.message : "Your changes could not be saved");
  }, []);

  const queueSave = useCallback((key: string, action: Action) => {
    const existing = pending.current.get(key);
    if (existing) clearTimeout(existing);
    setSaveState("saving");
    pending.current.set(key, setTimeout(async () => {
      pending.current.delete(key);
      try {
        await apiAction(action);
        if (pending.current.size === 0) setSaveState("saved");
      } catch (cause) { markError(cause); }
    }, 650));
  }, [markError]);

  const page = snapshot?.pages.find((item) => item.id === activePageId) ?? null;
  const blocks = useMemo(
    () => snapshot?.blocks.filter((block) => block.pageId === activePageId).sort((a, b) => a.position - b.position) ?? [],
    [snapshot, activePageId],
  );
  const filteredPages = useMemo(() => {
    if (!snapshot) return [];
    const term = query.trim().toLocaleLowerCase();
    if (!term) return snapshot.pages;
    return snapshot.pages.filter((item) =>
      item.title.toLocaleLowerCase().includes(term) ||
      snapshot.blocks.some((block) => block.pageId === item.id && block.text.toLocaleLowerCase().includes(term)),
    );
  }, [snapshot, query]);

  async function createPage() {
    try {
      setSaveState("saving");
      const created = await apiAction<{ page: Page; block: Block }>({ action: "createPage" });
      setSnapshot((current) => current && ({ pages: [created.page, ...current.pages], blocks: [...current.blocks, created.block] }));
      setActivePageId(created.page.id);
      setSidebarOpen(false);
      setSaveState("saved");
      setError(null);
    } catch (cause) { markError(cause); }
  }

  function renamePage(title: string) {
    if (!page) return;
    setSnapshot((current) => current && ({ ...current, pages: current.pages.map((item) => item.id === page.id ? { ...item, title } : item) }));
    queueSave(`page:${page.id}:title`, { action: "updatePage", pageId: page.id, title });
  }

  async function updatePageField(input: { icon?: string; favorite?: boolean }) {
    if (!page) return;
    const pageId = page.id;
    setSnapshot((current) => current && ({ ...current, pages: current.pages.map((item) => item.id === pageId ? { ...item, ...input } : item) }));
    try { await apiAction({ action: "updatePage", pageId, ...input }); }
    catch (cause) { markError(cause); }
  }

  async function archivePage() {
    if (!page || !window.confirm(`Move “${page.title || "Untitled"}” to archive?`)) return;
    try {
      await apiAction({ action: "archivePage", pageId: page.id });
      const remaining = snapshot?.pages.filter((item) => item.id !== page.id) ?? [];
      setSnapshot((current) => current && ({ pages: remaining, blocks: current.blocks.filter((block) => block.pageId !== page.id) }));
      setActivePageId(remaining[0]?.id ?? null);
      setPageMenuOpen(false);
    } catch (cause) { markError(cause); }
  }

  function updateBlockLocal(blockId: string, patch: Partial<Block>, persist = true) {
    setSnapshot((current) => current && ({ ...current, blocks: current.blocks.map((block) => block.id === blockId ? { ...block, ...patch } : block) }));
    if (persist) queueSave(`block:${blockId}`, { action: "updateBlock", blockId, ...patch });
  }

  async function createBlock(afterId: string | null, text = "", type: BlockType = "paragraph") {
    if (!page) return;
    try {
      const created = await apiAction<{ block: Block }>({ action: "createBlock", pageId: page.id, afterId, text, type });
      setSnapshot((current) => current && ({ ...current, blocks: [...current.blocks, created.block] }));
      requestAnimationFrame(() => blockRefs.current.get(created.block.id)?.focus());
    } catch (cause) { markError(cause); }
  }

  async function deleteBlock(blockId: string, focusId?: string) {
    if (blocks.length <= 1) return;
    try {
      await apiAction({ action: "deleteBlock", blockId });
      setSnapshot((current) => current && ({ ...current, blocks: current.blocks.filter((block) => block.id !== blockId) }));
      if (focusId) requestAnimationFrame(() => blockRefs.current.get(focusId)?.focus());
    } catch (cause) { markError(cause); }
  }

  function onBlockKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>, block: Block, index: number) {
    if (event.key === "Enter" && !event.shiftKey && block.type !== "code") {
      event.preventDefault();
      const textarea = event.currentTarget;
      const before = block.text.slice(0, textarea.selectionStart);
      const after = block.text.slice(textarea.selectionEnd);
      if (before !== block.text) updateBlockLocal(block.id, { text: before });
      void createBlock(block.id, after);
    } else if (event.key === "Backspace" && block.text === "" && index > 0) {
      event.preventDefault();
      void deleteBlock(block.id, blocks[index - 1].id);
    } else if (event.key === "Escape") {
      setTypeMenu(null);
    }
  }

  return (
    <div className="workspace-shell">
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-head"><div className="brand-mark">f<span>.</span></div><div className="brand-name">fieldnotes <span>workspace</span></div><button className="icon-button sidebar-close" title="Close sidebar" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)}><PanelLeftClose size={18} /></button></div>
        <div className="workspace-person"><div className="avatar">{userName.slice(0, 1).toUpperCase()}</div><div><strong>{userName.split("@")[0]}</strong><span>Personal workspace</span></div><ChevronDown size={14} className="muted-icon" /></div>
        <div className="sidebar-actions"><label className="search-box"><Search size={17} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search pages" aria-label="Search pages" />{query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button>}</label><button className="new-page" onClick={createPage}><Plus size={17} /> New page <span>＋</span></button></div>
        <nav className="page-nav" aria-label="Pages">
          {!query && snapshot?.pages.some((item) => item.favorite) && <><div className="section-label">Favorites</div>{snapshot.pages.filter((item) => item.favorite).map((item) => <PageLink key={`fav-${item.id}`} page={item} active={item.id === activePageId} onClick={() => { setActivePageId(item.id); setSidebarOpen(false); }} />)}</>}
          <div className="section-label section-label-pages"><span>{query ? "Search results" : "Private pages"}</span><button aria-label="Add page" title="Add page" onClick={createPage}><Plus size={15} /></button></div>
          {filteredPages.map((item) => <PageLink key={item.id} page={item} active={item.id === activePageId} onClick={() => { setActivePageId(item.id); setSidebarOpen(false); }} />)}
          {filteredPages.length === 0 && <p className="no-pages">{query ? "No matching pages" : "Your pages will appear here"}</p>}
        </nav>
        <div className="sidebar-footer"><div className="help-note"><CircleHelp size={17} /><span>Made for thinking out loud.</span></div><button type="button" className="download-app" onClick={() => setInstallModalOpen(true)}><Download size={16} /> {isMobile ? "Install on phone" : "Get the app (iOS, Android, Mac)"}</button><SignOutButton redirectUrl="/sign-in"><button type="button" className="sign-out"><LogOut size={16} /> Sign out</button></SignOutButton></div>
      </aside>

      <main className="main-panel">
        {showMobileBanner && (
          <aside className="mobile-install-banner" aria-label="Install app banner">
            <div className="mobile-install-info">
              <Smartphone size={16} className="mobile-install-icon" />
              <span>Use Fieldnotes as a full-screen app on your phone</span>
            </div>
            <div className="mobile-install-actions">
              <button
                type="button"
                className="mobile-install-btn"
                onClick={() => {
                  if (platform === "android" && canInstallNative) {
                    void promptInstall();
                  } else {
                    setInstallModalOpen(true);
                  }
                }}
              >
                {platform === "android" && canInstallNative ? "Install" : "Get App"}
              </button>
              <button
                type="button"
                className="mobile-install-close"
                aria-label="Dismiss banner"
                onClick={() => {
                  setBannerDismissed(true);
                  try { window.localStorage.setItem("fieldnotes-pwa-banner-dismissed", "true"); } catch {}
                }}
              >
                <X size={15} />
              </button>
            </div>
          </aside>
        )}
        <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open sidebar" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button><span className="breadcrumb-workspace">My workspace</span><ChevronRight size={15} className="breadcrumb-arrow" /><span className="breadcrumb-current">{page?.title || "Untitled"}</span></div><div className="topbar-actions"><div className={`save-indicator ${saveState}`}>{saveState === "saving" ? <LoaderCircle size={14} className="spin" /> : saveState === "saved" ? <Check size={14} /> : <X size={14} />}{saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : "Not saved"}</div><button className="icon-button top-search" aria-label="Search" title="Search" onClick={() => { setSidebarOpen(true); setTimeout(() => searchRef.current?.focus(), 40); }}><Search size={18} /></button><button className="icon-button theme-toggle" type="button" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Light mode" : "Dark mode"} aria-pressed={theme === "dark"} onClick={toggleTheme}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>{page && <button className={`icon-button ${page.favorite ? "is-favorite" : ""}`} aria-label={page.favorite ? "Remove favorite" : "Add favorite"} title={page.favorite ? "Remove favorite" : "Add favorite"} onClick={() => updatePageField({ favorite: !page.favorite })}><Star size={18} fill={page.favorite ? "currentColor" : "none"} /></button>}<div className="page-menu-wrap"><button className="icon-button" title="Page options" aria-label="Page options" onClick={() => setPageMenuOpen((open) => !open)}><MoreHorizontal size={20} /></button>{pageMenuOpen && page && <div className="page-menu"><button onClick={archivePage}><Archive size={16} /> Move to archive</button></div>}</div></div></header>
        {error && <div className="error-banner" role="alert"><span>{error === "storage_unconfigured" ? "Turso storage is being connected. Editing will be available once configuration is complete." : error === "storage_unavailable" ? "The database is unavailable right now. Please try again shortly." : error}</span><button aria-label="Dismiss error" onClick={() => setError(null)}><X size={16} /></button></div>}
        {loading ? <div className="loading-panel"><LoaderCircle size={24} className="spin" /><span>Opening your workspace...</span></div> : page ? <div className="document-wrap"><div className="document-content">
          <div className="document-eyebrow"><BookOpen size={14} /> PRIVATE PAGE <span>·</span> Edited {relativeTime(page.updatedAt)}</div>
          <div className="page-icon-wrap"><button className="page-icon" title="Change page icon" aria-label="Change page icon" onClick={() => { const index = icons.indexOf(page.icon); void updatePageField({ icon: icons[(index + 1) % icons.length] }); }}>{page.icon}</button><span>Click to change icon</span></div>
          <input className="page-title-input" value={page.title === "Untitled" ? "" : page.title} onChange={(event) => renamePage(event.target.value)} placeholder="Untitled" aria-label="Page title" maxLength={200} />
          <div className="document-divider" />
          <div className="blocks" aria-label="Page blocks">{blocks.map((block, index) => <div key={block.id} className={`block-row block-${block.type}`}>
            <div className="block-controls"><button className="block-add" aria-label="Add block" title="Add block" onClick={() => createBlock(block.id)}><Plus size={16} /></button><button className="block-grip" aria-label="Block type" title="Block type" onClick={() => setTypeMenu(typeMenu === block.id ? null : block.id)}><GripVertical size={16} /></button></div>
            {block.type === "todo" && <input className="todo-check" type="checkbox" checked={block.checked} onChange={(event) => updateBlockLocal(block.id, { checked: event.target.checked })} aria-label="Mark to-do complete" />}
            {block.type === "bullet" && <span className="bullet-dot" aria-hidden="true">•</span>}
            <textarea ref={(element) => { if (element) blockRefs.current.set(block.id, element); else blockRefs.current.delete(block.id); }} rows={1} value={block.text} onChange={(event) => { updateBlockLocal(block.id, { text: event.target.value }); event.target.style.height = "auto"; event.target.style.height = `${event.target.scrollHeight}px`; }} onKeyDown={(event) => onBlockKeyDown(event, block, index)} onFocus={(event) => { event.currentTarget.style.height = "auto"; event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`; }} placeholder={index === 0 ? "Start writing, or use + to add a block..." : block.type === "todo" ? "To-do" : "Type something..."} className={block.checked ? "block-checked" : ""} aria-label={`${block.type} block`} />
            {typeMenu === block.id && <div className="block-menu"><div className="block-menu-title">Turn into</div>{blockOptions.map((option) => <button key={option.type} className={option.type === block.type ? "selected" : ""} onClick={() => { updateBlockLocal(block.id, { type: option.type }); setTypeMenu(null); }}><option.icon size={16} /> {option.label}</button>)}<div className="block-menu-separator" /><button className="danger-option" onClick={() => { void deleteBlock(block.id, blocks[Math.max(0, index - 1)]?.id); setTypeMenu(null); }}><Trash2 size={16} /> Delete block</button></div>}
          </div>)}</div>
          <button className="append-block" onClick={() => createBlock(blocks.at(-1)?.id ?? null)}><Plus size={15} /> Add a block</button>
          <div className="editor-hint">Press <kbd>Enter</kbd> for a new block · <kbd>Shift</kbd> + <kbd>Enter</kbd> for a line break</div>
        </div></div> : <div className="empty-document"><div className="empty-glyph"><FileText size={28} /></div><h1>Your workspace is ready</h1><p>Create a page to start collecting ideas, plans, and notes.</p><button onClick={createPage}><Plus size={17} /> Create a page</button></div>}
      </main>
      <InstallModal isOpen={installModalOpen} onClose={() => setInstallModalOpen(false)} />
    </div>
  );
}

function PageLink({ page, active, onClick }: { page: Page; active: boolean; onClick: () => void }) {
  return <button className={`page-link ${active ? "active" : ""}`} onClick={onClick}><span className="page-link-icon">{page.icon}</span><span className="page-link-name">{page.title || "Untitled"}</span>{active && <ChevronRight size={14} className="page-link-chevron" />}</button>;
}
