import { useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "../icons";
import { Order, OrderStatus } from "../../lib/constants";

interface Props {
  orders: Order[];
  locationId: string;
  onLoadDraft?: (order: Order) => void;
  preOpenDraftId?: string | null;
}

const STATUS_CONFIG: Record<string, { label:string; color:string; bg:string }> = {
  pending_review: { label:"Pending Review",  color:"#92400e", bg:"#fef3c7" },
  reviewing:      { label:"In Review",       color:"#1d4ed8", bg:"#dbeafe" },
  published:      { label:"Published",       color:"#7c3aed", bg:"#ede9fe" },
  rejected:       { label:"Revision Needed", color:"#991b1b", bg:"#fee2e2" },
  submitted:      { label:"Submitted",       color:"#065f46", bg:"#d1fae5" },
  draft:                { label:"Draft",             color:"#475569", bg:"#f1f5f9" },
  draft_pending_review: { label:"⏳ Pending Review",  color:"#92400e", bg:"#fef3c7" },
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
  return (
    <span style={{ fontSize:".68rem", fontWeight:700, color:s.color, background:s.bg, padding:".15rem .5rem", borderRadius:"99px", display:"inline-flex", alignItems:"center", gap:".25rem", whiteSpace:"nowrap" }}>
      {s.icon} {label}
    </span>
  );
}

export default function PublishedPress({ orders, onLoadDraft, preOpenDraftId }: Props) {
  const [activeTab, setActiveTab] = useState<"published"|"drafts">("published");
  const [articleModal, setArticleModal] = useState<Order | null>(null);

  // Auto-open draft if coming from auto-generate
  useEffect(() => {
    if (!preOpenDraftId) return;
    setActiveTab("drafts");
    const order = orders.find(o => o.id === preOpenDraftId);
    if (order) setArticleModal(order);
  }, [preOpenDraftId, orders]);

  const published = orders.filter(o => !o.status || o.status === "submitted" || o.status === "pending_review" || o.status === "published");
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
                  const sc = STATUS_CONFIG[order.status || "submitted"] || STATUS_CONFIG.pending_review;
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
                      <td style={c()}><span style={{ fontSize:".72rem", fontWeight:700, color:sc.color, background:sc.bg, padding:".2rem .55rem", borderRadius:"99px", whiteSpace:"nowrap" }}>{sc.label}</span></td>
                      <td style={cl()}>
                        {(order as any).report_link
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
                  <th style={thLast}>Last Edited</th>
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
                      <td style={cl()}><span style={{ fontSize:".72rem", color:"#94a3b8" }}>{isNaN(editedDt.getTime()) ? "—" : editedDt.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </TableCard>
      )}

      {/* Article Modal */}
      {articleModal && createPortal(
        <div style={{ position:"fixed", inset:0, zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,.6)", backdropFilter:"blur(4px)", padding:"1.5rem" }}>
          <div style={{ background:"white", borderRadius:"1rem", width:"100%", maxWidth:720, maxHeight:"85vh", display:"flex", flexDirection:"column", boxShadow:"0 32px 80px rgba(0,0,0,.3)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"1rem 1.25rem", borderBottom:"1px solid #f1f5f9", flexShrink:0 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:".95rem", color:"#1e293b" }}>{articleModal.prTitle}</div>
                <div style={{ fontSize:".72rem", color:"#94a3b8", marginTop:".15rem" }}>{articleModal.productName} · {articleModal.date}</div>
              </div>
              <button onClick={() => setArticleModal(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", padding:".25rem", display:"flex" }}>
                <XIcon size={18}/>
              </button>
            </div>
            {/* 48hr banner for pending review drafts */}
            {articleModal.status === "draft_pending_review" && (
              <div style={{ background:"linear-gradient(135deg,#fffbeb,#fef3c7)", borderBottom:"1px solid #fde68a", padding:".75rem 1.25rem", display:"flex", alignItems:"center", gap:".75rem", flexShrink:0 }}>
                <span style={{ fontSize:"1.1rem" }}>⏰</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:".82rem", color:"#92400e" }}>Auto-Submit Pending</div>
                  <div style={{ fontSize:".75rem", color:"#78350f" }}>If no action is taken, this PR auto-submits for distribution after 48 hours.</div>
                </div>
                <div style={{ display:"flex", gap:".5rem", flexShrink:0 }}>
                  <button onClick={() => { onLoadDraft?.(articleModal); setArticleModal(null); }}
                    style={{ padding:".4rem .85rem", borderRadius:".4rem", border:"1px solid #e2e8f0", background:"white", color:"#374151", fontSize:".78rem", fontWeight:600, cursor:"pointer" }}>
                    ✏️ Edit
                  </button>
                  <button style={{ padding:".4rem .85rem", borderRadius:".4rem", border:"none", background:"linear-gradient(135deg,#16a34a,#15803d)", color:"white", fontSize:".78rem", fontWeight:700, cursor:"pointer" }}>
                    ✅ Approve & Submit
                  </button>
                </div>
              </div>
            )}
            <div className="prose" style={{ overflowY:"auto", padding:"1.5rem", maxWidth:"none" }}
              dangerouslySetInnerHTML={{ __html: articleModal.prContent ?? "<p>Content not available.</p>" }}/>
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
