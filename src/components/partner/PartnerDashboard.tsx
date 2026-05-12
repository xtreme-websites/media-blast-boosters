import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, partnerPost } from "../../lib/supabase-partner";
import type { Session } from "@supabase/supabase-js";

type Tab = "overview" | "revenue" | "queue" | "pr_orders";

interface Order {
  id: string; location_id: string; pr_title: string; product_name: string;
  status: string; created_at: string; pr_content?: string; pr_content_original?: string;
  company_name?: string; ready_for_partner?: boolean;
}

const TIER_COLORS: Record<string, string> = { starter:"#6366f1", standard:"#8929bd", premium:"#d97706" };
const STATUS_COLORS: Record<string, { bg:string; color:string }> = {
  submitted:          { bg:"#dbeafe", color:"#1d4ed8" },
  published:          { bg:"#dcfce7", color:"#166534" },
  rejected:           { bg:"#fee2e2", color:"#991b1b" },
  draft:              { bg:"#f1f5f9", color:"#475569" },
  scheduled:          { bg:"#fef3c7", color:"#92400e" },
  draft_pending_review:{ bg:"#faf5ff", color:"#7e22ce" },
};

// ── Partner Login ──────────────────────────────────────────────────────────────
function PartnerLogin({ accessDenied }: { accessDenied?: boolean }) {
  const [email,   setEmail]   = useState("");
  const [pass,    setPass]    = useState("");
  const [err,     setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) { setErr(error.message); setLoading(false); }
    else setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0f0a1e,#1a0a2e)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"system-ui,sans-serif" }}>
      <div style={{ background:"white", borderRadius:"1rem", padding:"2.5rem", width:"100%", maxWidth:380, boxShadow:"0 32px 80px rgba(0,0,0,.4)" }}>
        <div style={{ textAlign:"center", marginBottom:"2rem" }}>
          <img src="https://mediablast.xlogic.app/logo.png" alt="MBB" style={{ width:56, height:56, objectFit:"contain", marginBottom:".75rem" }}/>
          <h1 style={{ fontWeight:900, fontSize:"1.3rem", color:"#1e293b", margin:"0 0 .25rem" }}>Partner Portal</h1>
          <p style={{ color:"#64748b", fontSize:".82rem", margin:0 }}>Media Blast Boosters™</p>
        </div>
        {accessDenied && <div style={{ background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:".5rem", padding:".65rem .9rem", color:"#be123c", fontSize:".82rem", marginBottom:"1rem" }}>⛔ Access denied — your account is not authorized as a partner.</div>}
        {err && <div style={{ background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:".5rem", padding:".65rem .9rem", color:"#be123c", fontSize:".82rem", marginBottom:"1rem" }}>{err}</div>}
        <div style={{ display:"flex", flexDirection:"column", gap:".75rem" }}>
          <input type="email" placeholder="Partner email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}
            style={{ padding:".65rem .9rem", borderRadius:".5rem", border:"1.5px solid #e2e8f0", fontSize:".88rem", outline:"none" }}/>
          <input type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()}
            style={{ padding:".65rem .9rem", borderRadius:".5rem", border:"1.5px solid #e2e8f0", fontSize:".88rem", outline:"none" }}/>
          <button onClick={login} disabled={loading || !email || !pass}
            style={{ padding:".75rem", borderRadius:".55rem", border:"none", background:loading?"#e2e8f0":"linear-gradient(135deg,#6366f1,#8929bd)", color:loading?"#94a3b8":"white", fontWeight:800, fontSize:".9rem", cursor:loading?"not-allowed":"pointer" }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Partner Dashboard ────────────────────────────────────────────────────
export default function PartnerDashboard() {
  const [session,      setSession]      = useState<Session|null>(null);
  const [isPartner,    setIsPartner]    = useState(false);
  const [authCheck,    setAuthCheck]    = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [activeTab,    setActiveTab]    = useState<Tab>("overview");
  const [loading,      setLoading]      = useState(false);
  const [toast,        setToast]        = useState<{msg:string;type:"success"|"error"}|null>(null);

  // Data
  const [overview,    setOverview]    = useState<any>(null);
  const [revenue,     setRevenue]     = useState<any>(null);
  const [queue,       setQueue]       = useState<Order[]>([]);
  const [allOrders,   setAllOrders]   = useState<Order[]>([]);
  const [ordFilter,   setOrdFilter]   = useState({ location:"", package:"", status:"", dateFrom:"", dateTo:"" });

  // PR preview modal
  const [previewOrder,    setPreviewOrder]    = useState<Order|null>(null);
  const [editedContent,   setEditedContent]   = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const showToast = (msg: string, type: "success"|"error" = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500);
  };

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkPartner(session); else setAuthCheck(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) checkPartner(s); else { setIsPartner(false); setAuthCheck(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const checkPartner = async (s: Session) => {
    try {
      const d = await partnerPost("get_overview", {}, s.access_token);
      if (!d.error) { setIsPartner(true); setOverview(d); }
      else { setIsPartner(false); setAccessDenied(true); await supabase.auth.signOut(); }
    } catch { setIsPartner(false); setAccessDenied(true); }
    setAuthCheck(false);
  };

  const load = useCallback(async (tab: Tab) => {
    if (!session) return;
    setLoading(true);
    try {
      if (tab === "overview") {
        const d = await partnerPost("get_overview", {}, session.access_token);
        if (!d.error) setOverview(d);
      }
      if (tab === "revenue") {
        const d = await partnerPost("get_partner_revenue", {}, session.access_token);
        if (!d.error) setRevenue(d);
      }
      if (tab === "queue") {
        const d = await partnerPost("get_approval_queue", {}, session.access_token);
        if (!d.error) {
          setQueue((d.orders as any[]).map((o:any) => ({
            ...o, company_name: (d.companies as any[]).find((c:any)=>c.location_id===o.location_id)?.company_name
          })));
        }
      }
      if (tab === "pr_orders") {
        const d = await partnerPost("get_all_orders", {}, session.access_token);
        if (!d.error) setAllOrders(d.orders || []);
      }
    } catch {}
    setLoading(false);
  }, [session]);

  useEffect(() => { if (isPartner) load(activeTab); }, [isPartner, activeTab]);

  const approveOrder = async (order_id: string) => {
    if (!session) return;
    const d = await partnerPost("approve_order", { order_id }, session.access_token);
    if (!d.error) { showToast("PR approved ✓"); load("queue"); }
    else showToast(d.error, "error");
  };

  const rejectOrder = async (order_id: string) => {
    const reason = window.prompt("Rejection reason (shown to client):");
    if (!reason || !session) return;
    const d = await partnerPost("reject_order", { order_id, reason }, session.access_token);
    if (!d.error) { showToast("PR rejected"); load("queue"); }
    else showToast(d.error, "error");
  };

  const approveWithChanges = async () => {
    if (!previewOrder || !session) return;
    const changed = editedContent && editedContent !== originalContent;
    if (!changed) { approveOrder(previewOrder.id); setPreviewOrder(null); return; }
    const d = await partnerPost("approve_with_changes", {
      order_id: previewOrder.id, original_content: originalContent,
      new_content: editedContent, location_id: previewOrder.location_id
    }, session.access_token);
    if (!d.error) { showToast("Approved with changes — client notified ✓"); setPreviewOrder(null); load("queue"); }
    else showToast(d.error, "error");
  };

  // ── Loading / Auth states ────────────────────────────────────────────────────
  if (authCheck) return (
    <div style={{ minHeight:"100vh", background:"#0f0a1e", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:32, height:32, border:"3px solid rgba(255,255,255,.1)", borderTopColor:"#8929bd", borderRadius:"50%", animation:"spin .8s linear infinite" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!session || !isPartner) return <PartnerLogin accessDenied={accessDenied} />;

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id:"overview",  label:"Overview",       icon:"📊" },
    { id:"revenue",   label:"Revenue",        icon:"💰" },
    { id:"queue",     label:"Approval Queue", icon:"📋" },
    { id:"pr_orders", label:"PR Orders",      icon:"📰" },
  ];

  const queueBadge = queue.length;

  // PR Orders filtered
  const STATUSES = ["","draft","scheduled","submitted","published","rejected","draft_pending_review"];
  const PACKAGES = ["","Starter","Standard","Premium"];
  const locationOptions = [...new Map(allOrders.filter(o=>o.company_name||o.location_id).map(o=>[o.location_id,o])).values()];
  const filteredOrders = allOrders.filter(o => {
    if (ordFilter.location && o.location_id !== ordFilter.location) return false;
    if (ordFilter.package && o.product_name?.toLowerCase() !== ordFilter.package.toLowerCase()) return false;
    if (ordFilter.status && o.status !== ordFilter.status) return false;
    if (ordFilter.dateFrom && new Date(o.created_at) < new Date(ordFilter.dateFrom)) return false;
    if (ordFilter.dateTo && new Date(o.created_at) > new Date(ordFilter.dateTo+"T23:59:59")) return false;
    return true;
  });

  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"system-ui,-apple-system,sans-serif" }}>
      {/* Top bar */}
      <div style={{ background:"linear-gradient(135deg,#1a0a2e,#2d1054)" }}>
        <div style={{ maxWidth:1200, margin:"0 auto", padding:".75rem 1.5rem", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:".75rem" }}>
            <img src="https://mediablast.xlogic.app/logo.png" alt="MBB" style={{ width:36, height:36, objectFit:"contain" }}/>
            <div>
              <div style={{ color:"white", fontWeight:900, fontSize:".95rem", letterSpacing:"-.01em" }}>Media Blast Boosters™</div>
              <div style={{ color:"rgba(255,255,255,.5)", fontSize:".68rem", letterSpacing:".08em", textTransform:"uppercase" }}>Partner Portal</div>
            </div>
          </div>
          <button onClick={() => supabase.auth.signOut()}
            style={{ background:"rgba(255,255,255,.1)", border:"none", color:"rgba(255,255,255,.7)", borderRadius:".4rem", padding:".35rem .85rem", fontSize:".78rem", cursor:"pointer" }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Tab nav */}
      <div style={{ background:"white", borderBottom:"1px solid #e2e8f0" }}>
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 1.5rem", display:"flex", overflowX:"auto" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ padding:".85rem 1.1rem", border:"none", borderBottom: activeTab===t.id ? "2.5px solid #8929bd" : "2.5px solid transparent", background:"transparent", color: activeTab===t.id ? "#8929bd" : "#64748b", fontWeight: activeTab===t.id ? 700 : 500, fontSize:".84rem", cursor:"pointer", display:"flex", alignItems:"center", gap:".4rem", whiteSpace:"nowrap" }}>
              {t.icon} {t.label}
              {t.id==="queue" && queueBadge > 0 && (
                <span style={{ background:"#ef4444", color:"white", fontSize:".6rem", fontWeight:900, padding:".1rem .4rem", borderRadius:"99px" }}>{queueBadge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding:"1.5rem", maxWidth:1200, margin:"0 auto" }}>
        {loading && <div style={{ textAlign:"center", padding:"3rem", color:"#94a3b8" }}>Loading…</div>}

        {/* OVERVIEW */}
        {!loading && activeTab==="overview" && (
          <div>
            <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:"0 0 1.25rem" }}>Overview</h2>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"1rem", marginBottom:"1.5rem" }}>
              {[
                { label:"Total PRs",      value: overview?.total_orders || 0,       icon:"📰", color:"#8929bd" },
                { label:"Pending Queue",  value: overview?.queue_count  || 0,       icon:"📋", color:"#ef4444" },
                { label:"Starter PRs",    value: overview?.orders_by_tier?.starter   || 0, icon:"🟣", color:TIER_COLORS.starter },
                { label:"Standard PRs",   value: overview?.orders_by_tier?.standard  || 0, icon:"🟪", color:TIER_COLORS.standard },
                { label:"Premium PRs",    value: overview?.orders_by_tier?.premium   || 0, icon:"🟠", color:TIER_COLORS.premium },
              ].map(card => (
                <div key={card.label} style={{ background:"white", borderRadius:".75rem", padding:"1.25rem", border:"1px solid #f1f5f9", boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:".5rem", marginBottom:".5rem" }}>
                    <span>{card.icon}</span>
                    <span style={{ fontSize:".75rem", fontWeight:600, color:"#94a3b8", textTransform:"uppercase", letterSpacing:".05em" }}>{card.label}</span>
                  </div>
                  <div style={{ fontSize:"1.75rem", fontWeight:900, color:card.color }}>{card.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REVENUE — payouts only */}
        {!loading && activeTab==="revenue" && (
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.25rem" }}>
              <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:0 }}>Revenue</h2>
              {revenue?.test_mode && <span style={{ background:"#fef3c7", color:"#92400e", fontSize:".72rem", fontWeight:800, padding:".2rem .6rem", borderRadius:"99px" }}>⚠️ TEST MODE</span>}
            </div>
            {revenue ? (
              <>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"1rem", marginBottom:"1.5rem" }}>
                  {[
                    { label:"Partner Payouts", value:`$${revenue.payout.toLocaleString("en-US",{minimumFractionDigits:2})}`, icon:"🤝", color:"#8929bd" },
                    { label:"Total Transactions", value:revenue.count, icon:"🧾", color:"#6366f1" },
                  ].map(card => (
                    <div key={card.label} style={{ background:"white", borderRadius:".75rem", padding:"1.25rem", border:"1px solid #f1f5f9" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:".4rem", marginBottom:".5rem" }}>
                        <span>{card.icon}</span>
                        <span style={{ fontSize:".72rem", fontWeight:600, color:"#94a3b8", textTransform:"uppercase" }}>{card.label}</span>
                      </div>
                      <div style={{ fontSize:"1.6rem", fontWeight:900, color:card.color }}>{card.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background:"white", borderRadius:".75rem", border:"1px solid #f1f5f9", overflow:"hidden" }}>
                  <div style={{ padding:"1rem 1.25rem", borderBottom:"1px solid #f1f5f9", fontWeight:700, fontSize:".88rem" }}>Monthly Breakdown</div>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:".83rem" }}>
                    <thead><tr style={{ background:"#f8fafc" }}>
                      {["Month","Partner Payouts","Transactions"].map(h=>(
                        <th key={h} style={{ padding:".65rem 1rem", textAlign:"left", fontWeight:700, color:"#64748b", fontSize:".72rem", textTransform:"uppercase" }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {Object.entries(revenue.by_month).sort(([a],[b])=>b.localeCompare(a)).map(([month,data]:any)=>(
                        <tr key={month} style={{ borderTop:"1px solid #f8fafc" }}>
                          <td style={{ padding:".7rem 1rem", fontWeight:600 }}>{month}</td>
                          <td style={{ padding:".7rem 1rem", color:"#8929bd", fontWeight:700 }}>${data.payout.toLocaleString("en-US",{minimumFractionDigits:2})}</td>
                          <td style={{ padding:".7rem 1rem" }}>{data.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : <div style={{ padding:"3rem", textAlign:"center", color:"#94a3b8" }}>No revenue data</div>}
          </div>
        )}

        {/* APPROVAL QUEUE */}
        {!loading && activeTab==="queue" && (
          <div>
            <div style={{ display:"flex", alignItems:"center", marginBottom:"1.25rem" }}>
              <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:0 }}>
                Approval Queue
                {queueBadge > 0 && <span style={{ marginLeft:".5rem", background:"#ef4444", color:"white", fontSize:".65rem", fontWeight:900, padding:".15rem .5rem", borderRadius:"99px" }}>{queueBadge}</span>}
              </h2>
            </div>
            {queue.length === 0 ? (
              <div style={{ background:"white", borderRadius:".75rem", padding:"3rem", textAlign:"center", border:"1px solid #f1f5f9" }}>
                <div style={{ fontSize:"2.5rem", marginBottom:".75rem" }}>✅</div>
                <div style={{ fontWeight:700, color:"#1e293b" }}>Queue is clear</div>
                <div style={{ color:"#94a3b8", fontSize:".82rem", marginTop:".3rem" }}>All submitted PRs have been reviewed</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
                {queue.map(order => (
                  <div key={order.id} style={{ background:"white", borderRadius:".75rem", border:"1px solid #e2e8f0", padding:"1.25rem" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"1rem", flexWrap:"wrap" }}>
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:".5rem", marginBottom:".3rem" }}>
                          <span style={{ fontSize:".7rem", fontWeight:800, color:"white", background:TIER_COLORS[order.product_name?.toLowerCase()]||"#6366f1", padding:".2rem .6rem", borderRadius:"99px", textTransform:"uppercase" }}>{order.product_name}</span>
                          <span style={{ fontSize:".72rem", color:"#94a3b8" }}>{new Date(order.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
                        </div>
                        <div style={{ fontWeight:700, fontSize:".95rem", color:"#1e293b", marginBottom:".2rem" }}>{order.pr_title||"Untitled PR"}</div>
                        <div style={{ fontSize:".78rem", color:"#8929bd" }}>{order.company_name||order.location_id}</div>
                      </div>
                      <div style={{ display:"flex", gap:".5rem", flexShrink:0 }}>
                        <button onClick={()=>{ setPreviewOrder(order); setOriginalContent(order.pr_content||""); setEditedContent(order.pr_content||""); }}
                          style={{ padding:".5rem 1rem", borderRadius:".45rem", border:"1px solid #e2e8f0", background:"white", fontSize:".8rem", fontWeight:600, cursor:"pointer" }}>
                          👁 Preview
                        </button>
                        <button onClick={()=>approveOrder(order.id)}
                          style={{ padding:".5rem 1rem", borderRadius:".45rem", border:"none", background:"#dcfce7", color:"#166534", fontSize:".8rem", fontWeight:700, cursor:"pointer" }}>
                          ✅ Approve
                        </button>
                        <button onClick={()=>rejectOrder(order.id)}
                          style={{ padding:".5rem 1rem", borderRadius:".45rem", border:"none", background:"#fee2e2", color:"#991b1b", fontSize:".8rem", fontWeight:700, cursor:"pointer" }}>
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PR ORDERS */}
        {!loading && activeTab==="pr_orders" && (
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.25rem" }}>
              <div>
                <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:"0 0 .2rem" }}>PR Orders</h2>
                <p style={{ color:"#64748b", fontSize:".82rem", margin:0 }}>{filteredOrders.length} of {allOrders.length} orders</p>
              </div>
            </div>
            {/* Filters */}
            <div style={{ background:"white", borderRadius:".75rem", border:"1px solid #f1f5f9", padding:"1rem 1.25rem", marginBottom:"1rem", display:"flex", gap:".65rem", flexWrap:"wrap", alignItems:"flex-end" }}>
              <div style={{ flex:"1 1 200px" }}>
                <div style={{ fontSize:".7rem", fontWeight:700, color:"#64748b", marginBottom:".3rem", textTransform:"uppercase", letterSpacing:".05em" }}>Company</div>
                <select value={ordFilter.location} onChange={e=>setOrdFilter(f=>({...f,location:e.target.value}))}
                  style={{ width:"100%", padding:".45rem .65rem", borderRadius:".4rem", border:"1px solid #e2e8f0", fontSize:".82rem", background:"white" }}>
                  <option value="">All Companies</option>
                  {locationOptions.map(o=><option key={o.location_id} value={o.location_id}>{o.company_name||o.location_id}</option>)}
                </select>
              </div>
              <div style={{ flex:"0 0 140px" }}>
                <div style={{ fontSize:".7rem", fontWeight:700, color:"#64748b", marginBottom:".3rem", textTransform:"uppercase", letterSpacing:".05em" }}>Package</div>
                <select value={ordFilter.package} onChange={e=>setOrdFilter(f=>({...f,package:e.target.value}))}
                  style={{ width:"100%", padding:".45rem .65rem", borderRadius:".4rem", border:"1px solid #e2e8f0", fontSize:".82rem", background:"white" }}>
                  {PACKAGES.map(p=><option key={p} value={p}>{p||"All Packages"}</option>)}
                </select>
              </div>
              <div style={{ flex:"0 0 160px" }}>
                <div style={{ fontSize:".7rem", fontWeight:700, color:"#64748b", marginBottom:".3rem", textTransform:"uppercase", letterSpacing:".05em" }}>Status</div>
                <select value={ordFilter.status} onChange={e=>setOrdFilter(f=>({...f,status:e.target.value}))}
                  style={{ width:"100%", padding:".45rem .65rem", borderRadius:".4rem", border:"1px solid #e2e8f0", fontSize:".82rem", background:"white" }}>
                  {STATUSES.map(s=><option key={s} value={s}>{s?s.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()):"All Statuses"}</option>)}
                </select>
              </div>
              <div style={{ flex:"0 0 140px" }}>
                <div style={{ fontSize:".7rem", fontWeight:700, color:"#64748b", marginBottom:".3rem", textTransform:"uppercase", letterSpacing:".05em" }}>From</div>
                <input type="date" value={ordFilter.dateFrom} onChange={e=>setOrdFilter(f=>({...f,dateFrom:e.target.value}))}
                  style={{ width:"100%", padding:".45rem .65rem", borderRadius:".4rem", border:"1px solid #e2e8f0", fontSize:".82rem", boxSizing:"border-box" as const }}/>
              </div>
              <div style={{ flex:"0 0 140px" }}>
                <div style={{ fontSize:".7rem", fontWeight:700, color:"#64748b", marginBottom:".3rem", textTransform:"uppercase", letterSpacing:".05em" }}>To</div>
                <input type="date" value={ordFilter.dateTo} onChange={e=>setOrdFilter(f=>({...f,dateTo:e.target.value}))}
                  style={{ width:"100%", padding:".45rem .65rem", borderRadius:".4rem", border:"1px solid #e2e8f0", fontSize:".82rem", boxSizing:"border-box" as const }}/>
              </div>
              <button onClick={()=>setOrdFilter({location:"",package:"",status:"",dateFrom:"",dateTo:""})}
                style={{ padding:".45rem .85rem", borderRadius:".4rem", border:"1px solid #e2e8f0", background:"white", fontSize:".78rem", fontWeight:600, cursor:"pointer", color:"#64748b", alignSelf:"flex-end" }}>
                ↩ Clear
              </button>
            </div>
            {/* Table */}
            <div style={{ background:"white", borderRadius:".75rem", border:"1px solid #f1f5f9", overflow:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:".82rem" }}>
                <thead><tr style={{ background:"#1a0a2e" }}>
                  {["Company","PR Title","Package","Status","Date","Ready"].map(h=>(
                    <th key={h} style={{ padding:".7rem 1rem", textAlign:"left", fontWeight:700, color:"rgba(255,255,255,.8)", fontSize:".68rem", textTransform:"uppercase", letterSpacing:".05em", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filteredOrders.map(order => {
                    const sc = STATUS_COLORS[order.status] || { bg:"#f1f5f9", color:"#475569" };
                    return (
                      <tr key={order.id} style={{ borderTop:"1px solid #f8fafc", cursor:"pointer" }}
                        onMouseOver={e=>(e.currentTarget.style.background="#fafafa")}
                        onMouseOut={e=>(e.currentTarget.style.background="white")}
                        onClick={()=>{ setPreviewOrder(order); setOriginalContent(order.pr_content||""); setEditedContent(order.pr_content||""); }}>
                        <td style={{ padding:".7rem 1rem" }}>
                          <div style={{ fontWeight:600, color:"#1e293b" }}>{order.company_name||"—"}</div>
                        </td>
                        <td style={{ padding:".7rem 1rem", maxWidth:260 }}>
                          <div style={{ fontWeight:500, color:"#374151", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{order.pr_title||"—"}</div>
                        </td>
                        <td style={{ padding:".7rem 1rem" }}>
                          <span style={{ fontSize:".72rem", fontWeight:700, color:TIER_COLORS[order.product_name?.toLowerCase()]||"#6366f1", background:"#f1f5f9", padding:".2rem .6rem", borderRadius:"99px" }}>{order.product_name||"—"}</span>
                        </td>
                        <td style={{ padding:".7rem 1rem" }}>
                          <span style={{ fontSize:".72rem", fontWeight:700, color:sc.color, background:sc.bg, padding:".2rem .6rem", borderRadius:"99px", whiteSpace:"nowrap" }}>{order.status?.replace(/_/g," ")||"—"}</span>
                        </td>
                        <td style={{ padding:".7rem 1rem", color:"#64748b", whiteSpace:"nowrap" }}>
                          {order.created_at ? new Date(order.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "—"}
                        </td>
                        <td style={{ padding:".7rem 1rem", textAlign:"center" }}>{order.ready_for_partner ? "✅" : "⏳"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredOrders.length===0 && <div style={{ padding:"3rem", textAlign:"center", color:"#94a3b8" }}>No orders match the filters</div>}
            </div>
          </div>
        )}
      </div>

      {/* PR Preview Modal */}
      {previewOrder && (
        <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,.6)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1.5rem" }}>
          <div style={{ background:"white", borderRadius:"1rem", width:"100%", maxWidth:780, maxHeight:"90vh", display:"flex", flexDirection:"column", boxShadow:"0 32px 80px rgba(0,0,0,.4)" }}>
            <div style={{ padding:"1rem 1.5rem", borderBottom:"1px solid #f1f5f9", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:"1rem", color:"#1e293b" }}>{previewOrder.pr_title}</div>
                <div style={{ fontSize:".75rem", color:"#94a3b8", marginTop:".15rem" }}>
                  <span style={{ background:TIER_COLORS[previewOrder.product_name?.toLowerCase()]||"#eef2ff", color:"white", fontWeight:700, fontSize:".68rem", padding:".15rem .5rem", borderRadius:"99px", marginRight:".5rem" }}>{previewOrder.product_name}</span>
                  {previewOrder.company_name} · {new Date(previewOrder.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:".5rem" }}>
                <span style={{ fontSize:".72rem", color:"#8929bd", fontWeight:600 }}>✏️ Click content to edit</span>
                <button onClick={()=>{ setPreviewOrder(null); setEditedContent(""); setOriginalContent(""); }}
                  style={{ background:"none", border:"none", fontSize:"1.2rem", cursor:"pointer", color:"#94a3b8", lineHeight:1 }}>✕</button>
              </div>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:"1.5rem 2rem" }}>
              <style>{`.partner-pr h1{font-size:1.5rem;font-weight:800;color:#0f172a;margin:0 0 1rem;font-family:system-ui,sans-serif}.partner-pr h2{font-size:1.05rem;font-weight:700;color:#374151;margin:1.5rem 0 .5rem;font-family:system-ui,sans-serif;border-bottom:1px solid #f1f5f9;padding-bottom:.3rem}.partner-pr p{margin:0 0 1rem;font-size:.93rem;line-height:1.7}.partner-pr [contenteditable]:focus{outline:2px dashed #8929bd;outline-offset:4px;border-radius:4px}`}</style>
              <div className="partner-pr" contentEditable suppressContentEditableWarning
                onInput={e => setEditedContent((e.target as HTMLDivElement).innerHTML)}
                dangerouslySetInnerHTML={{ __html: editedContent || previewOrder.pr_content || "<p>No content</p>" }}
                style={{ fontFamily:"Georgia,serif", color:"#1e293b", lineHeight:1.7 }}/>
            </div>
            <div style={{ padding:"1rem 1.5rem", borderTop:"1px solid #f1f5f9", display:"flex", gap:".65rem", justifyContent:"flex-end", flexShrink:0 }}>
              <button onClick={()=>rejectOrder(previewOrder.id)}
                style={{ padding:".6rem 1.1rem", borderRadius:".45rem", border:"none", background:"#fee2e2", color:"#991b1b", fontWeight:700, fontSize:".83rem", cursor:"pointer" }}>
                ✕ Reject
              </button>
              <button onClick={approveWithChanges}
                style={{ padding:".6rem 1.1rem", borderRadius:".45rem", border:"none", background:"#fef3c7", color:"#92400e", fontWeight:700, fontSize:".83rem", cursor:"pointer" }}>
                ✏️ Approve with Changes
              </button>
              <button onClick={()=>{ approveOrder(previewOrder.id); setPreviewOrder(null); setEditedContent(""); setOriginalContent(""); }}
                style={{ padding:".6rem 1.1rem", borderRadius:".45rem", border:"none", background:"#dcfce7", color:"#166534", fontWeight:700, fontSize:".83rem", cursor:"pointer" }}>
                ✅ Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", bottom:"1.5rem", right:"1.5rem", zIndex:10001, background:toast.type==="error"?"#991b1b":"#166534", color:"white", borderRadius:".65rem", padding:".85rem 1.25rem", fontSize:".85rem", fontWeight:600, boxShadow:"0 8px 24px rgba(0,0,0,.25)" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
