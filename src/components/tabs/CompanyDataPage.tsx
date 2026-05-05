import { useState, useEffect } from "react";
import { CompanyData, ServicePage, LocationPage, EMPTY_COMPANY } from "../../lib/constants";
import { LoaderIcon, SaveIcon, MapPinIcon, PhoneIcon, MailIcon, XIcon } from "../icons";

const CRAWL_URL = "https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/crawl-profile";

const TABS = [
  { id: "company",   label: "Company"   },
  { id: "services",  label: "Services"  },
  { id: "locations", label: "Locations" },
] as const;
type Tab = typeof TABS[number]["id"];

interface Props {
  companyData: CompanyData;
  onSave: (data: CompanyData) => Promise<void>;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export default function CompanyDataPage({ companyData, onSave, showToast }: Props) {
  const [activeTab,  setActiveTab]  = useState<Tab>("company");
  const [draft,      setDraft]      = useState<CompanyData>({ ...EMPTY_COMPANY });
  const [crawlUrl,   setCrawlUrl]   = useState("");
  const [crawling,   setCrawling]   = useState(false);
  const [crawlMsg,   setCrawlMsg]   = useState("");
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    setDraft({ ...EMPTY_COMPANY, ...companyData });
    setCrawlUrl(companyData.websiteUrl || "");
  }, [companyData]);

  const set = (k: keyof CompanyData, v: any) => setDraft(p => ({ ...p, [k]: v }));

  const crawl = async () => {
    const url = crawlUrl.trim().replace(/\/$/, "");
    if (!url) { showToast("Please enter a website URL", "error"); return; }
    setCrawling(true); setCrawlMsg("Fetching sitemap & pages…");
    try {
      const res  = await fetch(CRAWL_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ website_url: url, company_name: draft.name }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Crawl failed");
      setCrawlMsg("Extracting company data…");
      setDraft(prev => ({
        ...prev,
        name:             data.name             || prev.name,
        industry:         data.industry         || prev.industry,
        tagline:          data.tagline          || prev.tagline,
        targetAudience:   data.target_audience  || prev.targetAudience,
        about:            data.about_us         || prev.about,
        differentiators:  data.differentiators  || prev.differentiators,
        quoteAttribution: data.quote_attribution|| prev.quoteAttribution,
        websiteUrl:       url,
        address:          [data.address, data.city, data.state].filter(Boolean).join(", ") || prev.address,
        phone:            data.phone            || prev.phone,
        email:            data.email            || prev.email,
        servicePages:     Array.isArray(data.services)  ? data.services  : prev.servicePages,
        locationPages:    Array.isArray(data.locations) ? data.locations : prev.locationPages,
      }));
      showToast(`✓ Crawl complete — ${(data.services||[]).length} services, ${(data.locations||[]).length} locations found`);
    } catch (e: any) {
      showToast("Crawl failed: " + (e.message || "unknown error"), "error");
    }
    setCrawling(false); setCrawlMsg("");
  };

  const handleSave = async () => {
    if (!draft.name.trim()) { showToast("Company name is required", "error"); return; }
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    showToast("Company data saved!");
  };

  const field = (label: string, key: keyof CompanyData, opts?: { placeholder?: string; type?: string; hint?: string }) => (
    <div>
      <label className="field-label">{label}</label>
      {opts?.hint && <p style={{ fontSize:".72rem", color:"#94a3b8", margin:"-.3rem 0 .4rem" }}>{opts.hint}</p>}
      <input type={opts?.type || "text"} value={(draft[key] as string) || ""} onChange={e => set(key, e.target.value)}
        placeholder={opts?.placeholder || ""} className="field-input"/>
    </div>
  );

  const textarea = (label: string, key: keyof CompanyData, opts?: { placeholder?: string; hint?: string; rows?: number }) => (
    <div>
      <label className="field-label">{label}</label>
      {opts?.hint && <p style={{ fontSize:".72rem", color:"#94a3b8", margin:"-.3rem 0 .4rem" }}>{opts.hint}</p>}
      <textarea value={(draft[key] as string) || ""} onChange={e => set(key, e.target.value)}
        placeholder={opts?.placeholder || ""} className="field-input"
        style={{ height: opts?.rows ? `${opts.rows * 24}px` : "80px", resize:"vertical", lineHeight:1.6 }}/>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:"1.5rem", flexWrap:"wrap", gap:"1rem" }}>
        <div>
          <h2 style={{ fontWeight:800, fontSize:"1.2rem", color:"#1e293b", margin:0 }}>Company Profile</h2>
          <p style={{ color:"#64748b", fontSize:".83rem", margin:".25rem 0 0" }}>Powers all AI features — fill this once, no crawling needed at generation time</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ display:"flex", alignItems:"center", gap:".5rem" }}>
          {saving ? <><LoaderIcon size={14}/> Saving…</> : <><SaveIcon size={14}/> Save Changes</>}
        </button>
      </div>

      {/* Crawl bar */}
      <div style={{ background:"linear-gradient(135deg,#1e1b4b,#312e81)", borderRadius:".75rem", padding:"1rem 1.25rem", marginBottom:"1.5rem", display:"flex", gap:".75rem", alignItems:"center", flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:220 }}>
          <div style={{ fontSize:".72rem", fontWeight:600, color:"#a5b4fc", letterSpacing:".06em", marginBottom:".3rem" }}>🤖 AI CRAWL WEBSITE</div>
          <p style={{ color:"rgba(255,255,255,.7)", fontSize:".78rem", margin:0 }}>Enter your URL and AI will auto-fill all fields below</p>
        </div>
        <input value={crawlUrl} onChange={e => setCrawlUrl(e.target.value)} placeholder="https://yourcompany.com"
          style={{ flex:2, minWidth:220, padding:".6rem .85rem", borderRadius:".5rem", border:"1px solid rgba(255,255,255,.2)", background:"rgba(255,255,255,.1)", color:"white", fontSize:".85rem", outline:"none" }}
          onKeyDown={e => e.key === "Enter" && !crawling && crawl()}/>
        <button onClick={crawl} disabled={crawling || !crawlUrl.trim()} style={{ background:"#6366f1", color:"white", border:"none", borderRadius:".5rem", padding:".6rem 1.1rem", fontWeight:700, fontSize:".85rem", cursor: crawling ? "not-allowed" : "pointer", whiteSpace:"nowrap", opacity: crawling ? .7 : 1, display:"flex", alignItems:"center", gap:".4rem" }}>
          {crawling ? <><LoaderIcon size={14}/> {crawlMsg || "Crawling…"}</> : "🔍 Extract Data"}
        </button>
      </div>

      {/* Inner tabs */}
      <div style={{ display:"flex", gap:".25rem", background:"white", borderRadius:".75rem", padding:".35rem", marginBottom:"1.5rem", boxShadow:"0 1px 3px rgba(0,0,0,.06)", border:"1px solid #f1f5f9", width:"fit-content" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding:".5rem 1.25rem", borderRadius:".5rem", border:"none", cursor:"pointer", fontWeight:600, fontSize:".82rem", transition:"all .15s",
            background: activeTab===t.id ? "linear-gradient(135deg,#8929bd,#4338ca)" : "transparent",
            color: activeTab===t.id ? "white" : "#64748b",
            boxShadow: activeTab===t.id ? "0 2px 8px rgba(137,41,189,.3)" : "none" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── COMPANY TAB ── */}
      {activeTab === "company" && (
        <div className="card" style={{ padding:"1.5rem", display:"flex", flexDirection:"column", gap:"1rem" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
            {field("Company Name *", "name", { placeholder:"Acme Corporation" })}
            {field("Industry *", "industry", { placeholder:"e.g. Digital Marketing" })}
          </div>
          {textarea("About Us / Company Description", "about", {
            placeholder:"2-4 paragraphs describing who you are and what you do. This is the foundation of every generated post.",
            hint:"2-4 paragraphs about who they are and what they do.", rows:6
          })}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
            {field("Tagline / Slogan", "tagline", { placeholder:"Transforming brands with innovative digital marketing solutions." })}
            {field("Quote Attribution", "quoteAttribution", { placeholder:"Jane Doe — CEO, Acme Corp" })}
          </div>
          {textarea("Target Audience", "targetAudience", { placeholder:"Businesses of all sizes and industries seeking digital marketing, web design, and automation solutions.", hint:"Who are their ideal clients?" })}
          {textarea("Unique Differentiators", "differentiators", {
            placeholder:"Turnkey eCommerce™\nXtreme eCommerce™\nTurnkey Websites™",
            hint:"One differentiator per line — what makes them better or different from competitors?", rows:4
          })}

          <div style={{ height:1, background:"#f1f5f9", margin:".25rem 0" }}/>
          <p style={{ fontSize:".72rem", fontWeight:700, color:"#6366f1", letterSpacing:".08em", margin:0 }}>CONTACT & LINKS</p>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
            {field("Website URL", "websiteUrl", { type:"url", placeholder:"https://yoursite.com" })}
            {field("Google Profile URL", "googleProfileUrl", { type:"url", placeholder:"https://g.page/yourcompany" })}
          </div>
          <div>
            <label className="field-label" style={{ display:"flex", alignItems:"center", gap:".35rem" }}><MapPinIcon size={13}/> Address</label>
            <input value={draft.address} onChange={e => set("address", e.target.value)} placeholder="123 Main St, City, State, ZIP" className="field-input"/>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
            <div>
              <label className="field-label" style={{ display:"flex", alignItems:"center", gap:".35rem" }}><PhoneIcon size={13}/> Phone</label>
              <input type="tel" value={draft.phone} onChange={e => set("phone", e.target.value)} placeholder="+1 (555) 000-0000" className="field-input"/>
            </div>
            <div>
              <label className="field-label" style={{ display:"flex", alignItems:"center", gap:".35rem" }}><MailIcon size={13}/> Email</label>
              <input type="email" value={draft.email} onChange={e => set("email", e.target.value)} placeholder="press@yourcompany.com" className="field-input"/>
            </div>
          </div>
        </div>
      )}

      {/* ── SERVICES TAB ── */}
      {activeTab === "services" && (
        <ServiceLocationEditor
          items={draft.servicePages}
          onChange={pages => set("servicePages", pages)}
          type="service"
          websiteUrl={draft.websiteUrl}
        />
      )}

      {/* ── LOCATIONS TAB ── */}
      {activeTab === "locations" && (
        <ServiceLocationEditor
          items={draft.locationPages}
          onChange={pages => set("locationPages", pages)}
          type="location"
          websiteUrl={draft.websiteUrl}
        />
      )}
    </div>
  );
}

// ── Service / Location Editor ─────────────────────────────────────────────────
function ServiceLocationEditor({ items, onChange, type, websiteUrl }: {
  items: ServicePage[] | LocationPage[];
  onChange: (items: any[]) => void;
  type: "service" | "location";
  websiteUrl: string;
}) {
  const label = type === "service" ? "Service" : "Location";

  const addItem = () => onChange([...items, { name: "", url: "", keywords: [] }]);
  const removeItem = (i: number) => onChange(items.filter((_, j) => j !== i));
  const updateItem = (i: number, key: string, value: any) => {
    const updated = [...items];
    (updated[i] as any)[key] = value;
    onChange(updated);
  };
  const updateKeywords = (i: number, val: string) => {
    updateItem(i, "keywords", val.split(",").map(k => k.trim()).filter(Boolean));
  };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1rem" }}>
        <div>
          <p style={{ fontSize:".83rem", color:"#64748b", margin:0 }}>
            {type === "service"
              ? "Map each service to its page URL. Used as the 'Learn More' link in generated posts."
              : "Map each location to its page URL. Used for location-specific content generation."}
          </p>
        </div>
        <button onClick={addItem} style={{ background:"#6366f1", color:"white", border:"none", borderRadius:".5rem", padding:".5rem 1rem", fontWeight:700, fontSize:".82rem", cursor:"pointer", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:".4rem" }}>
          + Add {label} URL
        </button>
      </div>

      {items.length === 0 ? (
        <div className="card" style={{ padding:"2.5rem", textAlign:"center", color:"#94a3b8" }}>
          <div style={{ fontSize:"2rem", marginBottom:".5rem" }}>{type === "service" ? "🔧" : "📍"}</div>
          <div style={{ fontWeight:600, color:"#64748b", marginBottom:".25rem" }}>No {label.toLowerCase()}s yet</div>
          <p style={{ fontSize:".82rem", margin:"0 0 1rem" }}>Use the AI crawl above to auto-discover, or add manually</p>
          <button onClick={addItem} style={{ background:"#6366f1", color:"white", border:"none", borderRadius:".5rem", padding:".5rem 1.1rem", fontWeight:700, fontSize:".82rem", cursor:"pointer" }}>
            + Add {label}
          </button>
        </div>
      ) : (
        <div className="card" style={{ overflow:"hidden" }}>
          {/* Table header */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1.5fr 1.5fr auto", gap:"1rem", padding:".65rem 1rem", background:"linear-gradient(135deg,#4f46e5,#7c3aed)" }}>
            {[label+" Name", "Page URL", "Keywords (comma separated)", ""].map((h, i) => (
              <span key={i} style={{ fontSize:".7rem", fontWeight:700, color:"white", textTransform:"uppercase", letterSpacing:".06em", borderRight: i < 3 ? "1px solid rgba(255,255,255,.15)" : "none", paddingRight: i < 3 ? ".5rem" : 0 }}>{h}</span>
            ))}
          </div>
          {items.map((item, i) => (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1.5fr 1.5fr auto", gap:"1rem", padding:".75rem 1rem", borderBottom: i < items.length-1 ? "1px solid #f8fafc" : "none", alignItems:"center" }}>
              <input value={item.name} onChange={e => updateItem(i, "name", e.target.value)}
                placeholder={type === "service" ? "e.g. SEO Optimization" : "e.g. Downtown Austin"}
                style={{ padding:".45rem .65rem", border:"1px solid #e2e8f0", borderRadius:".4rem", fontSize:".82rem", outline:"none", width:"100%" }}/>
              <input value={item.url} onChange={e => updateItem(i, "url", e.target.value)}
                placeholder={websiteUrl ? `${websiteUrl}/your-${type}` : `https://yoursite.com/your-${type}`}
                style={{ padding:".45rem .65rem", border:"1px solid #e2e8f0", borderRadius:".4rem", fontSize:".82rem", outline:"none", width:"100%", fontFamily:"monospace" }}/>
              <input value={(item.keywords || []).join(", ")} onChange={e => updateKeywords(i, e.target.value)}
                placeholder="keyword 1, keyword 2, keyword 3"
                style={{ padding:".45rem .65rem", border:"1px solid #e2e8f0", borderRadius:".4rem", fontSize:".78rem", outline:"none", width:"100%" }}/>
              <button onClick={() => removeItem(i)} style={{ background:"#fef2f2", color:"#ef4444", border:"1px solid #fecaca", borderRadius:".4rem", padding:".3rem .5rem", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <XIcon size={14}/>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
