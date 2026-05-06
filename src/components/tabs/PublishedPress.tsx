import { useState } from "react";
import { XIcon } from "../icons";
import { Order } from "../../lib/constants";

interface Props { orders: Order[]; locationId: string; }

const STATUS_CONFIG: Record<string, { label:string; color:string; bg:string }> = {
  pending:   { label:"Pending Review",  color:"#92400e", bg:"#fef3c7" },
  reviewing: { label:"In Review",       color:"#1d4ed8", bg:"#dbeafe" },
  approved:  { label:"Approved",        color:"#065f46", bg:"#d1fae5" },
  published: { label:"Published",       color:"#7c3aed", bg:"#ede9fe" },
  rejected:  { label:"Revision Needed", color:"#991b1b", bg:"#fee2e2" },
};

const th: React.CSSProperties = {
  padding:".65rem 1rem", fontSize:".7rem", fontWeight:700, color:"white",
  textTransform:"uppercase", letterSpacing:".06em", textAlign:"left",
  background:"transparent", borderBottom:"none",
  borderRight:"1px solid rgba(255,255,255,.15)", whiteSpace:"nowrap",
};
const thLast: React.CSSProperties = { ...th, borderRight:"none" };

const td = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  padding:".85rem 1rem", borderBottom:"1px solid #f8fafc",
  borderRight:"1px solid #f1f5f9", verticalAlign:"middle", ...extra,
});
const tdLast = (extra: React.CSSProperties = {}): React.CSSProperties => ({ ...td(extra), borderRight:"none" });

export default function PublishedPress({ orders }: Props) {
  const [articleModal, setArticleModal] = useState<Order | null>(null);

  if (orders.length === 0) return (
    <div>
      <div style={{ marginBottom:"1.25rem" }}>
        <h2 style={{ fontWeight:800, fontSize:"1.2rem", color:"#1e293b", margin:0 }}>Published Press</h2>
        <p style={{ color:"#64748b", fontSize:".83rem", margin:".25rem 0 0" }}>Track the status of your submitted press releases</p>
      </div>
      <div className="card" style={{ padding:"3rem", textAlign:"center", color:"#94a3b8" }}>
        <div style={{ fontSize:"2.5rem", marginBottom:".75rem" }}>📰</div>
        <div style={{ fontWeight:600, fontSize:"1rem", color:"#1e293b", marginBottom:".35rem" }}>No press releases yet</div>
        <div style={{ fontSize:".83rem" }}>Submit your first press release from Media Content</div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom:"1.25rem" }}>
        <h2 style={{ fontWeight:800, fontSize:"1.2rem", color:"#1e293b", margin:0 }}>Published Press</h2>
        <p style={{ color:"#64748b", fontSize:".83rem", margin:".25rem 0 0" }}>Track the status of your submitted press releases</p>
      </div>

      <div className="card" style={{ overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)"}}>
              <th style={th}>Package</th>
              <th style={th}>PR Title</th>
              <th style={th}>SEO Focus</th>
              <th style={th}>Date</th>
              <th style={th}>Article</th>
              <th style={th}>Status</th>
              <th style={thLast}>Report</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order, i) => {
              const status = (order as any).status ?? "pending";
              const sc = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
              const dt = new Date(order.date);
              const shortTitle = order.prTitle;
              const isLast = i === orders.length - 1;
              const c  = (extra: React.CSSProperties = {}) => td({ ...extra, borderBottom: isLast ? "none" : "1px solid #f8fafc" });
              const cl = (extra: React.CSSProperties = {}) => tdLast({ ...extra, borderBottom: isLast ? "none" : "1px solid #f8fafc" });

              return (
                <tr key={order.id}>
                  <td style={c()}>
                    <span style={{ fontSize:".72rem", fontWeight:700,
                      color: order.productName==="Starter" ? "#6366f1" : order.productName==="Standard" ? "#8929bd" : "#d97706",
                      background: order.productName==="Starter" ? "#eef2ff" : order.productName==="Standard" ? "#f5f3ff" : "#fffbeb",
                      padding:".2rem .55rem", borderRadius:"99px", whiteSpace:"nowrap" }}>
                      {order.productName}
                    </span>
                  </td>
                  <td style={c()}>
                    <span style={{ fontWeight:600, fontSize:".83rem", color:"#1e293b" }}>{shortTitle}</span>
                  </td>
                  <td style={c()}>
                    <span style={{ fontSize:".72rem", color:"#94a3b8", whiteSpace:"nowrap" }}>
                      {isNaN(dt.getTime()) ? order.date : dt.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                    </span>
                  </td>
                  <td style={c()}>
                    <button onClick={() => setArticleModal(order)} style={{ background:"#eef2ff", color:"#6366f1", border:"none", borderRadius:".4rem", padding:".3rem .65rem", fontSize:".72rem", fontWeight:600, cursor:"pointer" }}>
                      View
                    </button>
                  </td>
                  <td style={c()}>
                    <span style={{ fontSize:".72rem", fontWeight:700, color:sc.color, background:sc.bg, padding:".2rem .55rem", borderRadius:"99px", whiteSpace:"nowrap" }}>
                      {sc.label}
                    </span>
                  </td>
                  <td style={cl()}>
                    {status === "published"
                      ? <button style={{ background:"#f0fdf4", color:"#16a34a", border:"1px solid #bbf7d0", borderRadius:".4rem", padding:".3rem .65rem", fontSize:".72rem", fontWeight:600, cursor:"pointer" }}>Report</button>
                      : <span style={{ fontSize:".72rem", color:"#94a3b8" }}>—</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Article Modal */}
      {articleModal && (
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
            <div className="prose" style={{ overflowY:"auto", padding:"1.5rem", maxWidth:"none" }}
              dangerouslySetInnerHTML={{ __html: articleModal.prContent ?? "<p>Content not available.</p>" }}/>
          </div>
        </div>
      )}
    </div>
  );
}

function SeoFocusBadge({ seoFocus }: { seoFocus: string }) {
  if (!seoFocus) return <span style={{ fontSize:".72rem", color:"#94a3b8" }}>—</span>;
  const [type, ...rest] = seoFocus.split(":");
  const typeColors: Record<string,{color:string;bg:string;icon:string}> = {
    home:     { color:"#8929bd", bg:"#f5f3ff", icon:"🌐" },
    service:  { color:"#6366f1", bg:"#eef2ff", icon:"🔧" },
    location: { color:"#0ea5e9", bg:"#f0f9ff", icon:"📍" },
    own:      { color:"#64748b", bg:"#f8fafc",  icon:"✍️" },
  };
  const style = typeColors[type] || typeColors.own;
  // Extract readable label
  let label = rest[rest.length - 1] || type;
  if (label.startsWith("http")) {
    const parts = label.split("/").filter(Boolean);
    label = parts[parts.length - 1]?.replace(/-/g," ") || type;
  }
  return (
    <span style={{ fontSize:".68rem", fontWeight:700, color:style.color, background:style.bg, padding:".15rem .5rem", borderRadius:"99px", display:"inline-flex", alignItems:"center", gap:".25rem", whiteSpace:"nowrap" }}>
      {style.icon} {label}
    </span>
  );
}
