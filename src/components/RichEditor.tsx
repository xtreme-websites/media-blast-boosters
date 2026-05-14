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

// ── Shared toolbar — exported so parent layouts can pin it above scroll areas ──
export function RichToolbar({ editorRef }: { editorRef: React.RefObject<HTMLDivElement> }) {
  const exec = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
  };

  const SEP = <div style={{ width:1, height:18, background:"#d1d5db", margin:"0 .2rem", flexShrink:0 }}/>;

  const btn = (label: string, title: string, cmd: string, val?: string) => (
    <button
      key={cmd+(val||"")}
      title={title}
      onMouseDown={e => { e.preventDefault(); exec(cmd, val); }}
      style={{
        padding:".25rem .5rem", minWidth:28, border:"1px solid #e2e8f0",
        borderRadius:".3rem", background:"white", cursor:"pointer",
        fontSize: label.length > 1 ? ".72rem" : ".82rem",
        fontWeight: label==="B" ? 800 : label==="I" ? 600 : 700,
        fontStyle: label==="I" ? "italic" : "normal",
        color:"#374151", lineHeight:1,
      }}
      onMouseOver={e => (e.currentTarget.style.background="#eef2ff")}
      onMouseOut={e => (e.currentTarget.style.background="white")}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display:"flex", alignItems:"center", gap:".25rem", flexWrap:"wrap" }}>
      {btn("B","Bold","bold")}
      {btn("I","Italic","italic")}
      {SEP}
      {btn("H1","Heading 1","formatBlock","h1")}
      {btn("H2","Heading 2","formatBlock","h2")}
      {btn("¶","Paragraph","formatBlock","p")}
      {SEP}
      {btn("•","Bullet list","insertUnorderedList")}
      {btn("✕","Clear format","removeFormat")}
    </div>
  );
}

// ── Self-contained editor (toolbar + content, no scroll concerns) ─────────────
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
