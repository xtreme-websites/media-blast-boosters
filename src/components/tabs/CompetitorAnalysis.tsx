import React, { useState, useMemo, useEffect } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { callClaude } from "../../lib/ai";
import { supabase } from "../../lib/supabase";
import { store } from "../../lib/ai";
import { RADAR_COLORS } from "../../lib/constants";
import { SparklesIcon, SearchIcon, LoaderIcon, TrendUpIcon, TrendDownIcon, BarIcon, AlertIcon } from "../icons";

interface CompetitorData {
  userCompany: { name: string; scores: Record<string, number> };
  competitors: Array<{ name: string; scores: Record<string, number>; trend: string; gapAnalysis: string }>;
  competitiveIntelligence: string[];
}

interface CompetitorAnalysisProps {
  companyName: string;
  industry: string;
  locationId: string;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export default function CompetitorAnalysis({ companyName, industry, locationId, showToast }: CompetitorAnalysisProps) {
  const [competitorData, setCompetitorData] = useState<CompetitorData | null>(() => {
    try { const c = localStorage.getItem(`mbb:competitorData:${locationId}`); return c ? JSON.parse(c) : null; } catch { return null; }
  });
  const [isScanning,     setIsScanning]     = useState(false);
  const [marketError,    setMarketError]    = useState<string | null>(null);

  useEffect(() => {
    if (competitorData) {
      try { localStorage.setItem(`mbb:competitorData:${locationId}`, JSON.stringify(competitorData)); } catch {}
    }
  }, [competitorData, locationId]);


  const scanMarket = async () => {
    if (!companyName.trim() || !industry.trim()) {
      showToast("Add company name and industry in Company Data first", "error"); return;
    }
    setIsScanning(true); setMarketError(null); setCompetitorData(null);
    try {
      const text = await callClaude(
        `Analyze competitive PR landscape for "${companyName}" in "${industry}". Use 3 real named competitors. Return ONLY this JSON:
{"userCompany":{"name":"${companyName}","scores":{"aiCitation":72,"mediaAuthority":65,"newsVolume":58,"sentimentPositivity":80,"topicLeadership":61}},"competitors":[{"name":"CompetitorName","scores":{"aiCitation":85,"mediaAuthority":78,"newsVolume":70,"sentimentPositivity":75,"topicLeadership":82},"trend":"up","gapAnalysis":"One sentence describing where they outperform you"}],"competitiveIntelligence":["Actionable insight 1","Actionable insight 2","Actionable insight 3","Actionable insight 4","Actionable insight 5"]}
Replace example numbers with realistic varied scores 0-100. Include exactly 3 competitors.`,
        "You are a PR intelligence analyst. Return ONLY valid JSON, no markdown."
      );
      const data = JSON.parse(text.replace(/```json|```/g, "").trim());
      setCompetitorData(data);
      try { await store.set("mbb:competitorData", JSON.stringify(data)); } catch {}
      try {
        await supabase.from("competitor_analysis").insert({
          location_id:              locationId,
          company_name:             companyName,
          industry,
          competitors:              data.competitors,
          user_scores:              data.userCompany.scores,
          competitive_intelligence: data.competitiveIntelligence.join("\n"),
        });
      } catch {}
      showToast("Competitor analysis complete!");
    } catch {
      setMarketError("Analysis failed — try again.");
    }
    setIsScanning(false);
  };

  const radarChartData = useMemo(() => {
    if (!competitorData) return [];
    return ["aiCitation", "mediaAuthority", "newsVolume", "sentimentPositivity", "topicLeadership"].map((key, i) => {
      const names = ["AI Citation", "Media Authority", "News Volume", "Sentiment", "Topic Leadership"];
      const pt: Record<string, unknown> = { metric: names[i], [competitorData.userCompany.name]: competitorData.userCompany.scores[key] };
      competitorData.competitors.forEach(c => { pt[c.name] = c.scores[key]; });
      return pt;
    });
  }, [competitorData]);

  return (
    <div className="animate-fadein">
      <div style={{ marginBottom: "1.25rem" }}>
        <h2 className="font-display" style={{ fontSize: "1.3rem", fontWeight: 700, color: "#0f172a", marginBottom: ".2rem" }}>Competitor Analysis</h2>
        <p style={{ color: "#64748b", fontSize: ".875rem" }}>AI-powered competitive PR benchmarking for <strong>{companyName || "your company"}</strong></p>
      </div>

      {!competitorData ? (
        <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "4rem 2rem", gap: "1.5rem" }}>
          {marketError && (
            <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: ".6rem", padding: ".75rem 1rem", color: "#be123c", fontSize: ".875rem", display: "flex", gap: ".5rem", alignItems: "center" }}>
              <AlertIcon size={16}/>{marketError}
            </div>
          )}
          <div style={{ fontSize:"3.5rem", lineHeight:1 }}>📊</div>
          <div style={{ textAlign: "center" }}>
            <p className="font-display" style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a", marginBottom: ".5rem" }}>Discover Your Competitive Position</p>
            <p style={{ color: "#64748b", fontSize: ".875rem", maxWidth: "360px" }}>AI benchmarks your PR performance against top competitors in {industry || "your industry"}.</p>
          </div>
          <button onClick={scanMarket} disabled={isScanning} className="btn-primary" style={{ padding: ".75rem 2rem" }}>
            {isScanning ? <><LoaderIcon size={16}/> Scanning...</> : <><SearchIcon size={16}/> Scan Market</>}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Radar chart */}
          <div style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", borderRadius: "1rem", padding: "1.5rem 1rem", boxShadow: "0 8px 32px rgba(0,0,0,.2)" }}>
            <h3 className="font-display" style={{ color: "white", fontSize: "1.05rem", fontWeight: 700, marginBottom: "1rem", paddingLeft: ".5rem" }}>Competitive PR Performance</h3>
            <ResponsiveContainer width="100%" height={360}>
              <RadarChart data={radarChartData}>
                <PolarGrid stroke="#334155"/>
                <PolarAngleAxis dataKey="metric" tick={{ fill: "#94a3b8", fontSize: 12 }}/>
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#475569", fontSize: 10 }}/>
                <Radar name={competitorData.userCompany.name} dataKey={competitorData.userCompany.name} stroke="#818cf8" fill="#818cf8" fillOpacity={0.45} strokeWidth={2.5} isAnimationActive animationDuration={900}/>
                {competitorData.competitors.map((c, i) => (
                  <Radar key={i} name={c.name} dataKey={c.name} stroke={RADAR_COLORS[i + 1]} fill={RADAR_COLORS[i + 1]} fillOpacity={0.15} strokeWidth={1.5} isAnimationActive animationDuration={900}/>
                ))}
                <Legend wrapperStyle={{ paddingTop: "12px" }} iconType="circle"/>
                <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: ".5rem", color: "#e2e8f0" }}/>
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Metrics legend — vertical tabs */}
          {(() => {
            const METRICS = [
              { label:"AI Citation",      icon:"🤖", desc:"Measures how frequently your brand is mentioned or cited by AI systems like ChatGPT, Perplexity, and Gemini when users ask questions relevant to your industry. A higher score means AI is actively recommending your brand as a trusted source." },
              { label:"Media Authority",  icon:"📰", desc:"Reflects the credibility and domain authority of the news outlets that have published coverage about you. Coverage from high-authority outlets like Forbes or Reuters scores higher than low-authority blogs." },
              { label:"News Volume",      icon:"📊", desc:"The total count of press mentions, news articles, and media coverage published about your brand over the tracking period. Higher volume indicates broader media presence and active press activity." },
              { label:"Sentiment",        icon:"💬", desc:"Analyzes the overall emotional tone of your media coverage — ranging from negative to neutral to positive. A high sentiment score means the majority of coverage frames your brand favorably." },
              { label:"Topic Leadership", icon:"🏆", desc:"Measures how often your brand is cited as a primary source, expert voice, or thought leader on key industry topics. High scores indicate your brand shapes conversations rather than just participating in them." },
            ];
            const [activeMetric, setActiveMetric] = React.useState(0);
            return (
              <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:".75rem", overflow:"hidden" }}>
                <div style={{ padding:".75rem 1.1rem .5rem", fontSize:".68rem", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:".08em" }}>What each metric measures</div>
                <div style={{ display:"flex", minHeight:140 }}>
                  {/* Vertical tab list */}
                  <div style={{ width:165, flexShrink:0, borderRight:"1px solid #e2e8f0", display:"flex", flexDirection:"column" }}>
                    {METRICS.map((m, i) => (
                      <button key={m.label} onClick={() => setActiveMetric(i)}
                        style={{ display:"flex", alignItems:"center", gap:".5rem", padding:".55rem .85rem", border:"none", background: activeMetric===i ? "white" : "transparent", cursor:"pointer", textAlign:"left", borderLeft: activeMetric===i ? "3px solid #6366f1" : "3px solid transparent", transition:"all .15s" }}>
                        <span style={{ fontSize:".85rem" }}>{m.icon}</span>
                        <span style={{ fontSize:".73rem", fontWeight: activeMetric===i ? 700 : 500, color: activeMetric===i ? "#4f46e5" : "#64748b", lineHeight:1.3 }}>{m.label}</span>
                      </button>
                    ))}
                  </div>
                  {/* Content panel */}
                  <div style={{ flex:1, padding:"1rem 1.25rem", display:"flex", alignItems:"center" }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:".5rem", marginBottom:".5rem" }}>
                        <span style={{ fontSize:"1.2rem" }}>{METRICS[activeMetric].icon}</span>
                        <span style={{ fontWeight:700, fontSize:".92rem", color:"#1e293b" }}>{METRICS[activeMetric].label}</span>
                      </div>
                      <p style={{ fontSize:".83rem", color:"#475569", lineHeight:1.7, margin:0 }}>{METRICS[activeMetric].desc}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Competitor cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(195px,1fr))", gap: "1rem" }}>
            {competitorData.competitors.map((c, i) => (
              <div key={i} className="card" style={{ padding: "1rem 1.1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".5rem" }}>
                  <h4 style={{ fontWeight: 700, fontSize: ".875rem", color: "#0f172a" }}>{c.name}</h4>
                  {c.trend === "up"
                    ? <span style={{ color: "#10b981" }}><TrendUpIcon size={16}/></span>
                    : <span style={{ color: "#ef4444" }}><TrendDownIcon size={16}/></span>}
                </div>
                <p style={{ fontSize: ".78rem", color: "#64748b", lineHeight: 1.5 }}>{c.gapAnalysis}</p>
                <div style={{ marginTop: ".5rem", fontSize: ".72rem", fontWeight: 600, color: c.trend === "up" ? "#10b981" : "#ef4444" }}>
                  PR: {c.trend === "up" ? "↑ Increasing" : "↓ Decreasing"}
                </div>
              </div>
            ))}
          </div>

          {/* Competitive intelligence */}
          <div className="card" style={{ padding: "1.25rem", background: "linear-gradient(135deg,#f0f4ff,#f5f3ff)" }}>
            <h3 style={{ fontWeight: 700, color: "#1e1b4b", marginBottom: "1rem", display: "flex", alignItems: "center", gap: ".5rem", fontSize: "1rem" }}>
              <SparklesIcon size={18}/> Competitive Intelligence
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
              {competitorData.competitiveIntelligence.map((ins, i) => (
                <div key={i} style={{ display: "flex", gap: ".75rem", alignItems: "flex-start" }}>
                  <div style={{ background: "#4f46e5", color: "white", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".7rem", fontWeight: 700, flexShrink: 0, marginTop: "1px" }}>{i + 1}</div>
                  <p style={{ fontSize: ".85rem", color: "#374151", lineHeight: 1.6 }}>{ins}</p>
                </div>
              ))}
            </div>
          </div>

          <button onClick={scanMarket} disabled={isScanning} className="btn-secondary" style={{ justifyContent: "center" }}>
            {isScanning ? <><LoaderIcon size={15}/> Rescanning...</> : <><SearchIcon size={15}/> Rescan Market</>}
          </button>
        </div>
      )}
    </div>
  );
}
