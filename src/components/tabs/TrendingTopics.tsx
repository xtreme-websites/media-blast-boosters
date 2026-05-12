import { useState, useEffect } from "react";
import { callClaude } from "../../lib/ai";
import { store } from "../../lib/ai";
import { SUPABASE_URL } from "../../lib/supabase";
import { CompanyData, Topic } from "../../lib/constants";
import { NewsIcon, ZapIcon, SearchIcon, LoaderIcon, ExternalLinkIcon, AlertIcon } from "../icons";

interface TrendingTopicsProps {
  companyData: CompanyData;
  showToast: (msg: string, type?: "success" | "error") => void;
  onTopicSelect: (topic: Topic & { selectedIdea?: string }) => void;
}

export default function TrendingTopics({ companyData, showToast, onTopicSelect }: TrendingTopicsProps) {
  const [trendingTopics,   setTrendingTopics]   = useState<Topic[]>(() => {
    try { const c = localStorage.getItem("mbb:trendingTopics"); return c ? JSON.parse(c) : []; } catch { return []; }
  });
  const [topicsPage,       setTopicsPage]       = useState(0);
  const [topicsFetched,    setTopicsFetched]    = useState(0);
  const [isLoading,        setIsLoading]        = useState(false);
  const [error,            setError]            = useState<string | null>(null);
  const [contentIdeas,     setContentIdeas]     = useState<Record<string, string[]>>({});
  const [showContentIdeas, setShowContentIdeas] = useState<Record<string, boolean>>({});

  // Persist topics to localStorage whenever they change
  useEffect(() => {
    if (trendingTopics.length > 0) {
      try { localStorage.setItem("mbb:trendingTopics", JSON.stringify(trendingTopics)); } catch {}
    }
  }, [trendingTopics]);

  const { industry, services } = companyData;


  const generateContentIdeas = async (topic: Topic) => {
    const tid = topic.title;
    setShowContentIdeas(p => ({ ...p, [tid]: true }));
    if (contentIdeas[tid]) return;
    try {
      const text = await callClaude(
        `For the topic "${topic.title}" in the ${industry || "business"} industry, generate 4 compelling press release angles for ${companyData.name || "a company"}. Return ONLY a JSON array of 4 short headline strings.`,
        "Return ONLY a JSON array of 4 strings. No markdown."
      );
      const ideas = JSON.parse(text.replace(/```json|```/g, "").trim());
      setContentIdeas(p => ({ ...p, [tid]: ideas }));
    } catch {
      setContentIdeas(p => ({
        ...p, [tid]: [
          `How ${industry || "Business"} Leaders Can Leverage This Trend`,
          `5 Actionable Insights from the Latest ${industry || "Industry"} Data`,
          `What This Means for Your ${industry || "Business"} in 2025`,
          `Expert Take: The ${industry || "Industry"} Strategy You Need Now`,
        ],
      }));
    }
  };

  const fetchTrendingTopics = async () => {
    const ind  = (industry  || "").trim();
    const svcs = (services  || "").trim();
    if (!ind) { showToast("Add your industry in Company Data first", "error"); return; }

    setIsLoading(true); setError(null); setTrendingTopics([]); setTopicsPage(0); setTopicsFetched(0);

    const svcList = svcs ? svcs.split(",").map(s => s.trim()).filter(Boolean) : [];
    const queries = [`${ind} news`, `${ind} industry trends`, ...svcList.map(s => `${s} news`)];
    const normT   = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();

    const parseXml = (xml: string): Topic[] => {
      const doc   = new DOMParser().parseFromString(xml, "text/xml");
      const items = Array.from(doc.querySelectorAll("item")).slice(0, 20);
      const isLowQuality = (title: string, desc: string) =>
        desc.length < 80 || title.trim().split(/\s+/).length < 3;
      const seen = new Set<string>();
      return items.map(el => {
        const title   = el.querySelector("title")?.textContent?.replace(/\s*-\s*[^-]+$/, "").trim() || "";
        const link    = el.querySelector("link")?.textContent?.trim() || "";
        const pubDate = el.querySelector("pubDate")?.textContent?.trim() || "";
        const source  = el.querySelector("source")?.textContent?.trim() || "";
        const rawDesc = el.querySelector("description")?.textContent?.replace(/<[^>]+>/g, "").trim() || "";
        const desc    = rawDesc.replace(/&nbsp;/g, " ").replace(/&#160;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#\d+;/g, " ").replace(/\s{2,}/g, " ").trim();
        const d       = pubDate ? new Date(pubDate) : null;
        const date    = d && !isNaN(d.getTime()) ? `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}` : "";
        return { title, summary: desc.slice(0, 286) + "…", source, date, url: link, relevance: "High", _desc: desc };
      })
      .filter(t => {
        if (!t.title || !t.url) return false;
        if (isLowQuality(t.title, t._desc)) return false;
        const key = normT(t.title);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(({ _desc, ...t }) => t)
      .slice(0, 6);
    };

    const fetchRSS = async (query: string): Promise<Topic[]> => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/rss-fetch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return [];
        const data = await res.json();
        if (data.error || !data.xml || data.xml.length < 100) return [];
        return parseXml(data.xml);
      } catch { return []; }
    };

    let all: Topic[] = [];
    const seenUrls   = new Set<string>();
    const seenTitles = new Set<string>();

    for (const query of queries) {
      if (all.length >= 12) break;
      try {
        const batch = await fetchRSS(query);
        const fresh = batch.filter(t => !seenUrls.has(t.url) && !seenTitles.has(normT(t.title)));
        fresh.forEach(t => { seenUrls.add(t.url); seenTitles.add(normT(t.title)); });
        all = [...all, ...fresh].slice(0, 12);
        if (all.length > 0) { setTrendingTopics([...all]); setTopicsFetched(all.length); }
      } catch {}
    }

    if (all.length === 0) setError("Could not load articles — try again in a moment.");
    else {
      showToast(`${all.length} live articles found!`);
      try { await store.set("mbb:trendingTopics", JSON.stringify(all)); } catch {}
    }
    setIsLoading(false);
  };

  return (
    <div className="animate-fadein">
      <div style={{ marginBottom: "1.25rem" }}>
        <h2 className="font-display" style={{ fontSize: "1.3rem", fontWeight: 700, color: "#0f172a", marginBottom: ".2rem" }}>Trending Topics</h2>
        <p style={{ color: "#64748b", fontSize: ".875rem" }}>
          AI-curated topics for <strong>{industry || "your industry"}</strong>
          {companyData.services && (
            <span style={{ color: "#94a3b8" }}>
              {" · "}{companyData.services.split(",").slice(0, 3).map(s => s.trim()).join(", ")}{companyData.services.split(",").length > 3 ? "…" : ""}
            </span>
          )}
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "5rem 0", gap: "1rem" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,#4f46e5,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LoaderIcon size={28}/>
          </div>
          <p style={{ color: "#64748b", fontWeight: 600, fontSize: ".95rem" }}>Fetching live {industry || "industry"} articles…</p>
          <div style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
            <div style={{ background: "#e0e7ff", borderRadius: "99px", height: 6, width: 160, overflow: "hidden" }}>
              <div style={{ background: "linear-gradient(90deg,#4f46e5,#7c3aed)", height: "100%", width: `${Math.min((topicsFetched / 12) * 100, 95)}%`, transition: "width .5s ease", borderRadius: "99px" }}/>
            </div>
            <span style={{ color: "#6366f1", fontSize: ".82rem", fontWeight: 700, minWidth: 40 }}>{topicsFetched}/12</span>
          </div>
          <p style={{ color: "#94a3b8", fontSize: ".78rem" }}>{topicsFetched < 6 ? "Loading batch 1…" : "Loading batch 2…"}</p>
        </div>
      ) : trendingTopics.length > 0 ? (
        <>
          {/* Page indicator */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: ".85rem" }}>
            <span style={{ fontSize: ".78rem", color: "#94a3b8", fontWeight: 500 }}>
              Showing {topicsPage * 6 + 1}–{Math.min(topicsPage * 6 + 6, trendingTopics.length)} of {trendingTopics.length} topics
            </span>
            <div style={{ display: "flex", gap: ".35rem" }}>
              {[0, 1].filter(p => p * 6 < trendingTopics.length).map(p => (
                <button key={p} onClick={() => setTopicsPage(p)} style={{ width: 28, height: 28, borderRadius: ".35rem", border: "none", cursor: "pointer", fontWeight: 700, fontSize: ".78rem", background: topicsPage === p ? "#4f46e5" : "#f1f5f9", color: topicsPage === p ? "white" : "#64748b", transition: "all .15s" }}>{p + 1}</button>
              ))}
            </div>
          </div>

          {/* Topic cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: ".75rem" }}>
            {trendingTopics.slice(topicsPage * 6, topicsPage * 6 + 6).map((t, i) => (
              <div key={`${topicsPage}-${i}`} className="topic-card animate-fadein" style={{ animationDelay: `${i * 30}ms` }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: ".75rem", marginBottom: ".6rem" }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: ".95rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.4, marginBottom: ".35rem" }}>{t.title}</h3>
                    <p style={{ fontSize: ".825rem", color: "#64748b", lineHeight: 1.6 }}>{t.summary}</p>
                  </div>
                  <button onClick={() => window.open(t.url, "_blank", "noopener,noreferrer")} title="Open article"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#818cf8", flexShrink: 0, marginTop: "2px", padding: 0 }}>
                    <ExternalLinkIcon size={15}/>
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: ".5rem" }}>
                  <div style={{ display: "flex", gap: ".4rem" }}>
                    <button onClick={() => generateContentIdeas(t)} style={{ background: "#f1f5f9", color: "#475569", fontSize: ".75rem", fontWeight: 600, padding: ".35rem .75rem", borderRadius: ".4rem", border: "1px solid #e2e8f0", cursor: "pointer" }}>💡 Content Ideas</button>
                    <button onClick={() => onTopicSelect({ ...t, selectedIdea: undefined })} style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "white", fontSize: ".75rem", fontWeight: 600, padding: ".35rem .75rem", borderRadius: ".4rem", border: "none", cursor: "pointer" }}>✍️ Create PR</button>
                  </div>
                  <div style={{ display: "flex", gap: "1rem", fontSize: ".75rem", color: "#94a3b8" }}>
                    <span>📰 {t.source}</span><span>📅 {t.date}</span>
                  </div>
                </div>
                {showContentIdeas[t.title] && (
                  <div style={{ marginTop: ".75rem", background: "#f8faff", borderRadius: ".5rem", padding: ".75rem 1rem", border: "1px solid #e0e7ff" }}>
                    <p style={{ fontSize: ".72rem", fontWeight: 700, color: "#4338ca", marginBottom: ".5rem", letterSpacing: ".04em" }}>💡 PRESS RELEASE ANGLES</p>
                    {contentIdeas[t.title] ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: ".3rem" }}>
                        {contentIdeas[t.title].map((idea, j) => (
                          <button key={j} onClick={() => onTopicSelect({ ...t, selectedIdea: idea })}
                            style={{ background: "none", border: "none", textAlign: "left", cursor: "pointer", fontSize: ".82rem", color: "#374151", padding: ".3rem .4rem", borderRadius: ".35rem" }}
                            onMouseOver={e => (e.currentTarget.style.background = "#e0e7ff")}
                            onMouseOut={e => (e.currentTarget.style.background = "none")}>
                            {j + 1}. {idea}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: ".5rem", color: "#94a3b8", fontSize: ".8rem" }}>
                        <LoaderIcon size={14}/> Generating...
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {trendingTopics.length > 6 && (
            <div style={{ display: "flex", justifyContent: "center", gap: ".5rem", marginTop: "1.25rem" }}>
              <button onClick={() => setTopicsPage(p => Math.max(0, p - 1))} disabled={topicsPage === 0} className="btn-secondary" style={{ padding: ".45rem .9rem", fontSize: ".8rem", opacity: topicsPage === 0 ? .4 : 1 }}>← Prev</button>
              {[0, 1].filter(p => p * 6 < trendingTopics.length).map(p => (
                <button key={p} onClick={() => setTopicsPage(p)} style={{ width: 36, height: 36, borderRadius: ".4rem", border: "none", cursor: "pointer", fontWeight: 700, fontSize: ".85rem", background: topicsPage === p ? "linear-gradient(135deg,#4f46e5,#7c3aed)" : "#f1f5f9", color: topicsPage === p ? "white" : "#64748b" }}>{p + 1}</button>
              ))}
              <button onClick={() => setTopicsPage(p => Math.min(Math.ceil(trendingTopics.length / 6) - 1, p + 1))} disabled={topicsPage >= Math.ceil(trendingTopics.length / 6) - 1} className="btn-secondary" style={{ padding: ".45rem .9rem", fontSize: ".8rem", opacity: topicsPage >= Math.ceil(trendingTopics.length / 6) - 1 ? .4 : 1 }}>Next →</button>
            </div>
          )}

          {/* Rescan */}
          <div style={{ borderTop: "1px solid #f1f5f9", marginTop: "1.5rem", paddingTop: "1rem", display: "flex", justifyContent: "center" }}>
            <button onClick={fetchTrendingTopics} disabled={isLoading} style={{ display: "flex", alignItems: "center", gap: ".5rem", background: "none", border: "none", color: "#64748b", fontSize: ".875rem", cursor: "pointer", padding: ".5rem 1rem", borderRadius: ".5rem", fontWeight: 500 }}
              onMouseOver={e => (e.currentTarget.style.background = "#f1f5f9")} onMouseOut={e => (e.currentTarget.style.background = "none")}>
              <SearchIcon size={15}/> Rescan Topics
            </button>
          </div>
        </>
      ) : (
        <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "4rem 2rem", gap: "1.5rem" }}>
          {error && (
            <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: ".6rem", padding: ".75rem 1rem", color: "#be123c", fontSize: ".875rem", display: "flex", gap: ".5rem", alignItems: "center" }}>
              <AlertIcon size={16}/>{error}
            </div>
          )}
          <div style={{ fontSize:"3.5rem", lineHeight:1 }}>🔥</div>
          <div style={{ textAlign: "center" }}>
            <p className="font-display" style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a", marginBottom: ".5rem" }}>Discover What's Trending</p>
            <p style={{ color: "#64748b", fontSize: ".875rem", maxWidth: "360px" }}>
              AI generates 12 relevant trending topics for <strong>{industry || "your industry"}</strong>{companyData.services ? `, tailored to your services` : ""} — ready to turn into press releases.
            </p>
          </div>
          <button onClick={fetchTrendingTopics} disabled={isLoading} className="btn-primary" style={{ padding: ".75rem 2rem" }}>
            <ZapIcon size={16}/> Run Analysis
          </button>
        </div>
      )}
    </div>
  );
}
