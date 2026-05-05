import { useState, useMemo, useEffect } from "react";
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
import CompanyDataPage from "./tabs/CompanyDataPage";

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
  { id: "topics",     icon: <i className="fa-solid fa-fire-flame-curved" style={{fontSize:15}}/>, label: "Trending Topics"     },
  { id: "competitor", icon: <i className="fa-solid fa-chart-bar" style={{fontSize:15}}/>,          label: "Competitor Analysis" },
  { id: "widgets",    icon: <MedalIcon size={15}/>,                                                label: "Trust Widgets"       },
  { id: "orders",     icon: <StarMenuIcon size={15}/>,                                             label: "Media Credits"       },
  { id: "pr",         icon: <ArticleEditIcon size={15}/>,                                          label: "Media Content"       },
  { id: "press",      icon: <MegaphoneIcon size={15}/>,                                            label: "Published Press"     },
];

export default function PRDashboard() {
  // ── Persistent / shared state ─────────────────────────────────────────────
  const [companyData,    setCompanyData]    = useState<CompanyData>(EMPTY_COMPANY);
  const [dataLoaded,     setDataLoaded]     = useState(false);
  const [webhookUrl,     setWebhookUrl]     = useState("");
  const [customPRPrompt, setCustomPRPrompt] = useState("");
  const [orders,         setOrders]         = useState<Order[]>([]);
  const [showThankYou,   setShowThankYou]   = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeTab,       setActiveTab]       = useState(() => {
    // If returning from Stripe checkout, land on orders tab directly
    return new URLSearchParams(window.location.search).get("checkout") === "complete"
      ? "orders" : "topics";
  });
  const [selectedTopic,   setSelectedTopic]   = useState<(Topic & { selectedIdea?: string }) | null>(null);
  const [showCompanyData, setShowCompanyData] = useState(false);
  const [showSettings,    setShowSettings]    = useState(false);
  const [toast,           setToast]           = useState<{ message: string; type: string } | null>(null);
  const [checkoutPackage, setCheckoutPackage] = useState<{type:string;title:string;content:string}|null>(null);

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
        const { data } = await supabase.from("company_profiles").select("*")
          .eq("location_id", locationId).order("updated_at", { ascending: false }).limit(1).single();
        if (data) {
          setCompanyData({ name: data.company_name || "", industry: data.industry || "", websiteUrl: data.website_url || "", googleProfileUrl: data.google_profile_url || "", summaryFileUrl: data.summary_file_url || "", about: data.about_company || data.about_us || "", tagline: data.tagline || "", targetAudience: data.target_audience || "", differentiators: data.differentiators || "", services: data.list_of_services || "", servicePages: data.services_json || [], locationPages: data.locations_json || [], address: data.address || "", phone: data.phone || "", email: data.email || "", quoteAttribution: data.quote_attribution || "" });
        } else {
          const cached = await store.get("mbb:companyData");
          if (cached) setCompanyData(JSON.parse(cached));
        }
      } catch { try { const c = await store.get("mbb:companyData"); if (c) setCompanyData(JSON.parse(c)); } catch {} }
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?location_id=eq.${locationId}&order=created_at.desc`, { headers: { "apikey": SUPABASE_ANON, "Authorization": `Bearer ${SUPABASE_ANON}` } });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) setOrders(data.map(o => ({ id: o.id, prTitle: o.pr_title, productName: o.product_name, price: `$${o.price}`, date: new Date(o.created_at).toLocaleDateString("en-US"), prContent: o.pr_content })));
      } catch {}
      setDataLoaded(true);
    })();
  }, [locationId]);

  // ── Save company data to Supabase + store ─────────────────────────────────
  const saveCompanyData = async (data: CompanyData) => {
    setCompanyData(data);
    try { await store.set("mbb:companyData", JSON.stringify(data)); } catch {}
    try { await supabase.from("company_profiles").upsert({ location_id: locationId, company_name: data.name, industry: data.industry, website_url: data.websiteUrl || "", google_profile_url: data.googleProfileUrl || "", about_company: data.about || "", about_us: data.about || "", tagline: data.tagline || "", target_audience: data.targetAudience || "", differentiators: data.differentiators || "", list_of_services: data.services || "", services_json: data.servicePages || [], locations_json: data.locationPages || [], address: data.address || "", phone: data.phone || "", email: data.email || "", quote_attribution: data.quoteAttribution || "", summary_file_url: data.summaryFileUrl || "", updated_at: new Date().toISOString() }, { onConflict: "location_id" }); } catch {}
  };

  // ── Place order (called from PRCreator) ───────────────────────────────────
  const placeOrder = async (packageType: string, prTitle: string, prContent: string) => {
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
      try { await supabase.from("orders").insert({ location_id: locationId, pr_title: prTitle, product_name: packageType, package_type: packageType, price: parseFloat(pkg.price.replace("$", "")), pr_content: prContent }); } catch {}
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

          <button onClick={() => setShowSettings(true)} style={{
            display: "flex", alignItems: "center", gap: ".6rem",
            padding: ".6rem .75rem", borderRadius: ".5rem", border: "none", cursor: "pointer",
            background: "transparent", color: "rgba(255,255,255,.62)",
            fontWeight: 500, fontSize: ".82rem", textAlign: "left", width: "100%", transition: "all .15s",
          }}
            onMouseOver={e => { e.currentTarget.style.background = "rgba(255,255,255,.1)"; e.currentTarget.style.color = "white"; }}
            onMouseOut={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,.62)"; }}
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
        <main style={{ flex: 1, overflowY: "auto", padding: "1.5rem", maxWidth: "940px", width: "100%", margin: "0 auto" }}>
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
          {activeTab === "widgets"    && <TrustAssets orders={orders} locationId={locationId} showToast={showToast}/>}
          {activeTab === "pr"         && <PRCreator companyData={companyData} customPRPrompt={customPRPrompt} selectedTopic={selectedTopic} onClearTopic={() => setSelectedTopic(null)} onNavigateToTopics={() => setActiveTab("topics")} onOpenCompanyData={() => setShowCompanyData(true)} onPlaceOrder={placeOrder} onOpenCheckout={(type,title,content) => setCheckoutPackage({type,title,content})} onOpenCredits={() => setActiveTab("orders")} onNavigateToPublished={() => setActiveTab("press")} onOpenHelp={() => setActiveTab("help")} locationId={locationId} showToast={showToast}/>}
          {activeTab === "press"      && <PublishedPress orders={orders} locationId={locationId}/>}
          {activeTab === "help"       && <HelpGuidelines onOpenHelp={() => {}}/>}
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
