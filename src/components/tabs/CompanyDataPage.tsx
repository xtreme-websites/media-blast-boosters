import { useState, useEffect, useRef, useCallback } from "react";
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
  const [autoSaving, setAutoSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced auto-save: fires 2s after last change
  const scheduleSave = useCallback((data: CompanyData) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setAutoSaving(true);
      await onSave(data);
      setAutoSaving(false);
    }, 2000);
  }, [onSave]);

  useEffect(() => {
    setDraft({ ...EMPTY_COMPANY, ...companyData });
    setCrawlUrl(companyData.websiteUrl || "");
  }, [companyData]);

  const set = (k: keyof CompanyData, v: any) => {
    setDraft(p => {
      const updated = { ...p, [k]: v };
      scheduleSave(updated);
      return updated;
    });
  };

  const CRAWL_STEPS = [
    "Fetching sitemap & homepage…",
    "Discovering service pages…",
    "Reading contact & about pages…",
    "Extracting company data with AI…",
    "Finalizing your profile…",
  ];

  const crawl = async () => {
    const url = crawlUrl.trim().replace(/\/$/, "");
    if (!url) { showToast("Please enter a website URL", "error"); return; }
    setCrawling(true); setCrawlMsg(CRAWL_STEPS[0]);

    // Cycle through progress messages while waiting
    let stepIdx = 0;
    const stepInterval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, CRAWL_STEPS.length - 1);
      setCrawlMsg(CRAWL_STEPS[stepIdx]);
    }, 6000);

    try {
      const res  = await fetch(CRAWL_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ website_url: url, company_name: draft.name }) });
      const data = await res.json();
      clearInterval(stepInterval);
      if (!data.success) throw new Error(data.error || "Crawl failed");
      setCrawlMsg("Saving profile…");
      const merged = (crawled: string, existing: string) => crawled?.trim() ? crawled : existing;
      const mergedAddress = data.address ? data.address : prev => [data.address, data.city, data.state, data.zip].filter(Boolean).join(", ") || prev;

      setDraft(prev => {
        const updated: CompanyData = {
          ...prev,
          name:             merged(data.name,              prev.name),
          industry:         merged(data.industry,          prev.industry),
          tagline:          merged(data.tagline,           prev.tagline),
          targetAudience:   merged(data.target_audience,   prev.targetAudience),
          about:            merged(data.about_us,          prev.about),
          differentiators:  merged(data.differentiators,   prev.differentiators),
          quoteAttribution: merged(data.quote_attribution, prev.quoteAttribution),
          websiteUrl:       url,
          address: (data.address?.trim() && data.address.length > 5) ? data.address : prev.address,
          phone:   (data.phone?.trim()   && data.phone.length > 4)   ? data.phone   : prev.phone,
          email:   (data.email?.trim()   && data.email.includes('@')) ? data.email   : prev.email,
          servicePages:  Array.isArray(data.services)  && data.services.length  > 0 ? data.services  : prev.servicePages,
          locationPages: Array.isArray(data.locations) && data.locations.length > 0 ? data.locations : prev.locationPages,
        };
        setTimeout(() => onSave(updated), 100);
        return updated;
      });
      showToast(`✓ Profile saved — ${(data.services||[]).length} services, ${(data.locations||[]).length} locations found`);
    } catch (e: any) {
      clearInterval(stepInterval);
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
          {saving ? <><LoaderIcon size={14}/> Saving…</> : autoSaving ? <><LoaderIcon size={14}/> Auto-saving…</> : <><SaveIcon size={14}/> Save Changes</>}
        </button>
      </div>

      {/* Crawl progress overlay */}
      {crawling && (
        <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(15,10,40,.82)", backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1.5rem" }}>
          <div style={{ background:"linear-gradient(135deg,#1e1b4b,#312e81,#4c1d95)", borderRadius:"1.25rem", padding:"2.5rem 2rem", width:"100%", maxWidth:420, textAlign:"center", boxShadow:"0 32px 80px rgba(99,102,241,.4)" }}>
            {/* Animated logo mark */}
            <div style={{ width:64, height:64, borderRadius:"50%", background:"rgba(255,255,255,.1)", margin:"0 auto 1.5rem", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.75rem" }}>
              🤖
            </div>
            <h3 style={{ color:"white", fontWeight:900, fontSize:"1.15rem", margin:"0 0 .5rem" }}>
              AI Website Crawl
            </h3>
            <p style={{ color:"rgba(255,255,255,.6)", fontSize:".82rem", margin:"0 0 2rem" }}>
              Analyzing <span style={{ color:"#a5b4fc", fontWeight:600 }}>{crawlUrl}</span>
            </p>

            {/* Pulsing step message */}
            <div style={{ background:"rgba(255,255,255,.08)", borderRadius:".65rem", padding:"1rem 1.25rem", marginBottom:"1.75rem" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:".65rem" }}>
                <div style={{ display:"flex", gap:".3rem", alignItems:"center" }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:"#a5b4fc",
                      animation:`bounce 1.2s ease-in-out ${i*0.2}s infinite`,
                    }}/>
                  ))}
                </div>
                <span style={{ color:"white", fontWeight:600, fontSize:".88rem" }}>{crawlMsg}</span>
              </div>
            </div>

            {/* Progress steps */}
            <div style={{ display:"flex", flexDirection:"column", gap:".5rem", textAlign:"left" }}>
              {[
                "Fetching sitemap & homepage",
                "Discovering service pages",
                "Reading contact & about pages",
                "Extracting data with AI",
                "Finalizing profile",
              ].map((step, i) => {
                const stepMsgIdx = ["Fetching","Discovering","Reading","Extracting","Finalizing"].findIndex(s => crawlMsg.startsWith(s));
                const done   = i < stepMsgIdx;
                const active = i === stepMsgIdx;
                return (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:".6rem", opacity: done||active ? 1 : 0.35 }}>
                    <div style={{ width:18, height:18, borderRadius:"50%", flexShrink:0, background: done ? "#22c55e" : active ? "#6366f1" : "rgba(255,255,255,.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:".65rem", fontWeight:900, color:"white" }}>
                      {done ? "✓" : i+1}
                    </div>
                    <span style={{ color: done ? "#86efac" : active ? "white" : "rgba(255,255,255,.5)", fontSize:".78rem", fontWeight: active ? 700 : 400 }}>{step}</span>
                  </div>
                );
              })}
            </div>

            <p style={{ color:"rgba(255,255,255,.35)", fontSize:".72rem", marginTop:"1.5rem", marginBottom:0 }}>
              Large sites may take 25–45 seconds. Please wait…
            </p>
          </div>
          <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}`}</style>
        </div>
      )}
      <div style={{ background:"linear-gradient(135deg,#1e1b4b,#312e81)", borderRadius:".75rem", padding:"1rem 1.25rem", marginBottom:"1.5rem", display:"flex", gap:".75rem", alignItems:"center", flexWrap:"wrap" }}>
        <div style={{ flex:1, minWidth:220 }}>
          <div style={{ fontSize:".72rem", fontWeight:600, color:"#a5b4fc", letterSpacing:".06em", marginBottom:".3rem" }}>🤖 AI CRAWL WEBSITE</div>
          <p style={{ color:"rgba(255,255,255,.7)", fontSize:".78rem", margin:0 }}>Enter your URL and AI will auto-fill all your fields below</p>
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
            {field("Company Name *", "name", { placeholder:"Rockville Home Services" })}
            {field("Industry *", "industry", { placeholder:"e.g. Home Cleaning, HVAC, Plumbing" })}
          </div>
          {textarea("About Us / Company Description", "about", {
            placeholder:"Locally-owned business specializing in professional window cleaning, power washing, and soft washing. Serving the Rockville and Bethesda areas for over 20 years...",
            hint:"2-4 paragraphs about who you are and what you do.", rows:6
          })}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
            {field("Tagline / Slogan", "tagline", { placeholder:"Serving homeowners in the DMV area since 2005." })}
            {field("Quote Attribution", "quoteAttribution", { placeholder:"Jane Smith — Owner, Your Company Name" })}
          </div>
          {textarea("Target Audience", "targetAudience", { placeholder:"Homeowners and property managers in the DC metro area seeking professional exterior cleaning services.", hint:"Who are your ideal clients?" })}
          {textarea("Unique Differentiators", "differentiators", {
            placeholder:"EPA-certified eco-friendly products\nSame-day service available\nFamily-owned and operated",
            hint:"One differentiator per line — what makes you better or different from competitors?", rows:4
          })}

          <div style={{ height:1, background:"#f1f5f9", margin:".25rem 0" }}/>
          <p style={{ fontSize:".72rem", fontWeight:700, color:"#6366f1", letterSpacing:".08em", margin:0 }}>CONTACT & LINKS</p>

          {field("Website URL", "websiteUrl", { type:"url", placeholder:"https://yourcompany.com" })}
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
