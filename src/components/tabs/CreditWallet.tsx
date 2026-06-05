import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { XIcon } from "../icons";
import PromoBanners from "./PromoBanners";

const fireConfetti = () => {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ["#6366f1","#8929bd","#d97706","#10b981","#f43f5e","#0ea5e9","#f59e0b","#a786ff"];
  const particles = Array.from({ length: 120 }, (_, i) => ({
    x: Math.random() < 0.5 ? 0 : canvas.width,
    y: canvas.height * 0.5,
    vx: (Math.random() < 0.5 ? 1 : -1) * (4 + Math.random() * 8),
    vy: -(Math.random() * 12 + 4),
    color: colors[Math.floor(Math.random() * colors.length)],
    size: Math.random() * 8 + 4,
    gravity: 0.25,
    decay: 0.97,
    rotation: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 8,
    alpha: 1,
  }));

  let frame = 0;
  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.vy += p.gravity;
      p.vx *= p.decay;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotSpeed;
      p.alpha -= 0.008;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation * Math.PI / 180);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
      ctx.restore();
    });
    frame++;
    if (frame < 180) requestAnimationFrame(animate);
    else canvas.remove();
  };
  animate();
};

const STRIPE_PK_LIVE = "pk_live_jem1i1ni1P4sQXEJTkgNSx8z";
const STRIPE_PK_TEST = "pk_test_FiKXMJBxEKrQqyMqdAILoROR";
const PROXY          = "https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/supabase-proxy";
const CHECKOUT_URL   = "https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/create-checkout-credits";

const stripePromises: Record<string, ReturnType<typeof loadStripe>> = {};
const getStripe = (pk: string) => { if (!stripePromises[pk]) stripePromises[pk] = loadStripe(pk); return stripePromises[pk]; };

const TIERS = {
  starter:  { label:"Starter",  color:"#6366f1", light:"#eef2ff", outlets:"200+", words:400,  readers:"2.2M",   authority:69 },
  standard: { label:"Standard", color:"#8929bd", light:"#f5f3ff", outlets:"350+", words:600,  readers:"26.4M",  authority:88 },
  premium:  { label:"Premium",  color:"#d97706", light:"#fffbeb", outlets:"500+", words:800, readers:"224.5M", authority:94 },
} as const;
type Tier = keyof typeof TIERS;

// Per-pack pricing (volume discount per credit)
const PACK_PRICES: Record<Tier, Record<number,number>> = {
  starter:  { 2: 397, 4: 377, 6: 357 },
  standard: { 2: 597, 4: 567, 6: 537 },
  premium:  { 2: 897, 4: 852, 6: 807 },
};

const TIER_STRATEGY: Record<string, { bestFor: string; useCase: string }> = {
  starter:  { bestFor: "Local SEO & Location Pages",      useCase: "Building geographic \"Entity\" signals and dominating local Map Packs."                        },
  standard: { bestFor: "Core Services & Optimization",    useCase: "Establishing your brand as a professional authority for specific offerings."                    },
  premium:  { bestFor: "Homepage & National Authority",   useCase: "Launching your Brand Apex on high-authority news sites for maximum trust."                     },
};

const PACKS = [
  { qty:2,  label:"2-Pack",  discount:null,        discountColor:"" },
  { qty:4,  label:"4-Pack",  discount:"5% Off",    discountColor:"#0ea5e9" },
  { qty:6,  label:"6-Pack",  discount:"10% Off",   discountColor:"#10b981" },
];

interface Credits {
  starter_credits:number; standard_credits:number; premium_credits:number;
  pending_starter_credits?:number; pending_standard_credits?:number; pending_premium_credits?:number;
}
interface Props { locationId:string; showToast:(msg:string, type?:"success"|"error")=>void; onNavigateToPR?:()=>void; savedCards?:{pm_id:string;last4:string;brand:string}[]; onCardSaved?:(cards:{pm_id:string;last4:string;brand:string}[])=>void; }

const PENDING_KEY = "mbb_pending_purchase";

export default function CreditWallet({ locationId, showToast, onNavigateToPR, savedCards = [], onCardSaved }: Props) {
  const savedCard = savedCards[0] ?? null;
  const [activeTab,       setActiveTab]       = useState<"packages"|"credits"|"transactions">("credits");
  const [activeTier,      setActiveTier]      = useState<Tier>("starter");
  const [credits,         setCredits]         = useState<Credits>({ starter_credits:0, standard_credits:0, premium_credits:0 });
  const [loading,         setLoading]         = useState(true);
  const [confirmCharge,   setConfirmCharge]   = useState<{tier:string;quantity:number;amount:number}|null>(null);
  const [charging,        setCharging]        = useState(false);
  const [couponCode,      setCouponCode]      = useState("");
  const [couponOpen,      setCouponOpen]      = useState(false);
  const [couponApplied,   setCouponApplied]   = useState<{code:string;label:string;finalAmount:number}|null>(null);
  const [couponError,     setCouponError]     = useState("");
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [selectedPmId,    setSelectedPmId]    = useState<string>("");
  const [pendingCoupon,   setPendingCoupon]   = useState<string | null>(null);
  const [checkout,        setCheckout]        = useState<{ tier:Tier; qty:number }|null>(null);
  const [clientSecret,    setClientSecret]    = useState<string|null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError,   setCheckoutError]   = useState("");
  const [testMode,        setTestMode]        = useState(false);
  const [thankYou,        setThankYou]        = useState<{ tier:Tier; qty:number }|null>(null);

  const loadCredits = async () => {
    setLoading(true);
    try {
      const res  = await fetch(PROXY, { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ table:"profiles", operation:"select", eq:{ location_id:locationId } }) });
      const data = await res.json();
      if (data.data) setCredits(data.data);
    } catch {}
    setLoading(false);
  };

  // On mount: check for ?checkout=complete redirect from Stripe return_url
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "complete") {
      // Clear the param from URL without reload
      const clean = window.location.search.replace(/[&?]checkout=complete/, "");
      window.history.replaceState({}, "", window.location.pathname + clean);
      // Retrieve pending purchase from sessionStorage
      try {
        const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null");
        if (pending?.tier && pending?.qty) {
          handlePurchaseComplete(pending.tier, pending.qty, true);
        }
      } catch {}
    }
    loadCredits();
  }, [locationId]);

  const openCheckout = async (tier: Tier, qty: number) => {
    // Save pending purchase so we can recover it after redirect
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ tier, qty }));
    setCheckout({ tier, qty }); setClientSecret(null); setCheckoutError(""); setCheckoutLoading(true);
    try {
      const returnUrl = `${window.location.origin}${window.location.pathname}${window.location.search}&checkout=complete`;
      const res  = await fetch(CHECKOUT_URL, { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ tier, quantity:qty, pricePerCredit: PACK_PRICES[tier][qty], locationId, returnUrl }) });
      const data = await res.json();
      if (data.error) setCheckoutError("Unable to load checkout. Please try again.");
      else { setClientSecret(data.clientSecret); setTestMode(!!data.testMode); }
    } catch { setCheckoutError("Could not connect to checkout."); }
    setCheckoutLoading(false);
  };

  const handlePurchaseComplete = async (tier: Tier, qty: number, fromRedirect = false) => {
    sessionStorage.removeItem(PENDING_KEY);
    const reason = `Purchased ${qty} ${TIERS[tier].label} PR Credit${qty > 1 ? "s" : ""}`;
    try {
      await fetch(PROXY, { method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ table:"profiles", operation:"increment_credits", location_id:locationId, tier, amount:qty, reason }) });
    } catch {}
    await loadCredits();
    setCheckout(null); setClientSecret(null);
    setThankYou({ tier, qty });
    setActiveTab("credits");
  };

  useEffect(() => {
    if (!thankYou) return;
    fireConfetti();
  }, [thankYou]);

  const t = checkout ? TIERS[checkout.tier] : null;
  const stripePk = testMode ? STRIPE_PK_TEST : STRIPE_PK_LIVE;

  const closeConfirm = () => {
    setConfirmCharge(null);
    setCouponCode(""); setCouponOpen(false);
    setCouponApplied(null); setCouponError("");
    setSelectedPmId("");
  };

  const validateCoupon = async () => {
    if (!couponCode.trim() || !confirmCharge) return;
    setValidatingCoupon(true); setCouponError("");
    try {
      // Validate by attempting a dry-run charge lookup — use Stripe promo code lookup
      const res = await fetch("https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/validate-coupon", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ promo_code: couponCode.trim(), tier: confirmCharge.tier, quantity: confirmCharge.quantity, location_id: locationId })
      });
      const d = await res.json();
      if (d.error) { setCouponError(d.error); }
      else { setCouponApplied({ code: couponCode.trim(), label: d.label, finalAmount: d.final_amount }); }
    } catch { setCouponError("Could not validate — please try again"); }
    setValidatingCoupon(false);
  };

  const handleChargeCard = async () => {
    if (!confirmCharge) return;
    setCharging(true);
    try {
      const res = await fetch("https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/charge-credits", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_id: locationId,
          tier: confirmCharge.tier,
          quantity: confirmCharge.quantity,
          promo_code: couponApplied?.code || undefined,
          selected_pm_id: selectedPmId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(data.error || "Payment failed", "error");
      } else {
        showToast(`✅ ${confirmCharge.quantity} ${confirmCharge.tier.charAt(0).toUpperCase() + confirmCharge.tier.slice(1)} credits added!`);
        closeConfirm();
        await loadCredits();
      }
    } catch { showToast("Payment failed — please try again", "error"); }
    setCharging(false);
  };

  return (
    <div>
      {/* Inner tabs */}
      <div style={{ display:"flex", gap:".25rem", background:"white", borderRadius:".75rem", padding:".35rem", marginBottom:"1.5rem", boxShadow:"0 1px 3px rgba(0,0,0,.06)", border:"1px solid #f1f5f9", width:"fit-content" }}>
        {([["credits","Media Credits"],["packages","Media Packages"],["transactions","Transactions"]] as const).map(([id,label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ padding:".5rem 1.1rem", borderRadius:".5rem", border:"none", cursor:"pointer", fontWeight:600, fontSize:".82rem", transition:"all .15s",
            background: activeTab===id ? "linear-gradient(135deg,#8929bd,#4338ca)" : "transparent",
            color: activeTab===id ? "white" : "#64748b",
            boxShadow: activeTab===id ? "0 2px 8px rgba(137,41,189,.3)" : "none" }}>
            {label}
          </button>
        ))}
      </div>

      {/* PACKAGES */}
      {activeTab==="packages" && (
        <div>
          <style>{`
            .pack-card { transition: transform .18s, box-shadow .18s, border-color .18s; }
            .pack-card:hover { transform: translateY(-3px); }
            .pack-card-starter:hover  { box-shadow: 0 8px 28px rgba(99,102,241,.3) !important; border-color: #6366f1 !important; }
            .pack-card-standard:hover { box-shadow: 0 8px 28px rgba(137,41,189,.3) !important; border-color: #8929bd !important; }
            .pack-card-premium:hover  { box-shadow: 0 8px 28px rgba(217,119,6,.3)  !important; border-color: #d97706 !important; }
          `}</style>
          <div style={{ marginBottom:"1.25rem" }}>
            <h2 style={{ fontWeight:800, fontSize:"1.2rem", color:"#1e293b", margin:0 }}>Media Packages</h2>
            <p style={{ color:"#64748b", fontSize:".83rem", margin:".25rem 0 0" }}>Purchase PR credit packs — use anytime to launch press releases</p>
          </div>

          {/* Tier tabs */}
          <div style={{ display:"flex", gap:".25rem", background:"white", borderRadius:".75rem", padding:".35rem", marginBottom:"1.5rem", boxShadow:"0 1px 3px rgba(0,0,0,.06)", border:"1px solid #f1f5f9" }}>
            {(Object.entries(TIERS) as [Tier, typeof TIERS[Tier]][]).map(([key, ti]) => (
              <button key={key} onClick={() => setActiveTier(key)} style={{ flex:1, padding:".5rem .75rem", borderRadius:".5rem", border:"none", cursor:"pointer", fontWeight:600, fontSize:".78rem", transition:"all .15s", textAlign:"center", lineHeight:1.3,
                background: activeTier===key ? `linear-gradient(135deg,${ti.color},${ti.color}cc)` : "transparent",
                color: activeTier===key ? "white" : "#64748b",
                boxShadow: activeTier===key ? `0 2px 8px ${ti.color}40` : "none" }}>
                <div>{ti.label}</div>
                <div style={{ fontSize:".65rem", fontWeight: activeTier===key ? 600 : 400, opacity: activeTier===key ? .9 : .7, marginTop:".1rem" }}>
                  {TIER_STRATEGY[key].bestFor}
                </div>
              </button>
            ))}
          </div>

          {/* Active tier content */}
          {(Object.entries(TIERS) as [Tier, typeof TIERS[Tier]][]).filter(([key]) => key === activeTier).map(([key, ti]) => (
            <div key={key}>
              {/* Tier header */}
              <div className="card" style={{ overflow:"hidden", marginBottom:"1.25rem" }}>
                <div style={{ background:`linear-gradient(135deg, ${ti.color}18, ${ti.color}06)`, borderBottom:`1px solid ${ti.color}25`, padding:"1rem 1.5rem", display:"flex", alignItems:"flex-start", gap:".75rem" }}>
                  <div style={{ width:10, height:10, borderRadius:"50%", background:ti.color, boxShadow:`0 0 8px ${ti.color}`, flexShrink:0, marginTop:".35rem" }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:800, fontSize:"1.05rem", color:"#1e293b" }}>{ti.label} PR Package</div>
                    <div style={{ fontSize:".75rem", color:"#64748b", marginTop:".1rem" }}>{ti.outlets} outlets · {ti.words} words · {ti.readers} readers · DA {ti.authority}</div>
                    <div style={{ marginTop:".6rem", display:"flex", gap:".5rem", flexWrap:"wrap", alignItems:"center" }}>
                      <span style={{ fontSize:".72rem", fontWeight:700, color:ti.color, background:`${ti.color}15`, padding:".2rem .65rem", borderRadius:"99px", border:`1px solid ${ti.color}30` }}>
                        Best For: {TIER_STRATEGY[key].bestFor}
                      </span>
                    </div>
                    <div style={{ fontSize:".75rem", color:"#64748b", marginTop:".45rem", lineHeight:1.5 }}>
                      {TIER_STRATEGY[key].useCase}
                    </div>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1rem", padding:"1.25rem" }}>
                  {PACKS.map(p => (
                    <div key={p.qty} className={`pack-card pack-card-${key}`} style={{ border:"1.5px solid #e2e8f0", borderRadius:".75rem", padding:"1.25rem", background:"white", position:"relative" }}>
                      {p.discount && (
                        <div style={{ position:"absolute", top:-1, right:-1, background:p.discountColor, color:"white", fontSize:".65rem", fontWeight:800, padding:".2rem .65rem", borderRadius:"0 .75rem 0 .5rem", letterSpacing:".04em" }}>
                          {p.discount}
                        </div>
                      )}
                      <div style={{ marginBottom:"1rem" }}>
                        <div style={{ display:"flex", alignItems:"baseline", gap:".3rem" }}>
                          <span style={{ fontSize:"2.8rem", fontWeight:900, color:ti.color, lineHeight:1 }}>{p.qty}</span>
                          <span style={{ fontSize:".85rem", fontWeight:600, color:"#64748b" }}>credits</span>
                        </div>
                        <div style={{ fontSize:".7rem", color:"#94a3b8", marginTop:".2rem" }}>PR launches included</div>
                      </div>
                      <div style={{ borderTop:"1px solid #f1f5f9", paddingTop:".85rem", marginBottom:".85rem" }}>
                        <div style={{ fontSize:"1.65rem", fontWeight:900, color:"#1e293b", lineHeight:1 }}>${(PACK_PRICES[key][p.qty] * p.qty).toLocaleString()}</div>
                        <div style={{ fontSize:".75rem", color:"#64748b", marginTop:".25rem" }}>${PACK_PRICES[key][p.qty].toLocaleString()} per credit</div>
                      </div>
                      <button onClick={() => openCheckout(key, p.qty)} style={{ width:"100%", padding:".6rem", borderRadius:".45rem", border:"none", cursor:"pointer", fontWeight:700, fontSize:".82rem", background:ti.color, color:"white", transition:"opacity .15s" }}
                        onMouseOver={e=>e.currentTarget.style.opacity=".85"} onMouseOut={e=>e.currentTarget.style.opacity="1"}>
                        Buy Now
                      </button>
                      {savedCard && (
                        <button onClick={() => {
                          const amount = PACK_PRICES[key]?.[p.qty];
                          if (amount) setConfirmCharge({ tier:key, quantity:p.qty, amount: amount * p.qty });
                        }} style={{ width:"100%", padding:".5rem", borderRadius:".45rem", border:"none", cursor:"pointer", fontWeight:700, fontSize:".75rem", background:`linear-gradient(135deg,${ti.color},${ti.color}cc)`, color:"white", marginTop:".4rem", opacity:.9 }}
                          onMouseOver={e=>e.currentTarget.style.opacity="1"} onMouseOut={e=>e.currentTarget.style.opacity=".9"}>
                          💳 Buy with ••••{savedCard.last4}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Why Publish section */}
              <div style={{ marginBottom:".75rem" }}>
                <h3 style={{ fontWeight:700, fontSize:"1rem", color:"#1e293b", margin:"0 0 .25rem" }}>Why Publish with Media Blast Boosters™?</h3>
                <p style={{ color:"#64748b", fontSize:".82rem", margin:0 }}>Get published across hundreds of top outlets, reaching millions monthly.</p>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:".75rem" }}>
                {[
                  { icon:"🏆", title:"Elite Brand Authority",    color:"#6366f1", bg:"#eef2ff", desc:"Establish your brand as a verified industry leader through editorial placements on reputable news outlets that prospects instantly recognize and trust." },
                  { icon:"🤖", title:"AI & LLM Visibility",      color:"#8929bd", bg:"#f5f3ff", desc:"Future-proof your business by feeding high-value, authoritative content into the datasets that power AI search engines and Large Language Models (LLMs)." },
                  { icon:"📡", title:"Strategic Media Exposure", color:"#0ea5e9", bg:"#f0f9ff", desc:"Earn visibility where your audience already spends their time, from hyper-local news sites to leading national and international media publications." },
                  { icon:"📈", title:"Compound SEO Authority",   color:"#10b981", bg:"#f0fdf4", desc:"Strengthen your domain naturally with high-quality editorial backlinks that boost your Google rankings and create long-term organic growth." },
                ].map(r => (
                  <div key={r.title} style={{ background:r.bg, border:`1px solid ${r.color}25`, borderRadius:".75rem", padding:"1rem 1.1rem" }}>
                    <div style={{ fontSize:"1.4rem", marginBottom:".4rem" }}>{r.icon}</div>
                    <div style={{ fontWeight:700, fontSize:".85rem", color:r.color, marginBottom:".3rem" }}>{r.title}</div>
                    <div style={{ fontSize:".75rem", color:"#475569", lineHeight:1.5 }}>{r.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREDITS */}
      {activeTab==="credits" && (
        <div>
          <div style={{ marginBottom:"1.25rem" }}>
            <h2 style={{ fontWeight:800, fontSize:"1.2rem", color:"#1e293b", margin:0 }}>Media Credits</h2>
            <p style={{ color:"#64748b", fontSize:".83rem", margin:".25rem 0 0" }}>Your available PR launch credits by package tier</p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:"1rem", marginBottom:"2rem" }}>
            {(Object.entries(TIERS) as [Tier, typeof TIERS[Tier]][]).map(([key, ti]) => {
              const bal     = credits[`${key}_credits`] ?? 0;
              const pending = credits[`pending_${key}_credits`] ?? 0;
              const bullets: Record<Tier,string[]> = {
                starter:  ["200+ News Outlets","400 Words","2.2M Monthly Readers","Max Authority: 69"],
                standard: ["350+ News Outlets","600 Words","26.4M Monthly Readers","Max Authority: 88"],
                premium:  ["500+ News Outlets","800 Words","224.5M Monthly Readers","Max Authority: 94"],
              };
              return (
                <div key={key} className="card" style={{ padding:"1.5rem", borderTop:`4px solid ${ti.color}`, position:"relative", overflow:"hidden" }}>
                  <div style={{ position:"absolute", top:0, right:0, width:72, height:72, background:ti.light, borderRadius:"0 0 0 100%", opacity:.7 }}/>
                  <div style={{ fontSize:".68rem", fontWeight:700, letterSpacing:".1em", textTransform:"uppercase", color:ti.color, marginBottom:".4rem" }}>{ti.label}</div>
                  <div style={{ fontSize:"3rem", fontWeight:900, color:"#1e293b", lineHeight:1, marginBottom:".2rem" }}>
                    {loading ? <span style={{ fontSize:"1.5rem", color:"#94a3b8" }}>…</span> : bal}
                  </div>
                  <div style={{ fontSize:".75rem", color:"#94a3b8", marginBottom: pending > 0 ? ".3rem" : ".85rem" }}>credits available</div>
                  {pending > 0 && (
                    <div style={{ display:"flex", alignItems:"center", gap:".35rem", marginBottom:".65rem" }}>
                      <span style={{ fontSize:".7rem", fontWeight:700, color:"#92400e", background:"#fef3c7", border:"1px solid #fde68a", padding:".1rem .5rem", borderRadius:"99px" }}>
                        ⏳ {pending} pending
                      </span>
                      <span style={{ fontSize:".68rem", color:"#94a3b8" }}>— reserved for scheduled PRs</span>
                    </div>
                  )}
                  <div style={{ marginBottom:"1rem" }}>
                    {bullets[key].map(b => (
                      <div key={b} style={{ display:"flex", alignItems:"center", gap:".4rem", fontSize:".75rem", color:"#475569", marginBottom:".3rem" }}>
                        <span style={{ width:5, height:5, borderRadius:"50%", background:ti.color, flexShrink:0 }}/>
                        {b}
                      </div>
                    ))}
                  </div>
                  {/* Credits tab always navigates to Packages tab */}
                  <button onClick={() => { setActiveTab("packages"); setActiveTier(key); }} style={{ width:"100%", padding:".55rem", borderRadius:".45rem", border:`1.5px solid ${ti.color}`, cursor:"pointer", fontWeight:700, fontSize:".78rem", background:"transparent", color:ti.color, transition:"all .15s" }}
                    onMouseOver={e=>{ e.currentTarget.style.background=ti.color; e.currentTarget.style.color="white"; }}
                    onMouseOut={e=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.color=ti.color; }}>
                    {bal > 0 ? "➕ Add More" : "🚀 Get Started"}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Promotions banners */}
          <PromoBanners locationId={locationId} />

          {/* Compelling reasons */}
          <div style={{ marginBottom:".75rem" }}>
            <h3 style={{ fontWeight:700, fontSize:"1rem", color:"#1e293b", margin:"0 0 .25rem" }}>Why Publish with Media Blast Boosters™?</h3>
            <p style={{ color:"#64748b", fontSize:".82rem", margin:0 }}>Get published across hundreds of top outlets, reaching millions monthly.</p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:".75rem" }}>
            {[
              { icon:"🏆", title:"Elite Brand Authority",      color:"#6366f1", bg:"#eef2ff", desc:"Establish your brand as a verified industry leader through editorial placements on reputable news outlets that prospects instantly recognize and trust." },
              { icon:"🤖", title:"AI & LLM Visibility",         color:"#8929bd", bg:"#f5f3ff", desc:"Future-proof your business by feeding high-value, authoritative content into the datasets that power AI search engines and Large Language Models (LLMs)." },
              { icon:"📡", title:"Strategic Media Exposure",    color:"#0ea5e9", bg:"#f0f9ff", desc:"Earn visibility where your audience already spends their time, from hyper-local news sites to leading national and international media publications." },
              { icon:"📈", title:"Compound SEO Authority",      color:"#10b981", bg:"#f0fdf4", desc:"Strengthen your domain naturally with high-quality editorial backlinks that boost your Google rankings and create long-term organic growth." },
            ].map(r => (
              <div key={r.title} style={{ background:r.bg, border:`1px solid ${r.color}25`, borderRadius:".75rem", padding:"1rem 1.1rem" }}>
                <div style={{ fontSize:"1.4rem", marginBottom:".4rem" }}>{r.icon}</div>
                <div style={{ fontWeight:700, fontSize:".85rem", color:r.color, marginBottom:".3rem" }}>{r.title}</div>
                <div style={{ fontSize:".75rem", color:"#475569", lineHeight:1.5 }}>{r.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TRANSACTIONS */}
      {activeTab==="transactions" && <TransactionLog locationId={locationId}/>}

      {/* CHECKOUT MODAL */}
      {checkout && (
        <div style={{ position:"fixed", inset:0, zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,.55)", backdropFilter:"blur(4px)" }}>
          <div style={{ background:"white", borderRadius:"1rem", width:"100%", maxWidth:550, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 24px 64px rgba(0,0,0,.25)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"1rem 1.25rem .85rem", borderBottom:"1px solid #f1f5f9", position:"sticky", top:0, background:"white", zIndex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:".6rem" }}>
                <img src="/logo.png" alt="MBB" style={{ width:28, height:28, objectFit:"contain" }}/>
                <div>
                  <div style={{ fontWeight:700, fontSize:".9rem", color:"#1e293b" }}>Media Blast Boosters™</div>
                  <div style={{ fontSize:".7rem", color:"#64748b" }}>Secure Checkout · 256-bit SSL</div>
                </div>
              </div>
              <button onClick={() => { setCheckout(null); setClientSecret(null); }} style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", padding:".25rem", display:"flex" }}><XIcon size={18}/></button>
            </div>
            {t && (
              <div style={{ background:"linear-gradient(135deg,#1e1b4b,#312e81)", padding:".9rem 1.25rem", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"1rem" }}>
                <div>
                  <div style={{ color:"#a5b4fc", fontSize:".68rem", fontWeight:600, textTransform:"uppercase", letterSpacing:".08em", marginBottom:".2rem" }}>{t.label} · {checkout.qty}-Pack</div>
                  <div style={{ color:"white", fontSize:".82rem" }}>{checkout.qty} PR Credits · {t.outlets} outlets each</div>
                </div>
                <div style={{ color:"white", fontWeight:900, fontSize:"1.4rem", flexShrink:0 }}>${(PACK_PRICES[checkout.tier][checkout.qty] * checkout.qty).toLocaleString()}</div>
              </div>
            )}
            <div>
              {checkoutLoading && (
                <div style={{ display:"flex", justifyContent:"center", alignItems:"center", padding:"3rem", color:"#64748b", gap:".75rem" }}>
                  <div style={{ width:20, height:20, border:"2px solid #e2e8f0", borderTopColor:"#6366f1", borderRadius:"50%", animation:"spin .8s linear infinite" }}/>
                  Loading secure checkout…
                </div>
              )}
              {checkoutError && (
                <div style={{ padding:"1.25rem" }}>
                  <div style={{ background:"#fff1f2", border:"1px solid #fecdd3", borderRadius:".5rem", padding:".75rem 1rem", fontSize:".82rem", color:"#be123c", textAlign:"center" }}>
                    {checkoutError}
                    <button onClick={() => { setCheckoutError(""); if(checkout) openCheckout(checkout.tier, checkout.qty); }} style={{ display:"block", margin:".5rem auto 0", fontSize:".78rem", color:"#6366f1", background:"none", border:"none", cursor:"pointer", textDecoration:"underline" }}>Try again</button>
                  </div>
                </div>
              )}
              {clientSecret && (
                <>
                  {testMode && (
                    <div style={{ margin:".75rem 1.25rem 0", background:"#fef3c7", border:"1px solid #f59e0b", borderRadius:".4rem", padding:".4rem .75rem", fontSize:".72rem", fontWeight:700, color:"#92400e", display:"flex", alignItems:"center", gap:".4rem" }}>
                      🧪 TEST MODE — card: 4242 4242 4242 4242 · exp 12/34 · CVC 123
                    </div>
                  )}
                  <EmbeddedCheckoutProvider stripe={getStripe(stripePk)} options={{
                    fetchClientSecret: () => Promise.resolve(clientSecret),
                    onComplete: () => handlePurchaseComplete(checkout!.tier, checkout!.qty),
                  }}>
                    <EmbeddedCheckout/>
                  </EmbeddedCheckoutProvider>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── THANK YOU MODAL ── */}
      {thankYou && (() => {
        const ti = TIERS[thankYou.tier];
        const total = (PACK_PRICES[thankYou.tier][thankYou.qty] * thankYou.qty).toLocaleString();
        const newBal = (credits[`${thankYou.tier}_credits`] ?? 0);
        return (
          <div style={{ position:"fixed", inset:0, zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,.6)", backdropFilter:"blur(6px)", animation:"fadeIn .2s ease" }}>
            <div style={{ background:"white", borderRadius:"1.25rem", width:"100%", maxWidth:440, padding:"2.5rem", textAlign:"center", boxShadow:"0 32px 80px rgba(0,0,0,.3)", animation:"slideUp .25s ease", position:"relative", zIndex:1001 }}>
              <div style={{ width:80, height:80, borderRadius:"50%", background:`linear-gradient(135deg, ${ti.color}22, ${ti.color}44)`, border:`3px solid ${ti.color}`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 1.25rem", fontSize:"2.2rem" }}>
                🎉
              </div>
              <h2 style={{ fontWeight:900, fontSize:"1.4rem", color:"#1e293b", margin:"0 0 .5rem" }}>Payment Successful!</h2>
              <p style={{ color:"#64748b", fontSize:".88rem", margin:"0 0 1.5rem", lineHeight:1.6 }}>
                Your <strong>{thankYou.qty} {ti.label} PR Credits</strong> have been added to your wallet.
              </p>
              <div style={{ background:`linear-gradient(135deg, ${ti.color}12, ${ti.color}06)`, border:`1px solid ${ti.color}30`, borderRadius:".75rem", padding:"1rem 1.25rem", marginBottom:"1.5rem", textAlign:"left" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:".5rem" }}>
                  <span style={{ fontSize:".78rem", color:"#64748b" }}>Credits purchased</span>
                  <span style={{ fontWeight:800, color:ti.color, fontSize:"1rem" }}>+{thankYou.qty}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:".5rem" }}>
                  <span style={{ fontSize:".78rem", color:"#64748b" }}>Amount charged</span>
                  <span style={{ fontWeight:700, color:"#1e293b" }}>${total}</span>
                </div>
                <div style={{ height:"1px", background:"#f1f5f9", margin:".5rem 0" }}/>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:".78rem", color:"#64748b" }}>{ti.label} balance now</span>
                  <span style={{ fontWeight:900, color:ti.color, fontSize:"1.1rem" }}>{newBal > 0 ? newBal : thankYou.qty} credits</span>
                </div>
              </div>
              <button onClick={() => { setThankYou(null); onNavigateToPR?.(); }} style={{ width:"100%", padding:".75rem", borderRadius:".6rem", border:"none", cursor:"pointer", fontWeight:700, fontSize:".9rem", background:`linear-gradient(135deg, ${ti.color}, ${ti.color}cc)`, color:"white", boxShadow:`0 4px 14px ${ti.color}50`, transition:"opacity .15s" }}
                onMouseOver={e=>e.currentTarget.style.opacity=".85"} onMouseOut={e=>e.currentTarget.style.opacity="1"}>
                Start Using My Credits 🚀
              </button>
            </div>
          </div>
        );
      })()}
      {/* Card-on-file charge confirmation modal */}
      {confirmCharge && savedCard && createPortal(
        <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(0,0,0,.55)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1.5rem" }}>
          <div style={{ background:"white", borderRadius:"1rem", width:"100%", maxWidth:420, padding:"2rem", boxShadow:"0 24px 64px rgba(0,0,0,.3)" }}>
            <div style={{ textAlign:"center", marginBottom:"1.25rem" }}>
              <div style={{ fontSize:"2.5rem", marginBottom:".5rem" }}>💳</div>
              <h3 style={{ fontWeight:900, fontSize:"1.2rem", color:"#0f172a", margin:"0 0 .25rem" }}>Confirm Purchase</h3>
              <p style={{ color:"#64748b", fontSize:".82rem", margin:0 }}>{confirmCharge.quantity} {confirmCharge.tier.charAt(0).toUpperCase()+confirmCharge.tier.slice(1)} PR Credits</p>
            </div>

            {/* Card selector */}
            {savedCards.length > 1 && (
              <div style={{ marginBottom:"1rem" }}>
                <div style={{ fontSize:".72rem", fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:".06em", marginBottom:".4rem" }}>Pay with</div>
                <div style={{ display:"flex", flexDirection:"column", gap:".35rem" }}>
                  {savedCards.map((card, i) => {
                    const isSelected = (selectedPmId || savedCards[0].pm_id) === card.pm_id;
                    return (
                      <button key={card.pm_id} onClick={() => setSelectedPmId(card.pm_id)}
                        style={{ display:"flex", alignItems:"center", gap:".65rem", padding:".6rem .85rem", borderRadius:".55rem", border:`2px solid ${isSelected ? "#6366f1" : "#e2e8f0"}`, background: isSelected ? "#eef2ff" : "white", cursor:"pointer", textAlign:"left", transition:"all .15s" }}>
                        <span style={{ fontSize:"1rem" }}>💳</span>
                        <span style={{ fontSize:".85rem", fontWeight:600, color:"#374151", flex:1 }}>{card.brand.charAt(0).toUpperCase()+card.brand.slice(1)} ••••{card.last4}</span>
                        {isSelected && <span style={{ fontSize:".65rem", fontWeight:800, color:"#6366f1", background:"#e0e7ff", padding:".15rem .45rem", borderRadius:"99px" }}>Selected</span>}
                        {i === 0 && !isSelected && <span style={{ fontSize:".65rem", color:"#94a3b8" }}>Default</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price summary */}
            <div style={{ background:"#f8fafc", borderRadius:".65rem", padding:".85rem 1rem", marginBottom:".75rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: couponApplied ? ".4rem" : 0 }}>
                <span style={{ fontSize:".84rem", color:"#64748b" }}>Total</span>
                <span style={{ fontWeight:700, color: couponApplied ? "#94a3b8" : "#1e293b", textDecoration: couponApplied ? "line-through" : "none" }}>
                  ${confirmCharge.amount.toLocaleString("en-US",{minimumFractionDigits:2})}
                </span>
              </div>
              {couponApplied && (
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:".82rem", color:"#16a34a", fontWeight:600 }}>🏷️ {couponApplied.code} — {couponApplied.label}</span>
                  <span style={{ fontWeight:800, color:"#16a34a", fontSize:".95rem" }}>${couponApplied.finalAmount.toLocaleString("en-US",{minimumFractionDigits:2})}</span>
                </div>
              )}
              {savedCards.length === 1 && (
                <div style={{ display:"flex", alignItems:"center", gap:".5rem", paddingTop:".5rem", marginTop:".5rem", borderTop:"1px solid #e2e8f0" }}>
                  <span style={{ fontSize:"1rem" }}>💳</span>
                  <span style={{ fontSize:".82rem", fontWeight:600, color:"#374151" }}>{savedCard.brand.charAt(0).toUpperCase()+savedCard.brand.slice(1)} ••••{savedCard.last4}</span>
                </div>
              )}
            </div>

            {/* Coupon — more visible */}
            <div style={{ marginBottom:"1rem" }}>
              {!couponApplied ? (
                <>
                  {!couponOpen ? (
                    <button onClick={() => setCouponOpen(true)}
                      style={{ background:"none", border:"none", color:"#6366f1", fontSize:".78rem", fontWeight:600, cursor:"pointer", padding:0, display:"flex", alignItems:"center", gap:".3rem" }}>
                      🏷️ Have a coupon code?
                    </button>
                  ) : (
                    <div>
                      <div style={{ display:"flex", gap:".4rem" }}>
                        <input value={couponCode} onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                          onKeyDown={e => e.key === "Enter" && validateCoupon()}
                          placeholder="ENTER CODE"
                          style={{ flex:1, padding:".45rem .7rem", borderRadius:".4rem", border:"1.5px solid " + (couponError ? "#fca5a5" : "#c7d2fe"), fontSize:".82rem", outline:"none", fontFamily:"monospace", letterSpacing:".05em" }}/>
                        <button onClick={validateCoupon} disabled={validatingCoupon || !couponCode.trim()}
                          style={{ padding:".45rem .9rem", borderRadius:".4rem", border:"none", background: couponCode.trim() ? "#6366f1" : "#e2e8f0", color: couponCode.trim() ? "white" : "#94a3b8", fontWeight:700, fontSize:".8rem", cursor: couponCode.trim() ? "pointer" : "not-allowed" }}>
                          {validatingCoupon ? "…" : "Apply"}
                        </button>
                      </div>
                      {couponError && <div style={{ fontSize:".72rem", color:"#dc2626", marginTop:".3rem" }}>{couponError}</div>}
                    </div>
                  )}
                </>
              ) : (
                <button onClick={() => { setCouponApplied(null); setCouponCode(""); }}
                  style={{ background:"none", border:"none", color:"#94a3b8", fontSize:".73rem", cursor:"pointer", padding:0 }}>
                  ✕ Remove coupon
                </button>
              )}
            </div>

            <div style={{ display:"flex", gap:".75rem" }}>
              <button onClick={closeConfirm} disabled={charging}
                style={{ flex:1, padding:".7rem", borderRadius:".55rem", border:"1px solid #e2e8f0", background:"white", color:"#374151", fontWeight:600, fontSize:".85rem", cursor:"pointer" }}>
                Cancel
              </button>
              <button onClick={handleChargeCard} disabled={charging}
                style={{ flex:2, padding:".7rem", borderRadius:".55rem", border:"none", background: charging ? "#e2e8f0" : "linear-gradient(135deg,#6366f1,#8929bd)", color: charging ? "#94a3b8" : "white", fontWeight:800, fontSize:".9rem", cursor: charging ? "not-allowed" : "pointer", boxShadow: charging ? "none" : "0 4px 14px rgba(99,102,241,.3)" }}>
                {charging ? "Processing…" : `Pay $${(couponApplied?.finalAmount ?? confirmCharge.amount).toLocaleString("en-US",{minimumFractionDigits:2})}`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Transactions ────────────────────────────────────────────────────────────
function TransactionLog({ locationId }: { locationId: string }) {
  const [logs,    setLogs]    = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res  = await fetch(PROXY, { method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({ table:"credit_logs", operation:"select_many", eq:{ location_id:locationId }, order:{ col:"created_at", ascending:false }, limit:50 }) });
        const data = await res.json();
        setLogs(data.data ?? []);
      } catch { setLogs([]); }
      setLoading(false);
    };
    load();
  }, [locationId]);

  const TIER_COLORS: Record<string,string> = { starter:"#6366f1", standard:"#8929bd", premium:"#d97706" };
  const getIcon = (reason: string) => {
    if (reason.startsWith("🪄")) return "🪄";
    if (reason.toLowerCase().includes("purchased") || reason.toLowerCase().includes("stripe") || reason.toLowerCase().includes("bonus")) return "⭐";
    if (reason.toLowerCase().includes("launch") || reason.toLowerCase().includes("submitted")) return "✏️";
    return "📝";
  };
  const cleanReason = (reason: string) => reason
    .replace(/^🪄\s*/u, "")
    .replace(/^PR Launch\s*[-–—]\s*/i, "")
    .replace(/^PR Submitted\s*[-–—]\s*/i, "");

  const thStyle: React.CSSProperties = { padding:".65rem 1rem", fontSize:".7rem", fontWeight:700, color:"white", textTransform:"uppercase", letterSpacing:".06em", textAlign:"left", background:"transparent", borderBottom:"none", borderRight:"1px solid rgba(255,255,255,.15)", whiteSpace:"nowrap" };
  const thLast: React.CSSProperties = { ...thStyle, borderRight:"none" };
  const tdBase  = (last=false, isLastRow=false): React.CSSProperties => ({ padding:".85rem 1rem", borderBottom: isLastRow ? "none" : "1px solid #f8fafc", borderRight: last ? "none" : "1px solid #f1f5f9", verticalAlign:"middle" });

  return (
    <div>
      <div style={{ marginBottom:"1.25rem" }}>
        <h2 style={{ fontWeight:800, fontSize:"1.2rem", color:"#1e293b", margin:0 }}>Transactions</h2>
        <p style={{ color:"#64748b", fontSize:".83rem", margin:".25rem 0 0" }}>Full history of credit purchases, bonuses and PR launches</p>
      </div>
      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:"3rem", color:"#94a3b8" }}>Loading…</div>
      ) : logs.length === 0 ? (
        <div className="card" style={{ padding:"3rem", textAlign:"center", color:"#94a3b8" }}>
          <div style={{ fontSize:"2rem", marginBottom:".75rem" }}>📋</div>
          <div style={{ fontWeight:600 }}>No transactions yet</div>
          <div style={{ fontSize:".82rem", marginTop:".25rem" }}>Credit purchases and PR launches will appear here</div>
        </div>
      ) : (
        <div className="card" style={{ overflow:"hidden" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{background:"linear-gradient(135deg,#4f46e5,#7c3aed)"}}>
                <th style={thStyle}>Description</th>
                <th style={thStyle}>Tier</th>
                <th style={thStyle}>Credits</th>
                <th style={thStyle}>Date</th>
                <th style={thLast}>Time</th>
              </tr>
            </thead>
            <tbody>
              {logs.filter(log => log.change_amount !== 0).map((log, i, arr) => {
                const isLastRow = i === arr.length - 1;
                return (
                  <tr key={i}>
                    <td style={tdBase(false, isLastRow)}>
                      <div style={{ display:"flex", alignItems:"center", gap:".65rem" }}>
                        <span style={{ width:32, height:32, borderRadius:"50%", background: log.change_amount>0 ? "#f0fdf4" : "#fef2f2", display:"flex", alignItems:"center", justifyContent:"center", fontSize:".9rem", flexShrink:0 }}>
                          {getIcon(log.reason)}
                        </span>
                        <span style={{ fontSize:".83rem", fontWeight:600, color:"#1e293b" }}>{cleanReason(log.reason)}</span>
                      </div>
                    </td>
                    <td style={tdBase(false, isLastRow)}>
                      <span style={{ fontSize:".73rem", fontWeight:700, textTransform:"capitalize", color:TIER_COLORS[log.tier] ?? "#64748b", background: log.tier==="starter" ? "#eef2ff" : log.tier==="standard" ? "#f5f3ff" : "#fffbeb", padding:".2rem .55rem", borderRadius:"99px" }}>
                        {log.tier}
                      </span>
                    </td>
                    <td style={tdBase(false, isLastRow)}>
                      <span style={{ fontSize:".9rem", fontWeight:800, color: log.change_amount>0 ? "#10b981" : "#ef4444" }}>
                        {log.change_amount>0 ? `+${log.change_amount}` : log.change_amount}
                      </span>
                    </td>
                    <td style={tdBase(false, isLastRow)}>
                      <span style={{ fontSize:".72rem", color:"#94a3b8", whiteSpace:"nowrap" }}>
                        {new Date(log.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                      </span>
                    </td>
                    <td style={tdBase(true, isLastRow)}>
                      <span style={{ fontSize:".72rem", color:"#94a3b8", whiteSpace:"nowrap" }}>
                        {new Date(log.created_at).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",hour12:true})}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
