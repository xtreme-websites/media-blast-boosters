import { useMemo } from "react";
import { CompanyData, Order, ServicePage, LocationPage } from "../../lib/constants";

interface Props {
  companyData: CompanyData;
  orders: Order[];
  onExecute: (payload: ExecutePayload) => void;
  onNavigateToCompanyProfile: () => void;
}

export interface ExecutePayload {
  mediaType: "authority";
  authorityFocus: AuthorityFocus;
  packageTier: string;
  strategyMatch: boolean;
}

export interface AuthorityFocus {
  type: "home" | "service" | "location";
  url: string;
  name: string;
  keyword: string;
  seoFocus: string;
}

// Count PRs for a given seo_focus prefix
function countPRs(orders: Order[], type: string, url?: string): number {
  return orders.filter(o => {
    if (!o.seoFocus) return false;
    if (type === "home") return o.seoFocus.startsWith("home:");
    if (url) return o.seoFocus.includes(url);
    return false;
  }).length;
}

const GOLD  = "#c9a84c";
const GOLD2 = "#f0c040";

const Badge = ({ label, color, bg }: { label: string; color: string; bg: string }) => (
  <span style={{ fontSize:".65rem", fontWeight:800, letterSpacing:".06em", textTransform:"uppercase", color, background:bg, padding:".15rem .55rem", borderRadius:"99px", border:`1px solid ${color}40` }}>{label}</span>
);

const ProgressBar = ({ steps, current }: { steps: string[]; current: number }) => (
  <div style={{ display:"flex", gap:".25rem", alignItems:"center", marginTop:".5rem" }}>
    {steps.map((label, i) => {
      const done = i < current;
      const active = i === current;
      return (
        <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", flex:1 }}>
          <div style={{ width:"100%", height:4, borderRadius:2, background: done ? GOLD : active ? `${GOLD}60` : "#e2e8f0", transition:"background .4s" }}/>
          <span style={{ fontSize:".6rem", color: done ? GOLD : "#94a3b8", fontWeight: done ? 700 : 400, marginTop:".2rem", textAlign:"center" }}>{label}</span>
        </div>
      );
    })}
  </div>
);

export default function AuthorityBuilder({ companyData, orders, onExecute, onNavigateToCompanyProfile }: Props) {
  const services  = companyData.servicePages  || [];
  const locations = companyData.locationPages || [];
  const websiteUrl = companyData.websiteUrl || "";

  const homePRs    = countPRs(orders, "home");
  const servicePRs = useMemo(() => services.map(s => ({ ...s, prs: countPRs(orders, "service", s.url) })), [orders, services]);
  const locationPRs = useMemo(() => locations.map(l => ({ ...l, prs: countPRs(orders, "location", l.url) })), [orders, locations]);

  // ── Stage gates ──────────────────────────────────────────────────────────────
  if (services.length === 0) return (
    <div>
      <PageHeader/>
      <div className="card" style={{ padding:"3rem", textAlign:"center" }}>
        <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>🏗️</div>
        <h3 style={{ fontWeight:800, fontSize:"1.2rem", color:"#1e293b", margin:"0 0 .5rem" }}>Foundation Missing</h3>
        <p style={{ color:"#64748b", fontSize:".88rem", maxWidth:420, margin:"0 auto 1.5rem", lineHeight:1.6 }}>
          Your Authority roadmap needs a foundation. Add your core service pages to the Company Profile first — these become the pillars of your entire PR strategy.
        </p>
        <button onClick={onNavigateToCompanyProfile} style={{ background:"linear-gradient(135deg,#6366f1,#8929bd)", color:"white", border:"none", borderRadius:".6rem", padding:".75rem 1.5rem", fontWeight:700, fontSize:".9rem", cursor:"pointer" }}>
          Add Services in Company Profile →
        </button>
      </div>
    </div>
  );

  // ── Next Best Move logic ─────────────────────────────────────────────────────
  const nextMove: { type:"home"|"service"|"location"; label:string; detail:string; tier:string; focus: AuthorityFocus } | null = useMemo(() => {
    // Priority 1: Homepage with 0 PRs
    if (homePRs === 0) return {
      type: "home", tier: "Premium", label: "Anchor Your Brand",
      detail: `Launch a Premium PR for your main domain to establish global entity authority — this acts as a multiplier for every other page you target.`,
      focus: { type:"home", url: websiteUrl, name: companyData.name || "Your Brand", keyword: companyData.name?.toLowerCase() || "", seoFocus: `home:${companyData.name?.toLowerCase() || "brand"}` },
    };
    // Priority 2: Service with 0 PRs
    const unserved = servicePRs.find(s => s.prs === 0);
    if (unserved) return {
      type: "service", tier: "Standard", label: "Establish Core Authority",
      detail: `Launch a Standard PR for "${unserved.name}" to build foundational topical authority for this service page.`,
      focus: { type:"service", url: unserved.url, name: unserved.name, keyword: (unserved.keywords||[])[0] || unserved.name.toLowerCase(), seoFocus: `service:${unserved.url}:${(unserved.keywords||[])[0] || unserved.name.toLowerCase()}` },
    };
    // Priority 3: Location with 0 PRs
    const unloc = locationPRs.find(l => l.prs === 0);
    if (unloc) return {
      type: "location", tier: "Starter", label: "Expand Local Reach",
      detail: `Secure "${unloc.name}" with a Starter PR to dominate local search in that market.`,
      focus: { type:"location", url: unloc.url, name: unloc.name, keyword: (unloc.keywords||[])[0] || unloc.name.toLowerCase(), seoFocus: `location:${unloc.url}:${(unloc.keywords||[])[0] || unloc.name.toLowerCase()}` },
    };
    return null;
  }, [homePRs, servicePRs, locationPRs]);

  // ── Ratio progress ───────────────────────────────────────────────────────────
  const brandDone    = homePRs >= 1;
  const servicesDone = servicePRs.filter(s => s.prs >= 1).length;
  const locationsDone = locationPRs.filter(l => l.prs >= 1).length;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1.5rem" }}>
      <PageHeader/>

      {/* Stage 2 banner */}
      {services.length > 0 && services.length <= 3 && (
        <div style={{ background:"linear-gradient(135deg,#fffbeb,#fef3c7)", border:"1px solid #f59e0b", borderRadius:".75rem", padding:"1rem 1.25rem", display:"flex", gap:".75rem", alignItems:"flex-start" }}>
          <span style={{ fontSize:"1.3rem" }}>📈</span>
          <div>
            <div style={{ fontWeight:700, color:"#92400e", marginBottom:".2rem" }}>Expand Your Media Surface Area</div>
            <p style={{ color:"#78350f", fontSize:".83rem", margin:0, lineHeight:1.5 }}>
              You're off to a great start, but with only {services.length} service page{services.length > 1 ? "s" : ""} your SEO footprint is small. Add more service pages to your Company Profile to unlock higher authority and unlock the full 1:3:12 strategy.
            </p>
          </div>
        </div>
      )}

      {/* 1:3:12 Ratio tracker */}
      <div className="card" style={{ padding:"1.25rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:".75rem", marginBottom:"1rem" }}>
          <span style={{ fontSize:"1.1rem" }}>⚡</span>
          <h3 style={{ fontWeight:800, fontSize:".95rem", color:"#1e293b", margin:0 }}>1:3:12 Authority Ratio</h3>
          <Badge label="Strategy" color={GOLD} bg="#fffbeb"/>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:".75rem" }}>
          {[
            { label:"Brand PR", target:1, done: Math.min(homePRs, 1), color:"#8929bd", icon:"🌐", desc:"Homepage — entity anchor" },
            { label:"Service PRs", target:3, done: Math.min(servicesDone, 3), color:"#6366f1", icon:"🔧", desc:"Core topical authority" },
            { label:"Location PRs", target:12, done: Math.min(locationsDone, 12), color:"#0ea5e9", icon:"📍", desc:"Local SEO dominance" },
          ].map(r => {
            const pct = Math.round((r.done / r.target) * 100);
            const complete = r.done >= r.target;
            return (
              <div key={r.label} style={{ background: complete ? `${r.color}08` : "#f8fafc", border:`1px solid ${complete ? r.color+"40" : "#f1f5f9"}`, borderRadius:".6rem", padding:".85rem" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:".4rem" }}>
                  <span style={{ fontSize:"1rem" }}>{r.icon}</span>
                  {complete && <span style={{ fontSize:".65rem", fontWeight:800, color:GOLD, background:"#fffbeb", padding:".1rem .45rem", borderRadius:"99px" }}>✓ Done</span>}
                </div>
                <div style={{ fontWeight:700, fontSize:".82rem", color:"#1e293b" }}>{r.label}</div>
                <div style={{ fontSize:".7rem", color:"#64748b", marginBottom:".5rem" }}>{r.desc}</div>
                <div style={{ background:"#e2e8f0", borderRadius:2, height:6, overflow:"hidden" }}>
                  <div style={{ width:`${pct}%`, height:"100%", background:`linear-gradient(90deg,${r.color},${r.color}cc)`, borderRadius:2, transition:"width .6s ease" }}/>
                </div>
                <div style={{ fontSize:".7rem", color:r.color, fontWeight:700, marginTop:".3rem" }}>{r.done} / {r.target}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Next Best Move */}
      {nextMove && (
        <div style={{ background:"linear-gradient(135deg,#1e1b4b,#312e81)", borderRadius:"1rem", padding:"1.5rem", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:-20, right:-20, width:120, height:120, borderRadius:"50%", background:"rgba(255,255,255,.03)" }}/>
          <div style={{ position:"absolute", bottom:-30, left:-10, width:80, height:80, borderRadius:"50%", background:"rgba(255,255,255,.02)" }}/>
          <div style={{ display:"flex", alignItems:"center", gap:".6rem", marginBottom:".75rem" }}>
            <span style={{ fontSize:".7rem", fontWeight:800, letterSpacing:".1em", color:"#a5b4fc", textTransform:"uppercase" }}>⚡ Next Best Move</span>
            <span style={{ fontSize:".65rem", fontWeight:800, color:GOLD, background:"rgba(201,168,76,.15)", padding:".15rem .55rem", borderRadius:"99px", border:`1px solid ${GOLD}40` }}>AI Recommended</span>
          </div>
          <h3 style={{ fontWeight:900, fontSize:"1.15rem", color:"white", margin:"0 0 .35rem" }}>{nextMove.label}</h3>
          <p style={{ color:"rgba(255,255,255,.7)", fontSize:".83rem", margin:"0 0 1.25rem", lineHeight:1.6 }}>{nextMove.detail}</p>
          <div style={{ display:"flex", alignItems:"center", gap:".75rem", flexWrap:"wrap" }}>
            <button onClick={() => onExecute({ mediaType:"authority", authorityFocus: nextMove.focus, packageTier: nextMove.tier, strategyMatch: true })}
              style={{ background:`linear-gradient(135deg,${GOLD},${GOLD2})`, color:"#1e1b4b", border:"none", borderRadius:".6rem", padding:".7rem 1.5rem", fontWeight:800, fontSize:".88rem", cursor:"pointer", boxShadow:`0 4px 20px ${GOLD}40` }}>
              ⚡ Execute Now
            </button>
            <div style={{ display:"flex", alignItems:"center", gap:".4rem" }}>
              <span style={{ fontSize:".72rem", color:"rgba(255,255,255,.5)" }}>Recommended tier:</span>
              <span style={{ fontSize:".75rem", fontWeight:700, color:GOLD, background:"rgba(201,168,76,.15)", padding:".15rem .5rem", borderRadius:"99px" }}>{nextMove.tier}</span>
            </div>
          </div>
        </div>
      )}

      {/* Brand Apex */}
      <div className="card" style={{ padding:"1.25rem" }}>
        <div style={{ display:"flex", alignItems:"center", gap:".6rem", marginBottom:"1rem" }}>
          <span style={{ fontSize:"1.1rem" }}>🌐</span>
          <h3 style={{ fontWeight:800, fontSize:".95rem", color:"#1e293b", margin:0 }}>Brand Apex</h3>
          <Badge label="Premium Anchor" color="#8929bd" bg="#f5f3ff"/>
          {homePRs >= 1 && <Badge label="✓ Established" color={GOLD} bg="#fffbeb"/>}
        </div>
        <div style={{ background: homePRs >= 1 ? "#f0fdf4" : "#f8fafc", border:`1px solid ${homePRs >= 1 ? "#bbf7d0" : "#e2e8f0"}`, borderRadius:".75rem", padding:"1rem" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:".75rem" }}>
            <div>
              <div style={{ fontWeight:700, fontSize:".9rem", color:"#1e293b" }}>{companyData.name || "Your Brand"}</div>
              <div style={{ fontSize:".75rem", color:"#64748b", marginTop:".15rem" }}>{websiteUrl || "Add website in Company Profile"}</div>
              <div style={{ fontSize:".72rem", color:"#94a3b8", marginTop:".25rem" }}>Homepage · {homePRs} PR{homePRs !== 1 ? "s" : ""} published · Authority multiplier for all sub-pages</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:".6rem" }}>
              {homePRs >= 1
                ? <span style={{ fontSize:".78rem", fontWeight:700, color:"#16a34a" }}>✓ Anchor established</span>
                : <button onClick={() => onExecute({ mediaType:"authority", authorityFocus:{ type:"home", url:websiteUrl, name:companyData.name||"Brand", keyword:companyData.name?.toLowerCase()||"", seoFocus:`home:${companyData.name?.toLowerCase()||"brand"}` }, packageTier:"Premium", strategyMatch:true })}
                    style={{ background:"linear-gradient(135deg,#8929bd,#4338ca)", color:"white", border:"none", borderRadius:".5rem", padding:".55rem 1rem", fontWeight:700, fontSize:".8rem", cursor:"pointer" }}>
                    Launch Brand PR →
                  </button>
              }
            </div>
          </div>
          {homePRs === 0 && (
            <div style={{ marginTop:".75rem", padding:".6rem .85rem", background:"rgba(137,41,189,.06)", borderRadius:".5rem", fontSize:".75rem", color:"#6d28d9", lineHeight:1.5 }}>
              💡 A Premium PR on your homepage acts as a <strong>domain authority multiplier</strong> — every Service and Location PR you launch after this will rank higher because of it.
            </div>
          )}
        </div>
      </div>

      {/* Service Authority */}
      <div className="card" style={{ padding:"1.25rem" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:".6rem" }}>
            <span style={{ fontSize:"1.1rem" }}>🔧</span>
            <h3 style={{ fontWeight:800, fontSize:".95rem", color:"#1e293b", margin:0 }}>Service Authority</h3>
            <Badge label="Standard PRs" color="#6366f1" bg="#eef2ff"/>
          </div>
          <span style={{ fontSize:".78rem", color:"#64748b" }}>{servicesDone}/{services.length} covered</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:".6rem" }}>
          {servicePRs.map((svc) => (
            <ServiceRow key={svc.url} svc={svc} onExecute={onExecute}/>
          ))}
        </div>
      </div>

      {/* Location Dominance Grid */}
      {locations.length > 0 && (
        <div className="card" style={{ padding:"1.25rem" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:".6rem" }}>
              <span style={{ fontSize:"1.1rem" }}>📍</span>
              <h3 style={{ fontWeight:800, fontSize:".95rem", color:"#1e293b", margin:0 }}>Location Dominance</h3>
              <Badge label="Starter PRs" color="#0ea5e9" bg="#f0f9ff"/>
            </div>
            <span style={{ fontSize:".78rem", color:"#64748b" }}>{locationsDone}/{locations.length} activated</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:".75rem" }}>
            {locationPRs.map((loc) => (
              <LocationCard key={loc.url} loc={loc} onExecute={onExecute}/>
            ))}
          </div>
        </div>
      )}

      {/* Media Blindspot Detector */}
      <BlindspotDetector servicePRs={servicePRs} locationPRs={locationPRs} orders={orders}/>
    </div>
  );
}

// ── Page Header ───────────────────────────────────────────────────────────────
function PageHeader() {
  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:".6rem", marginBottom:".25rem" }}>
        <h2 style={{ fontWeight:800, fontSize:"1.2rem", color:"#1e293b", margin:0 }}>Authority Builder</h2>
        <span style={{ fontSize:".65rem", fontWeight:800, letterSpacing:".08em", textTransform:"uppercase", color:"#8929bd", background:"#f5f3ff", padding:".15rem .55rem", borderRadius:"99px", border:"1px solid #ddd6fe" }}>Strategy Engine</span>
      </div>
      <p style={{ color:"#64748b", fontSize:".83rem", margin:0 }}>Your AI-powered PR roadmap — follow the 1:3:12 ratio to dominate search</p>
    </div>
  );
}

// ── Service Row ───────────────────────────────────────────────────────────────
function ServiceRow({ svc, onExecute }: { svc: ServicePage & { prs: number }; onExecute: (p: ExecutePayload) => void }) {
  const hasPR = svc.prs >= 1;
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:".75rem 1rem", background: hasPR ? "#f0fdf4" : "#f8fafc", border:`1px solid ${hasPR ? "#bbf7d0" : "#e2e8f0"}`, borderRadius:".6rem", gap:".75rem", flexWrap:"wrap" }}>
      <div style={{ minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:".85rem", color:"#1e293b" }}>{svc.name}</div>
        <div style={{ fontSize:".7rem", color:"#94a3b8", marginTop:".1rem" }}>{svc.url}</div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:".6rem", flexShrink:0 }}>
        {hasPR
          ? <span style={{ fontSize:".75rem", fontWeight:700, color:"#16a34a", display:"flex", alignItems:"center", gap:".3rem" }}>✓ {svc.prs} PR{svc.prs>1?"s":""}</span>
          : <button onClick={() => onExecute({ mediaType:"authority", authorityFocus:{ type:"service", url:svc.url, name:svc.name, keyword:(svc.keywords||[])[0]||svc.name.toLowerCase(), seoFocus:`service:${svc.url}:${(svc.keywords||[])[0]||svc.name.toLowerCase()}` }, packageTier:"Standard", strategyMatch:true })}
              style={{ background:"#6366f1", color:"white", border:"none", borderRadius:".4rem", padding:".35rem .75rem", fontWeight:700, fontSize:".75rem", cursor:"pointer", whiteSpace:"nowrap" }}>
              Launch PR →
            </button>
        }
      </div>
    </div>
  );
}

// ── Location Card ─────────────────────────────────────────────────────────────
const DOMINANCE_STEPS = ["Presence", "Authority", "Dominance"];

function LocationCard({ loc, onExecute }: { loc: LocationPage & { prs: number }; onExecute: (p: ExecutePayload) => void }) {
  const step = Math.min(loc.prs, 3);
  const isDominant = step >= 3;

  return (
    <div style={{ border:`1.5px solid ${isDominant ? GOLD : "#e2e8f0"}`, borderRadius:".75rem", padding:"1rem", background: isDominant ? "linear-gradient(135deg,#fffbeb,#fef9ec)" : "white", position:"relative", overflow:"hidden", transition:"all .3s" }}>
      {isDominant && (
        <>
          <style>{`@keyframes goldPulse{0%,100%{box-shadow:0 0 0 0 rgba(201,168,76,.4)}50%{box-shadow:0 0 0 8px rgba(201,168,76,0)}}`}</style>
          <div style={{ animation:"goldPulse 2s ease-in-out infinite", position:"absolute", inset:0, borderRadius:".75rem", pointerEvents:"none" }}/>
          <div style={{ position:"absolute", top:6, right:6, fontSize:".65rem", fontWeight:800, color:"#92400e", background:`linear-gradient(135deg,${GOLD},${GOLD2})`, padding:".2rem .55rem", borderRadius:"99px" }}>
            👑 Market Leader
          </div>
        </>
      )}
      <div style={{ fontWeight:700, fontSize:".85rem", color:"#1e293b", marginBottom:".2rem", paddingRight: isDominant ? "5rem" : 0 }}>{loc.name}</div>
      <div style={{ fontSize:".68rem", color:"#94a3b8", marginBottom:".75rem" }}>{loc.prs} PR{loc.prs !== 1 ? "s" : ""} launched</div>
      <ProgressBar steps={DOMINANCE_STEPS} current={step}/>
      {step < 3 && (
        <button onClick={() => onExecute({ mediaType:"authority", authorityFocus:{ type:"location", url:loc.url, name:loc.name, keyword:(loc.keywords||[])[0]||loc.name.toLowerCase(), seoFocus:`location:${loc.url}:${(loc.keywords||[])[0]||loc.name.toLowerCase()}` }, packageTier:"Starter", strategyMatch:true })}
          style={{ width:"100%", marginTop:".75rem", padding:".45rem", borderRadius:".45rem", border:"1px solid #e2e8f0", background:"white", color:"#6366f1", fontWeight:700, fontSize:".75rem", cursor:"pointer" }}>
          {step === 0 ? "Activate →" : step === 1 ? "Build Authority →" : "Achieve Dominance →"}
        </button>
      )}
    </div>
  );
}

// ── Blindspot Detector ────────────────────────────────────────────────────────
function BlindspotDetector({ servicePRs, locationPRs, orders }: { servicePRs: (ServicePage & {prs:number})[]; locationPRs: (LocationPage & {prs:number})[]; orders: Order[] }) {
  const blindspots = useMemo(() => {
    const spots: { service: string; location: string; locationUrl: string; keyword: string; seoFocus: string }[] = [];
    for (const svc of servicePRs) {
      if (svc.prs === 0) continue; // service itself not covered yet — not a blindspot yet
      for (const loc of locationPRs) {
        // Check if this specific service+location combo has a PR
        const covered = orders.some(o => o.seoFocus?.includes(loc.url) && o.prTitle?.toLowerCase().includes(svc.name.toLowerCase().split(" ")[0]));
        if (!covered) {
          spots.push({ service: svc.name, location: loc.name, locationUrl: loc.url, keyword: (loc.keywords||[])[0]||loc.name.toLowerCase(), seoFocus: `location:${loc.url}:${(loc.keywords||[])[0]||loc.name.toLowerCase()}` });
        }
      }
    }
    return spots.slice(0, 6);
  }, [servicePRs, locationPRs, orders]);

  if (blindspots.length === 0) return null;

  return (
    <div className="card" style={{ padding:"1.25rem" }}>
      <div style={{ display:"flex", alignItems:"center", gap:".6rem", marginBottom:"1rem" }}>
        <span style={{ fontSize:"1.1rem" }}>⚠️</span>
        <h3 style={{ fontWeight:800, fontSize:".95rem", color:"#1e293b", margin:0 }}>Media Blindspots</h3>
        <span style={{ fontSize:".65rem", fontWeight:800, color:"#dc2626", background:"#fef2f2", padding:".15rem .55rem", borderRadius:"99px", border:"1px solid #fecaca" }}>{blindspots.length} detected</span>
      </div>
      <p style={{ color:"#64748b", fontSize:".8rem", margin:"0 0 .85rem" }}>These service + location combos have no PR coverage — competitors may be capturing this search traffic.</p>
      <div style={{ display:"flex", flexDirection:"column", gap:".5rem" }}>
        {blindspots.map((b, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:".65rem .9rem", background:"#fff7f7", border:"1px solid #fecaca", borderRadius:".5rem", flexWrap:"wrap", gap:".5rem" }}>
            <div style={{ fontSize:".8rem", color:"#374151" }}>
              <span style={{ fontWeight:700, color:"#dc2626" }}>{b.location}</span>
              <span style={{ color:"#94a3b8", margin:"0 .35rem" }}>·</span>
              <span>{b.service}</span>
              <span style={{ color:"#94a3b8", margin:"0 .35rem" }}>·</span>
              <span style={{ color:"#ef4444", fontSize:".72rem" }}>0 PRs</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
