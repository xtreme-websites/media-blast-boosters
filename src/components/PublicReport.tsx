import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { SUPABASE_URL } from "../lib/supabase";

const REPORT_URL = `${SUPABASE_URL}/functions/v1/report-proxy`;

// Hardcoded Power 5 outlet stats (authoritative sources)
const POWER5: Record<string, { name: string; da: number; traffic: string; rank: string; color: string }> = {
  "finance.yahoo.com":  { name: "Yahoo Finance",   da: 94, traffic: "2.1 Billion", rank: "#6 (US)",    color: "#6366f1" },
  "apnews.com":         { name: "AP News",          da: 92, traffic: "25 Million",  rank: "Top 150",    color: "#8929bd" },
  "marketwatch.com":    { name: "MarketWatch",      da: 92, traffic: "70 Million",  rank: "Top 250",    color: "#0ea5e9" },
  "benzinga.com":       { name: "Benzinga",         da: 88, traffic: "14 Million",  rank: "Top 900",    color: "#d97706" },
  "digitaljournal.com": { name: "Digital Journal",  da: 87, traffic: "1.2 Million", rank: "Media Elite", color: "#10b981" },
};

// Package tier reach stats (matches CreditWallet.tsx)
const TIER_STATS: Record<string, { outlets: string; readers: string; authority: number; label: string; color: string }> = {
  starter:  { outlets: "200+", readers: "2.2M",   authority: 69, label: "Starter",  color: "#6366f1" },
  standard: { outlets: "300+", readers: "26.4M",  authority: 88, label: "Standard", color: "#8929bd" },
  premium:  { outlets: "450+", readers: "224.5M", authority: 94, label: "Premium",  color: "#d97706" },
};

interface ReportRow { domain: string; status: string; published_url: string; published_at: string; da: number; }
interface ReportData { rows: ReportRow[]; uploaded_at: string; }
interface Report {
  order_id: string; pr_title: string; product_name: string;
  published_date: string; company_name: string; report_data: ReportData;
}

function Favicon({ domain }: { domain: string }) {
  const [err, setErr] = useState(false);
  if (err) return <div style={{ width:20, height:20, borderRadius:4, background:"#1e1b4b", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color:"#a5b4fc", fontWeight:800 }}>{domain[0]?.toUpperCase()}</div>;
  return <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} width={20} height={20} style={{ borderRadius:4, objectFit:"cover" }} onError={()=>setErr(true)} />;
}

export default function PublicReport() {
  const { orderId } = useParams<{ orderId: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!orderId) return;
    fetch(`${REPORT_URL}?order_id=${orderId}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setReport(d); else setError(d.error || "Report not found"); })
      .catch(() => setError("Failed to load report"))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#080514", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:48, height:48, borderRadius:"50%", border:"3px solid #8929bd", borderTopColor:"transparent", animation:"spin 1s linear infinite", margin:"0 auto 1rem" }}/>
        <div style={{ color:"#a5b4fc", fontSize:".9rem" }}>Loading report…</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  if (error || !report) return (
    <div style={{ minHeight:"100vh", background:"#080514", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", color:"white" }}>
        <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>📋</div>
        <h2 style={{ fontWeight:800, marginBottom:".5rem" }}>Report Not Available</h2>
        <p style={{ color:"#64748b" }}>{error || "This report could not be found."}</p>
      </div>
    </div>
  );

  const rows: ReportRow[] = report.report_data?.rows || [];
  const published = rows.filter(r => r.status?.toLowerCase() === "published");
  const tier = report.product_name?.toLowerCase() || "starter";
  const tierStats = TIER_STATS[tier] || TIER_STATS.starter;
  const pubDate = new Date(report.published_date).toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
  const reportId = report.order_id.slice(0, 8).toUpperCase();

  // Power 5: which top outlets are in this report
  const power5InReport = Object.entries(POWER5).filter(([domain]) =>
    published.some(r => r.domain?.toLowerCase().includes(domain) || domain.includes(r.domain?.toLowerCase()))
  );

  // Rest of sites excluding power 5
  const domainSet = new Set(Object.keys(POWER5).flatMap(d => [d, d.replace("finance.", ""), d.replace("www.", "")]));
  const otherSites = published.filter(r => {
    const d = r.domain?.toLowerCase();
    return !Object.keys(POWER5).some(p5 => d?.includes(p5.replace("finance.", "").replace("www.", "")) || p5.includes(d || "!!!"));
  });

  // Max DA: only from the Power 5 publishers (authoritative top outlets)
  const power5DA = power5InReport.map(([domain]) => POWER5[domain].da);
  const maxDA = power5DA.length > 0 ? Math.max(...power5DA) : tierStats.authority;

  return (
    <div style={{ minHeight:"100vh", background:"#080514", fontFamily:"-apple-system, 'Segoe UI', sans-serif" }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div style={{ background:"linear-gradient(135deg, #0d0820 0%, #1a0a3e 50%, #0d0820 100%)", borderBottom:"1px solid rgba(139,92,246,.25)", padding:".85rem 2rem" }}>
        <div style={{ maxWidth:1100, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"1rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:".75rem" }}>
            <img src="https://mediablast.xlogic.app/logo.png" width={36} height={36} style={{ borderRadius:8 }} onError={e=>(e.currentTarget.style.display="none")} />
            <div>
              <div style={{ color:"white", fontWeight:900, fontSize:".95rem", letterSpacing:".03em" }}>Media Blast Boosters™</div>
              <div style={{ color:"#8929bd", fontSize:".7rem", fontWeight:700, textTransform:"uppercase", letterSpacing:".1em" }}>Publication Report</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:"1.5rem", flexWrap:"wrap" }}>
            {[
              ["Published", pubDate],
              ["Report ID", `#${reportId}`],
              ["Package", tierStats.label],
            ].map(([label, val]) => (
              <div key={label} style={{ textAlign:"right" }}>
                <div style={{ color:"#64748b", fontSize:".65rem", textTransform:"uppercase", letterSpacing:".08em" }}>{label}</div>
                <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:".82rem" }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <div style={{ background:"linear-gradient(180deg, #1a0a3e 0%, #080514 100%)", padding:"3.5rem 2rem 2.5rem", textAlign:"center", position:"relative", overflow:"hidden" }}>
        {/* Glow effect */}
        <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:600, height:300, background:"radial-gradient(ellipse, rgba(137,41,189,.18) 0%, transparent 70%)", pointerEvents:"none" }}/>
        <div style={{ maxWidth:800, margin:"0 auto", position:"relative" }}>
          <div style={{ color:"#8929bd", fontSize:".72rem", fontWeight:800, textTransform:"uppercase", letterSpacing:".15em", marginBottom:".75rem" }}>
            📡 Verified Distribution Report
          </div>
          <div style={{ color:"#a5b4fc", fontWeight:800, fontSize:"1.1rem", marginBottom:".5rem" }}>{report.company_name}</div>
          <h1 style={{ color:"white", fontWeight:900, fontSize:"clamp(1.4rem, 3vw, 2rem)", lineHeight:1.25, margin:"0 0 2.5rem", textShadow:"0 2px 20px rgba(139,92,246,.3)" }}>
            {report.pr_title}
          </h1>

          {/* Stats row */}
          <div style={{ display:"flex", justifyContent:"center", gap:"1.5rem", flexWrap:"wrap" }}>
            {[
              { val: published.length.toString(), label: "Publications" },
              { val: published.length.toString(), label: "News Sites" },
              { val: tierStats.readers,           label: "Est. Monthly Readers" },
              { val: maxDA > 0 ? maxDA.toString() : tierStats.authority.toString(), label: "Max Authority (DA)" },
            ].map(({ val, label }) => (
              <div key={label} style={{ background:"rgba(255,255,255,.04)", border:"1px solid rgba(139,92,246,.2)", borderRadius:".85rem", padding:"1.25rem 1.75rem", minWidth:130 }}>
                <div style={{ color:"#c4b5fd", fontWeight:900, fontSize:"1.9rem", lineHeight:1 }}>{val}</div>
                <div style={{ color:"#64748b", fontSize:".72rem", marginTop:".3rem", textTransform:"uppercase", letterSpacing:".06em" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"2rem" }}>

        {/* ── POWER 5 GRID ──────────────────────────────────────────────────── */}
        {power5InReport.length > 0 && (
          <div style={{ marginBottom:"2.5rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:.75+"rem", marginBottom:"1.25rem" }}>
              <div style={{ height:2, flex:1, background:"linear-gradient(90deg, #8929bd, transparent)" }}/>
              <h2 style={{ color:"white", fontWeight:900, fontSize:"1rem", margin:0, textTransform:"uppercase", letterSpacing:".1em", whiteSpace:"nowrap" }}>
                ⭐ Top Authority Publishers
              </h2>
              <div style={{ height:2, flex:1, background:"linear-gradient(90deg, transparent, #8929bd)" }}/>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"1rem", justifyContent: power5InReport.length < 5 ? "center" : "flex-start" }}>
              {power5InReport.map(([domain, info]) => {
                const row = published.find(r => r.domain?.toLowerCase().includes(domain) || domain.includes(r.domain?.toLowerCase()));
                return (
                  <a key={domain} href={row?.published_url || `https://${domain}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none", width:190, flexShrink:0 }}>
                    <div style={{ background:`linear-gradient(135deg, rgba(${info.color==='#6366f1'?'99,102,241':info.color==='#8929bd'?'137,41,189':info.color==='#0ea5e9'?'14,165,233':info.color==='#d97706'?'217,119,6':'16,185,129'},.15) 0%, rgba(8,5,20,.8) 100%)`, border:`1px solid ${info.color}44`, borderRadius:"1rem", padding:"1.25rem", transition:"transform .15s, border-color .15s", cursor:"pointer" }}
                      onMouseOver={e=>{(e.currentTarget as HTMLElement).style.transform="translateY(-3px)";(e.currentTarget as HTMLElement).style.borderColor=info.color;}}
                      onMouseOut={e=>{(e.currentTarget as HTMLElement).style.transform="";(e.currentTarget as HTMLElement).style.borderColor=info.color+"44";}}>
                      <div style={{ display:"flex", alignItems:"center", gap:".5rem", marginBottom:".85rem" }}>
                        <Favicon domain={domain} />
                        <span style={{ color:"white", fontWeight:800, fontSize:".85rem" }}>{info.name}</span>
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:".4rem .75rem" }}>
                        {[["DA", info.da], ["Traffic", info.traffic], ["Rank", info.rank]].map(([k, v]) => (
                          <div key={String(k)}>
                            <div style={{ color:"#64748b", fontSize:".6rem", textTransform:"uppercase", letterSpacing:".06em" }}>{k}</div>
                            <div style={{ color:info.color, fontWeight:700, fontSize:".78rem" }}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* ── FULL PUBLICATIONS TABLE ───────────────────────────────────────── */}
        <div style={{ marginBottom:"3rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:.75+"rem", marginBottom:"1.25rem" }}>
            <div style={{ height:2, flex:1, background:"linear-gradient(90deg, #6366f1, transparent)" }}/>
            <h2 style={{ color:"white", fontWeight:900, fontSize:"1rem", margin:0, textTransform:"uppercase", letterSpacing:".1em", whiteSpace:"nowrap" }}>
              📰 All Publications ({otherSites.length + power5InReport.length})
            </h2>
            <div style={{ height:2, flex:1, background:"linear-gradient(90deg, transparent, #6366f1)" }}/>
          </div>

          <div style={{ background:"rgba(255,255,255,.03)", border:"1px solid rgba(139,92,246,.15)", borderRadius:"1rem", overflow:"hidden" }}>
            {/* Table header */}
            <div style={{ display:"grid", gridTemplateColumns:"minmax(120px,auto) 1fr 44px 80px", gap:"1rem", padding:".65rem 1.25rem", background:"rgba(137,41,189,.12)", borderBottom:"1px solid rgba(139,92,246,.15)" }}>
              {["Publication", "Article Link", "DA", "Status"].map(h => (
                <div key={h} style={{ color:"#8929bd", fontSize:".65rem", fontWeight:800, textTransform:"uppercase", letterSpacing:".08em" }}>{h}</div>
              ))}
            </div>

            {/* Power 5 rows first */}
            {power5InReport.map(([domain, info]) => {
              const row = published.find(r => r.domain?.toLowerCase().includes(domain));
              return (
                <div key={domain} style={{ display:"grid", gridTemplateColumns:"minmax(120px,auto) 1fr 44px 80px", gap:"1rem", padding:".7rem 1.25rem", borderBottom:"1px solid rgba(255,255,255,.04)", alignItems:"center", background:"rgba(137,41,189,.05)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:".5rem" }}>
                    <Favicon domain={domain} />
                    <div>
                      <div style={{ color:"white", fontWeight:700, fontSize:".8rem" }}>{info.name}</div>
                      <div style={{ color:"#475569", fontSize:".68rem" }}>{domain}</div>
                    </div>
                  </div>
                  <div style={{ overflow:"hidden" }}>
                    {row?.published_url ? (
                      <a href={row.published_url} target="_blank" rel="noopener noreferrer" style={{ color:"#a5b4fc", fontSize:".72rem", textDecoration:"none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block" }}
                        onMouseOver={e=>(e.currentTarget.style.color="#c4b5fd")} onMouseOut={e=>(e.currentTarget.style.color="#a5b4fc")}>
                        {row.published_url} ↗
                      </a>
                    ) : <span style={{ color:"#334155", fontSize:".72rem" }}>—</span>}
                  </div>
                  <div style={{ color:info.color, fontWeight:700, fontSize:".78rem" }}>{info.da}</div>
                  <span style={{ background:"#052e1620", color:"#34d399", border:"1px solid #34d39944", fontSize:".65rem", fontWeight:700, padding:".15rem .5rem", borderRadius:"99px", whiteSpace:"nowrap" }}>
                    ✓ Published
                  </span>
                </div>
              );
            })}

            {/* Other sites */}
            {otherSites.map((row, i) => (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"minmax(120px,auto) 1fr 44px 80px", gap:"1rem", padding:".65rem 1.25rem", borderBottom:"1px solid rgba(255,255,255,.03)", alignItems:"center" }}
                onMouseOver={e=>(e.currentTarget.style.background="rgba(255,255,255,.03)")}
                onMouseOut={e=>(e.currentTarget.style.background="")}>
                <div style={{ display:"flex", alignItems:"center", gap:".5rem" }}>
                  <Favicon domain={row.domain} />
                  <div>
                    <div style={{ color:"#e2e8f0", fontWeight:600, fontSize:".78rem", textTransform:"capitalize" }}>{row.domain?.replace(/\.(com|net|org|io|co)$/i, "").replace(/[-.]/g, " ")}</div>
                    <div style={{ color:"#334155", fontSize:".65rem" }}>{row.domain}</div>
                  </div>
                </div>
                <div style={{ overflow:"hidden" }}>
                  {row.published_url ? (
                    <a href={row.published_url} target="_blank" rel="noopener noreferrer" style={{ color:"#64748b", fontSize:".7rem", textDecoration:"none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block" }}
                      onMouseOver={e=>(e.currentTarget.style.color="#a5b4fc")} onMouseOut={e=>(e.currentTarget.style.color="#64748b")}>
                      {row.published_url} ↗
                    </a>
                  ) : <span style={{ color:"#1e293b", fontSize:".7rem" }}>—</span>}
                </div>
                <div style={{ color: row.da >= 80 ? "#c4b5fd" : row.da >= 50 ? "#a5b4fc" : "#64748b", fontWeight:600, fontSize:".75rem" }}>
                  {row.da || "—"}
                </div>
                <span style={{ background:"#05140c", color:"#22c55e", border:"1px solid #22c55e33", fontSize:".65rem", fontWeight:700, padding:".15rem .5rem", borderRadius:"99px", whiteSpace:"nowrap" }}>
                  ✓ Published
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <div style={{ background:"#040210", borderTop:"1px solid rgba(139,92,246,.15)", padding:"2rem", textAlign:"center" }}>
        <a href="https://xtremewebsites.com/press-release-marketing/" target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none", display:"inline-flex", alignItems:"center", gap:".5rem", background:"rgba(137,41,189,.12)", border:"1px solid rgba(137,41,189,.3)", borderRadius:"99px", padding:".4rem 1rem" }}>
          <span style={{ color:"#8929bd", fontWeight:900, fontSize:".75rem" }}>✓</span>
          <span style={{ color:"#c4b5fd", fontWeight:700, fontSize:".75rem" }}>Verified by Media Blast Boosters™</span>
        </a>
      </div>
    </div>
  );
}
