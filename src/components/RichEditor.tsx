import { useRef, useEffect, useImperativeHandle, forwardRef } from "react";

export interface RichEditorHandle {
  getHTML: () => string;
  setHTML: (html: string) => void;
}

interface Props {
  initialHTML: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  noBorder?: boolean;
  minHeight?: string;
  style?: React.CSSProperties;
}

// ── SVG Icons ────────────────────────────────────────────────────────────────

const ULIcon = () => (
  <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor" style={{ display:"block" }}>
    <circle cx="1.5" cy="1.5" r="1.5"/>
    <rect x="4.5" y="0.4" width="9.5" height="2.2" rx="0.8"/>
    <circle cx="1.5" cy="6" r="1.5"/>
    <rect x="4.5" y="4.9" width="9.5" height="2.2" rx="0.8"/>
    <circle cx="1.5" cy="10.5" r="1.5"/>
    <rect x="4.5" y="9.4" width="9.5" height="2.2" rx="0.8"/>
  </svg>
);

const OLIcon = () => (
  <svg width="15" height="12" viewBox="0 0 15 12" fill="currentColor" style={{ display:"block" }}>
    {/* 1. */}
    <text x="0" y="3" fontSize="3.8" fontFamily="system-ui,sans-serif" fontWeight="700">1</text>
    <text x="2.2" y="3" fontSize="3.8" fontFamily="system-ui,sans-serif">.</text>
    <rect x="5" y="0.4" width="10" height="2.2" rx="0.8"/>
    {/* 2. */}
    <text x="0" y="7.5" fontSize="3.8" fontFamily="system-ui,sans-serif" fontWeight="700">2</text>
    <text x="2.2" y="7.5" fontSize="3.8" fontFamily="system-ui,sans-serif">.</text>
    <rect x="5" y="4.9" width="10" height="2.2" rx="0.8"/>
    {/* 3. */}
    <text x="0" y="12" fontSize="3.8" fontFamily="system-ui,sans-serif" fontWeight="700">3</text>
    <text x="2.2" y="12" fontSize="3.8" fontFamily="system-ui,sans-serif">.</text>
    <rect x="5" y="9.4" width="10" height="2.2" rx="0.8"/>
  </svg>
);

const LinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display:"block" }}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);

// ── Shared toolbar ────────────────────────────────────────────────────────────
export function RichToolbar({ editorRef }: { editorRef: React.RefObject<HTMLDivElement> }) {
  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
  };

  const SEP = <div key="sep" style={{ width:1, height:18, background:"#d1d5db", margin:"0 .15rem", flexShrink:0 }}/>;

  const btnStyle: React.CSSProperties = {
    padding:".25rem .4rem", minWidth:26, border:"1px solid #e2e8f0",
    borderRadius:".3rem", background:"white", cursor:"pointer",
    color:"#374151", lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center",
  };

  const btn = (label: string, title: string, cmd: string, val?: string, icon?: React.ReactNode) => (
    <button
      key={cmd+(val||"")}
      title={title}
      onMouseDown={e => { e.preventDefault(); exec(cmd, val); }}
      style={{
        ...btnStyle,
        fontSize: label.length > 1 ? ".72rem" : ".82rem",
        fontWeight: label === "B" ? 800 : label === "I" ? 600 : 700,
        fontStyle: label === "I" ? "italic" : "normal",
      }}
      onMouseOver={e => (e.currentTarget.style.background="#eef2ff")}
      onMouseOut={e => (e.currentTarget.style.background="white")}
    >
      {icon ?? label}
    </button>
  );

  const insertLink = () => {
    editorRef.current?.focus();
    const url = window.prompt("Enter URL:", "https://");
    if (url && url !== "https://") {
      document.execCommand("createLink", false, url);
      // Make sure the link opens in a new tab
      const links = editorRef.current?.querySelectorAll("a:not([target])");
      links?.forEach(a => { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer"); });
    }
  };

  return (
    <div style={{ display:"flex", alignItems:"center", gap:".2rem", flexWrap:"wrap" }}>
      {btn("B", "Bold", "bold")}
      {btn("I", "Italic", "italic")}
      {SEP}
      {btn("H1", "Heading 1", "formatBlock", "h1")}
      {btn("H2", "Heading 2", "formatBlock", "h2")}
      {btn("¶",  "Paragraph", "formatBlock", "p")}
      {SEP}
      {btn("ul", "Bullet list",    "insertUnorderedList", undefined, <ULIcon/>)}
      {btn("ol", "Numbered list",  "insertOrderedList",   undefined, <OLIcon/>)}
      {SEP}
      <button
        key="link"
        title="Insert link"
        onMouseDown={e => { e.preventDefault(); insertLink(); }}
        style={btnStyle}
        onMouseOver={e => (e.currentTarget.style.background="#eef2ff")}
        onMouseOut={e => (e.currentTarget.style.background="white")}
      >
        <LinkIcon/>
      </button>
      {btn("✕", "Clear format", "removeFormat")}
    </div>
  );
}

// ── Self-contained editor ─────────────────────────────────────────────────────
const RichEditor = forwardRef<RichEditorHandle, Props>(
  ({ initialHTML, onChange, readOnly, noBorder, minHeight="200px", style }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const isTypingRef = useRef(false);

    useImperativeHandle(ref, () => ({
      getHTML: () => editorRef.current?.innerHTML || "",
      setHTML: (html: string) => { if (editorRef.current) editorRef.current.innerHTML = html; },
    }));

    useEffect(() => {
      if (!isTypingRef.current && editorRef.current) {
        editorRef.current.innerHTML = initialHTML || "";
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialHTML]);

    const toolbarStyle = noBorder
      ? { padding:".45rem .75rem", background:"#f8fafc", borderBottom:"1px solid #e2e8f0" }
      : { padding:".45rem .65rem", background:"#f1f5f9", borderRadius:".55rem .55rem 0 0", border:"1px solid #c7d2fe", borderBottom:"none" };

    const editorStyle = {
      padding:"1.25rem 1.5rem",
      background: readOnly ? "#f8fafc" : "white",
      borderRadius: noBorder ? "0" : (readOnly ? ".6rem" : "0 0 .55rem .55rem"),
      border: noBorder ? "none" : `1px solid ${readOnly ? "#e2e8f0" : "#c7d2fe"}`,
      outline:"none",
      cursor: readOnly ? "default" : "text",
      lineHeight: 1.75,
      color:"#1e293b",
      fontSize:"0.875rem",
      minHeight,
      ...style,
    };

    return (
      <div>
        {!readOnly && (
          <div style={toolbarStyle}>
            <RichToolbar editorRef={editorRef} />
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onFocus={() => { isTypingRef.current = true; }}
          onBlur={() => { isTypingRef.current = false; onChange(editorRef.current?.innerHTML || ""); }}
          onInput={() => { onChange(editorRef.current?.innerHTML || ""); }}
          style={editorStyle}
        />
        <style>{`
          [contenteditable] h1     { font-size:1.4rem; font-weight:800; color:#0f172a; margin:0 0 1rem; line-height:1.25; }
          [contenteditable] h2     { font-size:1rem; font-weight:700; color:#1e293b; margin:1.25rem 0 .35rem; }
          [contenteditable] p      { margin:0 0 .85rem; line-height:1.75; }
          [contenteditable] em     { font-style:italic; }
          [contenteditable] strong { font-weight:700; }
          [contenteditable] a      { color:#6366f1; text-decoration:underline; }
          [contenteditable] ul     { list-style-type:disc !important; margin:0 0 .85rem; padding-left:1.5rem; }
          [contenteditable] ol     { list-style-type:decimal !important; margin:0 0 .85rem; padding-left:1.5rem; }
          [contenteditable] li     { display:list-item !important; margin-bottom:.25rem; }
        `}</style>
      </div>
    );
  }
);

RichEditor.displayName = "RichEditor";
export default RichEditor;
