import { useState, useEffect } from "react";

// Simple word-level diff for PR content comparison
// Block-level HTML-aware diff — preserves h1/h2/p/bold/italic/links
function buildDiffHtml(original: string, modified: string): string {
  // Extract block-level HTML elements preserving full tags
  const getBlocks = (html: string): string[] => {
    const blocks: string[] = [];
    const re = /<(h[1-6]|p|div|blockquote|ul|ol)[^>]*>[\s\S]*?<\/\1>/gi;
    let match;
    while ((match = re.exec(html)) !== null) blocks.push(match[0]);
    return blocks.length > 0 ? blocks : [html];
  };
  // Compare blocks by plain text content
  const textOf = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const oB = getBlocks(original), mB = getBlocks(modified);
  const oT = oB.map(textOf), mT = mB.map(textOf);
  const m = oB.length, n = mB.length;

  // LCS table
  const dp = Array.from({length: m+1}, () => new Array(n+1).fill(0));
  for (let i = m-1; i >= 0; i--)
    for (let j = n-1; j >= 0; j--)
      dp[i][j] = oT[i] === mT[j] ? 1+dp[i+1][j+1] : Math.max(dp[i+1][j], dp[i][j+1]);

  const parts: string[] = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && oT[i] === mT[j]) {
      parts.push(mB[j]); i++; j++; // unchanged — full HTML preserved
    } else if (j < n && (i >= m || dp[i][j+1] >= dp[i+1][j])) {
      parts.push(`<div style="background:#f0fdf4;border-left:4px solid #22c55e;padding-left:.6rem;margin:.3rem 0">${mB[j]}</div>`); j++;
    } else {
      parts.push(`<div style="background:#fef2f2;border-left:4px solid #ef4444;padding-left:.6rem;margin:.3rem 0;opacity:.65">${oB[i]}</div>`); i++;
    }
  }
  return `<div>${parts.join("")}</div>`;
}
import { createPortal } from "react-dom";
import { XIcon } from "../icons";
import { Order, OrderStatus } from "../../lib/constants";

interface Props {
  orders: Order[];
  locationId: string;
  onLoadDraft?: (order: Order) => void;
  onDeleteDraft?: (order: Order) => void;
  onApproveAndSubmit?: (order: Order) => void;
  preOpenDraftId?: string | null;
}

const STATUS_CONFIG: Record<string, { label:string; color:string; bg:string }> = {
  reviewing:      { label:"In Review",       color:"#1d4ed8", bg:"#dbeafe" },
  published:      { label:"Published",       color:"#7c3aed", bg:"#ede9fe" },
  rejected:       { label:"Revision Needed", color:"#991b1b", bg:"#fee2e2" },
  rejected:       { label:"Revision Needed", color:"#991b1b", bg:"#fee2e2" },
  submitted:      { label:"Submitted",       color:"#065f46", bg:"#d1fae5" },
  draft:                { label:"Draft",             color:"#475569", bg:"#f1f5f9" },
  draft_pending_review: { label:"⏳ Pending Review",  color:"#92400e", bg:"#fef3c7", nowrap:true },
  scheduled:      { label:"Scheduled",       color:"#0369a1", bg:"#e0f2fe" },
};

const thStyle: React.CSSProperties = {
  padding:".65rem 1rem", fontSize:".7rem", fontWeight:700, color:"white",
  textTransform:"uppercase", letterSpacing:".06em", textAlign:"left",
  background:"transparent", borderBottom:"none",
  borderRight:"1px solid rgba(255,255,255,.15)", whiteSpace:"nowrap",
};
const thLast: React.CSSProperties = { ...thStyle, borderRight:"none" };
const td = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  padding:".85rem 1rem", borderBottom:"1px solid #f8fafc",
  borderRight:"1px solid #f1f5f9", verticalAlign:"middle", ...extra,
});
const tdLast = (extra: React.CSSProperties = {}): React.CSSProperties => ({ ...td(extra), borderRight:"none" });

function SeoFocusBadge({ seoFocus }: { seoFocus: string }) {
  if (!seoFocus) return <span style={{ fontSize:".72rem", color:"#94a3b8" }}>—</span>;
  const [type, ...rest] = seoFocus.split(":");
  const styles: Record<string,{color:string;bg:string;icon:string}> = {
    home:     { color:"#8929bd", bg:"#f5f3ff", icon:"🌐" },
    service:  { color:"#6366f1", bg:"#eef2ff", icon:"🔧" },
    location: { color:"#0ea5e9", bg:"#f0f9ff", icon:"📍" },
    own:      { color:"#64748b", bg:"#f8fafc",  icon:"✍️" },
  };
  const s = styles[type] || styles.own;
  let label = rest[rest.length - 1] || type;
  if (label.startsWith("http")) {
    const parts = label.split("/").filter(Boolean);
    label = parts[parts.length - 1]?.replace(/-/g," ") || type;
  }

  // Manual keywords (own type) — split by comma and render as stacked pills
  if (type === "own" && label.includes(",")) {
    const keywords = label.split(",").map(k => k.trim()).filter(Boolean);
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:".25rem", alignItems:"flex-start" }}>
        {keywords.map((kw, i) => (
          <span key={i} style={{ fontSize:".68rem", fontWeight:600, color:"#64748b", background:"#f1f5f9", padding:".15rem .5rem", borderRadius:"99px", display:"inline-flex", alignItems:"center", gap:".25rem", whiteSpace:"nowrap", border:"1px solid #e2e8f0" }}>
            ✍️ {kw}
          </span>
        ))}
      </div>
    );
  }

  return (
    <span style={{ fontSize:".68rem", fontWeight:700, color:s.color, background:s.bg, padding:".15rem .5rem", borderRadius:"99px", display:"inline-flex", alignItems:"center", gap:".25rem", whiteSpace:"nowrap" }}>
      {s.icon} {label}
    </span>
  );
}

export default function PublishedPress({ orders, onLoadDraft, onDeleteDraft, onApproveAndSubmit, preOpenDraftId }: Props) {
  const [activeTab, setActiveTab] = useState<"published"|"drafts">("published");
  const [articleModal, setArticleModal] = useState<Order | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  // Auto-open draft if coming from auto-generate
  useEffect(() => {
    if (!preOpenDraftId) return;
    setActiveTab("drafts");
    const order = orders.find(o => o.id === preOpenDraftId);
    if (order) setArticleModal(order);
  }, [preOpenDraftId, orders]);

  const published = orders.filter(o => !o.status || o.status === "submitted" || o.status === "published" || o.status === "rejected");
  const drafts    = orders.filter(o => o.status === "draft" || o.status === "scheduled" || o.status === "draft_pending_review");

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:"1.25rem" }}>
        <h2 style={{ fontWeight:800, fontSize:"1.2rem", color:"#1e293b", margin:0 }}>Published Press</h2>
        <p style={{ color:"#64748b", fontSize:".83rem", margin:".25rem 0 0" }}>Track and manage your press releases</p>
      </div>

      {/* Inner tabs */}
      <div style={{ display:"flex", gap:".25rem", background:"white", borderRadius:".75rem", padding:".35rem", marginBottom:"1.5rem", boxShadow:"0 1px 3px rgba(0,0,0,.06)", border:"1px solid #f1f5f9", width:"fit-content" }}>
        {[
          { id:"published" as const, label:"📰 Published Press", count: published.length },
          { id:"drafts"    as const, label:"📝 PR Drafts",        count: drafts.length },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding:".5rem 1.1rem", borderRadius:".5rem", border:"none", cursor:"pointer", fontWeight:600, fontSize:".82rem", transition:"all .15s",
            background: activeTab===t.id ? "linear-gradient(135deg,#8929bd,#4338ca)" : "transparent",
            color: activeTab===t.id ? "white" : "#64748b",
            boxShadow: activeTab===t.id ? "0 2px 8px rgba(137,41,189,.3)" : "none" }}>
            {t.label} {t.count > 0 && <span style={{ background: activeTab===t.id ? "rgba(255,255,255,.25)" : "#e2e8f0", borderRadius:"99px", padding:".05rem .4rem", fontSize:".7rem", marginLeft:".3rem" }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* PUBLISHED TAB */}
      {activeTab === "published" && (
        published.length === 0
          ? <EmptyState icon="📰" title="No press releases yet" desc="Submit your first press release from Media Creator"/>
          : <TableCard>
              <thead>
                <tr style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)"}}>
                  <th style={thStyle}>Package</th>
                  <th style={thStyle}>PR Title & Document</th>
                  <th style={thStyle}>SEO Focus</th>
                  <th style={thStyle}>Submitted</th>
                  <th style={thStyle}>Published</th>
                  <th style={thStyle}>Status</th>
                  <th style={thLast}>Report</th>
                </tr>
              </thead>
              <tbody>
                {published.map((order, i) => {
                  const sc = STATUS_CONFIG[order.status || "submitted"] || STATUS_CONFIG.submitted;
                  const submittedDt = new Date((order as any).submitted_at || order.date);
                  const publishedDt = (order as any).published_date ? new Date((order as any).published_date) : null;
                  const isLast = i === published.length - 1;
                  const c  = (e: React.CSSProperties={}) => td({...e, borderBottom: isLast?"none":"1px solid #f8fafc"});
                  const cl = (e: React.CSSProperties={}) => tdLast({...e, borderBottom: isLast?"none":"1px solid #f8fafc"});
                  return (
                    <tr key={order.id}>
                      <td style={c()}><PackageBadge name={order.productName}/></td>
                      <td style={c()}>
                        <button onClick={() => setArticleModal(order)} style={{ background:"none", border:"none", padding:0, cursor:"pointer", textAlign:"left", display:"flex", alignItems:"flex-start", gap:".4rem", color:"#1e293b" }}>
                          <span style={{ fontWeight:600, fontSize:".83rem", lineHeight:1.4 }}>{order.prTitle}</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0, marginTop:".15rem" }}>
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </button>
                      </td>
                      <td style={c()}><SeoFocusBadge seoFocus={(order as any).seo_focus || order.seoFocus || ""}/></td>
                      <td style={c()}><span style={{ fontSize:".72rem", color:"#94a3b8", whiteSpace:"nowrap" }}>{isNaN(submittedDt.getTime()) ? order.date : submittedDt.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span></td>
                      <td style={c()}><span style={{ fontSize:".72rem", color:"#94a3b8", whiteSpace:"nowrap" }}>{publishedDt ? publishedDt.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "—"}</span></td>
                      <td style={c()}><span style={{ fontSize:".72rem", fontWeight:700, color:sc.color, background:sc.bg, padding:".2rem .55rem", borderRadius:"99px", whiteSpace:"nowrap", display:"inline-block" }}>{sc.label}</span></td>
                      <td style={cl()}>
                        {(order as any).reportData || (order as any).report_data
                          ? <a href={`/report/${order.id}`} target="_blank" rel="noopener noreferrer" style={{ background:"#f5f3ff", color:"#8929bd", border:"1px solid #ddd6fe", borderRadius:".4rem", padding:".3rem .65rem", fontSize:".72rem", fontWeight:700, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:".2rem", whiteSpace:"nowrap" }}>See Report ↗</a>
                          : (order as any).report_link
                            ? <a href={(order as any).report_link} target="_blank" rel="noopener noreferrer" style={{ background:"#f0fdf4", color:"#16a34a", border:"1px solid #bbf7d0", borderRadius:".4rem", padding:".3rem .65rem", fontSize:".72rem", fontWeight:600, textDecoration:"none", display:"inline-block" }}>Report</a>
                            : <span style={{ fontSize:".72rem", color:"#94a3b8" }}>—</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableCard>
      )}

      {/* DRAFTS TAB */}
      {activeTab === "drafts" && (
        drafts.length === 0
          ? <EmptyState icon="📝" title="No drafts yet" desc="Save a draft or schedule a PR from Media Creator"/>
          : <TableCard>
              <thead>
                <tr style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)"}}>
                  <th style={thStyle}>Package</th>
                  <th style={thStyle}>PR Title</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Scheduled Date</th>
                  <th style={thStyle}>Last Edited</th>
                  <th style={thLast}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((order, i) => {
                  const sc = STATUS_CONFIG[order.status || "draft"];
                  const editedDt = new Date((order as any).last_edited_at || order.date);
                  const scheduledDt = order.scheduledDate || (order as any).scheduled_date ? new Date((order as any).scheduled_date || order.scheduledDate!) : null;
                  const isLast = i === drafts.length - 1;
                  const c  = (e: React.CSSProperties={}) => td({...e, borderBottom: isLast?"none":"1px solid #f8fafc", cursor:"pointer"});
                  const cl = (e: React.CSSProperties={}) => tdLast({...e, borderBottom: isLast?"none":"1px solid #f8fafc", cursor:"pointer"});
                  return (
                    <tr key={order.id} onClick={() => onLoadDraft?.(order)} style={{ cursor:"pointer" }} title="Click to edit in Media Creator">
                      <td style={c()}><PackageBadge name={order.productName}/></td>
                      <td style={c()}><span style={{ fontWeight:600, fontSize:".83rem", color:"#1e293b" }}>{order.prTitle || "(Untitled Draft)"}</span></td>
                      <td style={c()}><span style={{ fontSize:".72rem", fontWeight:700, color:sc.color, background:sc.bg, padding:".2rem .55rem", borderRadius:"99px" }}>{sc.label}</span></td>
                      <td style={c()}><span style={{ fontSize:".72rem", color:"#94a3b8" }}>{scheduledDt ? scheduledDt.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "—"}</span></td>
                      <td style={c()}>
                      <span style={{ fontSize:".72rem", color:"#94a3b8" }}>{isNaN(editedDt.getTime()) ? "—" : editedDt.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
                    </td>
                    <td style={cl()} onClick={e => e.stopPropagation()}>
                      <div style={{ display:"flex", gap:".5rem", alignItems:"center" }}>
                        {/* Edit icon */}
                        <button title="Edit instructions" onClick={() => onLoadDraft?.(order)}
                          style={{ background:"#eef2ff", border:"none", borderRadius:".35rem", padding:".3rem .4rem", cursor:"pointer", display:"flex", alignItems:"center" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        {/* Delete icon */}
                        <button title="Delete draft" onClick={() => { if (confirm("Delete this draft? Credits reserved for this PR will be returned.")) onDeleteDraft?.(order); }}
                          style={{ background:"#fff1f2", border:"none", borderRadius:".35rem", padding:".3rem .4rem", cursor:"pointer", display:"flex", alignItems:"center" }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableCard>
      )}

      {/* Article / Draft Preview Modal */}
      {articleModal && createPortal(
        <div style={{ position:"fixed", inset:0, zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,.6)", backdropFilter:"blur(4px)", padding:"1.5rem" }}>
          <div style={{ background:"white", borderRadius:"1rem", width:"100%", maxWidth:760, maxHeight:"90vh", display:"flex", flexDirection:"column", boxShadow:"0 32px 80px rgba(0,0,0,.3)" }}>

            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"1rem 1.25rem", borderBottom:"1px solid #f1f5f9", flexShrink:0 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:".95rem", color:"#1e293b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{articleModal.prTitle}</div>
                <div style={{ fontSize:".72rem", color:"#94a3b8", marginTop:".15rem" }}>{articleModal.productName} · {articleModal.date}</div>
              </div>
              <div style={{ display:"flex", gap:".5rem", alignItems:"center", flexShrink:0, marginLeft:".75rem" }}>
                {/* Edit Instructions: draft / scheduled / rejected */}
                {(articleModal.status === "draft" || articleModal.status === "scheduled" || articleModal.status === "rejected") && (
                  <button onClick={() => { onLoadDraft?.(articleModal); setArticleModal(null); setShowDiff(false); }}
                    style={{ padding:".4rem .85rem", borderRadius:".45rem", border:"1px solid #e2e8f0", background:"white", color:"#374151", fontSize:".78rem", fontWeight:600, cursor:"pointer" }}>
                    {articleModal.status === "rejected" ? "✏️ Revise & Resubmit" : "✏️ Edit Instructions"}
                  </button>
                )}
                <button onClick={() => { setArticleModal(null); setShowDiff(false); }} style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", padding:".25rem", fontSize:"1.4rem", lineHeight:1 }}>×</button>
              </div>
            </div>

            {/* Review Required banner — only for draft_pending_review (auto-generated) */}
            {articleModal.status === "draft_pending_review" && (
              <div style={{ background:"linear-gradient(135deg,#fffbeb,#fef3c7)", borderBottom:"1px solid #fde68a", padding:".75rem 1.25rem", display:"flex", alignItems:"center", gap:".75rem", flexShrink:0 }}>
                <span style={{ fontSize:"1.1rem", flexShrink:0 }}>⏰</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:".82rem", color:"#92400e" }}>Review Required</div>
                  <div style={{ fontSize:".75rem", color:"#78350f" }}>Your review and approval are required. You have until the scheduled date to approve or edit. After that, it will be automatically submitted for distribution.</div>
                </div>
                <div style={{ display:"flex", gap:".5rem", flexShrink:0 }}>
                  <button onClick={() => { onApproveAndSubmit?.(articleModal!); setArticleModal(null); setShowDiff(false); }}
                    style={{ padding:".4rem .85rem", borderRadius:".4rem", border:"none", background:"linear-gradient(135deg,#16a34a,#15803d)", color:"white", fontSize:".78rem", fontWeight:700, cursor:"pointer" }}>
                    ✅ Approve & Submit
                  </button>
                </div>
              </div>
            )}

            {/* Submitted lock banner */}
            {articleModal.status === "submitted" && (
              <div style={{ background:"#f0fdf4", borderBottom:"1px solid #bbf7d0", padding:".6rem 1.25rem", display:"flex", alignItems:"center", gap:".5rem", flexShrink:0 }}>
                <span>✅</span>
                <span style={{ fontSize:".78rem", fontWeight:600, color:"#15803d" }}>This PR has been submitted for distribution and cannot be edited.</span>
              </div>
            )}

            {/* Rejection banner — shows reason + prompt to revise */}
            {articleModal.status === "rejected" && (
              <div style={{ background:"#fef2f2", borderBottom:"1px solid #fecaca", padding:".85rem 1.25rem", flexShrink:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:".5rem", marginBottom: articleModal.rejectionReason ? ".5rem" : 0 }}>
                  <span>❌</span>
                  <span style={{ fontSize:".82rem", fontWeight:700, color:"#991b1b" }}>This PR was rejected — revision required</span>
                </div>
                {articleModal.rejectionReason && (
                  <div style={{ background:"#fff5f5", border:"1px solid #fecaca", borderRadius:".4rem", padding:".6rem .85rem", fontSize:".8rem", color:"#7f1d1d", lineHeight:1.6, whiteSpace:"pre-wrap" }}>
                    <span style={{ fontWeight:700 }}>Feedback: </span>{articleModal.rejectionReason}
                  </div>
                )}
                <div style={{ fontSize:".73rem", color:"#ef4444", marginTop:".5rem" }}>
                  Click <strong>Revise &amp; Resubmit</strong> in the top-right to edit this PR and send it back for review.
                </div>
              </div>
            )}

            {/* PR content — editable for draft/scheduled/draft_pending_review, read-only for submitted/published/rejected */}
            {(() => {
              const isReadOnly = articleModal.status === "submitted" || !articleModal.status || articleModal.status === "published" || articleModal.status === "rejected";
              const hasDiff = !!(articleModal.prContentOriginal && articleModal.prContentOriginal !== articleModal.prContent);
              return (
                <>
                  {hasDiff && (
                    <div style={{ padding:".6rem 1.25rem", borderBottom:"1px solid #fde68a", background:"#fffbeb", display:"flex", alignItems:"center", gap:".75rem", flexShrink:0 }}>
                      <span style={{ fontSize:".78rem", fontWeight:700, color:"#92400e" }}>✏️ Your account manager made edits to this PR</span>
                      <button onClick={() => setShowDiff(d => !d)}
                        style={{ fontSize:".72rem", fontWeight:700, color:"#6366f1", background:"#eef2ff", border:"none", borderRadius:".35rem", padding:".2rem .65rem", cursor:"pointer" }}>
                        {showDiff ? "Show Final Version" : "View Changes"}
                      </button>
                    </div>
                  )}
                  <div
                    contentEditable={!isReadOnly && !showDiff}
                    suppressContentEditableWarning
                    style={{ overflowY:"auto", padding:"2rem 2.25rem", flex:1, outline:"none", cursor: isReadOnly ? "default" : "text",
                      background: isReadOnly ? "#fafafa" : "white" }}
                    dangerouslySetInnerHTML={{ __html: showDiff && hasDiff
                      ? buildDiffHtml(articleModal.prContentOriginal!, articleModal.prContent!)
                      : (articleModal.prContent ?? "<p>Content not available.</p>") }}
                  />
                  <style>{`
                    [contenteditable] h1 { font-size:1.45rem; font-weight:800; color:#0f172a; margin:0 0 1rem; line-height:1.25; }
                    [contenteditable] h2 { font-size:1rem; font-weight:700; color:#1e293b; margin:1.25rem 0 .35rem; }
                    [contenteditable] p  { font-size:.875rem; line-height:1.75; color:#374151; margin:0 0 .85rem; }
                    [contenteditable] em { font-style:italic; }
                    [contenteditable] strong { font-weight:700; }
                    [contenteditable] a  { color:#6366f1; text-decoration:underline; }
                  `}</style>
                  <div style={{ padding:".65rem 1.25rem", borderTop:"1px solid #f1f5f9", fontSize:".72rem", color:"#94a3b8", flexShrink:0 }}>
                    {isReadOnly ? "👁 Read-only view" : "💡 Click anywhere in the text to edit inline — changes here are for review only."}
                  </div>
                </>
              );
            })()}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="card" style={{ overflow:"hidden" }}>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>{children}</table>
    </div>
  );
}

function PackageBadge({ name }: { name: string }) {
  return (
    <span style={{ fontSize:".72rem", fontWeight:700,
      color: name==="Starter" ? "#6366f1" : name==="Standard" ? "#8929bd" : "#d97706",
      background: name==="Starter" ? "#eef2ff" : name==="Standard" ? "#f5f3ff" : "#fffbeb",
      padding:".2rem .55rem", borderRadius:"99px", whiteSpace:"nowrap" }}>
      {name}
    </span>
  );
}

function EmptyState({ icon, title, desc }: { icon:string; title:string; desc:string }) {
  return (
    <div className="card" style={{ padding:"3rem", textAlign:"center", color:"#94a3b8" }}>
      <div style={{ fontSize:"2.5rem", marginBottom:".75rem" }}>{icon}</div>
      <div style={{ fontWeight:600, fontSize:"1rem", color:"#1e293b", marginBottom:".35rem" }}>{title}</div>
      <div style={{ fontSize:".83rem" }}>{desc}</div>
    </div>
  );
}
