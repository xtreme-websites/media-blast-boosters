import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Order } from "../../lib/constants";
import { store } from "../../lib/ai";
import { CheckIcon, CopyIcon, XIcon, SparklesIcon, SearchIcon, LoaderIcon, AlertIcon, ShieldIcon } from "../icons";
import { LEFT_LAUREL_D, RIGHT_LAUREL_D, LEFT_LAUREL_TRANSFORM, RIGHT_LAUREL_TRANSFORM } from "../../lib/laurelPaths";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tier   = "starter" | "standard" | "premium";
type Layout = "horizontal" | "slider";

interface BadgeConfig {
  id: string; name: string; layout: Layout;
  logoColor: string; bgColor: string;
  showLaurels: boolean; verificationBadge: boolean; outletCounter: boolean;
  sliderSpeed: number;
}

interface TrustAssetsProps {
  orders: Order[]; locationId: string; showToast: (msg: string, type?: "success" | "error") => void;
  credits?: { starter_credits: number; standard_credits: number; premium_credits: number };
  isDevAccess?: boolean;
  hasCompanyData?: boolean;
  onNavigateToCompanyProfile?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const VERIFICATION_URL = "https://xtremewebsites.com/press-release-marketing/";
const OUTLET_COUNT: Record<Tier, string> = { starter: "200+", standard: "300+", premium: "450+" };
const LAYOUTS: { id: Layout; label: string }[] = [
  { id: "horizontal", label: "Horizontal" },
  { id: "slider",     label: "Slider"     },
];
interface LogoDef { id: string; label: string; font: string; size: string; weight: string; spacing?: string; lh?: string; fStyle?: string }

const LOGOS: Record<Tier, LogoDef[]> = {
  starter: [
    { id: "gnews",     label: "Google News",            font: "Arial,sans-serif", size: "11px", weight: "500" },
    { id: "chronicle", label: "The Chronicle\nJournal", font: "Georgia,serif",    size: "12px", weight: "700", lh: "1.15" },
    { id: "minyan",    label: "MINYANVILLE",            font: "Arial,sans-serif", size: "11px", weight: "700", spacing: "2px" },
  ],
  standard: [
    { id: "gnews",     label: "Google News",            font: "Arial,sans-serif", size: "10px", weight: "500" },
    { id: "chronicle", label: "The Chronicle\nJournal", font: "Georgia,serif",    size: "11px", weight: "700", lh: "1.15" },
    { id: "minyan",    label: "MINYANVILLE",            font: "Arial,sans-serif", size: "10px", weight: "700", spacing: "1.5px" },
    { id: "fox",       label: "FOX",                    font: "Arial,sans-serif", size: "18px", weight: "900", spacing: "1px" },
    { id: "benzinga",  label: "BENZINGA",               font: "Arial,sans-serif", size: "12px", weight: "900", spacing: "1px" },
  ],
  premium: [
    { id: "gnews",     label: "Google News",            font: "Arial,sans-serif", size: "9px",  weight: "500" },
    { id: "chronicle", label: "The Chronicle\nJournal", font: "Georgia,serif",    size: "10px", weight: "700", lh: "1.15" },
    { id: "minyan",    label: "MINYANVILLE",            font: "Arial,sans-serif", size: "9px",  weight: "700", spacing: "1.5px" },
    { id: "fox",       label: "FOX",                    font: "Arial,sans-serif", size: "18px", weight: "900", spacing: "1px" },
    { id: "benzinga",  label: "BENZINGA",               font: "Arial,sans-serif", size: "11px", weight: "900", spacing: "1px" },
    { id: "bi",        label: "Business Insider",       font: "Arial,sans-serif", size: "10px", weight: "700" },
    { id: "ap",        label: "AP",                     font: "Arial,sans-serif", size: "16px", weight: "900", spacing: "3px" },
  ],
};

const EMPTY_CONFIG: Omit<BadgeConfig, "id" | "name"> = {
  layout: "horizontal", logoColor: "#111111", bgColor: "#ffffff",
  showLaurels: true, verificationBadge: true, outletCounter: true, sliderSpeed: 35,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Laurel = ({ side, lc = "#d1d5db" }: { side: "left" | "right"; lc?: string }) => (
  <svg version="1.1" xmlns="http://www.w3.org/2000/svg"
    width="52" viewBox="0 0 191 385"
    style={{ flexShrink: 0, opacity: 0.85, height: "auto" }}>
    <path
      d={side === "right" ? RIGHT_LAUREL_D : LEFT_LAUREL_D}
      fill={lc}
      transform={side === "right" ? RIGHT_LAUREL_TRANSFORM : LEFT_LAUREL_TRANSFORM}
    />
  </svg>
);


function LogoEl({ logo, color, scale = 1 }: { logo: LogoDef; color: string; scale?: number }) {
  const parts = logo.label.split("\n");
  return (
    <span style={{ fontFamily: logo.font, fontSize: `calc(${logo.size} * ${scale})`, fontWeight: logo.weight, color, letterSpacing: logo.spacing ?? "normal", lineHeight: logo.lh ?? "1.2", fontStyle: logo.fStyle ?? "normal", textAlign: "center", display: "inline-block", whiteSpace: "nowrap" }}>
      {parts.map((p, i) => <span key={i}>{p}{i < parts.length - 1 && <br/>}</span>)}
    </span>
  );
}

function ColorPicker({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const defaults = ["#111111", "#888888", "#ffffff"];
  return (
    <div>
      <div style={{ fontSize: ".72rem", color: "#64748b", marginBottom: ".35rem" }}>{label}</div>
      <div style={{ display: "flex", gap: ".35rem", alignItems: "center" }}>
        {defaults.map(c => (
          <button key={c} onClick={() => onChange(c)} style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: value === c ? "2.5px solid #534AB7" : "0.5px solid #d1d5db", cursor: "pointer", outline: value === c ? "2px solid #a5b4fc" : "none", outlineOffset: "1px", transition: "all .12s", flexShrink: 0 }}/>
        ))}
        <label title="Custom color" style={{ width: 22, height: 22, borderRadius: "50%", border: "0.5px solid #d1d5db", overflow: "hidden", cursor: "pointer", flexShrink: 0, position: "relative", display: "block" }}>
          <input type="color" value={value.length === 7 ? value : "#111111"} onChange={e => onChange(e.target.value)} style={{ position: "absolute", inset: "-4px", width: "calc(100% + 8px)", height: "calc(100% + 8px)", border: "none", cursor: "pointer", padding: 0 }}/>
        </label>
        <input type="text" value={value} onChange={e => { const v = e.target.value; if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v); }} style={{ width: 68, fontSize: ".72rem", fontFamily: "monospace", padding: ".2rem .35rem", border: "0.5px solid #e2e8f0", borderRadius: ".3rem", color: "#374151", background: "white", outline: "none" }}/>
      </div>
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{ width: 36, height: 20, borderRadius: 99, border: "none", cursor: "pointer", background: on ? "#534AB7" : "#cbd5e1", position: "relative", flexShrink: 0, transition: "background .2s" }}>
      <span style={{ position: "absolute", top: 3, width: 14, height: 14, borderRadius: "50%", background: "white", transition: "left .2s", left: on ? "19px" : "3px" }}/>
    </button>
  );
}

// ─── Color helper ─────────────────────────────────────────────────────────────
function hexToRgba(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return `rgba(156,163,175,${alpha})`;
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Badge preview ────────────────────────────────────────────────────────────
function BadgePreview({ config, logos, tier, scale = 1 }: { config: BadgeConfig; logos: LogoDef[]; tier: Tier; scale?: number }) {
  const lc     = config.logoColor;
  const bg     = config.bgColor;
  const lineC  = hexToRgba(lc, 0.18);
  const textC  = hexToRgba(lc, 0.52);
  const leafC  = hexToRgba(lc, 0.22);
  const isSlider = config.layout === "slider";
  const animId   = `mbb-marquee-${config.id.slice(0,8)}`;

  return (
    <div style={{ background: bg, borderRadius: "6px", padding: `${12*scale}px ${isSlider ? 0 : 8*scale}px`, width: "100%", overflow: "hidden" }}>
      {isSlider && (
        <style>{`@keyframes ${animId} { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }`}</style>
      )}

      {/* AS SEEN ON */}
      <div style={{ display: "flex", alignItems: "center", gap: `${8*scale}px`, marginBottom: `${8*scale}px`, padding: isSlider ? `0 ${12*scale}px` : "0" }}>
        <div style={{ flex: 1, height: "0.5px", background: lineC }}/>
        <span style={{ fontFamily: "Arial,sans-serif", fontSize: `${10*scale}px`, letterSpacing: ".22em", color: textC, fontWeight: 600, whiteSpace: "nowrap" }}>AS SEEN ON</span>
        <div style={{ flex: 1, height: "0.5px", background: lineC }}/>
      </div>

      {/* Logos */}
      {isSlider ? (
        <div style={{ overflow: "hidden", WebkitMaskImage: "linear-gradient(to right,transparent,black 10%,black 90%,transparent)", maskImage: "linear-gradient(to right,transparent,black 10%,black 90%,transparent)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: `${40*scale}px`, animationName: animId, animationDuration: `${config.sliderSpeed}s`, animationTimingFunction: "linear", animationIterationCount: "infinite", width: "max-content", padding: `${4*scale}px 0` }}>
            {Array(6).fill(null).flatMap(() => logos).map((l, i) => <LogoEl key={i} logo={l} color={lc} scale={scale}/>)}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          {config.showLaurels && <div style={{ marginRight: `${30*scale}px`, flexShrink: 0 }}><Laurel side="left" lc={leafC}/></div>}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: `${14*scale}px`, flexWrap: "wrap" }}>
            {logos.map(l => <LogoEl key={l.id} logo={l} color={lc} scale={scale}/>)}
          </div>
          {config.showLaurels && <div style={{ marginLeft: `${30*scale}px`, flexShrink: 0 }}><Laurel side="right" lc={leafC}/></div>}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: `${2*scale}px`, marginTop: `${8*scale}px`, padding: isSlider ? `0 ${12*scale}px` : "0" }}>
        {config.outletCounter && (
          <span style={{ fontFamily: "Arial,sans-serif", fontSize: `${9*scale}px`, letterSpacing: ".18em", color: textC, fontWeight: 500 }}>AND OVER {OUTLET_COUNT[tier]} NEWS SITES</span>
        )}
        {config.verificationBadge && (
          <span style={{ fontFamily: "Arial,sans-serif", fontSize: `${8*scale}px`, color: textC, marginTop: `${10*scale}px`, fontWeight: 600, display: "flex", alignItems: "center", gap: `${4*scale}px` }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: `${12*scale}px`, height: `${12*scale}px`, borderRadius: "50%", border: `${0.8}px solid ${textC}`, fontSize: `${7*scale}px`, lineHeight: 1, flexShrink: 0 }}>✓</span>
            Verified by{" "}
            <a href={VERIFICATION_URL} target="_blank" rel="noopener noreferrer" style={{ color: textC, textDecoration: "none", fontWeight: 600 }}>Media Blast Boosters™</a>
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Embed HTML generator ─────────────────────────────────────────────────────
function generateEmbedHTML(config: BadgeConfig, logos: LogoDef[], tier: Tier): string {
  const lc    = config.logoColor;
  const bg    = config.bgColor;
  const lineC = hexToRgba(lc, 0.18);
  const textC = hexToRgba(lc, 0.52);
  const isSlider = config.layout === "slider";
  const animId   = `mbb-scroll-${config.id.slice(0,8)}`;

  const BASE = "https://mediablast.xlogic.app";
  const logoEl = (l: LogoDef) => `<span style="font-family:${l.font};font-size:${l.size};font-weight:${l.weight};color:${lc};letter-spacing:${l.spacing??"normal"};line-height:${l.lh??"1.2"};font-style:${l.fStyle??"normal"};display:inline-block;white-space:nowrap">${l.label.replace("\n","<br>")}</span>`;

  // Use hosted SVG files instead of inlining massive path data
  const laurelImg = (side: "left" | "right") =>
    `<img src="${BASE}/laurel-${side}.svg" width="52" height="104" alt="" style="flex-shrink:0;opacity:0.85">`;

  const header = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><div style="flex:1;height:0.5px;background:${lineC}"></div><span style="font-family:Arial,sans-serif;font-size:10px;letter-spacing:.22em;color:${textC};font-weight:600;white-space:nowrap">AS SEEN ON</span><div style="flex:1;height:0.5px;background:${lineC}"></div></div>`;
  const counter = config.outletCounter ? `<span style="font-family:Arial,sans-serif;font-size:9px;letter-spacing:.18em;color:${textC};font-weight:500">AND OVER ${OUTLET_COUNT[tier]} NEWS SITES</span>` : "";
  const verif   = config.verificationBadge ? `<span style="font-family:Arial,sans-serif;font-size:8px;color:${textC};margin-top:10px;display:flex;align-items:center;gap:4px;font-weight:600"><span style="display:inline-flex;align-items:center;justify-content:center;width:12px;height:12px;border-radius:50%;border:0.8px solid ${textC};font-size:7px;line-height:1;flex-shrink:0">&#10003;</span>Verified by <a href="${VERIFICATION_URL}" target="_blank" rel="noopener noreferrer" style="color:${textC};text-decoration:none;font-weight:600">Media Blast Boosters&#8482;</a></span>` : "";
  const footer  = `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;margin-top:8px">${counter}${verif}</div>`;
  const logosHTML = logos.map(logoEl).join("");

  if (isSlider) {
    const loopLogos = Array(6).fill(null).flatMap(() => logos).map(logoEl).join("");
    return `<style>@keyframes ${animId}{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}</style><div style="background:${bg};border-radius:6px;padding:12px 0;overflow:hidden">${header}<div style="overflow:hidden;-webkit-mask-image:linear-gradient(to right,transparent,black 10%,black 90%,transparent);mask-image:linear-gradient(to right,transparent,black 10%,black 90%,transparent)"><div style="display:flex;align-items:center;gap:40px;animation:${animId} ${config.sliderSpeed}s linear infinite;width:max-content;padding:4px 0">${loopLogos}</div></div>${footer}</div>`;
  }
  const logoRow = `<div style="display:flex;justify-content:center;align-items:center">${config.showLaurels ? `<div style="margin-right:30px;flex-shrink:0">${laurelImg("left")}</div>` : ""}<div style="display:flex;justify-content:center;align-items:center;gap:14px;flex-wrap:wrap">${logosHTML}</div>${config.showLaurels ? `<div style="margin-left:30px;flex-shrink:0">${laurelImg("right")}</div>` : ""}</div>`;
  return `<div style="background:${bg};border-radius:6px;padding:12px 8px">${header}${logoRow}${footer}</div>`;
}

// ─── Mini thumb ───────────────────────────────────────────────────────────────
function MiniThumb({ config, tier }: { config: BadgeConfig; tier: Tier }) {
  const bg = config.bgColor;
  const lc = config.logoColor;
  const tc = "#c0c8d4";
  return (
    <div style={{ background: bg, borderRadius: "4px", padding: "7px 8px", textAlign: "center" }}>
      <div style={{ fontSize: "6px", letterSpacing: ".15em", color: tc, fontFamily: "Arial", fontWeight: 600, marginBottom: "5px" }}>AS SEEN ON</div>
      <div style={{ display: "flex", gap: "5px", justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
        {LOGOS[tier].slice(0, 3).map(l => (
          <span key={l.id} style={{ fontFamily: l.font, fontSize: "5.5px", fontWeight: l.weight, color: lc, whiteSpace: "nowrap" }}>{l.label.split("\n")[0]}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TrustAssets({ orders, locationId, showToast, credits, isDevAccess = false, hasCompanyData = true, onNavigateToCompanyProfile }: TrustAssetsProps) {
  const autoTier: Tier = credits?.premium_credits  ? "premium"
                        : credits?.standard_credits ? "standard"
                        : "starter";
  const [tier, setTier] = useState<Tier>(autoTier);
  const [variations,  setVariations]  = useState<BadgeConfig[]>([]);
  const [activeId,    setActiveId]    = useState<string | null>(null);
  const [showModal,   setShowModal]   = useState(false);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [draft,       setDraft]       = useState<BadgeConfig>({ id: "", name: "", ...EMPTY_CONFIG });
  const [verifyUrl,    setVerifyUrl]    = useState("");
  const [isVerifying,  setIsVerifying]  = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<null | "found" | "not-found" | "error">(null);
  const [verifyReason, setVerifyReason] = useState("");
  const [verifyData,   setVerifyData]   = useState<Record<string,unknown>>({});

  useEffect(() => {
    const rank: Record<string, number> = { Starter: 1, Standard: 2, Premium: 3 };
    const max = orders.reduce((m, o) => Math.max(m, rank[o.productName] ?? 0), 0);
    if (max >= 3) setTier("premium");
    else if (max >= 2) setTier("standard");
  }, [orders]);

  useEffect(() => {
    (async () => {
      try {
        const saved = await store.get(`mbb:variations:${locationId}`);
        if (saved) {
          const v: BadgeConfig[] = JSON.parse(saved);
          setVariations(v); setActiveId(v[0]?.id ?? null);
        } else {
          const def: BadgeConfig = { id: crypto.randomUUID(), name: "Horizontal · light", ...EMPTY_CONFIG };
          setVariations([def]); setActiveId(def.id);
          store.set(`mbb:variations:${locationId}`, JSON.stringify([def]));
        }
      } catch {}
    })();
  }, [locationId]);

  const persist = async (vars: BadgeConfig[]) => {
    setVariations(vars);
    try { await store.set(`mbb:variations:${locationId}`, JSON.stringify(vars)); } catch {}
  };

  const logos  = LOGOS[tier];
  const active = variations.find(v => v.id === activeId) ?? variations[0];

  const openNew  = () => { setDraft({ id: crypto.randomUUID(), name: `Variation ${variations.length + 1}`, ...EMPTY_CONFIG }); setEditingId(null); setShowModal(true); };
  const openEdit = (v: BadgeConfig) => { setDraft({ ...v }); setEditingId(v.id); setShowModal(true); };

  const saveVariation = () => {
    const updated = editingId ? variations.map(v => v.id === editingId ? draft : v) : [...variations, draft];
    persist(updated);
    if (!editingId) setActiveId(draft.id);
    setShowModal(false);
    showToast(editingId ? "Variation updated!" : "Variation saved!");
  };

  const deleteVariation = (id: string) => {
    const updated = variations.filter(v => v.id !== id);
    persist(updated);
    if (activeId === id) setActiveId(updated[0]?.id ?? null);
    showToast("Variation deleted");
  };

  const copyHTML = (cfg: BadgeConfig) => {
    navigator.clipboard.writeText(generateEmbedHTML(cfg, logos, tier));
    showToast("HTML copied!");
  };

  const copyScript = (cfg: BadgeConfig) => {
    const idx = variations.findIndex(v => v.id === cfg.id) + 1;
    const tag = `<!-- Trust Widget: "${cfg.name}" -->\n<script src="https://mediablast.xlogic.app/trust-widget.js?v=${idx}"></script>`;
    navigator.clipboard.writeText(tag);
    showToast(`Script for "${cfg.name}" copied!`);
  };

  const d = (key: keyof BadgeConfig, val: unknown) => setDraft(p => ({ ...p, [key]: val }));

  const runVerify = async () => {
    setIsVerifying(true); setVerifyStatus(null); setVerifyReason("");
    try {
      const res = await fetch("https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/verify-badge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: verifyUrl.trim() }),
      });
      const data = await res.json();
      if (data.found) {
        setVerifyStatus("found");
        setVerifyData(data);
        showToast("Badge verified!");
      } else {
        setVerifyStatus("not-found");
        setVerifyReason(data.reason || "Badge not found on page.");
      }
    } catch (e: any) {
      setVerifyStatus("error");
      setVerifyReason(e.message || "Request failed.");
    }
    setIsVerifying(false);
  };

  // Empty state for new users without company profile
  const PREVIEW_LOGOS = LOGOS.starter;
  const PREVIEW_CONFIG: BadgeConfig = { id:"preview", name:"As Seen On", ...EMPTY_CONFIG };

  if (!hasCompanyData) return (
    <div>
      {/* Hero card */}
      <div className="card" style={{ padding:"2.5rem 2rem", textAlign:"center", border:"1px solid #e0e7ff", background:"linear-gradient(135deg,#fafaff,#f5f3ff)", marginBottom:"1.5rem" }}>
        <div style={{ fontSize:"3.5rem", marginBottom:"1rem" }}>🛡️</div>
        <h3 style={{ fontWeight:900, fontSize:"1.25rem", color:"#1e293b", margin:"0 0 .6rem" }}>Trust Widget</h3>
        <p style={{ color:"#64748b", fontSize:".88rem", maxWidth:480, margin:"0 auto 1rem", lineHeight:1.65 }}>
          Add a professional "As Seen On" badge to your website showcasing the media outlets that published your press releases. Builds instant credibility and social proof with every site visitor.
        </p>
        <div style={{ display:"flex", gap:"1rem", justifyContent:"center", flexWrap:"wrap", marginBottom:"1.5rem" }}>
          {["📰 200+ Media Outlets","✅ Auto-Updated","💡 Easy Embed"].map(f => (
            <span key={f} style={{ fontSize:".75rem", fontWeight:600, color:"#6366f1", background:"#eef2ff", padding:".3rem .75rem", borderRadius:"99px" }}>{f}</span>
          ))}
        </div>
        <button
          onClick={() => showToast("Please complete your Company Profile first to use the Trust Widget.", "error")}
          style={{ background:"linear-gradient(135deg,#6366f1,#8929bd)", color:"white", border:"none", borderRadius:".65rem", padding:".75rem 2rem", fontWeight:800, fontSize:".9rem", cursor:"pointer", boxShadow:"0 4px 14px rgba(99,102,241,.35)" }}>
          🛡️ Get My Trust Widget
        </button>
        <p style={{ marginTop:".85rem", fontSize:".75rem", color:"#94a3b8" }}>
          Complete your{" "}
          <button onClick={onNavigateToCompanyProfile} style={{ background:"none", border:"none", color:"#6366f1", cursor:"pointer", fontWeight:600, padding:0, fontSize:".75rem", textDecoration:"underline" }}>
            Company Profile
          </button>{" "}
          to get started
        </p>
      </div>
      {/* Live preview so they can see what they'll get */}
      <div style={{ marginBottom:".6rem", fontSize:".78rem", fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:".06em" }}>
        Preview — what your badge will look like
      </div>
      <div className="card" style={{ padding:"1.25rem", overflow:"hidden", opacity:.85 }}>
        <BadgePreview config={PREVIEW_CONFIG} logos={PREVIEW_LOGOS} tier="starter"/>
      </div>
    </div>
  );

  return (
    <div className="animate-fadein">
      {/* Header + tier pills */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.25rem", flexWrap:"wrap", gap:".75rem" }}>
        <div>
          <h2 className="font-display" style={{ fontSize:"1.3rem", fontWeight:700, color:"#0f172a", marginBottom:".2rem" }}>Brand Trust Widgets</h2>
          <p style={{ color:"#64748b", fontSize:".875rem" }}>Embed a professional trust badge on your website</p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:".4rem" }}>
          {isDevAccess && (["starter","standard","premium"] as Tier[]).map(t => (
            <button key={t} onClick={() => setTier(t)} style={{ padding:".3rem .75rem", borderRadius:"99px", fontSize:".75rem", fontWeight:600, border: tier===t ? "1.5px solid #534AB7" : "0.5px solid #e2e8f0", background: tier===t ? "#EEEDFE" : "white", color: tier===t ? "#3C3489" : "#64748b", cursor:"pointer", transition:"all .15s", textTransform:"capitalize" }}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
          {isDevAccess && <span style={{ fontSize:".62rem", color:"#94a3b8", paddingLeft:"2px" }}>admin</span>}
          {!isDevAccess && <span style={{ fontSize:".72rem", fontWeight:600, color:"#534AB7", background:"#EEEDFE", padding:".2rem .65rem", borderRadius:"99px", textTransform:"capitalize" }}>{tier}</span>}
        </div>
      </div>

      {/* Live preview */}
      {active && (
        <div style={{ marginBottom:"1.25rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:".5rem" }}>
            <span style={{ fontSize:".72rem", fontWeight:600, color:"#64748b", letterSpacing:".04em", textTransform:"uppercase" }}>Active badge · {active.name}</span>
            <div style={{ display:"flex", gap:".5rem" }}>
              <button onClick={() => copyScript(active)} className="btn-secondary" style={{ fontSize:".78rem", padding:".4rem .85rem" }}>📋 Copy Script Tag</button>
              <button onClick={() => openEdit(active)} className="btn-primary" style={{ fontSize:".78rem", padding:".4rem .85rem" }}><SparklesIcon size={13}/> Customize</button>
            </div>
          </div>
          <div className="card" style={{ padding:"1rem", overflow:"hidden" }}>
            <BadgePreview config={active} logos={logos} tier={tier}/>
          </div>
        </div>
      )}

      {/* Variations grid */}
      <div className="card" style={{ padding:"1rem 1.25rem", marginBottom:"1.25rem" }}>
        <div style={{ fontSize:".72rem", fontWeight:600, color:"#64748b", letterSpacing:".04em", textTransform:"uppercase", marginBottom:".75rem" }}>
          Saved variations ({variations.length}/3)
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:".6rem" }}>
          {variations.map((v, idx) => (
            <div key={v.id} onClick={() => setActiveId(v.id)} style={{ border: activeId===v.id ? "1.5px solid #534AB7" : "1px solid #e2e8f0", borderRadius:".75rem", padding:".75rem 1rem", cursor:"pointer", background: activeId===v.id ? "#fafafe" : "white", transition:"all .15s", boxShadow: activeId===v.id ? "0 0 0 3px rgba(83,74,183,.08)" : "none", display:"flex", alignItems:"center", gap:".85rem" }}>
              {/* Mini preview */}
              <div style={{ flexShrink:0, width:80 }}>
                <MiniThumb config={v} tier={tier}/>
              </div>
              {/* Name + version */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:".85rem", color: activeId===v.id ? "#3C3489" : "#1e293b", marginBottom:".15rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.name}</div>
                <div style={{ fontSize:".7rem", color:"#94a3b8" }}>Widget v{idx + 1} · {v.layout === "slider" ? "Slider" : "Horizontal"}</div>
              </div>
              {/* Actions */}
              <div style={{ display:"flex", gap:".4rem", flexShrink:0 }} onClick={e => e.stopPropagation()}>
                <button onClick={() => copyScript(v)} title="Copy script tag" style={{ display:"flex", alignItems:"center", gap:".3rem", fontSize:".72rem", color:"#6366f1", background:"#eef2ff", border:"none", borderRadius:".4rem", padding:".35rem .65rem", cursor:"pointer", fontWeight:600, whiteSpace:"nowrap" }}>
                  📋 v{idx + 1}
                </button>
                <button onClick={() => openEdit(v)} title="Edit" style={{ fontSize:".72rem", color:"#475569", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:".4rem", padding:".35rem .65rem", cursor:"pointer", fontWeight:600 }}>
                  Edit
                </button>
                {variations.length > 1 && (
                  <button onClick={() => deleteVariation(v.id)} title="Delete" style={{ fontSize:".72rem", color:"#be123c", background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:".4rem", padding:".35rem .5rem", cursor:"pointer" }}>
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
          {variations.length < 3 && (
            <div onClick={openNew} style={{ border:"1.5px dashed #e2e8f0", borderRadius:".75rem", padding:".75rem 1rem", cursor:"pointer", display:"flex", alignItems:"center", gap:".6rem", background:"white", transition:"border-color .15s", color:"#94a3b8" }}
              onMouseOver={e => e.currentTarget.style.borderColor="#a5b4fc"} onMouseOut={e => e.currentTarget.style.borderColor="#e2e8f0"}>
              <div style={{ width:80, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.4rem", color:"#cbd5e1" }}>+</div>
              <div style={{ fontSize:".82rem", fontWeight:600 }}>Add new variation</div>
            </div>
          )}
        </div>
      </div>

      {/* Widget Health Check */}
      <div className="card" style={{ padding:"1.25rem", borderStyle:"dashed" }}>
        <h3 style={{ fontWeight:700, marginBottom:".25rem", display:"flex", alignItems:"center", gap:".5rem", fontSize:"1rem" }}><ShieldIcon size={18}/> Widget Health Check</h3>
        <p style={{ fontSize:".82rem", color:"#64748b", marginBottom:"1rem" }}>Enter your website URL to verify the trust badge is live</p>
        <div style={{ display:"flex", gap:".75rem", marginBottom:"1rem" }}>
          <input type="url" value={verifyUrl} onChange={e => { setVerifyUrl(e.target.value); setVerifyStatus(null); }} placeholder="https://yourwebsite.com" className="field-input" style={{ flex:1 }}
            onKeyDown={e => { if (e.key === "Enter" && verifyUrl.trim()) runVerify(); }}/>
          <button onClick={runVerify} disabled={isVerifying || !verifyUrl.trim()} className="btn-primary" style={{ whiteSpace:"nowrap" }}>
            {isVerifying ? <><LoaderIcon size={15}/> Checking...</> : <><SearchIcon size={15}/> Verify</>}
          </button>
        </div>
        {verifyStatus === "found" && (
          <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:".5rem", padding:".875rem 1rem", display:"flex", alignItems:"center", gap:".5rem", color:"#166534", fontWeight:600 }}>
            <CheckIcon size={16}/> Badge detected and verified ✓
            {(verifyData as any)?.variationName && <span style={{ fontSize:".78rem", fontWeight:500, color:"#166534", background:"#dcfce7", padding:".1rem .5rem", borderRadius:"99px", marginLeft:".25rem" }}>Widget v{(verifyData as any).variationName}</span>}
          </div>
        )}
        {verifyStatus === "not-found" && (
          <div style={{ background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:".5rem", padding:".875rem 1rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:".5rem", color:"#be123c", fontWeight:600, marginBottom:".35rem" }}><AlertIcon size={16}/> Badge not detected</div>
            <p style={{ fontSize:".8rem", color:"#9f1239", margin:0 }}>{verifyReason || "The embed code was not found on this page. Make sure you've pasted it and published the changes."}</p>
          </div>
        )}
        {verifyStatus === "error" && (
          <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:".5rem", padding:".875rem 1rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:".5rem", color:"#92400e", fontWeight:600, marginBottom:".35rem" }}><AlertIcon size={16}/> Could not check</div>
            <p style={{ fontSize:".8rem", color:"#78350f", margin:0 }}>{verifyReason || "The site could not be reached or blocked the check."}</p>
          </div>
        )}
      </div>

      {/* Customize Modal — rendered via portal to avoid stacking context issues */}
      {showModal && createPortal(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, padding:"1rem" }} onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="card modal-panel" style={{ maxWidth:"520px", width:"100%", padding:"1.5rem", maxHeight:"90vh", overflowY:"auto" }}>
            {/* Modal header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
              <h2 className="font-display" style={{ fontSize:"1.1rem", fontWeight:700 }}>Customize badge</h2>
              <button onClick={() => setShowModal(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", padding:".25rem" }}><XIcon size={19}/></button>
            </div>

            {/* Name */}
            <div style={{ marginBottom:".9rem" }}>
              <label className="field-label">Variation name</label>
              <input value={draft.name} onChange={e => d("name", e.target.value)} className="field-input" placeholder="e.g. Horizontal · dark"/>
            </div>

            {/* Live preview */}
            <div style={{ marginBottom:".9rem" }}>
              <div className="field-label" style={{ marginBottom:".5rem" }}>Preview</div>
              <div style={{ background:"#f8fafc", borderRadius:".6rem", padding:"1rem", border:"0.5px solid #e2e8f0", overflow:"hidden" }}>
                <BadgePreview config={draft} logos={logos} tier={tier} scale={0.88}/>
              </div>
            </div>

            {/* Layout */}
            <div style={{ marginBottom:".9rem" }}>
              <div className="field-label" style={{ marginBottom:".5rem" }}>Layout</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:".45rem" }}>
                {LAYOUTS.map(lo => (
                  <button key={lo.id} onClick={() => d("layout", lo.id)} style={{ padding:".45rem", borderRadius:".45rem", fontSize:".8rem", fontWeight:600, border: draft.layout===lo.id ? "1.5px solid #534AB7" : "0.5px solid #e2e8f0", background: draft.layout===lo.id ? "#EEEDFE" : "white", color: draft.layout===lo.id ? "#3C3489" : "#64748b", cursor:"pointer", transition:"all .15s" }}>
                    {lo.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div style={{ marginBottom:".9rem", display:"flex", gap:"1.5rem", flexWrap:"wrap" }}>
              <ColorPicker value={draft.logoColor} onChange={v => d("logoColor", v)} label="Text / Logo color"/>
              <ColorPicker value={draft.bgColor}   onChange={v => d("bgColor", v)}   label="Background"/>
            </div>

            {/* Options */}
            <div style={{ marginBottom:"1.25rem" }}>
              <div className="field-label" style={{ marginBottom:".5rem" }}>Options</div>

              {/* Laurels OR speed depending on layout */}
              {draft.layout === "horizontal" ? (
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:".55rem 0", borderBottom:"0.5px solid #f1f5f9" }}>
                  <span style={{ fontSize:".875rem", color:"#374151" }}>Show laurel decorations</span>
                  <Toggle on={draft.showLaurels} onToggle={() => d("showLaurels", !draft.showLaurels)}/>
                </div>
              ) : (
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:".55rem 0", borderBottom:"0.5px solid #f1f5f9" }}>
                  <span style={{ fontSize:".875rem", color:"#374151" }}>Slider speed</span>
                  <select value={draft.sliderSpeed} onChange={e => d("sliderSpeed", +e.target.value)} style={{ fontSize:".8rem", border:"0.5px solid #e2e8f0", borderRadius:".4rem", padding:".3rem .5rem", color:"#374151", background:"white", cursor:"pointer" }}>
                    <option value={60}>Slow</option>
                    <option value={35}>Normal</option>
                    <option value={18}>Fast</option>
                    <option value={10}>Very fast</option>
                  </select>
                </div>
              )}

              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:".55rem 0", borderBottom:"0.5px solid #f1f5f9" }}>
                <span style={{ fontSize:".875rem", color:"#374151" }}>Show "Verified by Media Blast Boosters"</span>
                <Toggle on={draft.verificationBadge} onToggle={() => d("verificationBadge", !draft.verificationBadge)}/>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:".55rem 0" }}>
                <span style={{ fontSize:".875rem", color:"#374151" }}>Show outlet counter</span>
                <Toggle on={draft.outletCounter} onToggle={() => d("outletCounter", !draft.outletCounter)}/>
              </div>
            </div>

            {/* Footer */}
            <div style={{ display:"flex", gap:".75rem" }}>
              <button onClick={() => copyHTML(draft)} className="btn-secondary" style={{ flex:1, justifyContent:"center" }}><CopyIcon size={14}/> Copy HTML</button>
              <button onClick={saveVariation} disabled={!draft.name.trim()} className="btn-primary" style={{ flex:1, justifyContent:"center" }}><CheckIcon size={14}/> {editingId ? "Update" : "Save variation"}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
