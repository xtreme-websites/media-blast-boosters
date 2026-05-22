import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, partnerPost } from "../../lib/supabase-partner";
import type { Session } from "@supabase/supabase-js";
import RichEditor, { RichToolbar } from "../RichEditor";

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

type Tab = "overview" | "revenue" | "queue" | "pr_orders" | "pipeline" | "report_pending" | "details" | "payouts";

interface Order {
  id: string; location_id: string; pr_title: string; product_name: string;
  status: string; created_at: string; pr_content?: string; pr_content_original?: string;
  company_name?: string; ready_for_partner?: boolean; report_data?: any;
}

const TIER_COLORS: Record<string, string> = { starter:"#6366f1", standard:"#8929bd", premium:"#d97706" };
const PAYOUT: Record<string, number> = { starter:120, standard:220, premium:350 };
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
  const prefill = new URLSearchParams(window.location.search).get("email") || "";
  const [email,   setEmail]   = useState(prefill);
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
  const [pipelineItems,   setPipelineItems]   = useState<any[]>([]);
  const [pipelineTotal,   setPipelineTotal]   = useState(0);
  const [pipelineFilter,  setPipelineFilter]  = useState<"all"|"scheduled"|"draft"|"unused">("all");
  const [connectId,    setConnectId]    = useState<string|null>(null);
  const [connectStatus,setConnectStatus]= useState("not_connected");
  const [accountSession, setAccountSession] = useState<string|null>(null);
  const [accountSessionError, setAccountSessionError] = useState<string|null>(null);
  const [partnerName,  setPartnerName]  = useState("");
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [profile,       setProfile]       = useState({ email:"", contact:"", company:"", phone:"", website:"" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileDirty,  setProfileDirty]  = useState(false);
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

  // Report Pending
  const [reportPending, setReportPending] = useState<Order[]>([]);
  const [reportUploadModal, setReportUploadModal] = useState<Order|null>(null);
  const [reportCsvFile,     setReportCsvFile]     = useState<File|null>(null);
  const [reportCsvPreview,  setReportCsvPreview]  = useState<{count:number}|null>(null);
  const [reportConfirmed,   setReportConfirmed]   = useState(false);
  const [reportUploading,   setReportUploading]   = useState(false);

  // PR preview modal
  const [previewOrder,    setPreviewOrder]    = useState<Order|null>(null);
  const [editedContent,   setEditedContent]   = useState("");
  const partnerEditorRef = useRef<HTMLDivElement>(null);
  const isPartnerTypingRef = useRef(false);
  const originalContentRef = useRef<string>("");
  const [originalContent, setOriginalContent] = useState("");
  // Hydrate partner editor imperatively when a new order is opened (prevents scroll reset)
  useEffect(() => {
    if (previewOrder && partnerEditorRef.current) {
      isPartnerTypingRef.current = false;
      const content = previewOrder.pr_content || "<p>No content</p>";
      partnerEditorRef.current.innerHTML = content;
      originalContentRef.current = content;  // sync ref — no batching delay
      setOriginalContent(content);
      setEditedContent(content);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(previewOrder as any)?.id]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const showToast = (msg: string, type: "success"|"error" = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500);
  };

  // Auth
  // Handle Stripe Connect Account Links return + general ?tab= deep links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam  = params.get("tab") as Tab | null;
    const stripeReturn  = params.get("stripe_return");
    const stripeRefresh = params.get("stripe_refresh");

    if (stripeReturn || stripeRefresh) {
      // Clear params, land on details tab
      window.history.replaceState({}, "", "/partner?tab=details");
      setActiveTab("details"); // always navigate to details after Stripe redirect

      if (stripeReturn) {
        // Verify account status after onboarding
        const doVerify = async () => {
          const { data: { session: s } } = await supabase.auth.getSession();
          if (!s) return;
          const d = await partnerPost("verify_connect", {}, s.access_token);
          if (d.ok) {
            setConnectStatus(d.status);
            if (d.status === "active") setConnectId(prev => prev); // already set
          }
          // Reload details to get latest connect state
          const det = await partnerPost("get_details", {}, s.access_token);
          if (!det.error) { setConnectId(det.stripe_connect_id); setConnectStatus(det.stripe_connect_status || "not_connected"); }
        };
        setTimeout(doVerify, 800);
      }
      // stripe_refresh = user needs to re-do onboarding (link expired) — UI will show button again
    } else if (tabParam) {
      setActiveTab(tabParam);
      window.history.replaceState({}, "", `/partner?tab=${tabParam}`);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkPartner(session); else setAuthCheck(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) { checkPartner(s); } else { setIsPartner(false); setAuthCheck(false); }
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
        if (!d.error) { setPackageNotes(d.notes || []); setDocuments(d.documents || []); setConnectId(d.stripe_connect_id); setConnectStatus(d.stripe_connect_status||"not_connected"); if(d.partner_name) setPartnerName(d.partner_name); }
        // Load profile separately so we always get fresh data
        const pf = await partnerPost("get_profile", {}, session.access_token);
        if (!pf.error) setProfile({ email: pf.email||"", contact: pf.contact||"", company: pf.company||"", phone: pf.phone||"", website: pf.website||"" });
      }
      if (tab === "pipeline") {
        const d = await partnerPost("get_pipeline", {}, session.access_token);
        if (!d.error) { setPipelineItems(d.items || []); setPipelineTotal(d.total_pipeline || 0); }
      }
      if (tab === "payouts") {
        const cs = await partnerPost("get_connect_status", {}, session.access_token);
        if (!cs.error) { setConnectId(cs.stripe_connect_id); setConnectStatus(cs.stripe_connect_status||"not_connected"); setConnectClientId(cs.connect_client_id||"ca_UVPxtVObJ1J2nUieqPiHROqJn7etM44E"); }
        if (cs.stripe_connect_id) {
          const as = await partnerPost("get_account_session", {}, session.access_token);
          if (!as.error) { setAccountSession(as.client_secret); setAccountSessionError(null); }
          else setAccountSessionError(as.error as string);
        }
      }
      if (tab === "pr_orders") {
        const d = await partnerPost("get_all_orders", {}, session.access_token);
        if (!d.error) setAllOrders(d.orders || []);
      }
      if (tab === "report_pending") {
        const d = await partnerPost("get_report_pending", {}, session.access_token);
        if (!d.error) setReportPending(d.orders || []);
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

  const [rejectModal, setRejectModal] = useState<{orderId:string; title?:string} | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const rejectOrder = (order_id: string, title?: string) => {
    setRejectReason("");
    setRejectModal({ orderId: order_id, title });
    setPreviewOrder(null); setEditedContent(""); setOriginalContent("");
  };

  const submitReject = async () => {
    if (!rejectModal || !rejectReason.trim() || !session) return;
    setRejecting(true);
    const d = await partnerPost("reject_order", { order_id: rejectModal.orderId, reason: rejectReason.trim() }, session.access_token);
    if (!d.error) { showToast("PR rejected — client notified ✓"); load("queue"); load("pr_orders"); setRejectModal(null); setRejectReason(""); }
    else showToast(d.error, "error");
    setRejecting(false);
  };

  const approveWithChanges = async () => {
    if (!previewOrder || !session) return;
    // Both refs read synchronously — no React batching delay
    const currentContent = partnerEditorRef.current?.innerHTML || originalContentRef.current;
    const d = await partnerPost("approve_with_changes", {
      order_id: previewOrder.id, original_content: originalContentRef.current,
      new_content: currentContent, location_id: previewOrder.location_id
    }, session.access_token);
    if (!d.error) { showToast("Approved with changes — client notified ✓"); setPreviewOrder(null); setEditedContent(""); setOriginalContent(""); load("queue"); }
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

  const parseReportCsv = (text: string): {domain:string;status:string;published_url:string;published_at:string;da:number}[] => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    return lines.slice(1).map(line => {
      const cols = line.split(",");
      return { domain: cols[0]?.trim()||"", status: cols[1]?.trim()||"", published_url: cols[2]?.trim()||"", published_at: cols[3]?.trim()||"", da: parseInt(cols[5]?.trim()||"0")||0 };
    }).filter(r => r.domain && r.status?.toLowerCase() === "published");
  };

  const handleReportCsvSelect = (file: File) => {
    setReportCsvFile(file);
    setReportCsvPreview(null);
    const reader = new FileReader();
    reader.onload = e => {
      const rows = parseReportCsv(e.target?.result as string);
      setReportCsvPreview({ count: rows.length });
    };
    reader.readAsText(file);
  };

  const submitReport = async () => {
    if (!reportUploadModal || !reportCsvFile || !reportConfirmed || !session) return;
    setReportUploading(true);
    try {
      const text = await reportCsvFile.text();
      const csv_rows = parseReportCsv(text);
      if (csv_rows.length === 0) { showToast("No published rows found in CSV", "error"); return; }
      const d = await partnerPost("upload_report", { order_id: reportUploadModal.id, csv_rows }, session.access_token);
      if (!d.error) {
        showToast("Report uploaded — PR marked as Published ✓");
        setReportUploadModal(null); setReportCsvFile(null); setReportCsvPreview(null); setReportConfirmed(false);
        load("report_pending"); load("pr_orders");
      } else showToast(d.error, "error");
    } catch { showToast("Upload failed", "error"); }
    setReportUploading(false);
  };

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id:"overview",       label:"Overview",        icon:"📊" },
    { id:"revenue",        label:"Revenue",         icon:"💰" },
    { id:"queue",          label:"Approval Queue",  icon:"📋" },
    { id:"report_pending", label:"Report Pending",  icon:"📤" },
    { id:"pr_orders",      label:"PR Orders",       icon:"📰" },
    { id:"pipeline",       label:"Pipeline",        icon:"📈" },
    { id:"details",        label:"Partner Details", icon:"🤝" },
    { id:"payouts",        label:"Payouts",         icon:"💸" },
  ];

  const navigateTab = (tab: Tab) => {
    setActiveTab(tab);
    window.history.replaceState({}, "", `/partner?tab=${tab}`);
  };

  const queueBadge = queue.length;
  const reportPendingBadge = reportPending.length;

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
            <button key={t.id} onClick={() => navigateTab(t.id)}
              style={{ padding:".85rem 1.1rem", border:"none", borderBottom: activeTab===t.id ? "2.5px solid #8929bd" : "2.5px solid transparent", background:"transparent", color: activeTab===t.id ? "#8929bd" : "#64748b", fontWeight: activeTab===t.id ? 700 : 500, fontSize:".84rem", cursor:"pointer", display:"flex", alignItems:"center", gap:".4rem", whiteSpace:"nowrap" }}>
              {t.icon} {t.label}
              {t.id==="queue" && queueBadge > 0 && (
                <span style={{ background:"#ef4444", color:"white", fontSize:".6rem", fontWeight:900, padding:".1rem .4rem", borderRadius:"99px" }}>{queueBadge}</span>
              )}
              {t.id==="report_pending" && reportPendingBadge > 0 && (
                <span style={{ background:"#8929bd", color:"white", fontSize:".6rem", fontWeight:900, padding:".1rem .4rem", borderRadius:"99px" }}>{reportPendingBadge}</span>
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
                        <button onClick={()=>rejectOrder(order.id, order.pr_title)}
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
                  {["Company","PR Title","Package","Status","Date","Report"].map(h=>(
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
                        <td style={{ padding:".7rem 1rem", textAlign:"center" }}>
                          {order.report_data ? (
                            <a href={`/report/${order.id}`} target="_blank" rel="noopener noreferrer"
                              style={{ fontSize:".75rem", fontWeight:700, color:"#8929bd", textDecoration:"none", display:"inline-flex", alignItems:"center", gap:".2rem" }}
                              onClick={e=>e.stopPropagation()}>
                              See Report ↗
                            </a>
                          ) : <span style={{ color:"#cbd5e1", fontSize:".72rem" }}>—</span>}
                        </td>
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

      {/* PIPELINE */}
      {!loading && activeTab==="pipeline" && (
        <div style={{ padding:"1.5rem", maxWidth:1200, margin:"0 auto" }}>
          {/* Header + Total Pipeline Value */}
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:"1rem", marginBottom:"1.5rem" }}>
            <div>
              <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:"0 0 .25rem" }}>📈 Pipeline</h2>
              <p style={{ color:"#64748b", fontSize:".82rem", margin:0 }}>Fulfillment forecast based on purchased credits and active drafts.</p>
            </div>
            <div style={{ background:"linear-gradient(135deg,#1a0a2e,#2d1054)", borderRadius:".875rem", padding:"1rem 1.5rem", textAlign:"right", minWidth:200 }}>
              <div style={{ fontSize:".7rem", fontWeight:700, color:"rgba(255,255,255,.5)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:".25rem" }}>Total Pipeline Value</div>
              <div style={{ fontSize:"1.75rem", fontWeight:900, color:"white" }}>
                ${pipelineTotal.toLocaleString("en-US", { minimumFractionDigits:0 })}
              </div>
              <div style={{ fontSize:".72rem", color:"rgba(255,255,255,.4)", marginTop:".15rem" }}>{pipelineItems.length} items</div>
            </div>
          </div>

          {/* Status filter pills */}
          <div style={{ display:"flex", gap:".5rem", marginBottom:"1.25rem", flexWrap:"wrap" }}>
            {([
              { key:"all",       label:"All",           count: pipelineItems.length },
              { key:"scheduled", label:"🗓 Scheduled",  count: pipelineItems.filter(i=>i.status==="scheduled").length },
              { key:"draft",     label:"✏️ In Draft",   count: pipelineItems.filter(i=>i.status==="draft").length },
              { key:"unused",    label:"💤 Unused",     count: pipelineItems.filter(i=>i.status==="unused").length },
            ] as { key: typeof pipelineFilter; label: string; count: number }[]).map(f => (
              <button key={f.key} onClick={() => setPipelineFilter(f.key)}
                style={{ padding:".4rem .9rem", borderRadius:"99px", border:`1.5px solid ${pipelineFilter===f.key?"#8929bd":"#e2e8f0"}`, background:pipelineFilter===f.key?"#f5f3ff":"white", color:pipelineFilter===f.key?"#8929bd":"#374151", fontWeight:pipelineFilter===f.key?700:500, fontSize:".8rem", cursor:"pointer", display:"flex", alignItems:"center", gap:".35rem" }}>
                {f.label}
                <span style={{ background:pipelineFilter===f.key?"#8929bd":"#e2e8f0", color:pipelineFilter===f.key?"white":"#64748b", fontSize:".65rem", fontWeight:800, padding:".1rem .4rem", borderRadius:"99px" }}>{f.count}</span>
              </button>
            ))}
          </div>

          {/* Data grid */}
          {pipelineItems.length === 0 ? (
            <div style={{ background:"white", borderRadius:".75rem", border:"1px solid #f1f5f9", padding:"3rem", textAlign:"center" }}>
              <div style={{ fontSize:"2.5rem", marginBottom:".75rem" }}>📭</div>
              <div style={{ fontWeight:700, color:"#1e293b" }}>No pipeline data yet</div>
              <div style={{ color:"#94a3b8", fontSize:".82rem", marginTop:".3rem" }}>Items will appear as clients purchase credits and create drafts</div>
            </div>
          ) : (() => {
            const STATUS_STYLES: Record<string, { bg:string; color:string; label:string }> = {
              scheduled: { bg:"#fef3c7", color:"#92400e",  label:"Scheduled"     },
              draft:     { bg:"#dbeafe", color:"#1d4ed8",  label:"In Draft"      },
              unused:    { bg:"#f1f5f9", color:"#475569",  label:"Unused Credit" },
            };
            const TIER_COLORS: Record<string,string> = { starter:"#6366f1", standard:"#8929bd", premium:"#d97706" };

            const filtered = pipelineItems.filter(i => pipelineFilter === "all" || i.status === pipelineFilter);
            const filteredTotal = filtered.reduce((s:number, i:any) => s + i.payout, 0);

            return (
              <div>
                {pipelineFilter !== "all" && (
                  <div style={{ marginBottom:".75rem", fontSize:".82rem", color:"#64748b" }}>
                    <span style={{ fontWeight:700, color:"#1e293b" }}>{filtered.length} items</span> · Est. value: <span style={{ fontWeight:700, color:"#8929bd" }}>${filteredTotal.toLocaleString()}</span>
                  </div>
                )}
                <div style={{ background:"white", borderRadius:".875rem", border:"1px solid #f1f5f9", overflow:"auto", boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:".83rem" }}>
                    <thead>
                      <tr style={{ background:"#1a0a2e" }}>
                        {["Location","Tier","Status","Est. Payout","Actionable Date"].map(h => (
                          <th key={h} style={{ padding:".75rem 1rem", textAlign:"left", fontWeight:700, color:"rgba(255,255,255,.75)", fontSize:".68rem", textTransform:"uppercase", letterSpacing:".06em", whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((item: any) => {
                        const ss = STATUS_STYLES[item.status];
                        const tierColor = TIER_COLORS[item.tier] || "#6366f1";
                        return (
                          <tr key={item.key} style={{ borderTop:"1px solid #f8fafc" }}
                            onMouseOver={e=>(e.currentTarget.style.background="#fafafa")}
                            onMouseOut={e=>(e.currentTarget.style.background="white")}>
                            {/* Location */}
                            <td style={{ padding:".8rem 1rem" }}>
                              <div style={{ fontWeight:600, color:"#1e293b", fontSize:".85rem" }}>{item.company_name}</div>
                              <div style={{ fontSize:".7rem", color:"#94a3b8", fontFamily:"monospace", marginTop:".1rem" }}>{item.location_id}</div>
                            </td>
                            {/* Tier */}
                            <td style={{ padding:".8rem 1rem" }}>
                              <span style={{ fontWeight:700, fontSize:".75rem", color:tierColor, background:tierColor+"18", padding:".2rem .6rem", borderRadius:"99px", textTransform:"capitalize" as const }}>
                                {item.tier}
                              </span>
                            </td>
                            {/* Status */}
                            <td style={{ padding:".8rem 1rem" }}>
                              <span style={{ fontWeight:700, fontSize:".75rem", color:ss.color, background:ss.bg, padding:".25rem .65rem", borderRadius:"99px", whiteSpace:"nowrap" as const }}>
                                {ss.label}
                                {item.status === "unused" && item.credits > 1 && (
                                  <span style={{ marginLeft:".35rem", opacity:.75 }}>×{item.credits}</span>
                                )}
                              </span>
                            </td>
                            {/* Est. Payout */}
                            <td style={{ padding:".8rem 1rem" }}>
                              <span style={{ fontWeight:800, fontSize:".88rem", color:"#8929bd" }}>
                                ${item.payout.toLocaleString()}
                              </span>
                              {item.status === "unused" && item.credits > 1 && (
                                <div style={{ fontSize:".68rem", color:"#94a3b8", marginTop:".1rem" }}>${PAYOUT[item.tier]||120} × {item.credits}</div>
                              )}
                            </td>
                            {/* Actionable Date */}
                            <td style={{ padding:".8rem 1rem", color:"#64748b", fontSize:".78rem", whiteSpace:"nowrap" as const }}>
                              {item.actionable_date
                                ? new Date(item.actionable_date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})
                                : <span style={{ color:"#cbd5e1" }}>—</span>
                              }
                              {item.status === "scheduled" && item.actionable_date && new Date(item.actionable_date) > new Date() && (
                                <div style={{ fontSize:".68rem", color:"#92400e", marginTop:".1rem" }}>
                                  {Math.ceil((new Date(item.actionable_date).getTime()-Date.now())/(1000*60*60*24))}d away
                                </div>
                              )}
                              {item.status === "draft" && item.actionable_date && (
                                <div style={{ fontSize:".68rem", color:"#64748b", marginTop:".1rem" }}>last edited</div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filtered.length === 0 && (
                    <div style={{ padding:"2.5rem", textAlign:"center", color:"#94a3b8" }}>No items match this filter</div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* REPORT PENDING */}
      {!loading && activeTab==="report_pending" && (
        <div style={{ padding:"1.5rem", maxWidth:1200, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"center", marginBottom:"1.25rem" }}>
            <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:0 }}>
              Report Pending
              {reportPendingBadge > 0 && <span style={{ marginLeft:".5rem", background:"#8929bd", color:"white", fontSize:".65rem", fontWeight:900, padding:".15rem .5rem", borderRadius:"99px" }}>{reportPendingBadge}</span>}
            </h2>
          </div>
          <p style={{ color:"#64748b", fontSize:".82rem", margin:"-.5rem 0 1.25rem" }}>Orders that have been submitted for distribution and are awaiting a distribution report upload.</p>
          {reportPending.length === 0 ? (
            <div style={{ background:"white", borderRadius:".75rem", padding:"3rem", textAlign:"center", border:"1px solid #f1f5f9" }}>
              <div style={{ fontSize:"2.5rem", marginBottom:".75rem" }}>📤</div>
              <div style={{ fontWeight:700, color:"#1e293b" }}>No reports pending</div>
              <div style={{ color:"#94a3b8", fontSize:".82rem", marginTop:".3rem" }}>All submitted PRs have reports uploaded</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
              {reportPending.map(order => (
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
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:".4rem", flexShrink:0 }}>
                      <button onClick={()=>{ setReportUploadModal(order); setReportCsvFile(null); setReportCsvPreview(null); setReportConfirmed(false); }}
                        style={{ padding:".5rem 1.1rem", borderRadius:".45rem", border:"none", background:"linear-gradient(135deg,#6366f1,#8929bd)", color:"white", fontSize:".8rem", fontWeight:700, cursor:"pointer" }}>
                        📤 Add Report
                      </button>
                      {(() => {
                        const days = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 86400000);
                        const cfg = days >= 7
                          ? { icon:"🔴", label:`${days} days — Urgent`,    bg:"#fef2f2", color:"#dc2626", border:"#fecaca" }
                          : days >= 4
                          ? { icon:"🟡", label:`${days} days — Follow up`, bg:"#fefce8", color:"#ca8a04", border:"#fef08a" }
                          : { icon:"🟢", label:`${days === 1 ? "1 day" : `${days} days`} — On track`, bg:"#f0fdf4", color:"#16a34a", border:"#bbf7d0" };
                        return (
                          <span style={{ fontSize:".68rem", fontWeight:700, color:cfg.color, background:cfg.bg, border:`1px solid ${cfg.border}`, padding:".2rem .55rem", borderRadius:"99px", whiteSpace:"nowrap" }}>
                            {cfg.icon} Pending {cfg.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REPORT UPLOAD MODAL */}
      {reportUploadModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
          <div style={{ background:"white", borderRadius:"1rem", width:"100%", maxWidth:480, padding:"2rem", boxShadow:"0 20px 60px rgba(0,0,0,.25)" }}>
            <h3 style={{ fontWeight:900, fontSize:"1.1rem", color:"#1e293b", margin:"0 0 .3rem" }}>Upload Distribution Report</h3>
            <p style={{ color:"#64748b", fontSize:".8rem", margin:"0 0 1.25rem" }}>
              Upload the CSV from your distribution service (Newswirejet, BrandPush, etc.) for:<br/>
              <strong style={{ color:"#1e293b" }}>{reportUploadModal.pr_title}</strong>
            </p>

            {/* CSV upload zone */}
            <label style={{ display:"block", border:"2px dashed #e2e8f0", borderRadius:".65rem", padding:"1.5rem", textAlign:"center", cursor:"pointer", background:"#f8fafc", marginBottom:"1rem", transition:"border-color .15s" }}
              onDragOver={e=>{e.preventDefault();(e.currentTarget as HTMLElement).style.borderColor="#8929bd";}}
              onDragLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="#e2e8f0";}}
              onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleReportCsvSelect(f);(e.currentTarget as HTMLElement).style.borderColor="#e2e8f0";}}>
              <input type="file" accept=".csv" style={{ display:"none" }} onChange={e=>{const f=e.target.files?.[0];if(f)handleReportCsvSelect(f);}}/>
              {reportCsvFile ? (
                <div>
                  <div style={{ fontSize:"1.5rem", marginBottom:".3rem" }}>📄</div>
                  <div style={{ fontWeight:700, color:"#1e293b", fontSize:".85rem" }}>{reportCsvFile.name}</div>
                  {reportCsvPreview && <div style={{ color:"#22c55e", fontWeight:700, fontSize:".78rem", marginTop:".3rem" }}>✓ {reportCsvPreview.count} published sites found</div>}
                </div>
              ) : (
                <div>
                  <div style={{ fontSize:"1.5rem", marginBottom:".3rem" }}>📂</div>
                  <div style={{ fontWeight:600, color:"#64748b", fontSize:".82rem" }}>Click or drag to upload CSV report</div>
                  <div style={{ color:"#94a3b8", fontSize:".72rem", marginTop:".2rem" }}>Accepts .csv files</div>
                </div>
              )}
            </label>

            {/* Confirmation checkbox */}
            <label style={{ display:"flex", alignItems:"flex-start", gap:".6rem", cursor:"pointer", marginBottom:"1.5rem" }}>
              <input type="checkbox" checked={reportConfirmed} onChange={e=>setReportConfirmed(e.target.checked)}
                style={{ marginTop:".15rem", accentColor:"#8929bd", width:15, height:15, flexShrink:0 }}/>
              <span style={{ color:"#475569", fontSize:".78rem", lineHeight:1.5 }}>
                I confirm I have reviewed this report for accuracy.
                <span style={{ color:"#ef4444", fontWeight:700 }}> Note: Reports cannot be resubmitted once uploaded.</span>
              </span>
            </label>

            <div style={{ display:"flex", gap:".75rem" }}>
              <button onClick={submitReport} disabled={!reportCsvFile||!reportConfirmed||reportUploading}
                style={{ flex:1, padding:".7rem", borderRadius:".5rem", border:"none", background: (!reportCsvFile||!reportConfirmed||reportUploading) ? "#e2e8f0" : "linear-gradient(135deg,#6366f1,#8929bd)", color: (!reportCsvFile||!reportConfirmed||reportUploading) ? "#94a3b8" : "white", fontWeight:700, fontSize:".85rem", cursor: (!reportCsvFile||!reportConfirmed||reportUploading) ? "not-allowed" : "pointer" }}>
                {reportUploading ? "Uploading…" : "📤 Upload Report"}
              </button>
              <button onClick={()=>{setReportUploadModal(null);setReportCsvFile(null);setReportCsvPreview(null);setReportConfirmed(false);}}
                style={{ padding:".7rem 1.25rem", borderRadius:".5rem", border:"1px solid #e2e8f0", background:"white", fontWeight:600, fontSize:".85rem", cursor:"pointer", color:"#64748b" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PARTNER DETAILS */}
      {!loading && activeTab==="details" && <div style={{ padding:"1.5rem", maxWidth:1200, margin:"0 auto" }}>{(() => {
          const TIERS = [
            { key:"starter",  label:"Starter",  price:120, color:"#6366f1", bg:"#eef2ff" },
            { key:"standard", label:"Standard", price:220, color:"#8929bd", bg:"#f5f3ff" },
            { key:"premium",  label:"Premium",  price:350, color:"#d97706", bg:"#fef3c7" },
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
                  <div style={{ background:"linear-gradient(135deg,#f5f3ff,#ede9fe)", border:"1.5px solid #635bff40", borderRadius:".875rem", overflow:"hidden" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"1rem", padding:"1rem 1.5rem" }}>
                      {/* Stripe logo mark */}
                      <div style={{ width:40, height:40, borderRadius:"50%", background:"linear-gradient(135deg,#635bff,#0a2540)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/></svg>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:".5rem" }}>
                          <span style={{ fontWeight:800, fontSize:".95rem", color:"#3730a3" }}>Stripe Connected</span>
                          <span style={{ background:"#635bff", color:"white", fontWeight:700, fontSize:".65rem", padding:".15rem .55rem", borderRadius:"99px", letterSpacing:".04em", textTransform:"uppercase" }}>Active</span>
                        </div>
                        <div style={{ fontSize:".78rem", color:"#6366f1", marginTop:".15rem" }}>
                          {partnerName || "Payouts enabled"} — payouts will be sent automatically
                        </div>
                      </div>
                      <button onClick={() => setShowDisconnect(true)}
                        style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", fontSize:".73rem", fontWeight:500, textDecoration:"underline", textUnderlineOffset:2, flexShrink:0, padding:".25rem .5rem" }}>
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding:"1.5rem", background:"white", borderRadius:".75rem", border:"1.5px solid #e2e8f0", textAlign:"center" }}>
                    <div style={{ fontSize:"2rem", marginBottom:".5rem" }}>🔗</div>
                    <div style={{ fontWeight:700, color:"#1e293b", marginBottom:".3rem" }}>
                      {connectStatus === "pending" ? "Complete your Stripe setup" : "Connect your Stripe account"}
                    </div>
                    <div style={{ color:"#64748b", fontSize:".82rem", marginBottom:"1.25rem" }}>
                      {connectStatus === "pending"
                        ? "Your account was created but onboarding isn't complete. Click below to continue — or refresh if you already finished."
                        : "You'll be redirected to Stripe to complete Express onboarding. Takes about 2 minutes."}
                    </div>
                    <div style={{ display:"flex", gap:".75rem", justifyContent:"center", flexWrap:"wrap" }}>
                      <button onClick={async () => {
                          if (!session) return;
                          const d = await partnerPost("initiate_connect", {}, session.access_token);
                          if (d.ok && d.url) window.location.href = d.url;
                          else alert(d.error || "Failed to start Stripe onboarding");
                        }}
                        style={{ display:"inline-flex", alignItems:"center", gap:".5rem", padding:".75rem 1.75rem", borderRadius:".6rem", background:"linear-gradient(135deg,#635bff,#0a2540)", color:"white", fontWeight:800, fontSize:".9rem", border:"none", cursor:"pointer", boxShadow:"0 4px 14px rgba(99,91,255,.35)" }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/></svg>
                        {connectStatus === "pending" ? "Continue Stripe Setup" : "Connect with Stripe"}
                      </button>
                      {connectStatus === "pending" && (
                        <button onClick={async () => {
                            if (!session) return;
                            const d = await partnerPost("verify_connect", {}, session.access_token);
                            if (d.ok) {
                              setConnectStatus(d.status);
                              if (d.status === "active") setConnectId(connectId);
                              showToast(d.status === "active" ? "✅ Stripe connected!" : "Setup still pending on Stripe's end");
                            } else showToast(d.error || "Could not verify status", "error");
                          }}
                          style={{ padding:".75rem 1.25rem", borderRadius:".6rem", border:"1.5px solid #e2e8f0", background:"white", color:"#374151", fontWeight:700, fontSize:".9rem", cursor:"pointer" }}>
                          🔄 Refresh Status
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Disconnect Confirmation Modal */}
              {showDisconnect && (
                <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1.5rem" }}>
                  <div style={{ background:"white", borderRadius:"1rem", width:"100%", maxWidth:420, boxShadow:"0 24px 80px rgba(0,0,0,.3)", overflow:"hidden" }}>
                    <div style={{ background:"linear-gradient(135deg,#991b1b,#dc2626)", padding:"1.25rem 1.5rem", display:"flex", alignItems:"center", gap:".75rem" }}>
                      <span style={{ fontSize:"1.4rem" }}>⚠️</span>
                      <h3 style={{ fontWeight:900, color:"white", margin:0, fontSize:"1.05rem" }}>Disconnect Stripe?</h3>
                    </div>
                    <div style={{ padding:"1.5rem" }}>
                      <p style={{ color:"#374151", fontSize:".88rem", lineHeight:1.65, margin:"0 0 1rem" }}>
                        Are you sure? Disconnecting Stripe will <strong>remove your payout method</strong>. You will no longer receive automatic payments for fulfilled PRs until you reconnect.
                      </p>
                      <ul style={{ color:"#64748b", fontSize:".82rem", margin:"0 0 1.5rem", paddingLeft:"1.25rem", lineHeight:1.8 }}>
                        <li>Your Stripe Express account is <strong>not deleted</strong></li>
                        <li>You can reconnect at any time</li>
                        <li>Past payout records remain in Stripe</li>
                      </ul>
                      <div style={{ display:"flex", gap:".75rem" }}>
                        <button onClick={() => setShowDisconnect(false)}
                          style={{ flex:1, padding:".65rem", borderRadius:".5rem", border:"1px solid #e2e8f0", background:"white", fontWeight:600, cursor:"pointer", fontSize:".88rem" }}>
                          Cancel
                        </button>
                        <button onClick={async () => {
                            if (!session) return;
                            const d = await partnerPost("disconnect_stripe", {}, session.access_token);
                            if (d.ok) { setConnectId(null); setConnectStatus("not_connected"); setShowDisconnect(false); showToast("Stripe disconnected"); }
                            else showToast(d.error || "Failed to disconnect", "error");
                          }}
                          style={{ flex:1, padding:".65rem", borderRadius:".5rem", border:"none", background:"linear-gradient(135deg,#991b1b,#dc2626)", color:"white", fontWeight:800, cursor:"pointer", fontSize:".88rem" }}>
                          Yes, Disconnect
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Profile Details ── */}
              <div style={{ marginTop:"2.5rem" }}>
                <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:"0 0 .3rem" }}>Profile Details</h2>
                <p style={{ color:"#64748b", fontSize:".82rem", margin:"0 0 1.25rem" }}>Keep your contact info up to date. Email is set by the admin and cannot be changed here.</p>
                <div style={{ background:"white", borderRadius:".875rem", border:"1px solid #f1f5f9", padding:"1.5rem", display:"flex", flexDirection:"column", gap:"1rem" }}>
                  {/* Email + Point of Contact side by side */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:".85rem" }}>
                    <div>
                      <label style={{ fontSize:".75rem", fontWeight:700, color:"#374151", display:"block", marginBottom:".3rem" }}>
                        Email <span style={{ color:"#94a3b8", fontWeight:400 }}>(set by admin)</span>
                      </label>
                      <div style={{ padding:".5rem .85rem", borderRadius:".45rem", border:"1.5px solid #f1f5f9", background:"#f8fafc", fontSize:".88rem", color:"#64748b", fontFamily:"monospace" }}>
                        {profile.email || "—"}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize:".75rem", fontWeight:700, color:"#374151", display:"block", marginBottom:".3rem" }}>Point of Contact</label>
                      <input
                        value={profile.contact}
                        onChange={e=>{ setProfile(p=>({...p,contact:e.target.value})); setProfileDirty(true); }}
                        placeholder="Full name of main contact"
                        style={{ width:"100%", padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".85rem", boxSizing:"border-box" as const, outline:"none" }}
                      />
                    </div>
                  </div>
                  {/* Company + Phone side by side */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:".85rem" }}>
                    <div>
                      <label style={{ fontSize:".75rem", fontWeight:700, color:"#374151", display:"block", marginBottom:".3rem" }}>Company Name</label>
                      <input
                        value={profile.company}
                        onChange={e=>{ setProfile(p=>({...p,company:e.target.value})); setProfileDirty(true); }}
                        placeholder="Your company name"
                        style={{ width:"100%", padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".85rem", boxSizing:"border-box" as const, outline:"none" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize:".75rem", fontWeight:700, color:"#374151", display:"block", marginBottom:".3rem" }}>Phone Number</label>
                      <input
                        type="tel"
                        value={profile.phone}
                        onChange={e=>{ setProfile(p=>({...p,phone:e.target.value})); setProfileDirty(true); }}
                        placeholder="e.g. +1 (555) 000-0000"
                        style={{ width:"100%", padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".85rem", boxSizing:"border-box" as const, outline:"none" }}
                      />
                    </div>
                  </div>
                  {/* Website */}
                  <div>
                    <label style={{ fontSize:".75rem", fontWeight:700, color:"#374151", display:"block", marginBottom:".3rem" }}>Website URL</label>
                    <input
                      type="url"
                      value={profile.website}
                      onChange={e=>{ setProfile(p=>({...p,website:e.target.value})); setProfileDirty(true); }}
                      placeholder="https://yourcompany.com"
                      style={{ width:"100%", padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".85rem", boxSizing:"border-box" as const, outline:"none" }}
                    />
                  </div>
                  {/* Save button */}
                  <div style={{ display:"flex", justifyContent:"flex-end", paddingTop:".25rem" }}>
                    <button
                      onClick={async () => {
                        if (!session) return;
                        setProfileSaving(true);
                        const d = await partnerPost("save_profile", { contact:profile.contact, company:profile.company, phone:profile.phone, website:profile.website }, session.access_token);
                        if (d.ok) { showToast("Profile saved ✓"); setProfileDirty(false); if(profile.company) setPartnerName(profile.company); }
                        else showToast(d.error || "Save failed", "error");
                        setProfileSaving(false);
                      }}
                      disabled={profileSaving || !profileDirty}
                      style={{ padding:".6rem 1.5rem", borderRadius:".5rem", border:"none", background: profileSaving||!profileDirty?"#e2e8f0":"linear-gradient(135deg,#6366f1,#8929bd)", color: profileSaving||!profileDirty?"#94a3b8":"white", fontWeight:700, fontSize:".85rem", cursor: profileSaving||!profileDirty?"not-allowed":"pointer", transition:"all .15s" }}>
                      {profileSaving ? "Saving…" : "Save Profile"}
                    </button>
                  </div>
                </div>
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
              <button onClick={()=>navigateTab("details")}
                style={{ padding:".7rem 1.75rem", borderRadius:".6rem", border:"none", background:"linear-gradient(135deg,#6366f1,#8929bd)", color:"white", fontWeight:800, fontSize:".9rem", cursor:"pointer" }}>
                Go to Partner Details →
              </button>
            </div>
          ) : accountSession ? (
            <PayoutsEmbed clientSecret={accountSession} />
          ) : accountSessionError ? (
            <div style={{ textAlign:"center", padding:"3rem" }}>
              <div style={{ fontSize:"2rem", marginBottom:".75rem" }}>⚠️</div>
              <div style={{ fontWeight:700, color:"#1e293b", marginBottom:".4rem" }}>Payout Dashboard Unavailable</div>
              <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:".5rem", padding:".75rem 1rem", fontSize:".8rem", color:"#991b1b", maxWidth:400, margin:"0 auto .75rem", textAlign:"left", wordBreak:"break-word" }}>
                {accountSessionError}
              </div>
              <p style={{ fontSize:".82rem", color:"#64748b", maxWidth:380, margin:"0 auto .75rem" }}>
                If your Stripe account was connected in a different mode (live vs test), you may need to disconnect and reconnect.
              </p>
              <button onClick={() => load("payouts")}
                style={{ padding:".55rem 1.1rem", borderRadius:".5rem", border:"1px solid #e2e8f0", background:"white", color:"#374151", fontWeight:600, fontSize:".82rem", cursor:"pointer" }}>
                ↺ Retry
              </button>
            </div>
          ) : (
            <div style={{ textAlign:"center", padding:"3rem", color:"#94a3b8" }}>Loading payout dashboard…</div>
          )}
        </div>
      )}

      {/* PR Preview Modal */}
      {previewOrder && (() => {
        const isPublished = previewOrder.status === "published";
        return (
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
                {!isPublished && <span style={{ fontSize:".72rem", color:"#8929bd", fontWeight:600 }}>✏️ Click content to edit</span>}
                <button onClick={()=>{ setPreviewOrder(null); setEditedContent(""); setOriginalContent(""); }}
                  style={{ background:"none", border:"none", fontSize:"1.2rem", cursor:"pointer", color:"#94a3b8", lineHeight:1 }}>✕</button>
              </div>
            </div>

            {/* Published lock banner */}
            {isPublished && (
              <div style={{ background:"#f0fdf4", borderBottom:"1px solid #bbf7d0", padding:".6rem 1.25rem", display:"flex", alignItems:"center", gap:".5rem", flexShrink:0 }}>
                <span>✅</span>
                <span style={{ fontSize:".78rem", fontWeight:600, color:"#15803d" }}>This PR has been published and cannot be edited.</span>
              </div>
            )}

            {/* Toolbar pinned above scroll area — hidden when published */}
            {!isPublished && (
              <div style={{ padding:".5rem 1.25rem", background:"#f8fafc", borderBottom:"1px solid #e2e8f0", flexShrink:0 }}>
                <RichToolbar editorRef={partnerEditorRef} />
              </div>
            )}
            {/* Scrollable PR content */}
            <div style={{ flex:1, overflowY:"auto", padding:"1.5rem 2rem" }}>
              <style>{`
                .partner-pr-preview { font-family: Georgia, 'Times New Roman', serif; color: #1e293b; line-height: 1.7; }
                .partner-pr-preview h1 { font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0 0 1rem; line-height: 1.25; font-family: system-ui, sans-serif; }
                .partner-pr-preview h2 { font-size: 1.05rem; font-weight: 700; color: #374151; margin: 1.5rem 0 .5rem; font-family: system-ui, sans-serif; }
                .partner-pr-preview p { margin: 0 0 1rem; font-size: .93rem; }
                .partner-pr-preview strong { font-weight: 700; }
                .partner-pr-preview em { font-style: italic; }
                .partner-pr-preview a { color: #8929bd; }
                [contenteditable] ul { list-style-type:disc !important; margin:0 0 .85rem; padding-left:1.5rem; }
                [contenteditable] ol { list-style-type:decimal !important; margin:0 0 .85rem; padding-left:1.5rem; }
                [contenteditable] li { display:list-item !important; margin-bottom:.25rem; }
              `}</style>
              <div
                ref={partnerEditorRef}
                className="partner-pr-preview"
                contentEditable={!isPublished}
                suppressContentEditableWarning
                onFocus={() => { if (!isPublished) isPartnerTypingRef.current = true; }}
                onBlur={() => { isPartnerTypingRef.current = false; if (!isPublished) setEditedContent(partnerEditorRef.current?.innerHTML || ""); }}
                onInput={() => { if (!isPublished) setEditedContent(partnerEditorRef.current?.innerHTML || ""); }}
                style={{ outline:"none", minHeight:"300px", cursor: isPublished ? "default" : undefined }}
              />
            </div>
            <div style={{ padding:"1rem 1.5rem", borderTop:"1px solid #f1f5f9", display:"flex", gap:".65rem", justifyContent:"flex-end", flexShrink:0 }}>
              {isPublished ? (
                <button onClick={()=>{ setPreviewOrder(null); setEditedContent(""); setOriginalContent(""); }}
                  style={{ padding:".6rem 1.25rem", borderRadius:".45rem", border:"1px solid #e2e8f0", background:"white", fontWeight:600, fontSize:".83rem", cursor:"pointer", color:"#64748b" }}>
                  Close
                </button>
              ) : (<>
                <button onClick={()=>rejectOrder(previewOrder.id, previewOrder.pr_title)}
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
              </>)}
            </div>
          </div>
        </div>
        );
      })()}

      {/* Toast */}
      {/* Reject Modal */}
      {rejectModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:10000, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
          <div style={{ background:"white", borderRadius:"1rem", width:"100%", maxWidth:440, padding:"2rem", boxShadow:"0 24px 60px rgba(0,0,0,.3)" }}>
            <h3 style={{ fontWeight:900, fontSize:"1.05rem", color:"#1e293b", margin:"0 0 .25rem" }}>✕ Reject PR</h3>
            <p style={{ color:"#64748b", fontSize:".8rem", margin:"0 0 1.25rem", lineHeight:1.5 }}>
              {rejectModal.title && <><strong style={{ color:"#1e293b" }}>{rejectModal.title}</strong><br/></>}
              Provide a reason — this will be sent to the client so they know what to revise.
            </p>
            <textarea
              value={rejectReason}
              onChange={e=>setRejectReason(e.target.value)}
              placeholder="e.g. Please revise the second paragraph — the service description needs to be more specific about the target area and include the phone number."
              rows={4}
              style={{ width:"100%", padding:".65rem .85rem", borderRadius:".5rem", border:"1.5px solid #e2e8f0", fontSize:".83rem", lineHeight:1.55, resize:"vertical", boxSizing:"border-box", outline:"none", fontFamily:"inherit" }}
              onFocus={e=>(e.target.style.borderColor="#8929bd")}
              onBlur={e=>(e.target.style.borderColor="#e2e8f0")}
              autoFocus
            />
            <div style={{ display:"flex", gap:".75rem", marginTop:"1.25rem" }}>
              <button onClick={submitReject} disabled={!rejectReason.trim()||rejecting}
                style={{ flex:1, padding:".7rem", borderRadius:".5rem", border:"none", background:(!rejectReason.trim()||rejecting)?"#e2e8f0":"#dc2626", color:(!rejectReason.trim()||rejecting)?"#94a3b8":"white", fontWeight:800, fontSize:".85rem", cursor:(!rejectReason.trim()||rejecting)?"not-allowed":"pointer" }}>
                {rejecting ? "Rejecting…" : "✕ Reject & Notify Client"}
              </button>
              <button onClick={()=>{setRejectModal(null);setRejectReason("");}}
                style={{ padding:".7rem 1.25rem", borderRadius:".5rem", border:"1px solid #e2e8f0", background:"white", fontWeight:600, fontSize:".85rem", cursor:"pointer", color:"#64748b" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position:"fixed", bottom:"1.5rem", right:"1.5rem", zIndex:10001, background:toast.type==="error"?"#991b1b":"#166534", color:"white", borderRadius:".65rem", padding:".85rem 1.25rem", fontSize:".85rem", fontWeight:600, boxShadow:"0 8px 24px rgba(0,0,0,.25)" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
