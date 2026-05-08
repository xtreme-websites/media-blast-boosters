import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { store } from "../lib/ai";
import { supabase, SUPABASE_URL, SUPABASE_ANON } from "../lib/supabase";
import { CompanyData, Topic, Order, EMPTY_COMPANY, PR_PACKAGES } from "../lib/constants";
import { ZapIcon, BuildingIcon, SettingsIcon, CheckIcon, AlertIcon, NewsIcon, BarIcon, ShieldIcon, BriefIcon, CartIcon, ArticleEditIcon, MegaphoneIcon, StarMenuIcon, MedalIcon } from "./icons";
import CompanyDataModal from "./CompanyDataModal";
import SettingsModal from "./SettingsModal";
import CheckoutModal from "./CheckoutModal";
import TrendingTopics from "./tabs/TrendingTopics";
import CompetitorAnalysis from "./tabs/CompetitorAnalysis";
import TrustAssets from "./tabs/TrustAssets";
import PRCreator from "./tabs/PRCreator";
import AuthGuard from "./AuthGuard";
import CreditWallet from "./tabs/CreditWallet";
import PublishedPress from "./tabs/PublishedPress";
import HelpGuidelines from "./tabs/HelpGuidelines";
import SettingsPage from "./tabs/Settings";
import AlertsTab from "./tabs/AlertsTab";
import CompanyDataPage from "./tabs/CompanyDataPage";
import AuthorityBuilder from "./tabs/AuthorityBuilder";
import type { ExecutePayload } from "./tabs/AuthorityBuilder";

// ─── Global Styles ─────────────────────────────────────────────────────────────
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');
    *, *::before, *::after { box-sizing: border-box; }
    .mbb-root { font-family: 'DM Sans', sans-serif; }
    .font-display, .mbb-root h1, .mbb-root h2, .mbb-root h3 { font-family: 'Outfit', sans-serif; }
    .mbb-root .prose h1 { font-size:1.5rem; font-weight:700; margin-bottom:.75rem; line-height:1.3; font-family:'Outfit',sans-serif; }
    .mbb-root .prose h2 { font-size:1.1rem; font-weight:700; margin-top:1.5rem; margin-bottom:.5rem; color:#1e293b; }
    .mbb-root .prose p  { margin-bottom:.75rem; line-height:1.7; color:#374151; }
    .mbb-root .prose em { font-style:italic; }
    .mbb-root .prose strong { font-weight:600; }
    .mbb-root .prose a  { color:#4f46e5; text-decoration:underline; }
    .card { background:white; border-radius:.875rem; box-shadow:0 1px 3px rgba(0,0,0,.06); border:1px solid #f1f5f9; }
    .btn-primary { background:linear-gradient(135deg,#4f46e5,#7c3aed); color:white; font-weight:600; padding:.6rem 1.2rem; border-radius:.5rem; display:inline-flex; align-items:center; gap:.45rem; transition:all .2s; font-size:.875rem; border:none; cursor:pointer; }
    .btn-primary:hover:not(:disabled) { background:linear-gradient(135deg,#4338ca,#6d28d9); transform:translateY(-1px); box-shadow:0 4px 14px rgba(79,70,229,.35); }
    .btn-primary:disabled { opacity:.5; cursor:not-allowed; transform:none !important; box-shadow:none !important; }
    .btn-secondary { background:#f1f5f9; color:#475569; font-weight:600; padding:.6rem 1.2rem; border-radius:.5rem; display:inline-flex; align-items:center; gap:.45rem; transition:all .15s; font-size:.875rem; border:1px solid #e2e8f0; cursor:pointer; }
    .btn-secondary:hover { background:#e2e8f0; }
    .field-input { width:100%; border:1px solid #e2e8f0; border-radius:.5rem; padding:.6rem .75rem; font-size:.875rem; outline:none; font-family:'DM Sans',sans-serif; transition:border-color .15s; background:white; }
    .field-input:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,.1); }
    .field-label { display:block; font-size:.78rem; font-weight:600; color:#374151; margin-bottom:.4rem; }
    @keyframes spin { to { transform:rotate(360deg); } }
    @keyframes fadeSlideIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
    @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
    .animate-spin { animation:spin .8s linear infinite; }
    .animate-fadein { animation:fadeSlideIn .35s ease both; }
    .modal-backdrop { animation: fadeIn .2s ease; }
    .modal-panel { animation: slideUp .25s ease; }
    .topic-card { background:white; border-radius:.75rem; border:1px solid #e8edf5; padding:1.25rem; transition:all .2s; }
    .topic-card:hover { border-color:#c7d2fe; box-shadow:0 4px 16px rgba(99,102,241,.1); transform:translateY(-1px); }
    .cd-option { border:2px solid #e2e8f0; border-radius:.875rem; padding:1.1rem 1.25rem; cursor:pointer; transition:all .2s; text-align:left; background:white; width:100%; }
    .cd-option:hover { border-color:#a5b4fc; background:#fafbff; }
    .cd-option.selected { border-color:#6366f1; background:#f0f4ff; }
  `}</style>
);

const TABS = [
  { id: "authority",   icon: <i className="fa-solid fa-trophy" style={{fontSize:15}}/>,               label: "Authority Builder"   },
  { id: "topics",     icon: <i className="fa-solid fa-fire-flame-curved" style={{fontSize:15}}/>, label: "Trending Topics"     },
  { id: "competitor", icon: <i className="fa-solid fa-chart-bar" style={{fontSize:15}}/>,          label: "Competitor Analysis" },
  { id: "widgets",    icon: <MedalIcon size={15}/>,                                                label: "Trust Widgets"       },
  { id: "orders",     icon: <StarMenuIcon size={15}/>,                                             label: "Media Credits"       },
  { id: "pr",         icon: <ArticleEditIcon size={15}/>,                                          label: "Media Creator"       },
  { id: "press",      icon: <MegaphoneIcon size={15}/>,                                            label: "Published Press"     },
];

const IS_DEV = import.meta.env.DEV ||
  new URLSearchParams(window.location.search).get("dev_access") === "mbb2026";

export default function PRDashboard() {
  // ── Persistent / shared state ─────────────────────────────────────────────
  const [companyData,    setCompanyData]    = useState<CompanyData>(EMPTY_COMPANY);
  const [dataLoaded,     setDataLoaded]     = useState(false);
  const [webhookUrl,     setWebhookUrl]     = useState("");
  const [customPRPrompt, setCustomPRPrompt] = useState("");
  const [orders,         setOrders]         = useState<Order[]>([]);
  const [showThankYou,   setShowThankYou]   = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeTab,       setActiveTab]       = useState<string>(() => {
    // If returning from Stripe checkout, land on orders tab
    if (new URLSearchParams(window.location.search).get("checkout") === "complete") return "orders";
    return "authority";
  });
  const [selectedTopic,   setSelectedTopic]   = useState<(Topic & { selectedIdea?: string }) | null>(null);
  const [showCompanyData, setShowCompanyData] = useState(false);
  const [showSettings,    setShowSettings]    = useState(false);
  const [toast,           setToast]           = useState<{ message: string; type: string } | null>(null);
  const [checkoutPackage,  setCheckoutPackage]  = useState<{type:string;title:string;content:string}|null>(null);
  const [authorityPayload, setAuthorityPayload] = useState<ExecutePayload|null>(null);
  const [draftToLoad,      setDraftToLoad]      = useState<Order|null>(null);
  const [unreadAlerts,     setUnreadAlerts]     = useState(0);
  const [alertToast,       setAlertToast]       = useState<{title:string;message:string}|null>(null);
  const [autoGenState,     setAutoGenState]     = useState<{show:boolean;step:number;orderId:string|null;result:Order|null;pendingPkg:string;pendingSeo:string;pendingDate:string}>({show:false,step:0,orderId:null,result:null,pendingPkg:'',pendingSeo:'',pendingDate:''});

  const locationId = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("location_id") || params.get("locationId") || "preview-mode";
    } catch { return "preview-mode"; }
  }, []);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Bootstrap: load settings + company profile + orders ───────────────────
  useEffect(() => {
    (async () => {
      try { const r = await store.get("mbb:webhookUrl"); if (r) setWebhookUrl(r); } catch {}
      try {
        const proxyRes = await fetch("https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/supabase-proxy", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table: "company_profiles", operation: "select", eq: { location_id: locationId } }),
        });
        const proxyData = await proxyRes.json();
        const data = proxyData.data;
        if (data) {
          const parsed: CompanyData = { name: data.company_name || "", industry: data.industry || "", websiteUrl: data.website_url || "", googleProfileUrl: data.google_profile_url || "", summaryFileUrl: data.summary_file_url || "", about: data.about_company || data.about_us || "", tagline: data.tagline || "", targetAudience: data.target_audience || "", differentiators: data.differentiators || "", services: data.list_of_services || "", servicePages: data.services_json || [], locationPages: data.locations_json || [], address: data.address || "", phone: data.phone || "", email: data.email || "", quoteAttribution: data.quote_attribution || "" };
          setCompanyData(parsed);
          try { await store.set("mbb:companyData", JSON.stringify(parsed)); } catch {}
        } else {
          const cached = await store.get("mbb:companyData");
          if (cached) setCompanyData(JSON.parse(cached));
        }
      } catch { try { const c = await store.get("mbb:companyData"); if (c) setCompanyData(JSON.parse(c)); } catch {} }
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?location_id=eq.${locationId}&order=created_at.desc`, { headers: { "apikey": SUPABASE_ANON, "Authorization": `Bearer ${SUPABASE_ANON}` } });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) setOrders(data.map(o => ({ id: o.id, prTitle: o.pr_title, productName: o.product_name, price: `$${o.price}`, date: new Date(o.created_at).toLocaleDateString("en-US"), prContent: o.pr_content, status: o.status, seoFocus: o.seo_focus, scheduledDate: o.scheduled_date, submittedAt: o.submitted_at, publishedDate: o.published_date, reportLink: o.report_link, lastEditedAt: o.last_edited_at, formData: o.form_data })));
      } catch {}
      setDataLoaded(true);
    })();
  }, [locationId]);

  // ── Save company data to Supabase + store ─────────────────────────────────
  const saveCompanyData = async (data: CompanyData) => {
    setCompanyData(data);
    try { await store.set("mbb:companyData", JSON.stringify(data)); } catch {}
    try {
      await fetch("https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/supabase-proxy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "company_profiles", operation: "upsert", onConflict: "location_id", data: { location_id: locationId, company_name: data.name, industry: data.industry, website_url: data.websiteUrl || "", about_company: data.about || "", about_us: data.about || "", tagline: data.tagline || "", target_audience: data.targetAudience || "", differentiators: data.differentiators || "", list_of_services: data.services || "", services_json: data.servicePages || [], locations_json: data.locationPages || [], address: data.address || "", phone: data.phone || "", email: data.email || "", quote_attribution: data.quoteAttribution || "", summary_file_url: data.summaryFileUrl || "", updated_at: new Date().toISOString() } }),
      });
    } catch {}
  };

  // ── Place order (called from PRCreator) ───────────────────────────────────
  const saveDraft = async (packageType: string, prTitle: string, prContent: string, seoFocus = "", formData?: Record<string,unknown>, existingId?: string): Promise<string> => {
    const newId = existingId || crypto.randomUUID();
    const draft: Order = { id: newId, prTitle, productName: packageType, price: PR_PACKAGES[packageType]?.price || "$0", date: new Date().toLocaleDateString("en-US"), prContent, seoFocus, status: "draft", lastEditedAt: new Date().toISOString(), formData };
    setOrders(prev => existingId ? prev.map(o => o.id===existingId ? {...o,...draft} : o) : [draft,...prev]);
    try {
      if (existingId) {
        await fetch("https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/supabase-proxy", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ table:"orders", operation:"update", eq:{id:existingId}, data:{ pr_title:prTitle, product_name:packageType, package_type:packageType, price:parseFloat(PR_PACKAGES[packageType]?.price?.replace("$","")||"0"), pr_content:prContent, seo_focus:seoFocus, status:"draft", last_edited_at:new Date().toISOString(), form_data:formData||{} } })
        });
      } else {
        await fetch("https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/supabase-proxy", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ table:"orders", operation:"insert", data:{ id:newId, location_id:locationId, pr_title:prTitle, product_name:packageType, package_type:packageType, price:parseFloat(PR_PACKAGES[packageType]?.price?.replace("$","")||"0"), pr_content:prContent, seo_focus:seoFocus, status:"draft", last_edited_at:new Date().toISOString(), form_data:formData||{} } })
        });
      }
    } catch {}
    showToast("Draft saved!");
    return newId;
  };

  const scheduleAutomatic = async (packageType: string, seoFocus: string, _scheduledDate: string, authorityFocus: Record<string,unknown>) => {
    // Decrement credit first
    try {
      const creditRes = await fetch("https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/supabase-proxy", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ table:"profiles", operation:"reserve_credit", location_id:locationId, tier:packageType.toLowerCase(), reason:`Credit reserved — ${String(authorityFocus.name||"Authority Builder")}` })
      });
      const cd = await creditRes.json();
      if (cd.insufficient) { showToast("Insufficient credits for auto-generation","error"); return; }
    } catch {}
    // Show generation modal — pendingPkg/pendingSeo trigger the generation
    setAutoGenState({ show:true, step:0, orderId:null, result:null, pendingPkg:packageType, pendingSeo:seoFocus, pendingDate:_scheduledDate });
  };

  const sendNotification = async (key: string, title: string, message: string, link?: string) => {
    try {
      await fetch("https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/send-notification", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location_id: locationId, key, title, message, link }),
      });
    } catch {}
    // Show toast for 10 seconds
    setAlertToast({ title, message });
    setTimeout(() => setAlertToast(null), 10000);
  };

  const runAutoGenerate = async (packageType: string, seoFocus: string, scheduledDate?: string) => {
    // step 1
    setAutoGenState(s => ({...s, step:1}));
    await new Promise(r => setTimeout(r, 700));
    // step 2
    setAutoGenState(s => ({...s, step:2}));
    await new Promise(r => setTimeout(r, 800));
    // step 3 — actual generation
    setAutoGenState(s => ({...s, step:3}));
    try {
      const res = await fetch("https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/generate-pr", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ location_id:locationId, package_type:packageType, seo_focus:seoFocus, scheduled_date:scheduledDate })
      });
      const data = await res.json();
      if (!res.ok || !data.pr_content) { showToast("Generation failed — please try again","error"); setAutoGenState(s => ({...s,show:false,step:0})); return; }
      // step 4 — saving
      setAutoGenState(s => ({...s, step:4}));
      await new Promise(r => setTimeout(r, 500));
      const newOrder: Order = { id: crypto.randomUUID(), prTitle: data.pr_title, productName: packageType, price: PR_PACKAGES[packageType]?.price||"$0", date: new Date().toLocaleDateString("en-US"), prContent: data.pr_content, seoFocus, status:"draft_pending_review" as any, lastEditedAt: new Date().toISOString() };
      setOrders(prev => [newOrder, ...prev]);
      setAutoGenState(s => ({ ...s, show:true, step:5, orderId:newOrder.id, result:newOrder }));
      sendNotification('ab_approval', 'AI Draft Ready for Review', `Your press release "${newOrder.prTitle}" is ready. Review and approve before the scheduled date.`);
    } catch { showToast("Generation failed — please try again","error"); setAutoGenState(s => ({...s,show:false,step:0})); }
  };

  const scheduleOrder = async (packageType: string, prTitle: string, prContent: string, seoFocus: string, scheduledDate: string, formData?: Record<string,unknown>, existingId?: string) => {
    const newId = existingId || crypto.randomUUID();
    const order: Order = { id: newId, prTitle, productName: packageType, price: PR_PACKAGES[packageType]?.price || "$0", date: new Date().toLocaleDateString("en-US"), prContent, seoFocus, status: "scheduled", scheduledDate, lastEditedAt: new Date().toISOString(), formData };
    setOrders(prev => existingId ? prev.map(o => o.id===existingId ? {...o,...order} : o) : [order,...prev]);
    try {
      if (existingId) {
        await fetch("https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/supabase-proxy", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ table:"orders", operation:"update", eq:{id:existingId}, data:{ pr_title:prTitle, product_name:packageType, package_type:packageType, price:parseFloat(PR_PACKAGES[packageType]?.price?.replace("$","")||"0"), pr_content:prContent, seo_focus:seoFocus, status:"scheduled", scheduled_date:scheduledDate, last_edited_at:new Date().toISOString(), form_data:formData||{} } })
        });
      } else {
        await fetch("https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/supabase-proxy", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ table:"orders", operation:"insert", data:{ id:newId, location_id:locationId, pr_title:prTitle, product_name:packageType, package_type:packageType, price:parseFloat(PR_PACKAGES[packageType]?.price?.replace("$","")||"0"), pr_content:prContent, seo_focus:seoFocus, status:"scheduled", scheduled_date:scheduledDate, last_edited_at:new Date().toISOString(), form_data:formData||{} } })
        });
      }
    } catch {}
    showToast("PR scheduled!");
  };

  const placeOrder = async (packageType: string, prTitle: string, prContent: string, seoFocus = "", orderId?: string, status: string = "submitted", scheduledDate?: string, formData?: Record<string,unknown>) => {
    const pkg      = PR_PACKAGES[packageType];
    const newOrder: Order = { id: crypto.randomUUID(), prTitle, productName: packageType, price: pkg.price, date: new Date().toLocaleDateString("en-US"), prContent };
    setOrders(prev => [newOrder, ...prev]);
    setShowThankYou(true);
    // Decrement 1 credit for the chosen tier
    try {
      await fetch("https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/supabase-proxy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table:"profiles", operation:"decrement_credits", location_id: locationId, tier: packageType.toLowerCase(), reason: `PR Launch — ${prTitle.slice(0,60)}` }),
      });
    } catch {}
    if (locationId !== "preview-mode") {
      // Confirm pending credit if this was a reserved (auto-generated) order
    try {
      const submittingOrder = orders.find(o => o.id === orderId);
      if (submittingOrder?.status === "draft_pending_review") {
        await fetch("https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/supabase-proxy", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ table:"profiles", operation:"confirm_credit", location_id:locationId, tier:packageType.toLowerCase(), reason:`🪄 ${prTitle}` })
        });
      }
    } catch {}
    try {
        if (orderId) {
          // Update existing draft/scheduled
          await fetch("https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/supabase-proxy", {
            method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ table:"orders", operation:"update", eq:{ id: orderId }, data:{ pr_title: prTitle, product_name: packageType, package_type: packageType, price: parseFloat(pkg.price.replace("$","")), pr_content: prContent, seo_focus: seoFocus, status, scheduled_date: scheduledDate || null, submitted_at: status==="submitted" ? new Date().toISOString() : null, last_edited_at: new Date().toISOString(), form_data: formData||{} } })
          });
        } else {
          await supabase.from("orders").insert({ location_id: locationId, pr_title: prTitle, product_name: packageType, package_type: packageType, price: parseFloat(pkg.price.replace("$","")), pr_content: prContent, seo_focus: seoFocus, status, scheduled_date: scheduledDate || null, submitted_at: status==="submitted" ? new Date().toISOString() : null, last_edited_at: new Date().toISOString(), form_data: formData||{} });
        }
      } catch {}
    }
    if (webhookUrl) {
      try { await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "order.placed", location_id: locationId, order_id: newOrder.id, pr_title: prTitle, package: packageType, price: pkg.price, pr_content: prContent, company_name: companyData.name, industry: companyData.industry, timestamp: new Date().toISOString() }) }); } catch {}
    }
  };

  const handleTopicSelect = (topic: Topic & { selectedIdea?: string }) => {
    setSelectedTopic(topic);
    setActiveTab("pr");
    showToast(topic.selectedIdea ? "Angle selected!" : "Topic selected!");
  };

  const hasCompanyData = !!(companyData.name || companyData.industry);

  return (
    <AuthGuard locationId={locationId}>
    <div className="mbb-root" style={{ display:"flex", minHeight:"100vh", background:"#f1f5f9" }}>
      <GlobalStyles/>

      {/* Notification alert toast (10s auto-close) */}
      {alertToast && createPortal(
        <div style={{ position:"fixed", bottom:"1.5rem", right:"1.5rem", zIndex:10001, maxWidth:360,
          background:"linear-gradient(135deg,#1e1b4b,#312e81)", color:"white", borderRadius:".85rem",
          padding:"1rem 1.25rem", boxShadow:"0 8px 32px rgba(0,0,0,.35)", display:"flex", gap:".75rem", alignItems:"flex-start",
          animation:"slideInUp .3s ease" }}>
          <span style={{ fontSize:"1.2rem", flexShrink:0 }}>🔔</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:800, fontSize:".85rem", marginBottom:".2rem" }}>{alertToast.title}</div>
            <div style={{ fontSize:".75rem", color:"rgba(255,255,255,.7)", lineHeight:1.45 }}>{alertToast.message}</div>
          </div>
          <button onClick={() => setAlertToast(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,.5)", fontSize:"1.1rem", lineHeight:1, flexShrink:0, padding:0 }}>×</button>
          <style>{`@keyframes slideInUp{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
        </div>,
        document.body
      )}
      {autoGenState.show && <AutoGenerateModal
        step={autoGenState.step}
        result={autoGenState.result}
        packageType={autoGenState.pendingPkg}
        seoFocus={autoGenState.pendingSeo}
        scheduledDate={autoGenState.pendingDate}
        onStart={(pkg, seo) => runAutoGenerate(pkg, seo, autoGenState.pendingDate)}
        onNavigate={() => { setAutoGenState(s => ({...s,show:false})); setActiveTab("press"); }}
        onClose={() => setAutoGenState(s => ({...s,show:false,step:0,orderId:null,result:null}))}
      />}

      {/* ══ LEFT SIDEBAR ══════════════════════════════════════════════════════ */}
      <aside style={{
        width: 250, flexShrink: 0, display: "flex", flexDirection: "column",
        background: "linear-gradient(90deg, rgba(137,41,189,1) 0%, rgba(38,32,105,1) 35%)",
        minHeight: "100vh", position: "sticky", top: 0, height: "100vh",
        boxShadow: "4px 0 24px rgba(0,0,0,.25)", zIndex: 30,
      }}>

        {/* Logo */}
        <div style={{ padding: "1rem 1.1rem .85rem", borderBottom: "1px solid rgba(255,255,255,.1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
            <img src="/logo.png" alt="MBB" style={{ width: 36, height: 36, objectFit: "contain", flexShrink: 0 }}/>
            <span className="font-display" style={{ color: "white", fontWeight: 800, fontSize: "16px", letterSpacing: "-.01em", whiteSpace: "nowrap" }}>
              Media Blast Boosters<span style={{ color: "rgba(255,255,255,.6)", fontSize: ".65rem", fontWeight: 700, marginLeft: ".15rem", verticalAlign: "super" }}>™</span>
            </span>
          </div>
        </div>

        {/* Main nav */}
        <nav style={{ flex: 1, padding: ".75rem .6rem", display: "flex", flexDirection: "column", gap: ".15rem" }}>
          {TABS.map(t => {
            const active = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                display: "flex", alignItems: "center", gap: ".6rem",
                padding: ".6rem .75rem", borderRadius: ".5rem", border: "none", cursor: "pointer",
                background: active ? "rgba(255,255,255,.18)" : "transparent",
                color: active ? "white" : "rgba(255,255,255,.62)",
                fontWeight: active ? 600 : 500, fontSize: ".82rem", textAlign: "left", width: "100%",
                transition: "all .15s",
                boxShadow: active ? "inset 0 0 0 1px rgba(255,255,255,.15)" : "none",
              }}
                onMouseOver={e => { if (!active) e.currentTarget.style.background = "rgba(255,255,255,.1)"; e.currentTarget.style.color = "white"; }}
                onMouseOut={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,.62)"; } }}
              >
                <span style={{ opacity: active ? 1 : .75 }}>{t.icon}</span>
                {t.label}
                {t.id === "press" && orders.filter(o => o.status === "draft_pending_review").length > 0 && (
                  <span style={{ marginLeft:"auto", background:"#ef4444", color:"white", fontSize:".6rem", fontWeight:800, padding:".05rem .35rem", borderRadius:"99px", minWidth:14, textAlign:"center" }}>
                    {orders.filter(o => o.status === "draft_pending_review").length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Divider */}
        <div style={{ height: "1px", background: "rgba(255,255,255,.12)", margin: "0 .75rem" }}/>

        {/* Company Profile + Settings */}
        <div style={{ padding: ".75rem .6rem", display: "flex", flexDirection: "column", gap: ".15rem" }}>
          <button onClick={() => setActiveTab("company_data" as any)} style={{
            display: "flex", alignItems: "center", gap: ".6rem",
            padding: ".6rem .75rem", borderRadius: ".5rem", border: "none", cursor: "pointer",
            background: "transparent", color: "rgba(255,255,255,.62)",
            fontWeight: 500, fontSize: ".82rem", textAlign: "left", width: "100%", transition: "all .15s",
          }}
            onMouseOver={e => { e.currentTarget.style.background = "rgba(255,255,255,.1)"; e.currentTarget.style.color = "white"; }}
            onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,.62)"; }}
          >
            <BuildingIcon size={15}/>
            Company Profile
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: hasCompanyData ? "#34d399" : "#f87171", flexShrink: 0, marginLeft: "auto" }}/>
          </button>

          <button onClick={() => setActiveTab("help")} style={{
            display: "flex", alignItems: "center", gap: ".6rem",
            padding: ".6rem .75rem", borderRadius: ".5rem", border: "none", cursor: "pointer",
            background: activeTab === "help" ? "rgba(255,255,255,.15)" : "transparent", color: activeTab === "help" ? "white" : "rgba(255,255,255,.62)",
            fontWeight: 500, fontSize: ".82rem", textAlign: "left", width: "100%", transition: "all .15s",
          }}
            onMouseOver={e => { e.currentTarget.style.background = "rgba(255,255,255,.1)"; e.currentTarget.style.color = "white"; }}
            onMouseOut={e => { if (activeTab !== "help") { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,.62)"; } }}
          >
            <i className="fa-solid fa-circle-question" style={{fontSize:15}}/>
            Help & Guidelines
          </button>

          {/* 🔔 Alerts */}
          <button onClick={() => setActiveTab("alerts")} style={{
            display: "flex", alignItems: "center", gap: ".6rem",
            padding: ".6rem .75rem", borderRadius: ".5rem", border: "none", cursor: "pointer",
            background: activeTab === "alerts" ? "rgba(255,255,255,.15)" : "transparent", color: activeTab === "alerts" ? "white" : "rgba(255,255,255,.62)",
            fontWeight: 500, fontSize: ".82rem", textAlign: "left", width: "100%", transition: "all .15s",
          }}
            onMouseOver={e => { e.currentTarget.style.background = "rgba(255,255,255,.1)"; e.currentTarget.style.color = "white"; }}
            onMouseOut={e => { if (activeTab !== "alerts") { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,.62)"; } }}
          >
            <i className="fa-solid fa-bell" style={{fontSize:14}}/>
            Activity Alerts
            {unreadAlerts > 0 && (
              <span style={{ marginLeft:"auto", background:"#ef4444", color:"white", fontSize:".6rem", fontWeight:900, padding:".1rem .4rem", borderRadius:"99px", minWidth:16, textAlign:"center" }}>
                {unreadAlerts}
              </span>
            )}
          </button>

          <button onClick={() => setActiveTab('settings')} style={{
            display: "flex", alignItems: "center", gap: ".6rem",
            padding: ".6rem .75rem", borderRadius: ".5rem", border: "none", cursor: "pointer",
            background: activeTab === "settings" ? "rgba(255,255,255,.15)" : "transparent", color: activeTab === "settings" ? "white" : "rgba(255,255,255,.62)",
            fontWeight: 500, fontSize: ".82rem", textAlign: "left", width: "100%", transition: "all .15s",
          }}
            onMouseOver={e => { if (activeTab !== "settings") { e.currentTarget.style.background = "rgba(255,255,255,.1)"; e.currentTarget.style.color = "white"; }}}
            onMouseOut={e => { if (activeTab !== "settings") { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,.62)"; }}}
          >
            <SettingsIcon size={15}/>
            Settings
          </button>
        </div>

        {/* Bottom padding */}
        <div style={{ height: ".5rem" }}/>
      </aside>

      {/* ══ MAIN CONTENT ══════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <main style={{ flex: 1, overflowY: "auto", padding: "1.5rem", maxWidth: activeTab === "press" ? "1128px" : "1000px", width: "100%", margin: "0 auto" }}>
          {!hasCompanyData && dataLoaded && (
            <div style={{ background:"linear-gradient(135deg,#1e1b4b,#312e81)",border:"1px solid #4338ca",borderRadius:".875rem",padding:"1rem 1.5rem",marginBottom:"1.25rem",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"1rem",flexWrap:"wrap" }}>
              <div style={{ display:"flex",alignItems:"center",gap:".75rem" }}>
                <div style={{ background:"rgba(99,102,241,.25)",borderRadius:".5rem",padding:".5rem",display:"flex" }}><BuildingIcon size={20}/></div>
                <div>
                  <p style={{ color:"white",fontWeight:600,fontSize:".9rem",margin:0 }}>Set up your company profile to get started</p>
                  <p style={{ color:"#a5b4fc",fontSize:".78rem",margin:"2px 0 0" }}>AI uses your company data to personalize every output across the dashboard.</p>
                </div>
              </div>
              <button onClick={() => setActiveTab("company_data" as any)} className="btn-primary" style={{ flexShrink:0 }}><BuildingIcon size={15}/> Add Company Profile</button>
            </div>
          )}

          {activeTab === "topics"     && <TrendingTopics companyData={companyData} showToast={showToast} onTopicSelect={handleTopicSelect}/>}
          {activeTab === "competitor" && <CompetitorAnalysis companyName={companyData.name} industry={companyData.industry} locationId={locationId} showToast={showToast}/>}
          {activeTab === "widgets"    && <TrustAssets orders={orders} locationId={locationId} showToast={showToast} isDevAccess={IS_DEV}/>}
          {activeTab === "pr"         && <PRCreator companyData={companyData} customPRPrompt={customPRPrompt} selectedTopic={selectedTopic} onClearTopic={() => setSelectedTopic(null)} onNavigateToTopics={() => setActiveTab("topics")} onOpenCompanyData={() => setShowCompanyData(true)} onPlaceOrder={placeOrder} onOpenCheckout={(type,title,content) => setCheckoutPackage({type,title,content})} onOpenCredits={() => setActiveTab("orders")} onNavigateToPublished={() => setActiveTab("press")} onOpenHelp={() => setActiveTab("help")} onNavigateToAuthorityBuilder={() => setActiveTab("authority")} authorityPayload={authorityPayload} draftToLoad={draftToLoad} onDraftLoaded={() => setDraftToLoad(null)} onSaveDraft={saveDraft} onScheduleOrder={scheduleOrder} orders={orders} locationId={locationId} showToast={showToast}/>}
          {activeTab === "press"      && <PublishedPress orders={orders} locationId={locationId}
            onLoadDraft={(o) => { setDraftToLoad(o); setActiveTab("pr"); }}
            onApproveAndSubmit={async (o) => {
              try {
                await fetch("https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/supabase-proxy", {
                  method:"POST", headers:{"Content-Type":"application/json"},
                  body: JSON.stringify({ table:"orders", operation:"update", eq:{id:o.id}, data:{ status:"submitted", submitted_at:new Date().toISOString() } })
                });
                await fetch("https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/supabase-proxy", {
                  method:"POST", headers:{"Content-Type":"application/json"},
                  body: JSON.stringify({ table:"profiles", operation:"confirm_credit", location_id:locationId, tier:(o.productName||"starter").toLowerCase(), reason:`🪄 ${o.prTitle||"Press Release"}` })
                });
              } catch {}
              setOrders(prev => prev.map(x => x.id===o.id ? {...x, status:"submitted" as any, submittedAt:new Date().toISOString()} : x));
              showToast("✅ PR approved and submitted for distribution!");
              sendNotification("mc_submitted", "PR Approved & Submitted", `"${o.prTitle || "Your PR"}" has been approved and submitted for distribution.`);
            }}
            onDeleteDraft={async (o) => {
              if (o.status === "draft_pending_review" || (o.status === "scheduled" && (o as any).source === "authority_builder")) {
                try {
                  await fetch("https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/supabase-proxy", {
                    method:"POST", headers:{"Content-Type":"application/json"},
                    body: JSON.stringify({ table:"profiles", operation:"release_credit", location_id:locationId, tier:(o.productName||"starter").toLowerCase(), reason:`🪄 ${o.prTitle||"Press Release"}` })
                  });
                } catch {}
              }
              try {
                await fetch("https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/supabase-proxy", {
                  method:"POST", headers:{"Content-Type":"application/json"},
                  body: JSON.stringify({ table:"orders", operation:"delete", eq:{ id: o.id } })
                });
              } catch {}
              setOrders(prev => prev.filter(x => x.id !== o.id));
              showToast("Draft deleted — credit returned");
            }}
            preOpenDraftId={autoGenState.result?.id || null}/>}
          {activeTab === "alerts"     && <AlertsTab locationId={locationId} onUnreadChange={(n) => setUnreadAlerts(n)}/>}
          {activeTab === "help"       && <HelpGuidelines onOpenHelp={() => {}}/>}
          {activeTab === "authority"  && !dataLoaded && (
            <div style={{ display:"flex", flexDirection:"column", gap:"1rem", padding:".5rem 0" }}>
              <div style={{ height:32, background:"#f1f5f9", borderRadius:".5rem", width:"60%" }}/>
              {[1,2,3].map(i => <div key={i} style={{ height:96, background:"#f8fafc", borderRadius:".75rem", border:"1px solid #f1f5f9" }}/>)}
            </div>
          )}
          {activeTab === "authority"  && dataLoaded && <AuthorityBuilder companyData={companyData} orders={orders} onExecute={(p) => { setAuthorityPayload(p); setActiveTab("pr"); }} onScheduleAutomatic={scheduleAutomatic} onNavigateToCompanyProfile={() => setActiveTab("company_data" as any)}/>}
          {(activeTab as string) === "company_data" && <CompanyDataPage companyData={companyData} onSave={saveCompanyData} showToast={showToast}/>}
          {activeTab === "orders"     && <CreditWallet locationId={locationId} showToast={showToast} onNavigateToPR={() => setActiveTab("pr")}/>}
        </main>
      </div>

      {/* ══ MODALS ════════════════════════════════════════════════════════════ */}
      <CompanyDataModal isOpen={showCompanyData} onClose={() => setShowCompanyData(false)} companyData={companyData} onSave={saveCompanyData} showToast={showToast}/>
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} webhookUrl={webhookUrl} customPRPrompt={customPRPrompt}
        onSave={({ webhookUrl: w, customPRPrompt: p }) => { setWebhookUrl(w); setCustomPRPrompt(p); }} showToast={showToast}/>
      <CheckoutModal
        isOpen={!!checkoutPackage}
        onClose={() => setCheckoutPackage(null)}
        packageType={checkoutPackage?.type ?? ""}
        prTitle={checkoutPackage?.title ?? ""}
        locationId={locationId}
        onOrderComplete={(pkgType) => {
          if (checkoutPackage) placeOrder(pkgType, checkoutPackage.title, checkoutPackage.content);
        }}
        showToast={showToast}
      />

      {/* ══ TOAST ═════════════════════════════════════════════════════════════ */}
      {toast && (
        <div style={{ position:"fixed",bottom:"1.5rem",right:"1.5rem",zIndex:60,background:toast.type==="success"?"linear-gradient(135deg,#10b981,#059669)":"linear-gradient(135deg,#ef4444,#dc2626)",color:"white",padding:".75rem 1.1rem",borderRadius:".6rem",boxShadow:"0 8px 24px rgba(0,0,0,.2)",fontSize:".875rem",fontWeight:500,display:"flex",alignItems:"center",gap:".5rem",animation:"fadeSlideIn .3s ease" }}>
          {toast.type==="success"?<CheckIcon size={15}/>:<AlertIcon size={15}/>}{toast.message}
        </div>
      )}
    </div>
    </AuthGuard>
  );
}

// ── AutoGenerateModal ──────────────────────────────────────────────────────────

const STEPS = [
  { icon:"🔍", label:"Analyzing your company profile..." },
  { icon:"🎯", label:"Building your PR strategy..."     },
  { icon:"✍️",  label:"Generating press release..."      },
  { icon:"💾", label:"Saving draft for review..."       },
  { icon:"✅", label:"PR ready for your review!"        },
];

function AutoGenerateModal({ step, result, packageType, seoFocus, scheduledDate, onStart, onNavigate, onClose }: {
  step: number; result: Order | null;
  packageType: string; seoFocus: string; scheduledDate?: string;
  onStart: (pkg: string, seo: string, date?: string) => void;
  onNavigate: () => void;
  onClose: () => void;
}) {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started && packageType) {
      setStarted(true);
      onStart(packageType, seoFocus, scheduledDate);
    }
  }, [packageType]);

  const done = step === 5;

  return createPortal(
    <div style={{ position:"fixed", inset:0, zIndex:10000, background:"linear-gradient(135deg,rgba(30,27,75,.97),rgba(49,46,129,.97))", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"2rem" }}>
      <div style={{ width:"100%", maxWidth:480, textAlign:"center" }}>
        {/* Header */}
        <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>{done ? "✅" : "🤖"}</div>
        <h2 style={{ fontWeight:900, fontSize:"1.4rem", color:"white", margin:"0 0 .5rem" }}>
          {done ? "Your PR is Ready!" : "Auto-Generating PR..."}
        </h2>
        <p style={{ color:"rgba(255,255,255,.65)", fontSize:".85rem", margin:"0 0 2rem" }}>
          {done ? "Review, edit, or approve below. If no action in 48 hrs, it auto-submits." : "AI is crafting your press release using your company data and authority strategy."}
        </p>

        {/* Steps */}
        <div style={{ display:"flex", flexDirection:"column", gap:".6rem", marginBottom:"2rem", textAlign:"left" }}>
          {STEPS.map((s, i) => {
            const current = i === step - 1;
            const done    = i < step - 1;
            const pending = i >= step;
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:".75rem", padding:".6rem .85rem", borderRadius:".6rem",
                background: done ? "rgba(99,102,241,.2)" : current ? "rgba(201,168,76,.15)" : "rgba(255,255,255,.04)",
                border:`1px solid ${done ? "rgba(99,102,241,.4)" : current ? "rgba(201,168,76,.4)" : "rgba(255,255,255,.08)"}`,
                opacity: pending ? .4 : 1, transition:"all .3s" }}>
                <span style={{ fontSize:"1.1rem", width:24, textAlign:"center", flexShrink:0 }}>
                  {done ? "✓" : current ? <span style={{ display:"inline-block", animation:"spin .8s linear infinite" }}>⟳</span> : s.icon}
                </span>
                <span style={{ fontSize:".83rem", fontWeight: current ? 700 : 500, color: done ? "#a5b4fc" : current ? "#fde68a" : "rgba(255,255,255,.7)" }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        {!done && (
          <div style={{ background:"rgba(255,255,255,.12)", borderRadius:99, height:6, overflow:"hidden", marginBottom:"2rem" }}>
            <div style={{ height:"100%", background:"linear-gradient(90deg,#c9a84c,#f0c040)", borderRadius:99, width:`${Math.max(5,(step/5)*100)}%`, transition:"width .6s ease" }}/>
          </div>
        )}

        {/* Done state */}
        {done && result && (
          <>
            <div style={{ background:"rgba(251,191,36,.12)", border:"1px solid rgba(251,191,36,.35)", borderRadius:".75rem", padding:".85rem 1rem", marginBottom:"1.25rem" }}>
              <div style={{ fontSize:".75rem", fontWeight:800, color:"#fde68a", marginBottom:".25rem" }}>⏰ Review Required</div>
              <div style={{ fontSize:".78rem", color:"rgba(255,255,255,.7)", lineHeight:1.5 }}>
                Your review and approval are required. You have until the <strong style={{color:"white"}}>scheduled date</strong> to approve or edit — after that it auto-submits.
              </div>
            </div>
            <button onClick={onNavigate}
              style={{ width:"100%", padding:".85rem", borderRadius:".7rem", border:"none", background:"linear-gradient(135deg,#c9a84c,#f0c040)", color:"#1e1b4b", fontWeight:800, fontSize:".95rem", cursor:"pointer", boxShadow:"0 4px 20px rgba(201,168,76,.4)" }}>
              Review My PR →
            </button>
          </>
        )}

        {/* Cancel (only before done) */}
        {!done && (
          <button onClick={onClose} style={{ marginTop:"1rem", background:"none", border:"none", color:"rgba(255,255,255,.4)", fontSize:".78rem", cursor:"pointer" }}>
            Cancel
          </button>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>,
    document.body
  );
}
