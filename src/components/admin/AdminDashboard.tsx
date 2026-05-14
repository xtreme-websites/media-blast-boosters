import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, adminPost, ADMIN_REVENUE, ADMIN_CREDITS } from "../../lib/supabase-admin";
import type { Session } from "@supabase/supabase-js";
import RichEditor, { RichToolbar } from "../RichEditor";

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "overview" | "locations" | "revenue" | "pipeline" | "queue" | "pr_orders" | "report_pending" | "promotions" | "email_alerts" | "partner_details" | "settings";
interface EmailTemplate { key: string; subject: string; html: string; updated_at?: string; is_custom?: boolean; }

interface Location { location_id: string; company_name?: string; email?: string;
  starter_credits: number; standard_credits: number; premium_credits: number;
  orders: { product_name: string; status: string }[]; }
interface Order { id: string; location_id: string; pr_title: string; product_name: string;
  status: string; created_at: string; pr_content?: string; company_name?: string; }
interface RevenueData { gross: number; payout: number; margin: number; count: number;
  by_month: Record<string,{gross:number;payout:number;count:number}>; test_mode: boolean; }
interface AdminSettings { review_mode_global: boolean; review_mode_overrides: Record<string,boolean>; }

const TIER_COLORS: Record<string,string> = { starter:"#6366f1", standard:"#8929bd", premium:"#d97706" };

// ── Login ─────────────────────────────────────────────────────────────────────
function AdminLogin({ onLogin, accessDenied }: { onLogin: () => void; accessDenied?: boolean }) {
  const [email, setEmail] = useState("");
  const [pass,  setPass]  = useState("");
  const [err,   setErr]   = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) { setErr(error.message); setLoading(false); return; }
    onLogin();
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0f0a1e,#1e1b4b)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"system-ui,sans-serif" }}>
      <div style={{ background:"white", borderRadius:"1rem", padding:"2.5rem", width:"100%", maxWidth:380, boxShadow:"0 32px 80px rgba(0,0,0,.4)" }}>
        <div style={{ textAlign:"center", marginBottom:"2rem" }}>
          <img src="https://mediablast.xlogic.app/logo.png" alt="MBB" style={{ width:56, height:56, objectFit:"contain", marginBottom:".75rem", display:"block", margin:"0 auto .75rem" }}/>
          <h1 style={{ fontWeight:900, fontSize:"1.3rem", color:"#1e293b", margin:"0 0 .25rem" }}>Admin Command Center</h1>
          <p style={{ color:"#64748b", fontSize:".82rem", margin:0 }}>Media Blast Boosters™</p>
        </div>
        {accessDenied && <div style={{ background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:".5rem", padding:".65rem .9rem", color:"#be123c", fontSize:".82rem", marginBottom:"1rem" }}>⛔ Access denied — your account is not authorized as admin.</div>}
        {err && <div style={{ background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:".5rem", padding:".65rem .9rem", color:"#be123c", fontSize:".82rem", marginBottom:"1rem" }}>{err}</div>}
        <div style={{ display:"flex", flexDirection:"column", gap:".75rem" }}>
          <input type="email" placeholder="Admin email" value={email} onChange={e=>setEmail(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&login()}
            style={{ padding:".65rem .9rem", borderRadius:".5rem", border:"1.5px solid #e2e8f0", fontSize:".88rem", outline:"none" }}/>
          <input type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&login()}
            style={{ padding:".65rem .9rem", borderRadius:".5rem", border:"1.5px solid #e2e8f0", fontSize:".88rem", outline:"none" }}/>
          <button onClick={login} disabled={loading || !email || !pass}
            style={{ padding:".75rem", borderRadius:".55rem", border:"none", background: loading?"#e2e8f0":"linear-gradient(135deg,#6366f1,#8929bd)", color: loading?"#94a3b8":"white", fontWeight:800, fontSize:".9rem", cursor: loading?"not-allowed":"pointer" }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Promotions Tab ───────────────────────────────────────────────────────────
interface PromotionsTabProps {
  promotions: any[];
  locationsList: any[];
  session: any;
  showToast: (msg: string, type?: "success"|"error") => void;
  onRefresh: () => void;
}
function PromotionsTab({ promotions, locationsList, session, showToast, onRefresh }: PromotionsTabProps) {
  const [creating, setCreating] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [editingPromo, setEditingPromo] = useState<any | null>(null);
  const [editSaving,   setEditSaving]   = useState(false);
  const [eLocSearch,   setELocSearch]   = useState("");
  const [locSearch, setLocSearch] = useState("");
  const EMPTY_FORM = { name:"", code:"", discount_type:"percent", discount_value:"", packages:[] as string[], location_ids:[] as string[], max_redemptions:"", max_redemptions_per_user:"", expires_at:"", client_description:"", show_banner:false };
  const [form, setForm] = useState(EMPTY_FORM);
  const ALL_PKGS = ["starter","standard","premium"];
  const togglePkg = (p: string) => setForm(f=>({...f, packages: f.packages.includes(p) ? f.packages.filter(x=>x!==p) : [...f.packages, p]}));

  // Autocomplete: filter by search, exclude already selected
  const locSuggestions = locSearch.trim().length > 0
    ? locationsList.filter(l =>
        !form.location_ids.includes(l.location_id) &&
        l.company_name?.toLowerCase().includes(locSearch.toLowerCase())
      ).slice(0, 6)
    : [];

  const addLocation = (loc: any) => {
    setForm(f => ({ ...f, location_ids: [...f.location_ids, loc.location_id] }));
    setLocSearch("");
  };
  const removeLocation = (id: string) => setForm(f => ({ ...f, location_ids: f.location_ids.filter(x => x !== id) }));
  const getLocName = (id: string) => locationsList.find(l => l.location_id === id)?.company_name || id;

  const createPromo = async () => {
    if (!form.code || !form.discount_value || !session) return;
    setSaving(true);
    const d = await adminPost("create_promotion", {
      name: form.name || form.code,
      code: form.code.toUpperCase(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      packages: form.packages.length ? form.packages : null,
      location_ids: form.location_ids.length ? form.location_ids : null,
      max_redemptions: form.max_redemptions ? Number(form.max_redemptions) : null,
      max_redemptions_per_user: form.max_redemptions_per_user ? Number(form.max_redemptions_per_user) : null,
      expires_at: form.expires_at || null,
      client_description: form.client_description || null,
      show_banner: form.show_banner,
    }, session.access_token);
    if (d.ok) {
      showToast(`✅ Promotion ${form.code.toUpperCase()} created`);
      setCreating(false); setForm(EMPTY_FORM); onRefresh();
    } else showToast(d.error || "Failed to create", "error");
    setSaving(false);
  };

  const deactivate = async (id: string) => {
    if (!session || !confirm("Deactivate this promo code? It will no longer be usable.")) return;
    const d = await adminPost("deactivate_promotion", { id }, session.access_token);
    if (d.ok) { showToast("Promo code deactivated"); onRefresh(); }
    else showToast(d.error, "error");
  };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.5rem" }}>
        <div>
          <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:"0 0 .2rem" }}>🎟️ Promotions</h2>
          <p style={{ color:"#64748b", fontSize:".82rem", margin:0 }}>Create and manage coupon codes — synced live with Stripe</p>
        </div>
        <button onClick={()=>setCreating(true)}
          style={{ padding:".65rem 1.5rem", borderRadius:".55rem", border:"none", background:"linear-gradient(135deg,#6366f1,#8929bd)", color:"white", fontWeight:800, fontSize:".85rem", cursor:"pointer", boxShadow:"0 4px 14px rgba(99,102,241,.25)" }}>
          + New Promo Code
        </button>
      </div>

      {promotions.length === 0 ? (
        <div style={{ background:"white", borderRadius:".75rem", border:"1px solid #f1f5f9", padding:"3rem", textAlign:"center" }}>
          <div style={{ fontSize:"2.5rem", marginBottom:".75rem" }}>🎟️</div>
          <div style={{ fontWeight:700, color:"#1e293b" }}>No promotions yet</div>
          <div style={{ color:"#94a3b8", fontSize:".82rem", marginTop:".3rem" }}>Create your first coupon code above</div>
        </div>
      ) : (
        <div style={{ background:"white", borderRadius:".75rem", border:"1px solid #f1f5f9", overflow:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:".82rem" }}>
            <thead><tr style={{ background:"#1e1b4b" }}>
              {["Code","Discount","Packages","Audience","Uses (Total)","Uses (Per Client)","Expires","Banner","Status",""].map(h=>(
                <th key={h} style={{ padding:".7rem 1rem", textAlign:"left", fontWeight:700, color:"rgba(255,255,255,.8)", fontSize:".68rem", textTransform:"uppercase", letterSpacing:".05em", whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {promotions.map(p=>(
                <tr key={p.id} style={{ borderTop:"1px solid #f8fafc" }}
                  onMouseOver={e=>(e.currentTarget.style.background="#fafafa")}
                  onMouseOut={e=>(e.currentTarget.style.background="white")}>
                  <td style={{ padding:".8rem 1rem" }}>
                    <span style={{ fontFamily:"monospace", fontWeight:800, fontSize:".88rem", color:"#6366f1", background:"#eef2ff", padding:".2rem .6rem", borderRadius:".3rem" }}>{p.code}</span>
                    {p.name && p.name !== p.code && <div style={{ fontSize:".72rem", color:"#94a3b8", marginTop:".2rem" }}>{p.name}</div>}
                  </td>
                  <td style={{ padding:".8rem 1rem", fontWeight:700, color:"#16a34a", fontSize:".9rem" }}>
                    {p.discount_type==="percent" ? `${p.discount_value}% off` : `$${p.discount_value} off`}
                  </td>
                  <td style={{ padding:".8rem 1rem" }}>
                    {p.packages ? p.packages.map((pkg:string)=>(
                      <span key={pkg} style={{ fontSize:".68rem", fontWeight:700, background:"#f1f5f9", color:"#374151", padding:".15rem .45rem", borderRadius:"99px", marginRight:".25rem" }}>{pkg}</span>
                    )) : <span style={{ fontSize:".72rem", color:"#94a3b8" }}>All</span>}
                  </td>
                  <td style={{ padding:".8rem 1rem" }}>
                    {p.location_ids ? <span style={{ fontSize:".72rem", color:"#6366f1" }}>{p.location_ids.length} location{p.location_ids.length!==1?"s":""}</span> : <span style={{ fontSize:".72rem", color:"#94a3b8" }}>All</span>}
                  </td>
                  <td style={{ padding:".8rem 1rem", color:"#374151" }}>{p.max_redemptions || <span style={{ color:"#94a3b8" }}>∞</span>}</td>
                  <td style={{ padding:".8rem 1rem", color:"#374151" }}>{p.max_redemptions_per_user || <span style={{ color:"#94a3b8" }}>∞</span>}</td>
                  <td style={{ padding:".8rem 1rem", color:"#64748b", fontSize:".78rem" }}>
                    {p.expires_at ? new Date(p.expires_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : <span style={{ color:"#94a3b8" }}>Never</span>}
                  </td>
                  <td style={{ padding:".8rem 1rem", textAlign:"center" }}>{p.show_banner ? "✅" : "—"}</td>
                  <td style={{ padding:".8rem 1rem" }}>
                    <span style={{ fontSize:".7rem", fontWeight:700, padding:".2rem .55rem", borderRadius:"99px", background:p.active?"#dcfce7":"#fee2e2", color:p.active?"#166534":"#991b1b" }}>
                      {p.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding:".8rem 1rem" }}>
                    <div style={{ display:"flex", gap:".4rem" }}>
                      <button onClick={()=>setEditingPromo({...p, location_ids: p.location_ids||[] })}
                        style={{ fontSize:".72rem", padding:".25rem .65rem", borderRadius:".35rem", border:"1px solid #e2e8f0", background:"white", color:"#374151", cursor:"pointer", fontWeight:600 }}>✏️ Edit</button>
                      {p.active && <button onClick={()=>deactivate(p.id)} style={{ fontSize:".72rem", padding:".25rem .65rem", borderRadius:".35rem", border:"1px solid #fee2e2", background:"white", color:"#991b1b", cursor:"pointer", fontWeight:600 }}>Deactivate</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1.5rem" }}>
          <div style={{ background:"white", borderRadius:"1rem", width:"100%", maxWidth:560, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 80px rgba(0,0,0,.35)" }}>
            <div style={{ padding:"1.25rem 1.5rem", borderBottom:"1px solid #f1f5f9", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, background:"white", zIndex:1 }}>
              <h3 style={{ fontWeight:900, margin:0, fontSize:"1.05rem" }}>🎟️ New Promo Code</h3>
              <button onClick={()=>setCreating(false)} style={{ background:"none", border:"none", fontSize:"1.2rem", cursor:"pointer", color:"#94a3b8", lineHeight:1 }}>✕</button>
            </div>
            <div style={{ padding:"1.5rem", display:"flex", flexDirection:"column", gap:"1.1rem" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:".75rem" }}>
                <div>
                  <label style={{ fontSize:".75rem", fontWeight:700, color:"#374151", display:"block", marginBottom:".3rem" }}>Promo Code *</label>
                  <input value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))} placeholder="SAVE20"
                    style={{ width:"100%", padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".9rem", fontFamily:"monospace", fontWeight:700, letterSpacing:".05em", boxSizing:"border-box" as const }}/>
                </div>
                <div>
                  <label style={{ fontSize:".75rem", fontWeight:700, color:"#374151", display:"block", marginBottom:".3rem" }}>Internal Name</label>
                  <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Summer promotion"
                    style={{ width:"100%", padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".84rem", boxSizing:"border-box" as const }}/>
                </div>
              </div>
              <div>
                <label style={{ fontSize:".75rem", fontWeight:700, color:"#374151", display:"block", marginBottom:".3rem" }}>Discount *</label>
                <div style={{ display:"flex", gap:".5rem" }}>
                  <select value={form.discount_type} onChange={e=>setForm(f=>({...f,discount_type:e.target.value}))}
                    style={{ padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".84rem", background:"white" }}>
                    <option value="percent">% Off</option>
                    <option value="amount">$ Off</option>
                  </select>
                  <input type="number" value={form.discount_value} onChange={e=>setForm(f=>({...f,discount_value:e.target.value}))}
                    placeholder={form.discount_type==="percent"?"20":"50"} min="1"
                    style={{ flex:1, padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".9rem", fontWeight:700 }}/>
                  <span style={{ display:"flex", alignItems:"center", fontWeight:800, color:"#6366f1", fontSize:".9rem" }}>{form.discount_type==="percent"?"%":"USD"}</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize:".75rem", fontWeight:700, color:"#374151", display:"block", marginBottom:".5rem" }}>Packages <span style={{ color:"#94a3b8", fontWeight:400 }}>(unchecked = all)</span></label>
                <div style={{ display:"flex", gap:".5rem" }}>
                  {ALL_PKGS.map(p=>(
                    <button key={p} onClick={()=>togglePkg(p)}
                      style={{ padding:".4rem .9rem", borderRadius:".4rem", border:"2px solid", borderColor:form.packages.includes(p)?"#6366f1":"#e2e8f0", background:form.packages.includes(p)?"#eef2ff":"white", color:form.packages.includes(p)?"#6366f1":"#374151", fontWeight:form.packages.includes(p)?700:500, cursor:"pointer", fontSize:".8rem", textTransform:"capitalize" as const }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize:".75rem", fontWeight:700, color:"#374151", display:"block", marginBottom:".5rem" }}>Audience <span style={{ color:"#94a3b8", fontWeight:400 }}>(leave empty = all locations)</span></label>
                {/* Selected pills */}
                {form.location_ids.length > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:".35rem", marginBottom:".5rem" }}>
                    {form.location_ids.map(id => (
                      <span key={id} style={{ display:"inline-flex", alignItems:"center", gap:".3rem", background:"#eef2ff", color:"#6366f1", fontSize:".75rem", fontWeight:600, padding:".25rem .6rem", borderRadius:"99px" }}>
                        {getLocName(id)}
                        <button onClick={() => removeLocation(id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#6366f1", padding:0, fontSize:".75rem", lineHeight:1, display:"flex", alignItems:"center" }}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
                {/* Search input */}
                <div style={{ position:"relative" }}>
                  <input
                    value={locSearch}
                    onChange={e => setLocSearch(e.target.value)}
                    placeholder={form.location_ids.length ? "Add another location…" : "Search locations…"}
                    style={{ width:"100%", padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".84rem", boxSizing:"border-box" as const }}
                  />
                  {locSuggestions.length > 0 && (
                    <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"white", border:"1px solid #e2e8f0", borderRadius:".45rem", boxShadow:"0 4px 16px rgba(0,0,0,.1)", zIndex:100, marginTop:".2rem", overflow:"hidden" }}>
                      {locSuggestions.map(loc => (
                        <button key={loc.location_id} onMouseDown={() => addLocation(loc)}
                          style={{ width:"100%", padding:".55rem .85rem", border:"none", background:"white", textAlign:"left", cursor:"pointer", fontSize:".82rem", color:"#374151" }}
                          onMouseOver={e => (e.currentTarget.style.background = "#f1f5f9")}
                          onMouseOut={e => (e.currentTarget.style.background = "white")}>
                          {loc.company_name}
                        </button>
                      ))}
                    </div>
                  )}
                  {locSearch.trim().length > 0 && locSuggestions.length === 0 && (
                    <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"white", border:"1px solid #e2e8f0", borderRadius:".45rem", padding:".65rem .85rem", fontSize:".8rem", color:"#94a3b8", marginTop:".2rem" }}>
                      No matches
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:".75rem" }}>
                <div>
                  <label style={{ fontSize:".75rem", fontWeight:700, color:"#374151", display:"block", marginBottom:".3rem" }}>Max Uses — Total <span style={{ color:"#94a3b8", fontWeight:400 }}>(blank = ∞)</span></label>
                  <input type="number" value={form.max_redemptions} onChange={e=>setForm(f=>({...f,max_redemptions:e.target.value}))} placeholder="∞"
                    style={{ width:"100%", padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".84rem", boxSizing:"border-box" as const }}/>
                  <div style={{ fontSize:".68rem", color:"#94a3b8", marginTop:".25rem" }}>Max times the code can be used across all clients</div>
                </div>
                <div>
                  <label style={{ fontSize:".75rem", fontWeight:700, color:"#374151", display:"block", marginBottom:".3rem" }}>Max Uses — Per Client <span style={{ color:"#94a3b8", fontWeight:400 }}>(blank = ∞)</span></label>
                  <input type="number" value={form.max_redemptions_per_user} onChange={e=>setForm(f=>({...f,max_redemptions_per_user:e.target.value}))} placeholder="∞"
                    style={{ width:"100%", padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".84rem", boxSizing:"border-box" as const }}/>
                  <div style={{ fontSize:".68rem", color:"#94a3b8", marginTop:".25rem" }}>Max times one location can redeem this code</div>
                </div>
              </div>
                <div>
                  <label style={{ fontSize:".75rem", fontWeight:700, color:"#374151", display:"block", marginBottom:".3rem" }}>Expiry Date <span style={{ color:"#94a3b8", fontWeight:400 }}>(blank = none)</span></label>
                  <input type="date" value={form.expires_at} onChange={e=>setForm(f=>({...f,expires_at:e.target.value}))}
                    style={{ width:"100%", padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".84rem", boxSizing:"border-box" as const }}/>
                </div>
              {/* Client Description */}
              <div>
                <label style={{ fontSize:".75rem", fontWeight:700, color:"#374151", display:"block", marginBottom:".3rem" }}>
                  Client Description <span style={{ color:"#94a3b8", fontWeight:400 }}>(shown on the banner)</span>
                </label>
                <input value={form.client_description} onChange={e=>setForm(f=>({...f,client_description:e.target.value}))}
                  placeholder="e.g. Limited time offer — save on your next PR package!"
                  style={{ width:"100%", padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".84rem", boxSizing:"border-box" as const }}/>
              </div>
              {/* Promo Banner toggle */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:".75rem 1rem", borderRadius:".55rem", border:"1.5px solid #e2e8f0", background:"#fafafa" }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:".84rem", color:"#1e293b" }}>Show Promo Banner on Client Dashboard</div>
                  <div style={{ fontSize:".72rem", color:"#94a3b8", marginTop:".15rem" }}>Displays a promotional banner below the Media Packages section</div>
                </div>
                <button onClick={()=>setForm(f=>({...f,show_banner:!f.show_banner}))}
                  style={{ position:"relative", width:44, height:24, borderRadius:99, border:"none", cursor:"pointer", padding:0, flexShrink:0,
                    background: form.show_banner?"#10b981":"#e2e8f0", transition:"background .2s" }}>
                  <div style={{ position:"absolute", top:3, left: form.show_banner?22:3, width:18, height:18, borderRadius:"50%", background:"white", transition:"left .2s", boxShadow:"0 1px 3px rgba(0,0,0,.2)" }}/>
                </button>
              </div>
              {form.code && form.discount_value && (
                <div style={{ background:"linear-gradient(135deg,#f0fdf4,#dcfce7)", borderRadius:".65rem", padding:"1rem", border:"1px solid #bbf7d0", textAlign:"center" }}>
                  <div style={{ fontSize:".72rem", fontWeight:700, color:"#166534", textTransform:"uppercase", letterSpacing:".06em", marginBottom:".3rem" }}>Preview</div>
                  <code style={{ fontSize:"1.1rem", fontWeight:900, color:"#166534" }}>{form.code.toUpperCase()}</code>
                  <span style={{ marginLeft:".75rem", fontWeight:700, color:"#166534" }}>→ {form.discount_type==="percent"?`${form.discount_value}% off`:`$${form.discount_value} off`}</span>
                  {form.packages.length > 0 && <span style={{ marginLeft:".5rem", color:"#16a34a", fontSize:".8rem" }}>({form.packages.join(", ")})</span>}
                </div>
              )}
              <div style={{ display:"flex", gap:".75rem", paddingTop:".25rem" }}>
                <button onClick={()=>setCreating(false)} style={{ flex:1, padding:".7rem", borderRadius:".5rem", border:"1px solid #e2e8f0", background:"white", fontWeight:600, cursor:"pointer" }}>Cancel</button>
                <button onClick={createPromo} disabled={saving || !form.code || !form.discount_value}
                  style={{ flex:2, padding:".7rem", borderRadius:".5rem", border:"none", background:saving||!form.code||!form.discount_value?"#e2e8f0":"linear-gradient(135deg,#6366f1,#8929bd)", color:saving||!form.code||!form.discount_value?"#94a3b8":"white", fontWeight:800, cursor:saving?"not-allowed":"pointer", fontSize:".9rem" }}>
                  {saving ? "Creating…" : "🎟️ Create & Sync to Stripe"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingPromo && (() => {
        const ALL_PKGS_E = ["starter","standard","premium"];
        const eSugg = eLocSearch.trim() ? locationsList.filter((l:any)=>!(editingPromo.location_ids||[]).includes(l.location_id)&&l.company_name?.toLowerCase().includes(eLocSearch.toLowerCase())).slice(0,6) : [];
        const addELoc = (loc:any) => { setEditingPromo((f:any)=>({...f,location_ids:[...(f.location_ids||[]),loc.location_id]})); setELocSearch(""); };
        const remELoc = (id:string) => setEditingPromo((f:any)=>({...f,location_ids:(f.location_ids||[]).filter((x:string)=>x!==id)}));
        const togglePkgE = (p:string) => setEditingPromo((f:any)=>({...f,packages:(f.packages||[]).includes(p)?(f.packages||[]).filter((x:string)=>x!==p):[...(f.packages||[]),p]}));
        const saveEdit = async () => {
          if(!session)return;
          setEditSaving(true);
          const d = await adminPost("edit_promotion",{id:editingPromo.id,name:editingPromo.name||null,packages:editingPromo.packages?.length?editingPromo.packages:null,location_ids:editingPromo.location_ids?.length?editingPromo.location_ids:null,max_redemptions_per_user:editingPromo.max_redemptions_per_user?Number(editingPromo.max_redemptions_per_user):null,expires_at:editingPromo.expires_at||null,client_description:editingPromo.client_description||null,show_banner:!!editingPromo.show_banner},session.access_token);
          if(d.ok){showToast("Promotion updated ✓");setEditingPromo(null);setELocSearch("");onRefresh();}
          else showToast(d.error||"Save failed","error");
          setEditSaving(false);
        };
        return (
          <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.55)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
            <div style={{background:"white",borderRadius:"1rem",width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(0,0,0,.35)"}}>
              <div style={{padding:"1.25rem 1.5rem",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:"white",zIndex:1}}>
                <div>
                  <h3 style={{fontWeight:900,margin:"0 0 .2rem",fontSize:"1.05rem"}}>✏️ Edit Promo Code</h3>
                  <div style={{display:"flex",alignItems:"center",gap:".5rem"}}>
                    <span style={{fontFamily:"monospace",fontWeight:800,fontSize:".85rem",color:"#6366f1",background:"#eef2ff",padding:".15rem .5rem",borderRadius:".3rem"}}>{editingPromo.code}</span>
                    <span style={{fontWeight:700,color:"#16a34a",fontSize:".82rem"}}>{editingPromo.discount_type==="percent"?`${editingPromo.discount_value}% off`:`$${editingPromo.discount_value} off`}</span>
                    <span style={{fontSize:".68rem",color:"#94a3b8"}}>· Code & discount are fixed</span>
                  </div>
                </div>
                <button onClick={()=>{setEditingPromo(null);setELocSearch("");}} style={{background:"none",border:"none",fontSize:"1.2rem",cursor:"pointer",color:"#94a3b8",lineHeight:1}}>✕</button>
              </div>
              <div style={{padding:"1.5rem",display:"flex",flexDirection:"column",gap:"1rem"}}>
                <div>
                  <label style={{fontSize:".75rem",fontWeight:700,color:"#374151",display:"block",marginBottom:".3rem"}}>Internal Name</label>
                  <input value={editingPromo.name||""} onChange={e=>setEditingPromo((f:any)=>({...f,name:e.target.value}))} placeholder="e.g. Summer Sale"
                    style={{width:"100%",padding:".5rem .75rem",borderRadius:".45rem",border:"1.5px solid #e2e8f0",fontSize:".84rem",boxSizing:"border-box" as const}}/>
                </div>
                <div>
                  <label style={{fontSize:".75rem",fontWeight:700,color:"#374151",display:"block",marginBottom:".5rem"}}>Packages <span style={{color:"#94a3b8",fontWeight:400}}>(unchecked = all)</span></label>
                  <div style={{display:"flex",gap:".5rem"}}>
                    {ALL_PKGS_E.map(p=>(
                      <button key={p} onClick={()=>togglePkgE(p)}
                        style={{padding:".4rem .9rem",borderRadius:".4rem",border:"2px solid",borderColor:(editingPromo.packages||[]).includes(p)?"#6366f1":"#e2e8f0",background:(editingPromo.packages||[]).includes(p)?"#eef2ff":"white",color:(editingPromo.packages||[]).includes(p)?"#6366f1":"#374151",fontWeight:(editingPromo.packages||[]).includes(p)?700:500,cursor:"pointer",fontSize:".8rem",textTransform:"capitalize" as const}}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{fontSize:".75rem",fontWeight:700,color:"#374151",display:"block",marginBottom:".5rem"}}>Audience <span style={{color:"#94a3b8",fontWeight:400}}>(empty = all locations)</span></label>
                  {(editingPromo.location_ids||[]).length>0&&(
                    <div style={{display:"flex",flexWrap:"wrap",gap:".35rem",marginBottom:".5rem"}}>
                      {(editingPromo.location_ids||[]).map((id:string)=>(
                        <span key={id} style={{display:"inline-flex",alignItems:"center",gap:".3rem",background:"#eef2ff",color:"#6366f1",fontSize:".75rem",fontWeight:600,padding:".25rem .6rem",borderRadius:"99px"}}>
                          {locationsList.find((l:any)=>l.location_id===id)?.company_name||id}
                          <button onClick={()=>remELoc(id)} style={{background:"none",border:"none",cursor:"pointer",color:"#6366f1",padding:0,fontSize:".75rem",lineHeight:1}}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{position:"relative"}}>
                    <input value={eLocSearch} onChange={e=>setELocSearch(e.target.value)} placeholder="Search locations…"
                      style={{width:"100%",padding:".5rem .75rem",borderRadius:".45rem",border:"1.5px solid #e2e8f0",fontSize:".84rem",boxSizing:"border-box" as const}}/>
                    {eSugg.length>0&&(
                      <div style={{position:"absolute",top:"100%",left:0,right:0,background:"white",border:"1px solid #e2e8f0",borderRadius:".45rem",boxShadow:"0 4px 16px rgba(0,0,0,.1)",zIndex:100,marginTop:".2rem",overflow:"hidden"}}>
                        {eSugg.map((loc:any)=>(
                          <button key={loc.location_id} onMouseDown={()=>addELoc(loc)}
                            style={{width:"100%",padding:".55rem .85rem",border:"none",background:"white",textAlign:"left",cursor:"pointer",fontSize:".82rem",color:"#374151"}}
                            onMouseOver={e=>(e.currentTarget.style.background="#f1f5f9")}
                            onMouseOut={e=>(e.currentTarget.style.background="white")}>
                            {loc.company_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".75rem"}}>
                  <div>
                    <label style={{fontSize:".75rem",fontWeight:700,color:"#374151",display:"block",marginBottom:".3rem"}}>Max Uses Per Client</label>
                    <input type="number" value={editingPromo.max_redemptions_per_user||""} onChange={e=>setEditingPromo((f:any)=>({...f,max_redemptions_per_user:e.target.value}))} placeholder="∞"
                      style={{width:"100%",padding:".5rem .75rem",borderRadius:".45rem",border:"1.5px solid #e2e8f0",fontSize:".84rem",boxSizing:"border-box" as const}}/>
                  </div>
                  <div>
                    <label style={{fontSize:".75rem",fontWeight:700,color:"#374151",display:"block",marginBottom:".3rem"}}>Expiry Date <span style={{color:"#94a3b8",fontWeight:400,fontSize:".68rem"}}>(also updates Stripe)</span></label>
                    <input type="date" value={editingPromo.expires_at?editingPromo.expires_at.split("T")[0]:""} onChange={e=>setEditingPromo((f:any)=>({...f,expires_at:e.target.value}))}
                      style={{width:"100%",padding:".5rem .75rem",borderRadius:".45rem",border:"1.5px solid #e2e8f0",fontSize:".84rem",boxSizing:"border-box" as const}}/>
                  </div>
                </div>
                <div>
                  <label style={{fontSize:".75rem",fontWeight:700,color:"#374151",display:"block",marginBottom:".3rem"}}>Client Description</label>
                  <input value={editingPromo.client_description||""} onChange={e=>setEditingPromo((f:any)=>({...f,client_description:e.target.value}))} placeholder="Shown on the promo banner"
                    style={{width:"100%",padding:".5rem .75rem",borderRadius:".45rem",border:"1.5px solid #e2e8f0",fontSize:".84rem",boxSizing:"border-box" as const}}/>
                </div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:".75rem 1rem",borderRadius:".55rem",border:"1.5px solid #e2e8f0",background:"#fafafa"}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:".84rem",color:"#1e293b"}}>Show Promo Banner on Client Dashboard</div>
                    <div style={{fontSize:".72rem",color:"#94a3b8",marginTop:".1rem"}}>Displays a promotional banner below the Media Packages section</div>
                  </div>
                  <button onClick={()=>setEditingPromo((f:any)=>({...f,show_banner:!f.show_banner}))}
                    style={{position:"relative",width:44,height:24,borderRadius:99,border:"none",cursor:"pointer",padding:0,flexShrink:0,background:editingPromo.show_banner?"#10b981":"#e2e8f0",transition:"background .2s"}}>
                    <div style={{position:"absolute",top:3,left:editingPromo.show_banner?22:3,width:18,height:18,borderRadius:"50%",background:"white",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
                  </button>
                </div>
                <div style={{display:"flex",gap:".75rem",paddingTop:".25rem"}}>
                  <button onClick={()=>{setEditingPromo(null);setELocSearch("");}} style={{flex:1,padding:".7rem",borderRadius:".5rem",border:"1px solid #e2e8f0",background:"white",fontWeight:600,cursor:"pointer"}}>Cancel</button>
                  <button onClick={saveEdit} disabled={editSaving}
                    style={{flex:2,padding:".7rem",borderRadius:".5rem",border:"none",background:editSaving?"#e2e8f0":"linear-gradient(135deg,#6366f1,#8929bd)",color:editSaving?"#94a3b8":"white",fontWeight:800,cursor:editSaving?"not-allowed":"pointer",fontSize:".9rem"}}>
                    {editSaving?"Saving…":"Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [session,   setSession]   = useState<Session|null>(null);
  const [isAdmin,   setIsAdmin]   = useState(false);
  const [authCheck, setAuthCheck] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Data state
  const [locations,   setLocations]   = useState<Location[]>([]);
  const [queue,       setQueue]       = useState<Order[]>([]);
  const [revenue,     setRevenue]     = useState<RevenueData|null>(null);
  const [settings,    setSettings]    = useState<AdminSettings>({ review_mode_global:false, review_mode_overrides:{} });
  const [loading,     setLoading]     = useState(false);
  const [allOrders,      setAllOrders]      = useState<Order[]>([]);
  const [promotions,     setPromotions]     = useState<any[]>([]);
  const [locationsList,  setLocationsList]  = useState<any[]>([]);
  const [ordFilter,      setOrdFilter]      = useState({ location:"", package:"", status:"", dateFrom:"", dateTo:"" });
  const [adminPipeline,    setAdminPipeline]    = useState<any[]>([]);
  const [adminPipeTotal,   setAdminPipeTotal]   = useState(0);
  const [adminPipeFilter,  setAdminPipeFilter]  = useState<"all"|"scheduled"|"draft"|"unused">("all");
  const [pdPartners,     setPdPartners]     = useState<any[]>([]);
  const [pdDefaultId,    setPdDefaultId]    = useState<string>("");
  const [pdNotes,        setPdNotes]        = useState<any[]>([]);
  const [pdDocuments,    setPdDocuments]    = useState<any[]>([]);
  const [pdSettingMain,  setPdSettingMain]  = useState(false);
  const [viewingPartner, setViewingPartner] = useState<any|null>(null);
  const [emailTemplates,  setEmailTemplates]  = useState<EmailTemplate[]>([]);
  const [defaultTmpl,     setDefaultTmpl]     = useState("");
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate|null>(null);
  const [editSubject,     setEditSubject]     = useState("");
  const [editHtml,        setEditHtml]        = useState("");
  const [showPreview,     setShowPreview]     = useState(true);
  const [savingTmpl,      setSavingTmpl]      = useState(false);
  const [sendingTest,     setSendingTest]     = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [adminNotifEmail, setAdminNotifEmail] = useState("");
  const [adminUsers,     setAdminUsers]     = useState<any[]>([]);
  const [notifEmails,    setNotifEmails]    = useState<string[]>([]);
  const [newNotifEmail,  setNewNotifEmail]  = useState("");
  const [defaultPartnerId, setDefaultPartnerId] = useState("");
  const [partnersList,    setPartnersList]    = useState<any[]>([]);
  const [toast,       setToast]       = useState<{msg:string;type:"success"|"error"}|null>(null);

  // Report Pending
  const [adminReportPending, setAdminReportPending] = useState<Order[]>([]);
  const [adminReportUploadModal, setAdminReportUploadModal] = useState<Order|null>(null);
  const [adminReportCsvFile,     setAdminReportCsvFile]     = useState<File|null>(null);
  const [adminReportCsvPreview,  setAdminReportCsvPreview]  = useState<{count:number}|null>(null);
  const [adminReportConfirmed,   setAdminReportConfirmed]   = useState(false);
  const [adminReportUploading,   setAdminReportUploading]   = useState(false);

  // Override modal
  const [overrideTarget, setOverrideTarget] = useState<Location|null>(null);
  const [overrideAmt,    setOverrideAmt]    = useState("");
  const [overrideTier,   setOverrideTier]   = useState("starter");
  const [overrideNote,   setOverrideNote]   = useState("");
  const [overriding,     setOverriding]     = useState(false);

  // PR preview modal
  const [previewOrder, setPreviewOrder] = useState<Order|null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const adminEditorRef = useRef<HTMLDivElement>(null);
  const isAdminTypingRef = useRef(false);

  const showToast = (msg: string, type: "success"|"error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Handle deep-link tab from URL params (e.g. email CTA → ?tab=partner_details)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as Tab | null;
    if (tab) { setActiveTab(tab); window.history.replaceState({}, "", "/admin"); }
  }, []);

  // Populate admin PR editor imperatively when a new order is opened (prevents scroll reset)
  useEffect(() => {
    if (previewOrder && adminEditorRef.current) {
      isAdminTypingRef.current = false;
      adminEditorRef.current.innerHTML = previewOrder.pr_content || "<p>No content</p>";
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOrder?.id]);

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkAdmin(session);
      else setAuthCheck(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) checkAdmin(s); else { setIsAdmin(false); setAuthCheck(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const checkAdmin = async (s: Session) => {
    try {
      const d = await adminPost("get_settings", {}, s.access_token);
      if (!d.error) {
        setIsAdmin(true);
        setSettings(d.settings || settings);
      } else {
        setIsAdmin(false);
        setAccessDenied(true);
        await supabase.auth.signOut();
      }
    } catch {
      setIsAdmin(false);
      setAccessDenied(true);
    }
    setAuthCheck(false);
  };

  const load = useCallback(async (tab: Tab) => {
    if (!session) return;
    setLoading(true);
    try {
      if (tab === "overview" || tab === "locations") {
        const d = await adminPost("get_locations", {}, session.access_token);
        if (!d.error) {
          const lids = [...new Set([...d.profiles.map((p:any)=>p.location_id)])];
          const merged: Location[] = (d.profiles as any[]).map((p: any) => {
            const co = (d.companies as any[]).find((c:any)=>c.location_id===p.location_id);
            const ords = (d.orders as any[]).filter((o:any)=>o.location_id===p.location_id);
            return { location_id: p.location_id, company_name: co?.company_name, email: co?.email,
              starter_credits: p.starter_credits||0, standard_credits: p.standard_credits||0, premium_credits: p.premium_credits||0, orders: ords };
          });
          setLocations(merged);
        }
      }
      if (tab === "queue") {
        const d = await adminPost("get_approval_queue", {}, session.access_token);
        if (!d.error) {
          const enriched = (d.orders as any[]).map((o:any) => ({
            ...o, company_name: (d.companies as any[]).find((c:any)=>c.location_id===o.location_id)?.company_name
          }));
          setQueue(enriched);
        }
      }
      if (tab === "revenue") {
        const res = await fetch(ADMIN_REVENUE, { headers: { Authorization: `Bearer ${session.access_token}` } });
        const d = await res.json();
        if (!d.error) setRevenue(d);
      }
      if (tab === "partner_details") {
        const d = await adminPost("get_partner_details", {}, session.access_token);
        if (!d.error) {
          setPdPartners(d.partners || []);
          setPdDefaultId(d.default_partner_id || "");
          setPdNotes(d.notes || []);
          setPdDocuments(d.documents || []);
        }
      }
    if (tab === "pipeline") {
      const d = await adminPost("get_pipeline", {}, session.access_token);
      if (!d.error) { setAdminPipeline(d.items || []); setAdminPipeTotal(d.total_pipeline || 0); }
    }
    if (tab === "pr_orders") {
        const d = await adminPost("get_all_orders", {}, session.access_token);
        if (!d.error) setAllOrders(d.orders || []);
      }
      if (tab === "report_pending") {
        const d = await adminPost("get_report_pending", {}, session.access_token);
        if (!d.error) setAdminReportPending(d.orders || []);
      }
      if (tab === "promotions") {
        const d = await adminPost("get_promotions", {}, session.access_token);
        if (!d.error) setPromotions(d.promotions || []);
        // Also load location list for audience picker
        const ld = await adminPost("get_locations", {}, session.access_token);
        if (!ld.error) {
          const merged = (ld.profiles as any[]).map((p: any) => {
            const co = (ld.companies as any[]).find((c:any)=>c.location_id===p.location_id);
            return { location_id: p.location_id, company_name: co?.company_name||p.location_id };
          });
          setLocationsList(merged);
        }
      }
      if (tab === "email_alerts") {
        const d = await adminPost("get_email_templates", {}, session.access_token);
        if (!d.error) {
          setEmailTemplates(d.templates || []);
          setDefaultTmpl(d.default_template || "");
        }
      }
      if (tab === "settings") {
        const d = await adminPost("get_settings", {}, session.access_token);
        if (!d.error) {
          setSettings(d.settings);
          setAdminUsers(d.admin_users || []);
          // Parse additional emails (excluding primary admin's email)
          const primary = (d.admin_users || []).sort((a:any,b:any)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime())[0]?.email || "";
          const stored = (d.settings?.admin_notification_email || "").split(",").map((e:string)=>e.trim()).filter(Boolean);
          const extras = stored.filter((e:string) => e.toLowerCase() !== primary.toLowerCase());
          setNotifEmails(extras);
          setAdminNotifEmail(d.settings?.admin_notification_email || primary);
        }
      }
    } catch {}
    setLoading(false);
  }, [session]);

  useEffect(() => { if (isAdmin) load(activeTab); }, [isAdmin, activeTab]);

  const impersonate = async (location_id: string) => {
    if (!session) return;
    const d = await adminPost("create_impersonation_token", { location_id }, session.access_token);
    if (d.token) {
      window.open(`https://mediablast.xlogic.app/?location_id=${location_id}&impersonate=${d.token}`, "_blank");
    } else showToast("Failed to create impersonation token", "error");
  };

  const approveOrder = async (order_id: string) => {
    if (!session) return;
    const d = await adminPost("approve_order", { order_id }, session.access_token);
    if (!d.error) { showToast("PR approved ✓"); load("queue"); }
    else showToast(d.error, "error");
  };

  const rejectOrder = async (order_id: string) => {
    const reason = window.prompt("Rejection reason (shown to client):");
    if (!reason || !session) return;
    const d = await adminPost("reject_order", { order_id, reason }, session.access_token);
    if (!d.error) { showToast("PR rejected"); load("queue"); }
    else showToast(d.error, "error");
  };

  const submitOverride = async () => {
    if (!overrideTarget || !session || !overrideNote.trim() || !overrideAmt) return;
    setOverriding(true);
    const amount = parseInt(overrideAmt);
    if (isNaN(amount) || amount === 0) { showToast("Enter a non-zero amount", "error"); setOverriding(false); return; }
    try {
      const res = await fetch(ADMIN_CREDITS, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ location_id: overrideTarget.location_id, amount, tier: overrideTier, reason: overrideNote }),
      });
      const d = await res.json();
      if (d.ok) {
        showToast(`${amount > 0 ? "Added" : "Removed"} ${Math.abs(amount)} ${overrideTier} credit${Math.abs(amount)!==1?"s":""}`);
        setOverrideTarget(null); setOverrideAmt(""); setOverrideNote("");
        load("locations");
      } else showToast(d.error || "Override failed", "error");
    } catch { showToast("Override failed", "error"); }
    setOverriding(false);
  };

  const saveSettings = async () => {
    if (!session) return;
    const primaryEmail = adminUsers.sort((a:any,b:any)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime())[0]?.email || "";
    const allEmails = [primaryEmail, ...notifEmails.filter(e=>e.toLowerCase()!==primaryEmail.toLowerCase())].filter(Boolean).join(",");
    setAdminNotifEmail(allEmails);
    const d = await adminPost("save_settings", { review_mode_global: settings.review_mode_global, review_mode_overrides: settings.review_mode_overrides, admin_notification_email: allEmails, default_partner_id: defaultPartnerId||null }, session.access_token);
    if (!d.error) showToast("Settings saved");
    else showToast(d.error, "error");
  };

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName,  setInviteName]  = useState("");
  const [invitePass,  setInvitePass]  = useState("");
  const [inviting,    setInviting]    = useState(false);

  const inviteAdmin = async () => {
    if (!inviteEmail || !invitePass || !session) return;
    setInviting(true);
    try {
      const d = await adminPost("create_admin_user", { email: inviteEmail, password: invitePass, name: inviteName || inviteEmail }, session.access_token);
      if (d.ok) {
        showToast(`✅ Admin user created — ${d.email} can now sign in`);
        setInviteEmail(""); setInvitePass(""); setInviteName("");
      } else {
        showToast(d.error || "Failed to create admin user", "error");
      }
    } catch (e: any) { showToast(e.message, "error"); }
    setInviting(false);
  };

  const admin = session ? { email: session.user?.email || "" } : null;
  const totalOrders = (loc: Location) => loc.orders?.length || 0;
  const ordersByTier = (loc: Location, tier: string) => loc.orders?.filter(o => o.product_name?.toLowerCase() === tier).length || 0;

  // ── States ──────────────────────────────────────────────────────────────────
  if (authCheck) return (
    <div style={{ minHeight:"100vh", background:"#0f0a1e", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:32, height:32, border:"3px solid rgba(255,255,255,.1)", borderTopColor:"#8929bd", borderRadius:"50%", animation:"spin .8s linear infinite" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!session || !isAdmin) return <AdminLogin onLogin={() => {}} accessDenied={accessDenied} />;

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id:"overview",       label:"Overview",        icon:"📊" },
    { id:"locations",      label:"Locations",       icon:"🏢" },
    { id:"revenue",        label:"Revenue",         icon:"💰" },
    { id:"pipeline",       label:"Pipeline",        icon:"📈" },
    { id:"queue",          label:"Approval Queue",  icon:"📋" },
    { id:"report_pending", label:"Report Pending",  icon:"📤" },
    { id:"pr_orders",      label:"PR Orders",       icon:"📰" },
    { id:"promotions",     label:"Promotions",      icon:"🎟️" },
    { id:"email_alerts",   label:"Email Alerts",    icon:"📧" },
    { id:"partner_details",label:"Partner Details", icon:"🤝" },
    { id:"settings",       label:"Settings",        icon:"⚙️" },
  ];

  const navigateTab = (tab: Tab) => {
    setActiveTab(tab);
    window.history.replaceState({}, "", `/admin?tab=${tab}`);
  };

  const queueBadge = queue.length;
  const adminReportPendingBadge = adminReportPending.length;

  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"system-ui,-apple-system,sans-serif" }}>
      {/* Top bar — full width to match sidebar layout */}
      <div style={{ background:"linear-gradient(135deg,#1e1b4b,#312e81)", flexShrink:0 }}>
        <div style={{ padding:".75rem 1.5rem", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:".75rem" }}>
            <img src="https://mediablast.xlogic.app/logo.png" alt="MBB" style={{ width:36, height:36, objectFit:"contain" }}/>
            <div>
              <div style={{ color:"white", fontWeight:900, fontSize:".95rem", letterSpacing:"-.01em" }}>Media Blast Boosters™</div>
              <div style={{ color:"rgba(255,255,255,.5)", fontSize:".68rem", letterSpacing:".08em", textTransform:"uppercase" }}>Admin Command Center</div>
            </div>
          </div>
          <button onClick={() => supabase.auth.signOut()}
            style={{ background:"rgba(255,255,255,.1)", border:"none", color:"rgba(255,255,255,.7)", borderRadius:".4rem", padding:".35rem .85rem", fontSize:".78rem", cursor:"pointer" }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div style={{ display:"flex", minHeight:"calc(100vh - 56px)" }}>

        {/* Vertical sidebar */}
        <div style={{ width:220, background:"white", borderRight:"1px solid #e2e8f0", flexShrink:0, position:"sticky", top:0, height:"calc(100vh - 56px)", overflowY:"auto", display:"flex", flexDirection:"column" }}>
          <nav style={{ padding:".5rem 0", flex:1 }}>
            {TABS.map(t => {
              const active = activeTab === t.id;
              return (
                <button key={t.id} onClick={() => navigateTab(t.id)}
                  style={{ width:"100%", padding:".65rem 1.25rem", border:"none", borderLeft: active ? "3px solid #6366f1" : "3px solid transparent", background: active ? "#eef2ff" : "transparent", color: active ? "#6366f1" : "#4b5563", fontWeight: active ? 700 : 500, fontSize:".83rem", cursor:"pointer", display:"flex", alignItems:"center", gap:".6rem", textAlign:"left", transition:"all .12s" }}
                  onMouseOver={e=>{ if(!active)(e.currentTarget.style.background="#f8fafc"); }}
                  onMouseOut={e=>{ if(!active)(e.currentTarget.style.background="transparent"); }}>
                  <span style={{ fontSize:".95rem", flexShrink:0 }}>{t.icon}</span>
                  <span style={{ flex:1 }}>{t.label}</span>
                  {t.id==="queue" && queueBadge > 0 && (
                    <span style={{ background:"#ef4444", color:"white", fontSize:".58rem", fontWeight:900, padding:".1rem .4rem", borderRadius:"99px", flexShrink:0 }}>{queueBadge}</span>
                  )}
                  {t.id==="report_pending" && adminReportPendingBadge > 0 && (
                    <span style={{ background:"#8929bd", color:"white", fontSize:".58rem", fontWeight:900, padding:".1rem .4rem", borderRadius:"99px", flexShrink:0 }}>{adminReportPendingBadge}</span>
                  )}
                </button>
              );
            })}
          </nav>
          <div style={{ padding:".75rem 1rem", borderTop:"1px solid #f1f5f9", fontSize:".7rem", color:"#94a3b8" }}>
            {session?.user?.email}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1, padding:"1.5rem", minWidth:0, overflowX:"hidden" }}>
          {loading && <div style={{ textAlign:"center", padding:"3rem", color:"#94a3b8" }}>Loading…</div>}

        {/* OVERVIEW */}
        {!loading && activeTab==="overview" && (
          <div>
            <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:"0 0 1.25rem" }}>Overview</h2>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"1rem", marginBottom:"1.5rem" }}>
              {[
                { label:"Total Locations", value: locations.length, icon:"🏢", color:"#6366f1" },
                { label:"Total PRs Ordered", value: locations.reduce((s,l)=>s+totalOrders(l),0), icon:"📰", color:"#8929bd" },
                { label:"Pending Queue", value: queueBadge, icon:"📋", color:"#ef4444" },
                { label:"Review Mode", value: settings.review_mode_global ? "ON" : "OFF", icon:"🔒", color: settings.review_mode_global?"#10b981":"#ef4444" },
              ].map(card => (
                <div key={card.label} style={{ background:"white", borderRadius:".75rem", padding:"1.25rem", border:"1px solid #f1f5f9", boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:".5rem", marginBottom:".5rem" }}>
                    <span style={{ fontSize:"1.2rem" }}>{card.icon}</span>
                    <span style={{ fontSize:".75rem", fontWeight:600, color:"#94a3b8", textTransform:"uppercase", letterSpacing:".05em" }}>{card.label}</span>
                  </div>
                  <div style={{ fontSize:"1.75rem", fontWeight:900, color: card.color }}>{card.value}</div>
                </div>
              ))}
            </div>
            {/* Quick locations preview */}
            <div style={{ background:"white", borderRadius:".75rem", border:"1px solid #f1f5f9", overflow:"hidden" }}>
              <div style={{ padding:"1rem 1.25rem", borderBottom:"1px solid #f1f5f9", fontWeight:700, fontSize:".88rem", color:"#1e293b" }}>Recent Locations</div>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:".82rem" }}>
                <thead><tr style={{ background:"#f8fafc" }}>
                  {["Company","Location ID","Credits (S/M/P)","Total PRs","Actions"].map(h=>(
                    <th key={h} style={{ padding:".65rem 1rem", textAlign:"left", fontWeight:700, color:"#64748b", fontSize:".72rem", textTransform:"uppercase", letterSpacing:".04em" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {locations.slice(0,5).map((loc,i) => (
                    <tr key={loc.location_id} style={{ borderTop:"1px solid #f8fafc" }}>
                      <td style={{ padding:".7rem 1rem", fontWeight:600, color:"#1e293b" }}>{loc.company_name||"—"}</td>
                      <td style={{ padding:".7rem 1rem", fontFamily:"monospace", fontSize:".78rem", color:"#6366f1" }}>{loc.location_id.slice(0,12)}…</td>
                      <td style={{ padding:".7rem 1rem" }}>
                        <span style={{ color:TIER_COLORS.starter, fontWeight:700 }}>{loc.starter_credits}</span>
                        {" / "}
                        <span style={{ color:TIER_COLORS.standard, fontWeight:700 }}>{loc.standard_credits}</span>
                        {" / "}
                        <span style={{ color:TIER_COLORS.premium, fontWeight:700 }}>{loc.premium_credits}</span>
                      </td>
                      <td style={{ padding:".7rem 1rem", fontWeight:700 }}>{totalOrders(loc)}</td>
                      <td style={{ padding:".7rem 1rem" }}>
                        <button onClick={()=>impersonate(loc.location_id)}
                          style={{ fontSize:".73rem", padding:".3rem .65rem", borderRadius:".35rem", border:"1px solid #e2e8f0", background:"white", cursor:"pointer", color:"#374151" }}>
                          👁 View as Client
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REVENUE */}
        {!loading && activeTab==="revenue" && (
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.25rem" }}>
              <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:0 }}>Revenue Intelligence</h2>
              {revenue?.test_mode && <span style={{ background:"#fef3c7", color:"#92400e", fontSize:".72rem", fontWeight:800, padding:".2rem .6rem", borderRadius:"99px" }}>⚠️ TEST MODE</span>}
            </div>
            {revenue ? (
              <>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:"1rem", marginBottom:"1.5rem" }}>
                  {[
                    { label:"Gross Revenue", value:`$${revenue.gross.toLocaleString("en-US",{minimumFractionDigits:2})}`, icon:"💰", color:"#10b981" },
                    { label:"Partner Payouts", value:`$${revenue.payout.toLocaleString("en-US",{minimumFractionDigits:2})}`, icon:"🤝", color:"#ef4444" },
                    { label:"Net Margin", value:`$${revenue.margin.toLocaleString("en-US",{minimumFractionDigits:2})}`, icon:"📈", color:"#6366f1" },
                    { label:"Total Transactions", value:revenue.count, icon:"🧾", color:"#8929bd" },
                  ].map(card=>(
                    <div key={card.label} style={{ background:"white", borderRadius:".75rem", padding:"1.25rem", border:"1px solid #f1f5f9" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:".4rem", marginBottom:".5rem" }}>
                        <span>{card.icon}</span>
                        <span style={{ fontSize:".72rem", fontWeight:600, color:"#94a3b8", textTransform:"uppercase" }}>{card.label}</span>
                      </div>
                      <div style={{ fontSize:"1.6rem", fontWeight:900, color:card.color }}>{card.value}</div>
                    </div>
                  ))}
                </div>
                {/* Monthly table */}
                <div style={{ background:"white", borderRadius:".75rem", border:"1px solid #f1f5f9", overflow:"hidden" }}>
                  <div style={{ padding:"1rem 1.25rem", borderBottom:"1px solid #f1f5f9", fontWeight:700, fontSize:".88rem" }}>Monthly Breakdown</div>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:".83rem" }}>
                    <thead><tr style={{ background:"#f8fafc" }}>
                      {["Month","Revenue","Payouts","Margin","Transactions"].map(h=>(
                        <th key={h} style={{ padding:".65rem 1rem", textAlign:"left", fontWeight:700, color:"#64748b", fontSize:".72rem", textTransform:"uppercase" }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {Object.entries(revenue.by_month).sort(([a],[b])=>b.localeCompare(a)).map(([month,data])=>(
                        <tr key={month} style={{ borderTop:"1px solid #f8fafc" }}>
                          <td style={{ padding:".7rem 1rem", fontWeight:600 }}>{month}</td>
                          <td style={{ padding:".7rem 1rem", color:"#10b981", fontWeight:700 }}>${data.gross.toLocaleString("en-US",{minimumFractionDigits:2})}</td>
                          <td style={{ padding:".7rem 1rem", color:"#ef4444" }}>${data.payout.toLocaleString("en-US",{minimumFractionDigits:2})}</td>
                          <td style={{ padding:".7rem 1rem", color:"#6366f1", fontWeight:700 }}>${(data.gross-data.payout).toLocaleString("en-US",{minimumFractionDigits:2})}</td>
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

        {/* LOCATIONS */}
        {!loading && activeTab==="locations" && (
          <div>
            <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:"0 0 1.25rem" }}>Location Master Table</h2>
            <div style={{ background:"white", borderRadius:".75rem", border:"1px solid #f1f5f9", overflow:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:".82rem" }}>
                <thead><tr style={{ background:"#1e1b4b" }}>
                  {["Company","Location ID","Email","Starter PRs","Standard PRs","Premium PRs","Credits (S/M/P)","Review Mode","Actions"].map(h=>(
                    <th key={h} style={{ padding:".7rem 1rem", textAlign:"left", fontWeight:700, color:"rgba(255,255,255,.8)", fontSize:".68rem", textTransform:"uppercase", letterSpacing:".05em", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {locations.map(loc => {
                    const override = settings.review_mode_overrides[loc.location_id];
                    const reviewOn = override !== undefined ? override : settings.review_mode_global;
                    return (
                      <tr key={loc.location_id} style={{ borderTop:"1px solid #f8fafc" }}
                        onMouseOver={e=>(e.currentTarget.style.background="#fafafa")}
                        onMouseOut={e=>(e.currentTarget.style.background="white")}>
                        <td style={{ padding:".8rem 1rem", fontWeight:700, color:"#1e293b" }}>{loc.company_name||"—"}</td>
                        <td style={{ padding:".8rem 1rem", fontFamily:"monospace", fontSize:".75rem", color:"#6366f1" }}>{loc.location_id}</td>
                        <td style={{ padding:".8rem 1rem", color:"#64748b", fontSize:".78rem" }}>{loc.email||"—"}</td>
                        <td style={{ padding:".8rem 1rem", textAlign:"center", fontWeight:700, color:TIER_COLORS.starter }}>{ordersByTier(loc,"starter")}</td>
                        <td style={{ padding:".8rem 1rem", textAlign:"center", fontWeight:700, color:TIER_COLORS.standard }}>{ordersByTier(loc,"standard")}</td>
                        <td style={{ padding:".8rem 1rem", textAlign:"center", fontWeight:700, color:TIER_COLORS.premium }}>{ordersByTier(loc,"premium")}</td>
                        <td style={{ padding:".8rem 1rem", fontWeight:700 }}>
                          <span style={{ color:TIER_COLORS.starter }}>{loc.starter_credits}</span>
                          {" / "}
                          <span style={{ color:TIER_COLORS.standard }}>{loc.standard_credits}</span>
                          {" / "}
                          <span style={{ color:TIER_COLORS.premium }}>{loc.premium_credits}</span>
                        </td>
                        <td style={{ padding:".8rem 1rem" }}>
                          <button onClick={()=>{
                            const newVal = !(override !== undefined ? override : settings.review_mode_global);
                            setSettings(s=>({...s,review_mode_overrides:{...s.review_mode_overrides,[loc.location_id]:newVal}}));
                          }} style={{ fontSize:".7rem", padding:".25rem .6rem", borderRadius:"99px", border:"none", background: reviewOn?"#dcfce7":"#fee2e2", color: reviewOn?"#166534":"#991b1b", fontWeight:700, cursor:"pointer" }}>
                            {reviewOn?"🔒 Review ON":"✅ Direct"}
                          </button>
                        </td>
                        <td style={{ padding:".8rem 1rem" }}>
                          <div style={{ display:"flex", gap:".4rem" }}>
                            <button onClick={()=>{ setOverrideTarget(loc); setOverrideTier("starter"); setOverrideAmt(""); setOverrideNote(""); }}
                              style={{ fontSize:".72rem", padding:".3rem .65rem", borderRadius:".35rem", border:"1px solid #e2e8f0", background:"white", cursor:"pointer" }}>
                              💳 Credits
                            </button>
                            <button onClick={()=>impersonate(loc.location_id)}
                              style={{ fontSize:".72rem", padding:".3rem .65rem", borderRadius:".35rem", border:"1px solid #e2e8f0", background:"white", cursor:"pointer" }}>
                              👁 View
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {locations.length===0 && <div style={{ padding:"3rem", textAlign:"center", color:"#94a3b8" }}>No locations yet</div>}
            </div>
          </div>
        )}

        {/* PIPELINE */}
        {!loading && activeTab==="pipeline" && (() => {
          const PIPE_PAYOUT: Record<string,number> = { starter:120, standard:220, premium:400 };
          const STATUS_STYLES: Record<string,{bg:string;color:string;label:string}> = {
            scheduled: { bg:"#fef3c7", color:"#92400e", label:"Scheduled"     },
            draft:     { bg:"#dbeafe", color:"#1d4ed8", label:"In Draft"      },
            unused:    { bg:"#f1f5f9", color:"#475569", label:"Unused Credit" },
          };
          const TIER_COL: Record<string,string> = { starter:"#6366f1", standard:"#8929bd", premium:"#d97706" };
          const filtered = adminPipeline.filter(i => adminPipeFilter==="all" || i.status===adminPipeFilter);
          const filteredTotal = filtered.reduce((s:number,i:any)=>s+i.payout, 0);
          return (
            <div>
              {/* Header */}
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:"1rem", marginBottom:"1.5rem" }}>
                <div>
                  <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:"0 0 .25rem" }}>📈 Pipeline</h2>
                  <p style={{ color:"#64748b", fontSize:".82rem", margin:0 }}>Fulfillment forecast across all locations — credits, active drafts, and scheduled PRs.</p>
                </div>
                <div style={{ background:"linear-gradient(135deg,#1e1b4b,#312e81)", borderRadius:".875rem", padding:"1rem 1.5rem", textAlign:"right", minWidth:200 }}>
                  <div style={{ fontSize:".7rem", fontWeight:700, color:"rgba(255,255,255,.5)", textTransform:"uppercase", letterSpacing:".08em", marginBottom:".25rem" }}>Total Pipeline Value</div>
                  <div style={{ fontSize:"1.75rem", fontWeight:900, color:"white" }}>${adminPipeTotal.toLocaleString("en-US",{minimumFractionDigits:0})}</div>
                  <div style={{ fontSize:".72rem", color:"rgba(255,255,255,.4)", marginTop:".15rem" }}>{adminPipeline.length} items</div>
                </div>
              </div>
              {/* Filters */}
              <div style={{ display:"flex", gap:".5rem", marginBottom:"1.25rem", flexWrap:"wrap" }}>
                {([
                  { key:"all",       label:"All",          count: adminPipeline.length },
                  { key:"scheduled", label:"🗓 Scheduled", count: adminPipeline.filter((i:any)=>i.status==="scheduled").length },
                  { key:"draft",     label:"✏️ In Draft",  count: adminPipeline.filter((i:any)=>i.status==="draft").length },
                  { key:"unused",    label:"💤 Unused",    count: adminPipeline.filter((i:any)=>i.status==="unused").length },
                ] as {key:typeof adminPipeFilter;label:string;count:number}[]).map(f=>(
                  <button key={f.key} onClick={()=>setAdminPipeFilter(f.key)}
                    style={{ padding:".4rem .9rem", borderRadius:"99px", border:`1.5px solid ${adminPipeFilter===f.key?"#6366f1":"#e2e8f0"}`, background:adminPipeFilter===f.key?"#eef2ff":"white", color:adminPipeFilter===f.key?"#6366f1":"#374151", fontWeight:adminPipeFilter===f.key?700:500, fontSize:".8rem", cursor:"pointer", display:"flex", alignItems:"center", gap:".35rem" }}>
                    {f.label}
                    <span style={{ background:adminPipeFilter===f.key?"#6366f1":"#e2e8f0", color:adminPipeFilter===f.key?"white":"#64748b", fontSize:".65rem", fontWeight:800, padding:".1rem .4rem", borderRadius:"99px" }}>{f.count}</span>
                  </button>
                ))}
              </div>
              {/* Table */}
              {adminPipeline.length === 0 ? (
                <div style={{ background:"white", borderRadius:".75rem", border:"1px solid #f1f5f9", padding:"3rem", textAlign:"center" }}>
                  <div style={{ fontSize:"2.5rem", marginBottom:".75rem" }}>📭</div>
                  <div style={{ fontWeight:700, color:"#1e293b" }}>No pipeline data yet</div>
                  <div style={{ color:"#94a3b8", fontSize:".82rem", marginTop:".3rem" }}>Items appear as clients purchase credits and create drafts</div>
                </div>
              ) : (
                <div>
                  {adminPipeFilter!=="all" && (
                    <div style={{ marginBottom:".75rem", fontSize:".82rem", color:"#64748b" }}>
                      <span style={{ fontWeight:700, color:"#1e293b" }}>{filtered.length} items</span> · Est. value: <span style={{ fontWeight:700, color:"#6366f1" }}>${filteredTotal.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ background:"white", borderRadius:".875rem", border:"1px solid #f1f5f9", overflow:"auto", boxShadow:"0 1px 4px rgba(0,0,0,.04)" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:".83rem" }}>
                      <thead><tr style={{ background:"#1e1b4b" }}>
                        {["Location","Tier","Status","Est. Payout","Actionable Date"].map(h=>(
                          <th key={h} style={{ padding:".75rem 1rem", textAlign:"left", fontWeight:700, color:"rgba(255,255,255,.75)", fontSize:".68rem", textTransform:"uppercase", letterSpacing:".06em", whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {filtered.map((item:any)=>{
                          const ss=STATUS_STYLES[item.status];
                          const tc=TIER_COL[item.tier]||"#6366f1";
                          return (
                            <tr key={item.key} style={{ borderTop:"1px solid #f8fafc" }}
                              onMouseOver={e=>(e.currentTarget.style.background="#fafafa")}
                              onMouseOut={e=>(e.currentTarget.style.background="white")}>
                              <td style={{ padding:".8rem 1rem" }}>
                                <div style={{ fontWeight:600, color:"#1e293b", fontSize:".85rem" }}>{item.company_name}</div>
                                <div style={{ fontSize:".7rem", color:"#94a3b8", fontFamily:"monospace", marginTop:".1rem" }}>{item.location_id}</div>
                              </td>
                              <td style={{ padding:".8rem 1rem" }}>
                                <span style={{ fontWeight:700, fontSize:".75rem", color:tc, background:tc+"18", padding:".2rem .6rem", borderRadius:"99px", textTransform:"capitalize" as const }}>{item.tier}</span>
                              </td>
                              <td style={{ padding:".8rem 1rem" }}>
                                <span style={{ fontWeight:700, fontSize:".75rem", color:ss.color, background:ss.bg, padding:".25rem .65rem", borderRadius:"99px", whiteSpace:"nowrap" as const }}>
                                  {ss.label}{item.status==="unused"&&item.credits>1&&<span style={{ marginLeft:".35rem", opacity:.75 }}>×{item.credits}</span>}
                                </span>
                              </td>
                              <td style={{ padding:".8rem 1rem" }}>
                                <span style={{ fontWeight:800, fontSize:".88rem", color:"#6366f1" }}>${item.payout.toLocaleString()}</span>
                                {item.status==="unused"&&item.credits>1&&(
                                  <div style={{ fontSize:".68rem", color:"#94a3b8", marginTop:".1rem" }}>${PIPE_PAYOUT[item.tier]||120} × {item.credits}</div>
                                )}
                              </td>
                              <td style={{ padding:".8rem 1rem", color:"#64748b", fontSize:".78rem", whiteSpace:"nowrap" as const }}>
                                {item.actionable_date
                                  ? new Date(item.actionable_date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})
                                  : <span style={{ color:"#cbd5e1" }}>—</span>}
                                {item.status==="scheduled"&&item.actionable_date&&new Date(item.actionable_date)>new Date()&&(
                                  <div style={{ fontSize:".68rem", color:"#92400e", marginTop:".1rem" }}>{Math.ceil((new Date(item.actionable_date).getTime()-Date.now())/(1000*60*60*24))}d away</div>
                                )}
                                {item.status==="draft"&&item.actionable_date&&(
                                  <div style={{ fontSize:".68rem", color:"#64748b", marginTop:".1rem" }}>last edited</div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filtered.length===0&&<div style={{ padding:"2.5rem", textAlign:"center", color:"#94a3b8" }}>No items match this filter</div>}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* APPROVAL QUEUE */}
        {!loading && activeTab==="queue" && (
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.25rem" }}>
              <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:0 }}>
                Approval Queue
                {queue.length>0 && <span style={{ marginLeft:".5rem", background:"#ef4444", color:"white", fontSize:".65rem", fontWeight:900, padding:".15rem .5rem", borderRadius:"99px" }}>{queue.length}</span>}
              </h2>
            </div>
            {queue.length===0 ? (
              <div style={{ background:"white", borderRadius:".75rem", padding:"3rem", textAlign:"center", border:"1px solid #f1f5f9" }}>
                <div style={{ fontSize:"2.5rem", marginBottom:".75rem" }}>✅</div>
                <div style={{ fontWeight:700, color:"#1e293b" }}>Queue is clear</div>
                <div style={{ color:"#94a3b8", fontSize:".82rem", marginTop:".3rem" }}>All submitted PRs have been reviewed</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
                {queue.map(order=>(
                  <div key={order.id} style={{ background:"white", borderRadius:".75rem", border:"1px solid #e2e8f0", padding:"1.25rem" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"1rem", flexWrap:"wrap" }}>
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:".5rem", marginBottom:".3rem" }}>
                          <span style={{ fontSize:".7rem", fontWeight:800, color:"white", background:TIER_COLORS[order.product_name?.toLowerCase()]||"#6366f1", padding:".2rem .6rem", borderRadius:"99px", textTransform:"uppercase" }}>
                            {order.product_name}
                          </span>
                          <span style={{ fontSize:".72rem", color:"#94a3b8" }}>{new Date(order.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
                        </div>
                        <div style={{ fontWeight:700, fontSize:".95rem", color:"#1e293b", marginBottom:".2rem" }}>{order.pr_title||"Untitled PR"}</div>
                        <div style={{ fontSize:".78rem", color:"#6366f1", fontFamily:"monospace" }}>{order.company_name||order.location_id}</div>
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
        {!loading && activeTab==="pr_orders" && (() => {
          const STATUSES = ["","draft","scheduled","submitted","published","rejected","draft_pending_review"];
          const PACKAGES = ["","Starter","Standard","Premium"];
          // Get unique locations for filter autocomplete
          const locationOptions = [...new Map(allOrders.filter(o=>o.company_name||o.location_id).map(o=>[o.location_id,o])).values()];

          const filtered = allOrders.filter(o => {
            if (ordFilter.location && o.location_id !== ordFilter.location) return false;
            if (ordFilter.package && o.product_name?.toLowerCase() !== ordFilter.package.toLowerCase()) return false;
            if (ordFilter.status && o.status !== ordFilter.status) return false;
            if (ordFilter.dateFrom && new Date(o.created_at) < new Date(ordFilter.dateFrom)) return false;
            if (ordFilter.dateTo && new Date(o.created_at) > new Date(ordFilter.dateTo+"T23:59:59")) return false;
            return true;
          });

          const STATUS_COLORS: Record<string,{bg:string;color:string}> = {
            submitted:{bg:"#dbeafe",color:"#1d4ed8"}, published:{bg:"#dcfce7",color:"#166534"},
            rejected:{bg:"#fee2e2",color:"#991b1b"}, draft:{bg:"#f1f5f9",color:"#475569"},
            scheduled:{bg:"#fef3c7",color:"#92400e"}, draft_pending_review:{bg:"#faf5ff",color:"#7e22ce"},
          };
          const TIER_COLORS: Record<string,string> = { starter:"#6366f1", standard:"#8929bd", premium:"#d97706" };

          return (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.25rem" }}>
                <div>
                  <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:"0 0 .2rem" }}>PR Orders</h2>
                  <p style={{ color:"#64748b", fontSize:".82rem", margin:0 }}>{filtered.length} of {allOrders.length} orders</p>
                </div>
              </div>

              {/* Filters */}
              <div style={{ background:"white", borderRadius:".75rem", border:"1px solid #f1f5f9", padding:"1rem 1.25rem", marginBottom:"1rem", display:"flex", gap:".65rem", flexWrap:"wrap", alignItems:"flex-end" }}>
                {/* Location autocomplete */}
                <div style={{ flex:"1 1 200px" }}>
                  <div style={{ fontSize:".7rem", fontWeight:700, color:"#64748b", marginBottom:".3rem", textTransform:"uppercase", letterSpacing:".05em" }}>Location</div>
                  <select value={ordFilter.location} onChange={e=>setOrdFilter(f=>({...f,location:e.target.value}))}
                    style={{ width:"100%", padding:".45rem .65rem", borderRadius:".4rem", border:"1px solid #e2e8f0", fontSize:".82rem", background:"white" }}>
                    <option value="">All Locations</option>
                    {locationOptions.map(o=>(
                      <option key={o.location_id} value={o.location_id}>{o.company_name||o.location_id}</option>
                    ))}
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
                    style={{ width:"100%", padding:".45rem .65rem", borderRadius:".4rem", border:"1px solid #e2e8f0", fontSize:".82rem", boxSizing:"border-box" }}/>
                </div>
                <div style={{ flex:"0 0 140px" }}>
                  <div style={{ fontSize:".7rem", fontWeight:700, color:"#64748b", marginBottom:".3rem", textTransform:"uppercase", letterSpacing:".05em" }}>To</div>
                  <input type="date" value={ordFilter.dateTo} onChange={e=>setOrdFilter(f=>({...f,dateTo:e.target.value}))}
                    style={{ width:"100%", padding:".45rem .65rem", borderRadius:".4rem", border:"1px solid #e2e8f0", fontSize:".82rem", boxSizing:"border-box" }}/>
                </div>
                <button onClick={()=>setOrdFilter({location:"",package:"",status:"",dateFrom:"",dateTo:""})}
                  style={{ padding:".45rem .85rem", borderRadius:".4rem", border:"1px solid #e2e8f0", background:"white", fontSize:".78rem", fontWeight:600, cursor:"pointer", color:"#64748b", alignSelf:"flex-end" }}>
                  ↩ Clear
                </button>
              </div>

              {/* Table */}
              <div style={{ background:"white", borderRadius:".75rem", border:"1px solid #f1f5f9", overflow:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:".82rem" }}>
                  <thead><tr style={{ background:"#1e1b4b" }}>
                    {["Company","PR Title","Package","Status","Date","Report"].map(h=>(
                      <th key={h} style={{ padding:".7rem 1rem", textAlign:"left", fontWeight:700, color:"rgba(255,255,255,.8)", fontSize:".68rem", textTransform:"uppercase", letterSpacing:".05em", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filtered.map(order=>{
                      const sc = STATUS_COLORS[order.status] || {bg:"#f1f5f9",color:"#475569"};
                      return (
                        <tr key={order.id} style={{ borderTop:"1px solid #f8fafc", cursor:"pointer" }}
                          onMouseOver={e=>(e.currentTarget.style.background="#fafafa")}
                          onMouseOut={e=>(e.currentTarget.style.background="white")}
                          onClick={()=>{ setPreviewOrder(order); setOriginalContent(order.pr_content||""); setEditedContent(order.pr_content||""); }}>
                          <td style={{ padding:".7rem 1rem" }}>
                            <div style={{ fontWeight:600, color:"#1e293b" }}>{order.company_name||"—"}</div>
                            <div style={{ fontSize:".7rem", color:"#94a3b8", fontFamily:"monospace" }}>{order.location_id?.slice(0,12)}…</div>
                          </td>
                          <td style={{ padding:".7rem 1rem", maxWidth:260 }}>
                            <div style={{ fontWeight:500, color:"#374151", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{order.pr_title||"—"}</div>
                          </td>
                          <td style={{ padding:".7rem 1rem" }}>
                            <span style={{ fontSize:".72rem", fontWeight:700, color: TIER_COLORS[order.product_name?.toLowerCase()]||"#6366f1", background:"#f1f5f9", padding:".2rem .6rem", borderRadius:"99px" }}>
                              {order.product_name||"—"}
                            </span>
                          </td>
                          <td style={{ padding:".7rem 1rem" }}>
                            <span style={{ fontSize:".72rem", fontWeight:700, color:sc.color, background:sc.bg, padding:".2rem .6rem", borderRadius:"99px", whiteSpace:"nowrap" }}>
                              {order.status?.replace(/_/g," ")||"—"}
                            </span>
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
                {filtered.length===0 && <div style={{ padding:"3rem", textAlign:"center", color:"#94a3b8" }}>No orders match the filters</div>}
              </div>
            </div>
          );
        })()}

        {/* REPORT PENDING */}
        {!loading && activeTab==="report_pending" && (() => {
          const TIER_COLORS: Record<string,string> = { starter:"#6366f1", standard:"#8929bd", premium:"#d97706" };

          const parseAdminCsv = (text: string) =>
            text.trim().split(/\r?\n/).slice(1).map(line => {
              const cols = line.split(",");
              return { domain:cols[0]?.trim()||"", status:cols[1]?.trim()||"", published_url:cols[2]?.trim()||"", published_at:cols[3]?.trim()||"", da:parseInt(cols[5]?.trim()||"0")||0 };
            }).filter(r => r.domain && r.status?.toLowerCase()==="published");

          const handleAdminCsvSelect = (file: File) => {
            setAdminReportCsvFile(file);
            const reader = new FileReader();
            reader.onload = e => {
              const rows = parseAdminCsv(e.target?.result as string);
              setAdminReportCsvPreview({ count: rows.length });
            };
            reader.readAsText(file);
          };

          const submitAdminReport = async () => {
            if (!adminReportUploadModal || !adminReportCsvFile || !adminReportConfirmed || !session) return;
            setAdminReportUploading(true);
            try {
              const text = await adminReportCsvFile.text();
              const csv_rows = parseAdminCsv(text);
              if (csv_rows.length === 0) { showToast("No published rows found in CSV", "error"); return; }
              const d = await adminPost("upload_report", { order_id: adminReportUploadModal.id, csv_rows }, session.access_token);
              if (!d.error) {
                showToast("Report uploaded — PR marked as Published ✓");
                setAdminReportUploadModal(null); setAdminReportCsvFile(null); setAdminReportCsvPreview(null); setAdminReportConfirmed(false);
                load("report_pending"); load("pr_orders");
              } else showToast(d.error, "error");
            } catch { showToast("Upload failed", "error"); }
            setAdminReportUploading(false);
          };

          return (
            <div>
              <div style={{ display:"flex", alignItems:"center", marginBottom:"1.25rem" }}>
                <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:0 }}>
                  Report Pending
                  {adminReportPendingBadge > 0 && <span style={{ marginLeft:".5rem", background:"#8929bd", color:"white", fontSize:".65rem", fontWeight:900, padding:".15rem .5rem", borderRadius:"99px" }}>{adminReportPendingBadge}</span>}
                </h2>
              </div>
              <p style={{ color:"#64748b", fontSize:".82rem", margin:"-.5rem 0 1.25rem" }}>Submitted orders awaiting distribution report upload.</p>
              {adminReportPending.length === 0 ? (
                <div style={{ background:"white", borderRadius:".75rem", padding:"3rem", textAlign:"center", border:"1px solid #f1f5f9" }}>
                  <div style={{ fontSize:"2.5rem", marginBottom:".75rem" }}>📤</div>
                  <div style={{ fontWeight:700, color:"#1e293b" }}>No reports pending</div>
                  <div style={{ color:"#94a3b8", fontSize:".82rem", marginTop:".3rem" }}>All submitted PRs have reports uploaded</div>
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
                  {adminReportPending.map(order => (
                    <div key={order.id} style={{ background:"white", borderRadius:".75rem", border:"1px solid #e2e8f0", padding:"1.25rem" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"1rem", flexWrap:"wrap" }}>
                        <div>
                          <div style={{ display:"flex", alignItems:"center", gap:".5rem", marginBottom:".3rem" }}>
                            <span style={{ fontSize:".7rem", fontWeight:800, color:"white", background:TIER_COLORS[order.product_name?.toLowerCase()]||"#6366f1", padding:".2rem .6rem", borderRadius:"99px", textTransform:"uppercase" as const }}>{order.product_name}</span>
                            <span style={{ fontSize:".72rem", color:"#94a3b8" }}>{new Date(order.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
                          </div>
                          <div style={{ fontWeight:700, fontSize:".95rem", color:"#1e293b", marginBottom:".2rem" }}>{order.pr_title||"Untitled PR"}</div>
                          <div style={{ fontSize:".78rem", color:"#8929bd" }}>{(order as any).company_name||order.location_id}</div>
                        </div>
                        <button onClick={()=>{ setAdminReportUploadModal(order); setAdminReportCsvFile(null); setAdminReportCsvPreview(null); setAdminReportConfirmed(false); }}
                          style={{ padding:".5rem 1.1rem", borderRadius:".45rem", border:"none", background:"linear-gradient(135deg,#6366f1,#8929bd)", color:"white", fontSize:".8rem", fontWeight:700, cursor:"pointer", flexShrink:0 }}>
                          📤 Add Report
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload modal */}
              {adminReportUploadModal && (
                <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
                  <div style={{ background:"white", borderRadius:"1rem", width:"100%", maxWidth:480, padding:"2rem", boxShadow:"0 20px 60px rgba(0,0,0,.25)" }}>
                    <h3 style={{ fontWeight:900, fontSize:"1.1rem", color:"#1e293b", margin:"0 0 .3rem" }}>Upload Distribution Report</h3>
                    <p style={{ color:"#64748b", fontSize:".8rem", margin:"0 0 1.25rem" }}>
                      Upload the CSV from the distribution service for:<br/>
                      <strong style={{ color:"#1e293b" }}>{adminReportUploadModal.pr_title}</strong>
                    </p>
                    <label style={{ display:"block", border:"2px dashed #e2e8f0", borderRadius:".65rem", padding:"1.5rem", textAlign:"center", cursor:"pointer", background:"#f8fafc", marginBottom:"1rem" }}>
                      <input type="file" accept=".csv" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(f) handleAdminCsvSelect(f); }}/>
                      {adminReportCsvFile ? (
                        <div>
                          <div style={{ fontSize:"1.5rem", marginBottom:".3rem" }}>📄</div>
                          <div style={{ fontWeight:700, color:"#1e293b", fontSize:".85rem" }}>{adminReportCsvFile.name}</div>
                          {adminReportCsvPreview && <div style={{ color:"#22c55e", fontWeight:700, fontSize:".78rem", marginTop:".3rem" }}>✓ {adminReportCsvPreview.count} published sites found</div>}
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize:"1.5rem", marginBottom:".3rem" }}>📂</div>
                          <div style={{ fontWeight:600, color:"#64748b", fontSize:".82rem" }}>Click to upload CSV report</div>
                          <div style={{ color:"#94a3b8", fontSize:".72rem", marginTop:".2rem" }}>Accepts .csv files</div>
                        </div>
                      )}
                    </label>
                    <label style={{ display:"flex", alignItems:"flex-start", gap:".6rem", cursor:"pointer", marginBottom:"1.5rem" }}>
                      <input type="checkbox" checked={adminReportConfirmed} onChange={e=>setAdminReportConfirmed(e.target.checked)} style={{ marginTop:".15rem", accentColor:"#8929bd", width:15, height:15, flexShrink:0 }}/>
                      <span style={{ color:"#475569", fontSize:".78rem", lineHeight:1.5 }}>
                        I confirm I have reviewed this report for accuracy.
                        <span style={{ color:"#ef4444", fontWeight:700 }}> Reports cannot be resubmitted once uploaded.</span>
                      </span>
                    </label>
                    <div style={{ display:"flex", gap:".75rem" }}>
                      <button onClick={submitAdminReport} disabled={!adminReportCsvFile||!adminReportConfirmed||adminReportUploading}
                        style={{ flex:1, padding:".7rem", borderRadius:".5rem", border:"none", background:(!adminReportCsvFile||!adminReportConfirmed||adminReportUploading)?"#e2e8f0":"linear-gradient(135deg,#6366f1,#8929bd)", color:(!adminReportCsvFile||!adminReportConfirmed||adminReportUploading)?"#94a3b8":"white", fontWeight:700, fontSize:".85rem", cursor:(!adminReportCsvFile||!adminReportConfirmed||adminReportUploading)?"not-allowed":"pointer" }}>
                        {adminReportUploading ? "Uploading…" : "📤 Upload Report"}
                      </button>
                      <button onClick={()=>{setAdminReportUploadModal(null);setAdminReportCsvFile(null);setAdminReportCsvPreview(null);setAdminReportConfirmed(false);}}
                        style={{ padding:".7rem 1.25rem", borderRadius:".5rem", border:"1px solid #e2e8f0", background:"white", fontWeight:600, fontSize:".85rem", cursor:"pointer", color:"#64748b" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* PROMOTIONS */}
        {!loading && activeTab==="promotions" && (
          <PromotionsTab
            promotions={promotions}
            locationsList={locationsList}
            session={session}
            showToast={showToast}
            onRefresh={() => load("promotions")}
          />
        )}

        {/* PARTNER DETAILS */}
        {!loading && activeTab==="partner_details" && (() => {
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
          const getBullets = (tier: string) => pdNotes.find(n=>n.tier===tier)?.bullets || DEFAULT_BULLETS[tier] || [];

          const setMainPartner = async (partnerId: string) => {
            if (!session) return;
            setPdSettingMain(true);
            const d = await adminPost("set_default_partner", { partner_id: partnerId || null }, session.access_token);
            if (d.ok) { setPdDefaultId(partnerId); showToast("Main partner updated ✓"); setDefaultPartnerId(partnerId); }
            else showToast(d.error || "Failed to update", "error");
            setPdSettingMain(false);
          };

          const fmtSize = (bytes: number) => bytes>1048576?`${(bytes/1048576).toFixed(1)} MB`:bytes>1024?`${Math.round(bytes/1024)} KB`:`${bytes} B`;

          return (
            <div>
              <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:"0 0 1.5rem" }}>🤝 Partner Details</h2>

              {/* List of Partners */}
              <div style={{ marginBottom:"2rem" }}>
                <h3 style={{ fontWeight:800, fontSize:"1rem", color:"#1e293b", margin:"0 0 .75rem" }}>List of Partners</h3>
                {pdPartners.length === 0 ? (
                  <div style={{ background:"white", borderRadius:".75rem", border:"1px solid #f1f5f9", padding:"2rem", textAlign:"center", color:"#94a3b8" }}>
                    No partners yet — create one in Settings
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:".65rem" }}>
                    {pdPartners.map((p:any) => {
                      const isMain = pdDefaultId === p.id;
                      return (
                        <div key={p.id} style={{ background:"white", borderRadius:".75rem", border:`1.5px solid ${isMain?"#8929bd":"#f1f5f9"}`, padding:"1rem 1.25rem", display:"flex", alignItems:"center", gap:"1rem", flexWrap:"wrap" }}>
                          {/* Main badge */}
                          {isMain && <span style={{ background:"linear-gradient(135deg,#8929bd,#6366f1)", color:"white", fontSize:".68rem", fontWeight:800, padding:".25rem .65rem", borderRadius:"99px", whiteSpace:"nowrap" }}>⭐ Main Partner</span>}
                          {/* Identity */}
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:700, fontSize:".92rem", color:"#1e293b" }}>{p.name || p.email}</div>
                            {p.company && <div style={{ fontSize:".76rem", color:"#64748b", marginTop:".1rem" }}>{p.company}</div>}
                          </div>
                          {/* Stripe status */}
                          <div style={{ flexShrink:0 }}>
                            {p.stripe_connect_status === "active" ? (
                              <span style={{ background:"linear-gradient(135deg,#f5f3ff,#ede9fe)", color:"#4338ca", fontSize:".72rem", fontWeight:700, padding:".25rem .65rem", borderRadius:"99px", border:"1px solid #635bff40", display:"inline-flex", alignItems:"center", gap:".3rem" }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="#635bff"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/></svg>
                                Stripe Connected
                              </span>
                            ) : (
                              <span style={{ background:"#f1f5f9", color:"#64748b", fontSize:".72rem", fontWeight:600, padding:".25rem .65rem", borderRadius:"99px" }}>⚠️ No Stripe</span>
                            )}
                          </div>
                          {/* See Profile */}
                          <button onClick={() => setViewingPartner(p)}
                            style={{ padding:".35rem .85rem", borderRadius:".4rem", border:"1px solid #e2e8f0", background:"white", fontSize:".75rem", fontWeight:600, cursor:"pointer", color:"#374151", flexShrink:0 }}>
                            👤 See Profile
                          </button>
                          {/* Member since */}
                          <div style={{ fontSize:".72rem", color:"#94a3b8", flexShrink:0 }}>
                            Since {new Date(p.created_at).toLocaleDateString("en-US",{month:"short",year:"numeric"})}
                          </div>
                          {/* Set as main */}
                          {!isMain && (
                            <button onClick={() => setMainPartner(p.id)} disabled={pdSettingMain}
                              style={{ padding:".4rem .9rem", borderRadius:".45rem", border:"1.5px solid #8929bd", background:"white", color:"#8929bd", fontWeight:700, fontSize:".78rem", cursor:"pointer", flexShrink:0, whiteSpace:"nowrap" }}>
                              {pdSettingMain ? "…" : "Set as Main Partner"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Partner Profile Modal */}
              {viewingPartner && (
                <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,.5)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1.5rem" }}>
                  <div style={{ background:"white", borderRadius:"1rem", width:"100%", maxWidth:440, boxShadow:"0 24px 80px rgba(0,0,0,.3)", overflow:"hidden" }}>
                    <div style={{ background:"linear-gradient(135deg,#1a0a2e,#2d1054)", padding:"1.25rem 1.5rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:".75rem" }}>
                        <div style={{ width:40, height:40, borderRadius:"50%", background:"rgba(255,255,255,.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.1rem" }}>👤</div>
                        <div>
                          <div style={{ color:"white", fontWeight:800, fontSize:".95rem" }}>{viewingPartner.name || viewingPartner.email}</div>
                          <div style={{ color:"rgba(255,255,255,.5)", fontSize:".72rem", marginTop:".1rem" }}>Partner Profile</div>
                        </div>
                      </div>
                      <button onClick={() => setViewingPartner(null)}
                        style={{ background:"none", border:"none", color:"rgba(255,255,255,.6)", fontSize:"1.2rem", cursor:"pointer", lineHeight:1, padding:".25rem" }}>✕</button>
                    </div>
                    <div style={{ padding:"1.5rem", display:"flex", flexDirection:"column", gap:"0" }}>
                      {([
                        { label:"Email",            value: viewingPartner.email },
                        { label:"Company",          value: viewingPartner.company },
                        { label:"Point of Contact", value: viewingPartner.contact },
                        { label:"Phone",            value: viewingPartner.phone },
                        { label:"Website",          value: viewingPartner.website, isUrl: true },
                        { label:"Member Since",     value: viewingPartner.created_at ? new Date(viewingPartner.created_at).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}) : null },
                      ] as { label:string; value:string|null; isUrl?:boolean }[]).filter(f=>f.value).map(f=>(
                        <div key={f.label} style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"1rem", padding:".65rem 0", borderBottom:"1px solid #f8fafc" }}>
                          <span style={{ fontSize:".73rem", fontWeight:700, color:"#94a3b8", textTransform:"uppercase" as const, letterSpacing:".05em", flexShrink:0, paddingTop:".05rem" }}>{f.label}</span>
                          {f.isUrl ? (
                            <a href={f.value!} target="_blank" rel="noreferrer" style={{ fontSize:".85rem", color:"#6366f1", fontWeight:500, textDecoration:"none", textAlign:"right" as const, wordBreak:"break-all" as const }}>{f.value}</a>
                          ) : (
                            <span style={{ fontSize:".85rem", color:"#1e293b", fontWeight:500, textAlign:"right" as const, wordBreak:"break-all" as const }}>{f.value}</span>
                          )}
                        </div>
                      ))}
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:".65rem 0" }}>
                        <span style={{ fontSize:".73rem", fontWeight:700, color:"#94a3b8", textTransform:"uppercase" as const, letterSpacing:".05em" }}>Stripe</span>
                        {viewingPartner.stripe_connect_status === "active"
                          ? <span style={{ background:"linear-gradient(135deg,#f5f3ff,#ede9fe)", color:"#4338ca", fontSize:".75rem", fontWeight:700, padding:".25rem .7rem", borderRadius:"99px", border:"1px solid #635bff40" }}>✓ Connected</span>
                          : <span style={{ background:"#f1f5f9", color:"#94a3b8", fontSize:".75rem", fontWeight:600, padding:".25rem .7rem", borderRadius:"99px" }}>Not connected</span>
                        }
                      </div>
                    </div>
                    <div style={{ padding:".75rem 1.5rem", borderTop:"1px solid #f1f5f9", display:"flex", justifyContent:"flex-end" }}>
                      <button onClick={() => setViewingPartner(null)}
                        style={{ padding:".55rem 1.25rem", borderRadius:".45rem", border:"1px solid #e2e8f0", background:"white", fontSize:".84rem", fontWeight:600, cursor:"pointer" }}>Close</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Package Pricing — read-only view of main partner's bullets */}
              <div style={{ marginBottom:"2rem" }}>
                <div style={{ display:"flex", alignItems:"center", gap:".75rem", marginBottom:".75rem" }}>
                  <h3 style={{ fontWeight:800, fontSize:"1rem", color:"#1e293b", margin:0 }}>Package Pricing</h3>
                  {pdDefaultId ? (
                    <span style={{ fontSize:".72rem", color:"#64748b", background:"#f1f5f9", padding:".2rem .6rem", borderRadius:"99px" }}>
                      From: {pdPartners.find((p:any)=>p.id===pdDefaultId)?.name || "Main Partner"}
                    </span>
                  ) : (
                    <span style={{ fontSize:".72rem", color:"#ef4444", background:"#fff1f2", padding:".2rem .6rem", borderRadius:"99px" }}>No main partner set</span>
                  )}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:"1rem" }}>
                  {TIERS.map(tier => {
                    const bullets = getBullets(tier.key);
                    return (
                      <div key={tier.key} style={{ background:"white", borderRadius:".875rem", border:`1.5px solid ${tier.color}25`, overflow:"hidden" }}>
                        <div style={{ background:`linear-gradient(135deg,${tier.color}15,${tier.color}05)`, borderBottom:`1px solid ${tier.color}20`, padding:"1rem 1.25rem" }}>
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                            <span style={{ fontWeight:800, fontSize:".9rem", color:tier.color }}>{tier.label}</span>
                            <span style={{ fontWeight:900, fontSize:"1.35rem", color:tier.color }}>${tier.price}</span>
                          </div>
                          <div style={{ fontSize:".7rem", color:"#94a3b8", marginTop:".1rem" }}>per press release · partner payout</div>
                        </div>
                        <div style={{ padding:"1rem 1.25rem" }}>
                          <ul style={{ margin:0, padding:0, listStyle:"none", display:"flex", flexDirection:"column", gap:".4rem" }}>
                            {(bullets as string[]).map((b, i) => (
                              <li key={i} style={{ fontSize:".8rem", color:"#374151", display:"flex", alignItems:"flex-start", gap:".45rem" }}>
                                <span style={{ color:tier.color, flexShrink:0 }}>•</span>{b}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Partner Documents — all documents from all partners */}
              <div>
                <h3 style={{ fontWeight:800, fontSize:"1rem", color:"#1e293b", margin:"0 0 .75rem" }}>Partner Documents</h3>
                {pdDocuments.length === 0 ? (
                  <div style={{ background:"white", borderRadius:".75rem", border:"1px solid #f1f5f9", padding:"2.5rem", textAlign:"center" }}>
                    <div style={{ fontSize:"2rem", marginBottom:".4rem" }}>📁</div>
                    <div style={{ fontWeight:600, color:"#1e293b" }}>No documents uploaded yet</div>
                    <div style={{ color:"#94a3b8", fontSize:".82rem", marginTop:".25rem" }}>Partners can upload documents from their Partner Details tab</div>
                  </div>
                ) : (
                  <div style={{ background:"white", borderRadius:".75rem", border:"1px solid #f1f5f9", overflow:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:".82rem" }}>
                      <thead><tr style={{ background:"#1e1b4b" }}>
                        {["Partner","Document","Description","File","Uploaded"].map(h=>(
                          <th key={h} style={{ padding:".7rem 1rem", textAlign:"left", fontWeight:700, color:"rgba(255,255,255,.8)", fontSize:".68rem", textTransform:"uppercase", letterSpacing:".05em", whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {pdDocuments.map((doc:any)=>{
                          // Try to match partner name from partner_id
                          const partnerName = doc.partner_id
                            ? pdPartners.find((p:any)=>p.id===doc.partner_id)?.name || doc.uploaded_by
                            : doc.uploaded_by || "—";
                          return (
                            <tr key={doc.id} style={{ borderTop:"1px solid #f8fafc" }}
                              onMouseOver={e=>(e.currentTarget.style.background="#fafafa")}
                              onMouseOut={e=>(e.currentTarget.style.background="white")}>
                              <td style={{ padding:".75rem 1rem" }}>
                                <span style={{ fontWeight:600, color:"#8929bd", fontSize:".8rem" }}>{partnerName}</span>
                              </td>
                              <td style={{ padding:".75rem 1rem", fontWeight:600, color:"#1e293b" }}>{doc.name}</td>
                              <td style={{ padding:".75rem 1rem", color:"#64748b", fontSize:".78rem", maxWidth:200 }}>
                                <div style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{doc.description||"—"}</div>
                              </td>
                              <td style={{ padding:".75rem 1rem" }}>
                                {doc.file_url?(
                                  <a href={doc.file_url} target="_blank" rel="noreferrer"
                                    style={{ color:"#6366f1", fontWeight:600, fontSize:".78rem", textDecoration:"none", display:"flex", alignItems:"center", gap:".3rem" }}>
                                    📄 {doc.file_name||"View"}{doc.file_size?<span style={{ color:"#94a3b8", fontWeight:400 }}> ({fmtSize(doc.file_size)})</span>:null}
                                  </a>
                                ):"—"}
                              </td>
                              <td style={{ padding:".75rem 1rem", color:"#64748b", whiteSpace:"nowrap", fontSize:".78rem" }}>
                                {doc.uploaded_at?new Date(doc.uploaded_at).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}):"—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* EMAIL ALERTS */}
        {!loading && activeTab==="email_alerts" && (() => {
          const EMAIL_TYPES = [
            { section:"✍️ Media Creator", items:[
              { key:"mc_scheduled",  label:"PR Scheduled",              desc:"Sent when a client schedules a press release for a future date" },
              { key:"mc_submitted",  label:"PR Submitted",              desc:"Sent when a PR is ordered and submitted for review" },
              { key:"mc_published",  label:"PR Published",              desc:"Sent when a PR goes live and the distribution report is added" },
              { key:"mc_rejected",   label:"PR Rejected / Revision",    desc:"Sent when a submitted PR requires changes" },
            ]},
            { section:"🏆 Authority Builder", items:[
              { key:"ab_approval",   label:"AI Draft Ready for Review", desc:"Sent when an auto-generated PR is ready for client approval" },
            ]},
            { section:"🔥 Trending Topics", items:[
              { key:"tt_digest",     label:"Trending Topics Digest",    desc:"Digest of trending topics in the client's industry" },
            ]},
            { section:"📊 Competitor Analysis", items:[
              { key:"ca_digest",     label:"Competitor Activity Report",desc:"Updates on competitor movements and positioning" },
            ]},
            { section:"🛡️ Trust Widget", items:[
              { key:"tw_not_created",  label:"Widget Not Set Up",       desc:"Reminder if no Trust Widget has been created after 7 days" },
              { key:"tw_not_verified", label:"Widget Not Verified",     desc:"Alert if widget isn't verified within 48 hours of setup" },
            ]},
            { section:"💳 Media Credits", items:[
              { key:"credits_low",       label:"Low Credit Alert",      desc:"Sent when any tier drops to 1 credit remaining" },
              { key:"credits_promotion", label:"Promotions & Offers",   desc:"Special deals and bonus credit opportunities" },
            ]},
            { section:"🔴 Admin Alerts", items:[
              { key:"admin_credits_purchase", label:"New Credits Purchase", desc:"Sent to admin when a client purchases media credits — links to PR Orders tab" },
              { key:"admin_new_pr_order",     label:"New PR Order",         desc:"Sent to admin when a client submits a new press release — links to PR Orders tab" },
              { key:"admin_approval_needed",  label:"Approval Needed",      desc:"Sent to admin when a PR is awaiting review in the Approval Queue" },
            ]},
          ];

          const openEditor = (key: string, label: string) => {
            const saved = emailTemplates.find(t => t.key === key);
            setEditingTemplate({ key, subject: saved?.subject || `[MBB] ${label}`, html: saved?.html || defaultTmpl, is_custom: !!saved?.html });
            setEditSubject(saved?.subject || `[MBB] ${label}`);
            setEditHtml(saved?.html || defaultTmpl);
            setShowPreview(true);
          };

          const saveTemplate = async () => {
            if (!editingTemplate || !session) return;
            setSavingTmpl(true);
            const d = await adminPost("save_email_template", { key: editingTemplate.key, subject: editSubject, html: editHtml }, session.access_token);
            if (!d.error) { showToast("Template saved ✓"); setEmailTemplates(prev => { const idx = prev.findIndex(t=>t.key===editingTemplate.key); const updated = [...prev]; if(idx>=0) updated[idx]={...updated[idx],subject:editSubject,html:editHtml}; else updated.push({key:editingTemplate.key,subject:editSubject,html:editHtml,is_custom:true}); return updated; }); }
            else showToast(d.error,"error");
            setSavingTmpl(false);
          };

          const resetTemplate = async () => {
            if (!editingTemplate || !session) return;
            if (!confirm("Reset to default template? Your changes will be lost.")) return;
            const d = await adminPost("reset_email_template", { key: editingTemplate.key }, session.access_token);
            if (!d.error) { setEditHtml(d.default_template || defaultTmpl); setEmailTemplates(prev=>prev.filter(t=>t.key!==editingTemplate.key)); showToast("Reset to default"); }
          };

          const VARS = ["{{badge}}","{{title}}","{{message}}","{{dashUrl}}"];
          const previewHtml = editHtml.replace(/\{\{badge\}\}/g,"Media Creator").replace(/\{\{title\}\}/g,"Test Email Subject").replace(/\{\{message\}\}/g,"This is a preview of your email notification.").replace(/\{\{dashUrl\}\}/g,"https://mediablast.xlogic.app");

          return (
            <div>
              <div style={{ marginBottom:"1.5rem" }}>
                <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:"0 0 .3rem" }}>Email Alerts</h2>
                <p style={{ color:"#64748b", fontSize:".84rem", margin:0 }}>Customize the HTML template for each system email. Default templates are used automatically until overridden.</p>
              </div>

              {EMAIL_TYPES.map(group => (
                <div key={group.section} style={{ marginBottom:"1.75rem" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:".5rem", marginBottom:".65rem", paddingBottom:".5rem", borderBottom:"2px solid #f1f5f9" }}>
                    <span style={{ fontSize:"1rem" }}>{group.section.split(" ")[0]}</span>
                    <h3 style={{ margin:0, fontWeight:800, fontSize:".88rem", color:"#1e293b" }}>{group.section.split(" ").slice(1).join(" ")}</h3>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:".35rem" }}>
                    {group.items.map(item => {
                      const isCustom = emailTemplates.some(t => t.key === item.key);
                      return (
                        <div key={item.key} style={{ display:"flex", alignItems:"center", padding:".7rem .9rem", borderRadius:".55rem", gap:"1rem", background:"white", border:`1px solid ${isCustom?"#c7d2fe":"#f1f5f9"}` }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:600, fontSize:".84rem", color:"#1e293b", display:"flex", alignItems:"center", gap:".5rem" }}>
                              {item.label}
                              {isCustom && <span style={{ fontSize:".65rem", fontWeight:800, color:"#6366f1", background:"#eef2ff", padding:".1rem .45rem", borderRadius:"99px" }}>Custom</span>}
                            </div>
                            <div style={{ fontSize:".73rem", color:"#94a3b8", marginTop:".1rem" }}>{item.desc}</div>
                          </div>
                          <button onClick={() => openEditor(item.key, item.label)}
                            style={{ padding:".4rem .9rem", borderRadius:".45rem", border:`1px solid ${isCustom?"#6366f1":"#e2e8f0"}`, background: isCustom?"#eef2ff":"white", color: isCustom?"#6366f1":"#374151", fontWeight:600, fontSize:".78rem", cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
                            ✏️ {isCustom?"Edit Template":"Edit Template"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Template Editor Modal */}
              {editingTemplate && (
                <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,.6)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
                  <div style={{ background:"white", borderRadius:"1rem", width:"100%", maxWidth:960, height:"90vh", display:"flex", flexDirection:"column", boxShadow:"0 32px 80px rgba(0,0,0,.4)" }}>
                    {/* Header */}
                    <div style={{ padding:"1rem 1.5rem", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", gap:"1rem", flexShrink:0 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:800, fontSize:".95rem", color:"#1e293b" }}>✏️ Edit Email Template</div>
                        <div style={{ fontSize:".73rem", color:"#94a3b8", marginTop:".1rem" }}>key: <code style={{ background:"#f1f5f9", padding:"0 .3rem", borderRadius:".2rem" }}>{editingTemplate.key}</code></div>
                      </div>
                      {/* Variables reference */}
                      <div style={{ display:"flex", gap:".35rem", alignItems:"center" }}>
                        <span style={{ fontSize:".68rem", color:"#94a3b8", fontWeight:600 }}>Variables:</span>
                        {VARS.map(v => (
                          <code key={v} onClick={() => { const ta = document.getElementById("tmpl-editor") as HTMLTextAreaElement; if(ta){const s=ta.selectionStart; const newVal=editHtml.slice(0,s)+v+editHtml.slice(ta.selectionEnd); setEditHtml(newVal); setTimeout(()=>{ta.selectionStart=ta.selectionEnd=s+v.length;ta.focus();},0);} }}
                            style={{ fontSize:".68rem", background:"#eef2ff", color:"#6366f1", padding:".15rem .4rem", borderRadius:".25rem", cursor:"pointer", fontFamily:"monospace" }} title="Click to insert">
                            {v}
                          </code>
                        ))}
                      </div>
                      <button onClick={() => setShowPreview(p=>!p)}
                        style={{ padding:".4rem .9rem", borderRadius:".45rem", border:"1px solid #e2e8f0", background: showPreview?"#eef2ff":"white", color: showPreview?"#6366f1":"#374151", fontWeight:600, fontSize:".78rem", cursor:"pointer" }}>
                        {showPreview?"◀ Editor":"👁 Preview"}
                      </button>
                      <button onClick={() => setEditingTemplate(null)} style={{ background:"none", border:"none", fontSize:"1.2rem", cursor:"pointer", color:"#94a3b8", lineHeight:1 }}>✕</button>
                    </div>

                    {/* Subject line */}
                    <div style={{ padding:".6rem 1.5rem", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", gap:".75rem", flexShrink:0, background:"#fafafa" }}>
                      <span style={{ fontSize:".75rem", fontWeight:700, color:"#64748b", whiteSpace:"nowrap" }}>Subject line:</span>
                      <input value={editSubject} onChange={e=>setEditSubject(e.target.value)}
                        style={{ flex:1, padding:".4rem .7rem", borderRadius:".4rem", border:"1px solid #e2e8f0", fontSize:".84rem", outline:"none" }}/>
                    </div>

                    {/* Editor / Preview split */}
                    <div style={{ flex:1, overflow:"hidden", display:"flex" }}>
                      {!showPreview ? (
                        <textarea
                          id="tmpl-editor"
                          value={editHtml}
                          onChange={e => setEditHtml(e.target.value)}
                          spellCheck={false}
                          style={{ flex:1, padding:"1rem 1.5rem", fontFamily:"'Cascadia Code','Fira Code','JetBrains Mono',monospace", fontSize:".78rem", lineHeight:1.6, border:"none", resize:"none", outline:"none", color:"#1e293b", background:"#fafffe", overflowY:"auto" }}
                        />
                      ) : (
                        <iframe
                          ref={iframeRef}
                          srcDoc={previewHtml}
                          sandbox="allow-same-origin allow-scripts"
                          style={{ flex:1, border:"none", background:"white" }}
                          title="Email Preview"
                          onLoad={() => {
                            try {
                              const doc = iframeRef.current?.contentDocument;
                              if (doc) {
                                doc.designMode = "on";
                                doc.addEventListener("input", () => {
                                  setEditHtml(doc.documentElement.outerHTML);
                                });
                              }
                            } catch {}
                          }}
                        />
                      )}
                    </div>

                    {/* Footer actions */}
                    <div style={{ padding:"1rem 1.5rem", borderTop:"1px solid #f1f5f9", display:"flex", gap:".65rem", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
                      <div style={{ display:"flex", gap:".5rem" }}>
                        <button onClick={resetTemplate}
                          style={{ padding:".5rem .9rem", borderRadius:".45rem", border:"1px solid #e2e8f0", background:"white", color:"#64748b", fontWeight:600, fontSize:".78rem", cursor:"pointer" }}>
                          ↩ Reset to Default
                        </button>
                        <button onClick={async()=>{
                            if(!session||!admin)return;
                            setSendingTest(true);
                            const toEmail = admin.email || "";
                            const d = await adminPost("send_test_email",{subject:editSubject,html:editHtml,to_email:toEmail},session.access_token);
                            if(d.ok) showToast(`📧 Test email sent to ${toEmail}`);
                            else showToast(d.error||"Failed to send test","error");
                            setSendingTest(false);
                          }} disabled={sendingTest}
                          style={{ padding:".5rem .9rem", borderRadius:".45rem", border:"1px solid #6366f1", background:"#eef2ff", color:"#6366f1", fontWeight:600, fontSize:".78rem", cursor: sendingTest?"not-allowed":"pointer" }}>
                          {sendingTest ? "Sending…" : "📨 Send Test to My Email"}
                        </button>
                      </div>
                      <div style={{ display:"flex", gap:".65rem" }}>
                        <button onClick={()=>setEditingTemplate(null)}
                          style={{ padding:".55rem 1.25rem", borderRadius:".45rem", border:"1px solid #e2e8f0", background:"white", color:"#374151", fontWeight:600, fontSize:".85rem", cursor:"pointer" }}>
                          Cancel
                        </button>
                        <button onClick={saveTemplate} disabled={savingTmpl}
                          style={{ padding:".55rem 1.5rem", borderRadius:".45rem", border:"none", background: savingTmpl?"#e2e8f0":"linear-gradient(135deg,#6366f1,#8929bd)", color: savingTmpl?"#94a3b8":"white", fontWeight:800, fontSize:".85rem", cursor: savingTmpl?"not-allowed":"pointer" }}>
                          {savingTmpl?"Saving…":"Save Template"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* SETTINGS */}
        {!loading && activeTab==="settings" && (
          <div style={{ maxWidth:600 }}>
            <h2 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:"0 0 1.5rem" }}>Operational Settings</h2>
            <div style={{ background:"white", borderRadius:".75rem", border:"1px solid #f1f5f9", padding:"1.5rem", marginBottom:"1rem" }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"1rem" }}>
                <div>
                  <div style={{ fontWeight:800, fontSize:"1rem", color:"#1e293b", marginBottom:".3rem" }}>🔒 Global Review Mode</div>
                  <div style={{ fontSize:".82rem", color:"#64748b", lineHeight:1.55 }}>
                    When ON, all new PRs from every location are held in the Approval Queue for your review before being marked ready for the partner. When OFF, PRs are approved automatically.
                  </div>
                  <div style={{ marginTop:".75rem", fontSize:".78rem", fontWeight:600, color: settings.review_mode_global?"#166534":"#991b1b", background: settings.review_mode_global?"#dcfce7":"#fee2e2", display:"inline-block", padding:".25rem .75rem", borderRadius:"99px" }}>
                    Currently {settings.review_mode_global ? "ON — PRs held for review" : "OFF — PRs auto-approved"}
                  </div>
                </div>
                <button onClick={()=>setSettings(s=>({...s,review_mode_global:!s.review_mode_global}))}
                  style={{ position:"relative", width:52, height:28, borderRadius:99, border:"none", cursor:"pointer", padding:0, flexShrink:0,
                    background: settings.review_mode_global?"#10b981":"#ef4444", transition:"background .2s" }}>
                  <div style={{ position:"absolute", top:3, left: settings.review_mode_global?26:3, width:22, height:22, borderRadius:"50%", background:"white", transition:"left .2s", boxShadow:"0 1px 4px rgba(0,0,0,.25)" }}/>
                </button>
              </div>
            </div>
            <div style={{ background:"#fffbeb", borderRadius:".75rem", border:"1px solid #fde68a", padding:"1rem 1.25rem", marginBottom:"1.5rem", fontSize:".8rem", color:"#92400e" }}>
              💡 Per-location overrides are set in the Locations table. The global switch applies to all locations that don't have an explicit override.
            </div>

            {/* Admin notification email */}

            <div style={{ background:"white", borderRadius:".75rem", border:"1px solid #f1f5f9", padding:"1.25rem", marginBottom:"1.25rem" }}>
              <div style={{ fontWeight:800, fontSize:"1rem", color:"#1e293b", marginBottom:".25rem" }}>📧 Admin Alert Emails</div>
              <div style={{ fontSize:".8rem", color:"#64748b", marginBottom:"1rem", lineHeight:1.5 }}>
                These addresses receive admin alerts — new purchases, PR orders, and approvals needed.
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:".5rem" }}>
                {/* Primary admin — locked */}
                {adminUsers.length > 0 && (() => {
                  const primary = adminUsers.sort((a:any,b:any)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime())[0];
                  return (
                    <div style={{ display:"flex", alignItems:"center", gap:".75rem", padding:".55rem .85rem", borderRadius:".5rem", background:"#f8fafc", border:"1.5px solid #e2e8f0" }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:".85rem", color:"#1e293b", fontWeight:600 }}>{primary.email}</div>
                        <div style={{ fontSize:".7rem", color:"#94a3b8", marginTop:".1rem" }}>{primary.name} · Primary admin</div>
                      </div>
                      <span style={{ fontSize:".68rem", fontWeight:700, color:"#6366f1", background:"#eef2ff", padding:".2rem .6rem", borderRadius:"99px", flexShrink:0 }}>🔒 Required</span>
                    </div>
                  );
                })()}
                {/* Additional emails */}
                {notifEmails.map((email, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:".75rem", padding:".55rem .85rem", borderRadius:".5rem", background:"white", border:"1.5px solid #e2e8f0" }}>
                    <div style={{ flex:1, fontSize:".85rem", color:"#374151" }}>{email}</div>
                    <button onClick={() => setNotifEmails(prev => prev.filter((_,j)=>j!==i))}
                      style={{ background:"none", border:"none", cursor:"pointer", color:"#ef4444", fontSize:".8rem", fontWeight:700, padding:".1rem .4rem", borderRadius:".3rem", flexShrink:0 }}>
                      ✕ Remove
                    </button>
                  </div>
                ))}
                {/* Add new email row */}
                <div style={{ display:"flex", gap:".5rem", marginTop:".25rem" }}>
                  <input type="email" value={newNotifEmail} onChange={e=>setNewNotifEmail(e.target.value)}
                    onKeyDown={e=>{ if(e.key==="Enter"&&newNotifEmail.trim()){ setNotifEmails(p=>[...p,newNotifEmail.trim()]); setNewNotifEmail(""); } }}
                    placeholder="Add another email address…"
                    style={{ flex:1, padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".84rem", outline:"none" }}/>
                  <button onClick={()=>{ if(newNotifEmail.trim()){ setNotifEmails(p=>[...p,newNotifEmail.trim()]); setNewNotifEmail(""); } }}
                    disabled={!newNotifEmail.trim()}
                    style={{ padding:".5rem 1rem", borderRadius:".45rem", border:"none", background:newNotifEmail.trim()?"#6366f1":"#e2e8f0", color:newNotifEmail.trim()?"white":"#94a3b8", fontWeight:700, fontSize:".82rem", cursor:newNotifEmail.trim()?"pointer":"not-allowed" }}>
                    + Add
                  </button>
                </div>
              </div>
            </div>
            <button onClick={saveSettings}
              style={{ padding:".75rem 2rem", borderRadius:".65rem", border:"none", background:"linear-gradient(135deg,#6366f1,#8929bd)", color:"white", fontWeight:800, fontSize:".9rem", cursor:"pointer", boxShadow:"0 4px 14px rgba(99,102,241,.3)" }}>
              Save Settings
            </button>

            {/* Add Admin User */}
            <div style={{ marginTop:"2rem", paddingTop:"2rem", borderTop:"1px solid #f1f5f9" }}>
              <h3 style={{ fontWeight:800, fontSize:"1rem", color:"#1e293b", margin:"0 0 .35rem" }}>👤 Add Admin User</h3>
              <p style={{ fontSize:".8rem", color:"#64748b", margin:"0 0 1rem", lineHeight:1.5 }}>
                Create a new admin account with full dashboard access. The account is created and activated instantly — no extra steps required.
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:".65rem" }}>
                <input value={inviteName} onChange={e=>setInviteName(e.target.value)} placeholder="Full name"
                  style={{ padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".84rem" }}/>
                <input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="Email address"
                  style={{ padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".84rem" }}/>
                <input type="password" value={invitePass} onChange={e=>setInvitePass(e.target.value)} placeholder="Temporary password"
                  style={{ padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".84rem" }}/>
                <button onClick={inviteAdmin} disabled={inviting || !inviteEmail || !invitePass}
                  style={{ padding:".6rem 1.25rem", borderRadius:".5rem", border:"none", background: inviting||!inviteEmail||!invitePass?"#e2e8f0":"#1e293b", color: inviting||!inviteEmail||!invitePass?"#94a3b8":"white", fontWeight:700, fontSize:".84rem", cursor: inviting?"not-allowed":"pointer", alignSelf:"flex-start" }}>
                  {inviting ? "Creating…" : "Create Admin User"}
                </button>
              </div>
            </div>

            {/* Add Partner User */}
            <div style={{ marginTop:"2rem", paddingTop:"2rem", borderTop:"1px solid #f1f5f9" }}>
              <h3 style={{ fontWeight:800, fontSize:"1rem", color:"#1e293b", margin:"0 0 .35rem" }}>🤝 Add Partner User</h3>
              <p style={{ fontSize:".8rem", color:"#64748b", margin:"0 0 1rem", lineHeight:1.5 }}>
                Create a partner account for <strong>mediablast.xlogic.app/partner</strong>. Partners can view PR Orders, manage the Approval Queue, and see payout revenue only — no admin access.
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:".65rem" }}>
                <input value={inviteName} onChange={e=>setInviteName(e.target.value)} placeholder="Partner name (e.g. NewswireJet)"
                  style={{ padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".84rem" }}/>
                <input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="Partner email"
                  style={{ padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".84rem" }}/>
                <input type="password" value={invitePass} onChange={e=>setInvitePass(e.target.value)} placeholder="Temporary password"
                  style={{ padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".84rem" }}/>
                <button onClick={async () => {
                    if (!inviteEmail || !invitePass || !session) return;
                    setInviting(true);
                    try {
                      const d = await adminPost("create_partner_user", { email: inviteEmail, password: invitePass, name: inviteName || inviteEmail }, session.access_token);
                      if (d.ok) { showToast(`✅ Partner user created — ${inviteEmail} can sign in at /partner`); setInviteEmail(""); setInvitePass(""); setInviteName(""); }
                      else showToast(d.error || "Failed to create partner", "error");
                    } catch (e: any) { showToast(e.message, "error"); }
                    setInviting(false);
                  }} disabled={inviting || !inviteEmail || !invitePass}
                  style={{ padding:".6rem 1.25rem", borderRadius:".5rem", border:"none", background: inviting||!inviteEmail||!invitePass?"#e2e8f0":"#1a0a2e", color: inviting||!inviteEmail||!invitePass?"#94a3b8":"white", fontWeight:700, fontSize:".84rem", cursor: inviting?"not-allowed":"pointer", alignSelf:"flex-start" }}>
                  {inviting ? "Creating…" : "Create Partner User"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>{/* /content */}
      </div>{/* /body: sidebar+content */}

      {/* Credit Override Modal */}
      {overrideTarget && (
        <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1.5rem" }}>
          <div style={{ background:"white", borderRadius:"1rem", width:"100%", maxWidth:420, padding:"2rem" }}>
            <h3 style={{ fontWeight:900, margin:"0 0 .25rem", fontSize:"1.1rem" }}>💳 Credit Override</h3>
            <p style={{ color:"#64748b", fontSize:".82rem", margin:"0 0 1.25rem" }}>{overrideTarget.company_name||overrideTarget.location_id}</p>
            <div style={{ display:"flex", flexDirection:"column", gap:".75rem" }}>
              <div>
                <label style={{ fontSize:".75rem", fontWeight:700, color:"#374151", display:"block", marginBottom:".3rem" }}>Tier</label>
                <select value={overrideTier} onChange={e=>setOverrideTier(e.target.value)}
                  style={{ width:"100%", padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".85rem" }}>
                  <option value="starter">Starter</option>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize:".75rem", fontWeight:700, color:"#374151", display:"block", marginBottom:".3rem" }}>Amount (use negative to remove)</label>
                <input type="number" value={overrideAmt} onChange={e=>setOverrideAmt(e.target.value)} placeholder="e.g. 3 or -1"
                  style={{ width:"100%", padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".85rem", boxSizing:"border-box" }}/>
              </div>
              <div>
                <label style={{ fontSize:".75rem", fontWeight:700, color:"#374151", display:"block", marginBottom:".3rem" }}>Reason (required — shown to client)</label>
                <input value={overrideNote} onChange={e=>setOverrideNote(e.target.value)} placeholder="e.g. Bonus credits for onboarding"
                  style={{ width:"100%", padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".85rem", boxSizing:"border-box" }}/>
              </div>
              <div style={{ display:"flex", gap:".75rem", marginTop:".25rem" }}>
                <button onClick={()=>setOverrideTarget(null)} style={{ flex:1, padding:".65rem", borderRadius:".5rem", border:"1px solid #e2e8f0", background:"white", fontWeight:600, cursor:"pointer" }}>Cancel</button>
                <button onClick={submitOverride} disabled={overriding||!overrideNote.trim()||!overrideAmt}
                  style={{ flex:2, padding:".65rem", borderRadius:".5rem", border:"none", background: overriding||!overrideNote.trim()?"#e2e8f0":"linear-gradient(135deg,#6366f1,#8929bd)", color: overriding||!overrideNote.trim()?"#94a3b8":"white", fontWeight:800, cursor: overriding?"not-allowed":"pointer" }}>
                  {overriding?"Applying…":"Apply Override"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PR Preview Modal — formatted, inline-editable, 3-button approval */}
      {previewOrder && (
        <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,.6)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1.5rem" }}>
          <div style={{ background:"white", borderRadius:"1rem", width:"100%", maxWidth:780, maxHeight:"90vh", display:"flex", flexDirection:"column", boxShadow:"0 32px 80px rgba(0,0,0,.4)" }}>
            {/* Header */}
            <div style={{ padding:"1rem 1.5rem", borderBottom:"1px solid #f1f5f9", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:"1rem", color:"#1e293b" }}>{previewOrder.pr_title}</div>
                <div style={{ fontSize:".75rem", color:"#94a3b8", marginTop:".15rem" }}>
                  <span style={{ background: previewOrder.product_name?.toLowerCase()==="premium"?"#fef3c7":previewOrder.product_name?.toLowerCase()==="standard"?"#f5f3ff":"#eef2ff", color: previewOrder.product_name?.toLowerCase()==="premium"?"#92400e":previewOrder.product_name?.toLowerCase()==="standard"?"#6b21a8":"#3730a3", fontWeight:700, fontSize:".68rem", padding:".15rem .5rem", borderRadius:"99px", marginRight:".5rem", textTransform:"uppercase" }}>{previewOrder.product_name}</span>
                  {previewOrder.company_name} · {new Date(previewOrder.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:".5rem" }}>
                <span style={{ fontSize:".72rem", color:"#6366f1", fontWeight:600 }}>✏️ Click content to edit</span>
                <button onClick={()=>{ setPreviewOrder(null); setEditedContent(""); setOriginalContent(""); }}
                  style={{ background:"none", border:"none", fontSize:"1.2rem", cursor:"pointer", color:"#94a3b8", lineHeight:1 }}>✕</button>
              </div>
            </div>

            {/* Editable PR content — toolbar pinned, content scrolls */}
            <div style={{ flex:1, display:"flex", flexDirection:"column", minHeight:0 }}>
              {/* Toolbar row — always visible, never scrolls away */}
              <div style={{ padding:".5rem 1.25rem", background:"#f8fafc", borderBottom:"1px solid #e2e8f0", flexShrink:0 }}>
                <RichToolbar editorRef={adminEditorRef} />
              </div>
              {/* Scrollable PR text */}
              <div style={{ flex:1, overflowY:"auto", padding:"1.5rem 2rem" }}>
                <style>{`
                  .admin-pr-preview { font-family: Georgia, 'Times New Roman', serif; color: #1e293b; line-height: 1.7; }
                  .admin-pr-preview h1 { font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0 0 1rem; line-height: 1.25; font-family: system-ui, sans-serif; }
                  .admin-pr-preview h2 { font-size: 1.05rem; font-weight: 700; color: #374151; margin: 1.5rem 0 .5rem; font-family: system-ui, sans-serif; border-bottom: 1px solid #f1f5f9; padding-bottom: .3rem; }
                  .admin-pr-preview p { margin: 0 0 1rem; font-size: .93rem; }
                  .admin-pr-preview strong { font-weight: 700; color: #1e293b; }
                  .admin-pr-preview em { font-style: italic; color: #374151; }
                  .admin-pr-preview a { color: #6366f1; }
                  [contenteditable] ul { list-style-type:disc !important; margin:0 0 .85rem; padding-left:1.5rem; }
                  [contenteditable] ol { list-style-type:decimal !important; margin:0 0 .85rem; padding-left:1.5rem; }
                  [contenteditable] li { display:list-item !important; margin-bottom:.25rem; }
                `}</style>
                <div
                  ref={adminEditorRef}
                  className="admin-pr-preview"
                  contentEditable
                  suppressContentEditableWarning
                  onFocus={() => { isAdminTypingRef.current = true; }}
                  onBlur={() => { isAdminTypingRef.current = false; setEditedContent(adminEditorRef.current?.innerHTML || ""); }}
                  onInput={() => setEditedContent(adminEditorRef.current?.innerHTML || "")}
                  style={{ outline:"none", minHeight:"240px" }}
                />
              </div>
            </div>

            {/* 3-button footer */}
            <div style={{ padding:"1rem 1.5rem", borderTop:"1px solid #f1f5f9", display:"flex", gap:".65rem", justifyContent:"flex-end", flexShrink:0, flexWrap:"wrap" }}>
              <button onClick={()=>rejectOrder(previewOrder.id)}
                style={{ padding:".6rem 1.1rem", borderRadius:".45rem", border:"none", background:"#fee2e2", color:"#991b1b", fontWeight:700, fontSize:".83rem", cursor:"pointer" }}>
                ✕ Reject
              </button>
              <button onClick={async()=>{
                  if(!session)return;
                  const changed = editedContent && editedContent !== originalContent;
                  if(!changed){ approveOrder(previewOrder.id); setPreviewOrder(null); setEditedContent(""); setOriginalContent(""); return; }
                  const d = await adminPost("approve_with_changes",{ order_id:previewOrder.id, original_content:originalContent, new_content:editedContent, location_id:previewOrder.location_id }, session.access_token);
                  if(!d.error){ showToast("Approved with changes — client notified ✓"); setPreviewOrder(null); setEditedContent(""); setOriginalContent(""); load("queue"); }
                  else showToast(d.error,"error");
                }}
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
        <div style={{ position:"fixed", bottom:"1.5rem", right:"1.5rem", zIndex:10001,
          background: toast.type==="error"?"#991b1b":"#166534", color:"white",
          borderRadius:".65rem", padding:".85rem 1.25rem", fontSize:".85rem", fontWeight:600,
          boxShadow:"0 8px 24px rgba(0,0,0,.25)" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
