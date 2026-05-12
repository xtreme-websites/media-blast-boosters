import { useState, useEffect } from "react";

const PROXY = "https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/supabase-proxy";
const post = (body: object) =>
  fetch(PROXY, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());

interface Promo {
  id: string;
  code: string;
  name: string | null;
  discount_type: "percent" | "amount";
  discount_value: number;
  packages: string[] | null;
  location_ids: string[] | null;
  max_redemptions_per_user: number | null;
  expires_at: string | null;
  client_description: string | null;
}

interface Props {
  locationId: string;
}

const TIER_GRAD: Record<string, string> = {
  starter:  "linear-gradient(135deg,#6366f1,#4f46e5)",
  standard: "linear-gradient(135deg,#8929bd,#6366f1)",
  premium:  "linear-gradient(135deg,#d97706,#b45309)",
};

export default function PromoBanners({ locationId }: Props) {
  const [banners, setBanners] = useState<Promo[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!locationId) return;
    (async () => {
      // Fetch all active banners
      const pd = await post({ table:"promotions", operation:"select_many",
        eq:{ active:true, show_banner:true }, select:"id,code,name,discount_type,discount_value,packages,location_ids,max_redemptions_per_user,expires_at,client_description" });
      let promos: Promo[] = pd.data || [];

      // Filter by location_ids (null = everyone)
      promos = promos.filter(p => !p.location_ids || p.location_ids.includes(locationId));

      if (promos.length === 0) { setBanners([]); return; }

      // For promos with max_redemptions_per_user=1, check if this location already used it
      const promoIds = promos.filter(p => p.max_redemptions_per_user === 1).map(p => p.id);
      let usedIds = new Set<string>();
      if (promoIds.length > 0) {
        const rd = await post({ table:"promo_redemptions", operation:"select_many",
          eq:{ location_id: locationId }, select:"promo_id" });
        const redemptions: { promo_id: string }[] = rd.data || [];
        usedIds = new Set(redemptions.filter(r => promoIds.includes(r.promo_id)).map(r => r.promo_id));
      }

      // Filter out used single-use promos
      promos = promos.filter(p => !(p.max_redemptions_per_user === 1 && usedIds.has(p.id)));

      setBanners(promos);
    })();
  }, [locationId]);

  if (banners.length === 0) return null;

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const discountLabel = (p: Promo) =>
    p.discount_type === "percent" ? `${p.discount_value}% OFF` : `$${p.discount_value} OFF`;

  const packageLabel = (p: Promo) => {
    if (!p.packages || p.packages.length === 0) return "All packages";
    return p.packages.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ");
  };

  const gradient = (p: Promo) => {
    if (p.packages?.length === 1) return TIER_GRAD[p.packages[0]] || TIER_GRAD.standard;
    return "linear-gradient(135deg,#6366f1,#8929bd)";
  };

  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <div style={{ display:"flex", alignItems:"center", gap:".5rem", marginBottom:".75rem" }}>
        <span style={{ fontSize:".7rem", fontWeight:800, color:"#8929bd", textTransform:"uppercase", letterSpacing:".08em" }}>🎟️ Exclusive Promotions</span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:".75rem" }}>
        {banners.map(p => (
          <div key={p.id} style={{
            borderRadius:".875rem", overflow:"hidden",
            boxShadow:"0 4px 20px rgba(99,102,241,.18)",
            display:"flex", alignItems:"stretch",
          }}>
            {/* Accent bar */}
            <div style={{ width:6, flexShrink:0, background: gradient(p) }}/>

            {/* Content */}
            <div style={{ flex:1, background:"white", padding:"1rem 1.25rem", display:"flex", alignItems:"center", gap:"1.25rem", flexWrap:"wrap" }}>
              {/* Discount badge */}
              <div style={{ flexShrink:0, background: gradient(p), borderRadius:".65rem", padding:".5rem .9rem", textAlign:"center", minWidth:90 }}>
                <div style={{ color:"white", fontWeight:900, fontSize:"1.15rem", letterSpacing:"-.01em", lineHeight:1.1 }}>{discountLabel(p)}</div>
                <div style={{ color:"rgba(255,255,255,.8)", fontSize:".62rem", fontWeight:700, textTransform:"uppercase", letterSpacing:".06em", marginTop:".15rem" }}>{packageLabel(p)}</div>
              </div>

              {/* Text */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:800, fontSize:".92rem", color:"#1e293b", marginBottom:".2rem" }}>
                  {p.client_description || `Save ${discountLabel(p)} on your next PR package`}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:".5rem", flexWrap:"wrap" }}>
                  <span style={{ fontFamily:"monospace", fontWeight:800, fontSize:".82rem", color:"#6366f1", background:"#eef2ff", padding:".2rem .55rem", borderRadius:".3rem" }}>
                    {p.code}
                  </span>
                  {p.expires_at && (
                    <span style={{ fontSize:".72rem", color:"#94a3b8" }}>
                      Expires {new Date(p.expires_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                    </span>
                  )}
                  {p.max_redemptions_per_user === 1 && (
                    <span style={{ fontSize:".68rem", fontWeight:700, color:"#d97706", background:"#fef3c7", padding:".15rem .45rem", borderRadius:"99px" }}>
                      One-time use
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:"flex", gap:".5rem", flexShrink:0 }}>
                <button onClick={() => copyCode(p.code)}
                  style={{ padding:".45rem 1rem", borderRadius:".5rem", border:"1.5px solid #e2e8f0", background:"white", fontWeight:700, fontSize:".78rem", cursor:"pointer", color:"#374151", transition:"all .15s", whiteSpace:"nowrap" }}>
                  {copied === p.code ? "✓ Copied!" : "📋 Copy Code"}
                </button>

              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
