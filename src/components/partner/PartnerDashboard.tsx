import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, partnerPost } from "../../lib/supabase-partner";
import type { Session } from "@supabase/supabase-js";

// ── Stripe Connect Embedded Payouts ───────────────────────────────────────────
const STRIPE_PUBLISHABLE_KEY = "pk_live_51QRk7nKWRQxDCjAzFSFjlNJRBK9ORKpxB0k4eP4nH5gCi8mBFkmpNm9OxupGbJnKlQ6TU0X4CQxLDXW1dHFf3Ns00oJlasEdZS";

function PayoutsEmbed({ clientSecret }: { clientSecret: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let instance: any;
    (async () => {
      try {
        const { loadConnectAndInitialize } = await import("@stripe/connect-js");
        instance = loadConnectAndInitialize({
          publishableKey: STRIPE_PUBLISHABLE_KEY,
          fetchClientSecret: () => Promise.resolve(clientSecret),
          appearance: {
            overlays: "drawer",
            variables: {
              colorPrimary: "#8929bd",
              colorBackground: "#ffffff",
              fontFamily: "system-ui, -apple-system, sans-serif",
              borderRadius: "8px",
            },
          },
        });
        if (containerRef.current) {
          const payouts = instance.create("payouts");
          payouts.mount(containerRef.current);
        }
      } catch (e) {
        console.error("Stripe Connect failed to load:", e);
      }
    })();
    return () => { try { instance?.destroy(); } catch {} };
  }, [clientSecret]);
  return <div ref={containerRef} style={{ minHeight:400 }}/>;
}

type Tab = "overview" | "revenue" | "queue" | "pr_orders" | "details" | "payouts";

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
          <img src="https://mediablast.xlogic.app/logo.png" alt="MBB" style={{ width:56, height:56, objectFit:"contain", display:"block", margin:"0 auto .75rem" }}/>
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
  const [connectId,    setConnectId]    = useState<string|null>(null);
  const [connectStatus,setConnectStatus]= useState("not_connected");
  const [connectClientId, setConnectClientId] = useState("ca_UVPxtVObJ1J2nUieqPiHROqJn7etM44E");
  const [accountSession, setAccountSession] = useState<string|null>(null);
  const [packageNotes, setPackageNotes] = useState<any[]>([]);
  const [documents,    setDocuments]    = useState<any[]>([]);
  const [editingTier,  setEditingTier]  = useState<string|null>(null);
  const [editBullets,  setEditBullets]  = useState<string[]>([]);
  const [savingNotes,  setSavingNotes]  = useState(false);
  const [uploadModal,  setUploadModal]  = useState(false);
  const [uploadName,   setUploadName]   = useState("");
  const [uploadDesc,   setUploadDesc]   = useState("");
  const [uploadFile,   setUploadFile]   = useState<File|null>(null);
  const [uploading,    setUploading]    = useState(false);

  // PR preview modal
  const [previewOrder,    setPreviewOrder]    = useState<Order|null>(null);
  const [editedContent,   setEditedContent]   = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const showToast = (msg: string, type: "success"|"error" = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500);
  };

  // Auth
  // Handle Stripe Connect OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (code && state === "stripe_connect") {
      // Remove params from URL
      window.history.replaceState({}, "", "/partner?tab=details");
      // Exchange code after auth is ready
      const doExchange = async () => {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (s) {
          const d = await partnerPost("complete_stripe_connect", { code }, s.access_token);
          if (d.ok) { setConnectId(d.stripe_user_id); setConnectStatus("active"); setActiveTab("details"); }
        }
      };
      setTimeout(doExchange, 1500); // wait for auth to settle
    }
  }, []);

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
      else { setIsPartner(false); setAccessDenied(true); }
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
      if (tab === "details") {
        const d = await partnerPost("get_details", {}, session.access_token);
        if (!d.error) { setPackageNotes(d.notes || []); setDocuments(d.documents || []); setConnectId(d.stripe_connect_id); setConnectStatus(d.stripe_connect_status||"not_connected"); }
      }
      if (tab === "payouts") {
        const cs = await partnerPost("get_connect_status", {}, session.access_token);
        if (!cs.error) { setConnectId(cs.stripe_connect_id); setConnectStatus(cs.stripe_connect_status||"not_connected"); setConnectClientId(cs.connect_client_id||"ca_UVPxtVObJ1J2nUieqPiHROqJn7etM44E"); }
        if (cs.stripe_connect_id) {
          const as = await partnerPost("get_account_session", {}, session.access_token);
          if (!as.error) setAccountSession(as.client_secret);
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
    { id:"details",   label:"Partner Details", icon:"🤝" },
    { id:"payouts",   label:"Payouts",         icon:"💸" },
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

      {/* PARTNER DETAILS */}
      {!loading && activeTab==="details" && <div style={{ padding:"1.5rem", maxWidth:1200, margin:"0 auto" }}>{(() => {
          const TIERS = [
            { key:"starter",  label:"Starter",  price:120, color:"#6366f1", bg:"#eef2ff" },
            { key:"standard", label:"Standard", price:220, color:"#8929bd", bg:"#f5f3ff" },
            { key:"premium",  label:"Premium",  price:400, color:"#d97706", bg:"#fef3c7" },
          ];
          const DEFAULT_BULLETS: Record<string,string[]> = {
            starter:  ["Published across 200+ media outlets","300-400 word press release","24-48 hour turnaround","Full distribution report included"],
            standard: ["Published across 400+ premium outlets","500-600 word press release","24 hour turnaround","Distribution report + analytics","Enhanced editorial placement"],
            premium:  ["Published across 600+ top-tier outlets","800-1000 word press release","Priority same-day processing","Full distribution report + analytics","TV/radio syndication included","Dedicated account support"],
          };
          const getBullets = (tier: string) => packageNotes.find((n:any)=>n.tier===tier)?.bullets || DEFAULT_BULLETS[tier] || [];
          const openEdit = (tier: string) => { setEditingTier(tier); setEditBullets([...getBullets(tier)]); };
          const saveNotes = async () => {
            if (!editingTier || !session) return;
            setSavingNotes(true);
            const d = await partnerPost("save_package_notes", { tier: editingTier, bullets: editBullets }, session.access_token);
            if (d.ok) {
              showToast("Package details updated — admin notified ✓");
              setPackageNotes((prev:any[]) => { const idx=prev.findIndex((n:any)=>n.tier===editingTier); const next=[...prev]; if(idx>=0) next[idx]={...next[idx],bullets:editBullets.filter(b=>b.trim())}; else next.push({tier:editingTier,bullets:editBullets.filter(b=>b.trim())}); return next; });
              setEditingTier(null);
            } else showToast(d.error||"Save failed","error");
            setSavingNotes(false);
          };
          const uploadDoc = async () => {
            if (!uploadFile || !uploadName || !session) return;
            setUploading(true);
            try {
              const { supabase: partnerSupa } = await import("../../lib/supabase-partner");
              const path = `${Date.now()}-${uploadFile.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
              const { data: storageData, error: storageErr } = await partnerSupa.storage.from("partner-docs").upload(path, uploadFile, { contentType: uploadFile.type });
              if (storageErr || !storageData) { showToast(storageErr?.message||"Upload failed","error"); setUploading(false); return; }
              const { data: { publicUrl } } = partnerSupa.storage.from("partner-docs").getPublicUrl(storageData.path);
              const d = await partnerPost("save_document_metadata", { name:uploadName, description:uploadDesc, file_url:publicUrl, file_name:uploadFile.name, file_size:uploadFile.size }, session.access_token);
              if (d.ok) {
                showToast("Document uploaded — admin notified ✓");
                if (d.document) setDocuments((prev:any[]) => [d.document, ...prev]);
                setUploadModal(false); setUploadName(""); setUploadDesc(""); setUploadFile(null);
              } else showToast(d.error||"Save failed","error");
            } catch (e: any) { showToast(e.message,"error"); }
            setUploading(false);
          };
          const deleteDoc = async (doc: any) => {
            if (!confirm(`Delete "${doc.name}"?`) || !session) return;
            const d = await partnerPost("delete_document", { id:doc.id, file_url:doc.file_url }, session.access_token);
            if (d.ok) { showToast("Document deleted"); setDocuments((prev:any[])=>prev.filter((x:any)=>x.id!==doc.id)); }
            else showToast(d.error,"error");
          };
          const fmtSize = (bytes: number) => bytes>1048576?`${(bytes/1048576).toFixed(1)} MB`:bytes>1024?`${Math.round(bytes/1024)} KB`:`${bytes} B`;

          return (
            <div style={{ padding:"0 0 2rem" }}>
              {/* Package Pricing */}
              <div style={{ marginBottom:"2.5rem" }}>
                <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:"0 0 .3rem" }}>Package Pricing</h2>
                <p style={{ color:"#64748b", fontSize:".82rem", margin:"0 0 1.25rem" }}>Partner payout rates per press release. Click "Edit &amp; Send" to update features — admin will be notified by email.</p>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:"1rem" }}>
                  {TIERS.map(tier => {
                    const bullets = getBullets(tier.key);
                    return (
                      <div key={tier.key} style={{ background:"white", borderRadius:".875rem", border:`1.5px solid ${tier.color}30`, overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 2px 8px rgba(0,0,0,.05)" }}>
                        <div style={{ background:`linear-gradient(135deg,${tier.color}15,${tier.color}05)`, borderBottom:`1px solid ${tier.color}20`, padding:"1rem 1.25rem" }}>
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:".2rem" }}>
                            <span style={{ fontWeight:800, fontSize:".9rem", color:tier.color }}>{tier.label}</span>
                            <span style={{ fontWeight:900, fontSize:"1.4rem", color:tier.color }}>${tier.price}</span>
                          </div>
                          <div style={{ fontSize:".7rem", color:"#94a3b8" }}>per press release</div>
                        </div>
                        <div style={{ padding:"1rem 1.25rem", flex:1 }}>
                          <ul style={{ margin:0, padding:0, listStyle:"none", display:"flex", flexDirection:"column", gap:".4rem" }}>
                            {(bullets as string[]).map((b, i) => (
                              <li key={i} style={{ fontSize:".8rem", color:"#374151", display:"flex", alignItems:"flex-start", gap:".45rem" }}>
                                <span style={{ color:tier.color, flexShrink:0 }}>•</span>{b}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div style={{ padding:".75rem 1.25rem", borderTop:`1px solid ${tier.color}15` }}>
                          <button onClick={() => openEdit(tier.key)}
                            style={{ width:"100%", padding:".55rem", borderRadius:".5rem", border:`1.5px solid ${tier.color}`, background:"white", color:tier.color, fontWeight:700, fontSize:".8rem", cursor:"pointer" }}>
                            ✏️ Edit &amp; Send
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Partner Documents */}
              <div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1rem" }}>
                  <div>
                    <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:"0 0 .2rem" }}>Partner Documents</h2>
                    <p style={{ color:"#64748b", fontSize:".82rem", margin:0 }}>Upload reports, contracts, and other files. Admin is notified on each upload.</p>
                  </div>
                  <button onClick={()=>setUploadModal(true)}
                    style={{ padding:".65rem 1.5rem", borderRadius:".55rem", border:"none", background:"linear-gradient(135deg,#6366f1,#8929bd)", color:"white", fontWeight:800, fontSize:".85rem", cursor:"pointer", whiteSpace:"nowrap" }}>
                    📎 Upload &amp; Send
                  </button>
                </div>
                {documents.length === 0 ? (
                  <div style={{ background:"white", borderRadius:".75rem", border:"1px solid #f1f5f9", padding:"3rem", textAlign:"center" }}>
                    <div style={{ fontSize:"2rem", marginBottom:".5rem" }}>📁</div>
                    <div style={{ fontWeight:600, color:"#1e293b" }}>No documents yet</div>
                    <div style={{ color:"#94a3b8", fontSize:".82rem", marginTop:".25rem" }}>Upload documents to share with the admin team</div>
                  </div>
                ) : (
                  <div style={{ background:"white", borderRadius:".75rem", border:"1px solid #f1f5f9", overflow:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:".82rem" }}>
                      <thead><tr style={{ background:"#1a0a2e" }}>
                        {["Document","Description","File","Uploaded",""].map(h=>(
                          <th key={h} style={{ padding:".65rem 1rem", textAlign:"left", fontWeight:700, color:"rgba(255,255,255,.8)", fontSize:".68rem", textTransform:"uppercase", letterSpacing:".05em" }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {(documents as any[]).map((doc)=>(
                          <tr key={doc.id} style={{ borderTop:"1px solid #f8fafc" }}
                            onMouseOver={e=>(e.currentTarget.style.background="#fafafa")}
                            onMouseOut={e=>(e.currentTarget.style.background="white")}>
                            <td style={{ padding:".75rem 1rem", fontWeight:600, color:"#1e293b" }}>{doc.name}</td>
                            <td style={{ padding:".75rem 1rem", color:"#64748b", fontSize:".78rem", maxWidth:200 }}>
                              <div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{doc.description||"—"}</div>
                            </td>
                            <td style={{ padding:".75rem 1rem" }}>
                              {doc.file_url?(
                                <a href={doc.file_url} target="_blank" rel="noreferrer"
                                  style={{ color:"#8929bd", fontWeight:600, fontSize:".78rem", textDecoration:"none", display:"flex", alignItems:"center", gap:".3rem" }}>
                                  📄 {doc.file_name||"View"}{doc.file_size?<span style={{ color:"#94a3b8", fontWeight:400 }}> ({fmtSize(doc.file_size)})</span>:null}
                                </a>
                              ):"—"}
                            </td>
                            <td style={{ padding:".75rem 1rem", color:"#64748b", whiteSpace:"nowrap", fontSize:".78rem" }}>
                              {doc.uploaded_at?new Date(doc.uploaded_at).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}):"—"}
                            </td>
                            <td style={{ padding:".75rem 1rem" }}>
                              <button onClick={()=>deleteDoc(doc)}
                                style={{ fontSize:".72rem", padding:".25rem .65rem", borderRadius:".35rem", border:"1px solid #fee2e2", background:"white", color:"#991b1b", cursor:"pointer", fontWeight:600 }}>
                                🗑 Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Stripe Connect section */}
              <div style={{ marginTop:"2.5rem" }}>
                <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:"0 0 .3rem" }}>Stripe Connect</h2>
                <p style={{ color:"#64748b", fontSize:".82rem", margin:"0 0 1.25rem" }}>Connect your Stripe account to receive automatic payouts when PRs are fulfilled.</p>
                {connectStatus === "active" && connectId ? (
                  <div style={{ display:"flex", alignItems:"center", gap:"1rem", padding:"1rem 1.5rem", background:"linear-gradient(135deg,#fffbeb,#fef3c7)", border:"1.5px solid #d97706", borderRadius:".75rem" }}>
                    <div style={{ fontSize:"1.5rem" }}>✅</div>
                    <div>
                      <div style={{ fontWeight:800, fontSize:".95rem", color:"#92400e" }}>Stripe Connected</div>
                      <div style={{ fontSize:".75rem", color:"#b45309", marginTop:".1rem", fontFamily:"monospace" }}>{connectId}</div>
                    </div>
                    <span style={{ marginLeft:"auto", background:"#d97706", color:"white", fontWeight:800, fontSize:".72rem", padding:".3rem .85rem", borderRadius:"99px" }}>Active</span>
                  </div>
                ) : (
                  <div style={{ padding:"1.5rem", background:"white", borderRadius:".75rem", border:"1.5px solid #e2e8f0", textAlign:"center" }}>
                    <div style={{ fontSize:"2rem", marginBottom:".5rem" }}>🔗</div>
                    <div style={{ fontWeight:700, color:"#1e293b", marginBottom:".3rem" }}>Connect your Stripe account</div>
                    <div style={{ color:"#64748b", fontSize:".82rem", marginBottom:"1.25rem" }}>You'll be redirected to Stripe to complete the Express onboarding. Takes about 2 minutes.</div>
                    <a
                      href={`https://connect.stripe.com/express/oauth/authorize?client_id=${connectClientId}&state=stripe_connect&redirect_uri=https://mediablast.xlogic.app/partner&suggested_capabilities[]=transfers`}
                      style={{ display:"inline-flex", alignItems:"center", gap:".5rem", padding:".75rem 1.75rem", borderRadius:".6rem", background:"linear-gradient(135deg,#635bff,#0a2540)", color:"white", fontWeight:800, fontSize:".9rem", textDecoration:"none", boxShadow:"0 4px 14px rgba(99,91,255,.35)" }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/></svg>
                      Connect with Stripe
                    </a>
                  </div>
                )}
              </div>
              {editingTier && (()=>{
                const tier=TIERS.find(t=>t.key===editingTier)!;
                return(
                  <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.55)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
                    <div style={{background:"white",borderRadius:"1rem",width:"100%",maxWidth:500,maxHeight:"85vh",overflow:"auto",boxShadow:"0 24px 80px rgba(0,0,0,.3)"}}>
                      <div style={{padding:"1.25rem 1.5rem",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:"white",zIndex:1}}>
                        <div>
                          <h3 style={{fontWeight:900,margin:"0 0 .15rem",fontSize:"1.05rem"}}>✏️ Edit {tier.label} Package</h3>
                          <div style={{fontSize:".75rem",color:"#94a3b8"}}>Changes will be emailed to admin</div>
                        </div>
                        <button onClick={()=>setEditingTier(null)} style={{background:"none",border:"none",fontSize:"1.2rem",cursor:"pointer",color:"#94a3b8",lineHeight:1}}>✕</button>
                      </div>
                      <div style={{padding:"1.5rem",display:"flex",flexDirection:"column",gap:".5rem"}}>
                        {editBullets.map((bullet,i)=>(
                          <div key={i} style={{display:"flex",gap:".5rem",alignItems:"center"}}>
                            <span style={{color:tier.color,fontWeight:700,fontSize:"1rem",flexShrink:0}}>•</span>
                            <input value={bullet} onChange={e=>{const n=[...editBullets];n[i]=e.target.value;setEditBullets(n);}} placeholder={`Feature ${i+1}`}
                              style={{flex:1,padding:".45rem .7rem",borderRadius:".4rem",border:"1.5px solid #e2e8f0",fontSize:".84rem",outline:"none"}}/>
                            <button onClick={()=>setEditBullets(editBullets.filter((_,j)=>j!==i))}
                              style={{background:"none",border:"none",cursor:"pointer",color:"#ef4444",fontSize:"1rem",lineHeight:1,flexShrink:0}}>✕</button>
                          </div>
                        ))}
                        <button onClick={()=>setEditBullets([...editBullets,""])}
                          style={{alignSelf:"flex-start",padding:".4rem .9rem",borderRadius:".4rem",border:`1.5px dashed ${tier.color}60`,background:tier.bg,color:tier.color,fontWeight:600,fontSize:".8rem",cursor:"pointer",marginTop:".25rem"}}>
                          + Add bullet
                        </button>
                        <div style={{display:"flex",gap:".75rem",marginTop:".75rem"}}>
                          <button onClick={()=>setEditingTier(null)} style={{flex:1,padding:".65rem",borderRadius:".5rem",border:"1px solid #e2e8f0",background:"white",fontWeight:600,cursor:"pointer"}}>Cancel</button>
                          <button onClick={saveNotes} disabled={savingNotes}
                            style={{flex:2,padding:".65rem",borderRadius:".5rem",border:"none",background:savingNotes?"#e2e8f0":`linear-gradient(135deg,${tier.color},${tier.color}bb)`,color:savingNotes?"#94a3b8":"white",fontWeight:800,cursor:savingNotes?"not-allowed":"pointer",fontSize:".9rem"}}>
                            {savingNotes?"Saving…":"✏️ Edit & Send"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Upload Document Modal */}
              {uploadModal&&(
                <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.55)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
                  <div style={{background:"white",borderRadius:"1rem",width:"100%",maxWidth:460,boxShadow:"0 24px 80px rgba(0,0,0,.3)"}}>
                    <div style={{padding:"1.25rem 1.5rem",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <h3 style={{fontWeight:900,margin:"0 0 .15rem",fontSize:"1.05rem"}}>📎 Upload Document</h3>
                        <div style={{fontSize:".75rem",color:"#94a3b8"}}>Admin will receive an email notification</div>
                      </div>
                      <button onClick={()=>{setUploadModal(false);setUploadName("");setUploadDesc("");setUploadFile(null);}} style={{background:"none",border:"none",fontSize:"1.2rem",cursor:"pointer",color:"#94a3b8",lineHeight:1}}>✕</button>
                    </div>
                    <div style={{padding:"1.5rem",display:"flex",flexDirection:"column",gap:".85rem"}}>
                      <div>
                        <label style={{fontSize:".75rem",fontWeight:700,color:"#374151",display:"block",marginBottom:".3rem"}}>Document Name *</label>
                        <input value={uploadName} onChange={e=>setUploadName(e.target.value)} placeholder="e.g. Q2 Distribution Report"
                          style={{width:"100%",padding:".5rem .75rem",borderRadius:".45rem",border:"1.5px solid #e2e8f0",fontSize:".84rem",boxSizing:"border-box" as const}}/>
                      </div>
                      <div>
                        <label style={{fontSize:".75rem",fontWeight:700,color:"#374151",display:"block",marginBottom:".3rem"}}>Description <span style={{color:"#94a3b8",fontWeight:400}}>(optional)</span></label>
                        <textarea value={uploadDesc} onChange={e=>setUploadDesc(e.target.value)} placeholder="Brief description…" rows={2}
                          style={{width:"100%",padding:".5rem .75rem",borderRadius:".45rem",border:"1.5px solid #e2e8f0",fontSize:".84rem",boxSizing:"border-box" as const,resize:"vertical" as const}}/>
                      </div>
                      <div>
                        <label style={{fontSize:".75rem",fontWeight:700,color:"#374151",display:"block",marginBottom:".3rem"}}>File *</label>
                        <div onClick={()=>document.getElementById("partner-file-input")?.click()}
                          style={{border:`2px dashed ${uploadFile?"#10b981":"#e2e8f0"}`,borderRadius:".55rem",padding:"1.25rem",textAlign:"center",cursor:"pointer",background:uploadFile?"#f0fdf4":"#fafafa",transition:"all .15s"}}>
                          {uploadFile?(
                            <div><div style={{fontSize:"1.5rem",marginBottom:".25rem"}}>📄</div><div style={{fontWeight:600,fontSize:".84rem",color:"#166534"}}>{uploadFile.name}</div><div style={{fontSize:".72rem",color:"#94a3b8",marginTop:".15rem"}}>{fmtSize(uploadFile.size)}</div></div>
                          ):(
                            <div><div style={{fontSize:"1.5rem",marginBottom:".25rem"}}>📂</div><div style={{fontSize:".84rem",color:"#64748b"}}>Click to select a file</div><div style={{fontSize:".72rem",color:"#94a3b8",marginTop:".1rem"}}>PDF, Word, Excel, images…</div></div>
                          )}
                          <input id="partner-file-input" type="file" onChange={e=>setUploadFile(e.target.files?.[0]||null)} style={{display:"none"}}/>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:".75rem"}}>
                        <button onClick={()=>{setUploadModal(false);setUploadName("");setUploadDesc("");setUploadFile(null);}} style={{flex:1,padding:".65rem",borderRadius:".5rem",border:"1px solid #e2e8f0",background:"white",fontWeight:600,cursor:"pointer"}}>Cancel</button>
                        <button onClick={uploadDoc} disabled={uploading||!uploadFile||!uploadName}
                          style={{flex:2,padding:".65rem",borderRadius:".5rem",border:"none",background:uploading||!uploadFile||!uploadName?"#e2e8f0":"linear-gradient(135deg,#6366f1,#8929bd)",color:uploading||!uploadFile||!uploadName?"#94a3b8":"white",fontWeight:800,cursor:uploading?"not-allowed":"pointer",fontSize:".9rem"}}>
                          {uploading?"Uploading…":"📎 Upload & Send"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
      })()}</div>}

      {/* PAYOUTS */}
      {!loading && activeTab==="payouts" && (
        <div style={{ padding:"1.5rem", maxWidth:1200, margin:"0 auto" }}>
          <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:"0 0 .3rem" }}>💸 Payouts</h2>
          <p style={{ color:"#64748b", fontSize:".82rem", margin:"0 0 1.5rem" }}>View your available balance, payout history, and manage your bank account.</p>

          {!connectId || connectStatus !== "active" ? (
            <div style={{ background:"white", borderRadius:".875rem", border:"1px solid #f1f5f9", padding:"4rem 2rem", textAlign:"center" }}>
              <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>🔗</div>
              <h3 style={{ fontWeight:800, fontSize:"1.1rem", color:"#1e293b", margin:"0 0 .5rem" }}>Stripe not connected</h3>
              <p style={{ color:"#64748b", fontSize:".88rem", margin:"0 0 1.5rem", maxWidth:420, marginLeft:"auto", marginRight:"auto", lineHeight:1.65 }}>
                Please complete your Stripe setup in the Partner Details tab to view earnings and receive payouts.
              </p>
              <button onClick={()=>setActiveTab("details")}
                style={{ padding:".7rem 1.75rem", borderRadius:".6rem", border:"none", background:"linear-gradient(135deg,#6366f1,#8929bd)", color:"white", fontWeight:800, fontSize:".9rem", cursor:"pointer" }}>
                Go to Partner Details →
              </button>
            </div>
          ) : accountSession ? (
            <PayoutsEmbed clientSecret={accountSession} />
          ) : (
            <div style={{ textAlign:"center", padding:"3rem", color:"#94a3b8" }}>Loading payout dashboard…</div>
          )}
        </div>
      )}

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
