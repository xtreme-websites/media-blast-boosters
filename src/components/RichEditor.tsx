import { useRef, useEffect, useImperativeHandle, forwardRef } from "react";

export interface RichEditorHandle {
  getHTML: () => string;
  setHTML: (html: string) => void;
}

interface Props {
  initialHTML: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  minHeight?: string;
  style?: React.CSSProperties;
}

// Toolbar using document.execCommand (deprecated but universally supported in contentEditable)
function Toolbar({ editorRef }: { editorRef: React.RefObject<HTMLDivElement> }) {
  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
  };

  const btns: { label: string; title: string; cmd: string; val?: string }[] = [
    { label: "B",  title: "Bold",          cmd: "bold" },
    { label: "I",  title: "Italic",        cmd: "italic" },
    { label: "H1", title: "Heading 1",     cmd: "formatBlock", val: "h1" },
    { label: "H2", title: "Heading 2",     cmd: "formatBlock", val: "h2" },
    { label: "¶",  title: "Paragraph",     cmd: "formatBlock", val: "p" },
    { label: "•",  title: "Bullet list",   cmd: "insertUnorderedList" },
    { label: "✕",  title: "Clear format",  cmd: "removeFormat" },
  ];

  const DIVIDERS = [2, 5]; // insert divider before these indices

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: ".25rem",
      padding: ".45rem .65rem", background: "#f1f5f9",
      borderRadius: ".55rem .55rem 0 0",
      border: "1px solid #c7d2fe", borderBottom: "none",
      flexWrap: "wrap",
    }}>
      {btns.map((b, i) => (
        <>
          {DIVIDERS.includes(i) && (
            <div key={`div${i}`} style={{ width: 1, height: 18, background: "#d1d5db", margin: "0 .2rem" }} />
          )}
          <button
            key={b.cmd + (b.val || "")}
            title={b.title}
            onMouseDown={e => { e.preventDefault(); exec(b.cmd, b.val); }}
            style={{
              padding: ".25rem .5rem", minWidth: 28, border: "1px solid #e2e8f0",
              borderRadius: ".3rem", background: "white", cursor: "pointer",
              fontSize: b.label.length > 1 ? ".72rem" : ".82rem",
              fontWeight: b.label === "B" ? 800 : b.label === "I" ? 600 : 700,
              fontStyle: b.label === "I" ? "italic" : "normal",
              color: "#374151", lineHeight: 1,
            }}
            onMouseOver={e => (e.currentTarget.style.background = "#eef2ff")}
            onMouseOut={e => (e.currentTarget.style.background = "white")}
          >
            {b.label}
          </button>
        </>
      ))}
    </div>
  );
}

const RichEditor = forwardRef<RichEditorHandle, Props>(
  ({ initialHTML, onChange, readOnly, minHeight = "200px", style }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const isTypingRef = useRef(false); // prevent React overwriting content while user types

    // Expose getHTML / setHTML via ref
    useImperativeHandle(ref, () => ({
      getHTML: () => editorRef.current?.innerHTML || "",
      setHTML: (html: string) => {
        if (editorRef.current) editorRef.current.innerHTML = html;
      },
    }));

    // Set initial content imperatively — bypasses React's render cycle entirely
    useEffect(() => {
      if (editorRef.current && !isTypingRef.current) {
        editorRef.current.innerHTML = initialHTML || "";
      }
    // Only re-run when initialHTML changes from outside (new generation / new draft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialHTML]);

    return (
      <div>
        {!readOnly && <Toolbar editorRef={editorRef} />}
        <div
          ref={editorRef}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onFocus={() => { isTypingRef.current = true; }}
          onBlur={() => {
            isTypingRef.current = false;
            onChange(editorRef.current?.innerHTML || "");
          }}
          onInput={() => {
            // Sync state without triggering a React DOM reconciliation of this element
            onChange(editorRef.current?.innerHTML || "");
          }}
          style={{
            padding: "1.25rem 1.5rem",
            background: readOnly ? "#f8fafc" : "white",
            borderRadius: readOnly ? ".6rem" : "0 0 .55rem .55rem",
            border: `1px solid ${readOnly ? "#e2e8f0" : "#c7d2fe"}`,
            outline: "none",
            cursor: readOnly ? "default" : "text",
            lineHeight: 1.75,
            color: "#1e293b",
            fontSize: "0.875rem",
            minHeight,
            ...style,
          }}
        />
        <style>{`
          [contenteditable] h1 { font-size:1.4rem; font-weight:800; color:#0f172a; margin:0 0 1rem; line-height:1.25; }
          [contenteditable] h2 { font-size:1rem; font-weight:700; color:#1e293b; margin:1.25rem 0 .35rem; }
          [contenteditable] p  { margin:0 0 .85rem; line-height:1.75; }
          [contenteditable] em { font-style:italic; }
          [contenteditable] strong { font-weight:700; }
          [contenteditable] a  { color:#6366f1; text-decoration:underline; }
          [contenteditable] ul { margin:0 0 .85rem; padding-left:1.5rem; }
          [contenteditable] li { margin-bottom:.25rem; }
        `}</style>
      </div>
    );
  }
);

RichEditor.displayName = "RichEditor";
export default RichEditor;
