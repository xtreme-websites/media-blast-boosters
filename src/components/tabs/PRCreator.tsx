import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { callClaude } from "../../lib/ai";
import { CompanyData, Topic, PR_PACKAGES, FOCUS_OPTIONS, THEME_OPTIONS } from "../../lib/constants";
import { SparklesIcon, LoaderIcon, BackIcon, ClipboardIcon, CopyIcon, CheckIcon, XIcon, UploadIcon, BriefIcon } from "../icons";

// ─── Inline KeywordTagInput (dashboard-styled) ───────────────────────────────
function KeywordTagInput({ keywords, onChange, maxKeywords = 2 }: { keywords: string[]; onChange: (kw: string[]) => void; maxKeywords?: number }) {
  const [input, setInput] = useState("");
  const sanitize = (v: string) => v.toLowerCase().replace(/[^a-z0-9\s-]/g, "");
  const add = () => {
    const t = sanitize(input).trim();
    if (t && !keywords.includes(t) && keywords.length < maxKeywords) { onChange([...keywords, t]); setInput(""); }
  };
  return (
    <div className="field-input" style={{ display: "flex", flexWrap: "wrap", gap: ".35rem", minHeight: "42px", padding: ".35rem .5rem", cursor: "text" }}>
      {keywords.map((kw, i) => (
        <span key={i} style={{ background: "#eef2ff", color: "#4338ca", fontSize: ".75rem", fontWeight: 600, padding: ".18rem .5rem", borderRadius: ".35rem", display: "flex", alignItems: "center", gap: ".2rem" }}>
          {kw}
          <button onClick={() => onChange(keywords.filter((_, j) => j !== i))} style={{ color: "#6366f1", fontWeight: 700, background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </span>
      ))}
      {keywords.length < maxKeywords && (
        <input value={input} onChange={e => setInput(sanitize(e.target.value))}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={keywords.length === 0 ? "Type + Enter" : "Add more..."}
          style={{ flex: 1, outline: "none", fontSize: ".875rem", minWidth: "100px", background: "transparent", border: "none", padding: ".1rem 0", textTransform:"lowercase" }}/>
      )}
    </div>
  );
}

// ─── KeywordPicker — 4 source sections ───────────────────────────────────────
import type { ServicePage, LocationPage } from "../../lib/constants";

function KeywordPicker({ selected, onChange, companyName, industry, servicePages, locationPages }: {
  selected: string[];
  onChange: (kw: string[]) => void;
  companyName: string;
  industry: string;
  servicePages: ServicePage[];
  locationPages: LocationPage[];
}) {
  const [input,       setInput]       = useState("");
  const [activeSection, setActiveSection] = useState<"own"|"home"|"service"|"location">("own");
  const MAX = 2;

  const sanitize = (v: string) => v.toLowerCase().replace(/[^a-z0-9\s-]/g, "");

  const toggle = (kw: string) => {
    const kl = kw.toLowerCase();
    if (selected.includes(kl)) {
      onChange(selected.filter(k => k !== kl));
    } else if (selected.length < MAX) {
      onChange([...selected, kl]);
    }
  };

  const addOwn = () => {
    const t = sanitize(input).trim();
    if (t && !selected.includes(t) && selected.length < MAX) { onChange([...selected, t]); setInput(""); }
  };

  // Home page keywords: company name + industry words
  const homeKws = [
    companyName,
    ...(industry ? industry.split(/[,\/]+/).map(s => s.trim()).filter(Boolean) : []),
  ].filter(Boolean).map(k => k.toLowerCase());

  // Service keywords: flatten all servicePages keywords
  const serviceKws = [...new Set(servicePages.flatMap(s => s.keywords || []))];

  // Location keywords: flatten all locationPages keywords
  const locationKws = [...new Set(locationPages.flatMap(l => l.keywords || []))];

  const tabs = [
    { id:"own"      as const, label:"✍️ Add Your Own",     count: null },
    { id:"home"     as const, label:"🏠 Home Page",         count: homeKws.length    },
    { id:"service"  as const, label:"🔧 Services",          count: serviceKws.length },
    { id:"location" as const, label:"📍 Locations",         count: locationKws.length},
  ];

  const KwChip = ({ kw }: { kw: string }) => {
    const isSelected = selected.includes(kw.toLowerCase());
    const disabled   = !isSelected && selected.length >= MAX;
    return (
      <button type="button" onClick={() => !disabled && toggle(kw)}
        style={{ padding:".25rem .6rem", borderRadius:".4rem", border:`1.5px solid ${isSelected ? "#6366f1" : "#e2e8f0"}`,
          background: isSelected ? "#eef2ff" : disabled ? "#fafafa" : "white",
          color: isSelected ? "#4338ca" : disabled ? "#c8ccd0" : "#374151",
          fontSize:".75rem", fontWeight: isSelected ? 700 : 500, cursor: disabled ? "not-allowed" : "pointer",
          transition:"all .12s", display:"flex", alignItems:"center", gap:".25rem" }}>
        {isSelected && <span style={{ color:"#6366f1" }}>✓</span>}{kw.toLowerCase()}
      </button>
    );
  };

  return (
    <div style={{ border:"1px solid #e2e8f0", borderRadius:".65rem", overflow:"hidden" }}>
      {/* Source tabs */}
      <div style={{ display:"flex", borderBottom:"1px solid #f1f5f9", background:"#f8fafc" }}>
        {tabs.map(t => (
          <button key={t.id} type="button" onClick={() => setActiveSection(t.id)}
            style={{ flex:1, padding:".45rem .3rem", border:"none", cursor:"pointer", fontSize:".7rem", fontWeight:600, transition:"all .12s",
              background: activeSection===t.id ? "white" : "transparent",
              color: activeSection===t.id ? "#4338ca" : "#94a3b8",
              borderBottom: activeSection===t.id ? "2px solid #6366f1" : "2px solid transparent" }}>
            {t.label}{t.count !== null ? <span style={{ marginLeft:".25rem", background:"#e2e8f0", borderRadius:"99px", padding:".05rem .35rem", fontSize:".65rem" }}>{t.count}</span> : null}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding:".65rem .75rem", minHeight:60 }}>
        {/* Selected chips always shown */}
        {selected.length > 0 && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:".3rem", marginBottom:".5rem" }}>
            {selected.map(kw => (
              <span key={kw} style={{ background:"#4338ca", color:"white", fontSize:".73rem", fontWeight:700, padding:".2rem .6rem", borderRadius:".35rem", display:"flex", alignItems:"center", gap:".25rem" }}>
                {kw}
                <button onClick={() => onChange(selected.filter(k => k !== kw))} style={{ color:"rgba(255,255,255,.8)", background:"none", border:"none", cursor:"pointer", lineHeight:1, padding:0, fontSize:".85rem" }}>×</button>
              </span>
            ))}
            <span style={{ fontSize:".72rem", color:"#94a3b8", alignSelf:"center" }}>{selected.length}/{MAX} selected</span>
          </div>
        )}

        {/* Own input */}
        {activeSection === "own" && (
          <div style={{ display:"flex", gap:".5rem" }}>
            <input value={input} onChange={e => setInput(sanitize(e.target.value))}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addOwn(); } }}
              placeholder="Type a keyword + Enter"
              disabled={selected.length >= MAX}
              style={{ flex:1, padding:".4rem .65rem", border:"1px solid #e2e8f0", borderRadius:".4rem", fontSize:".82rem", outline:"none", textTransform:"lowercase", background: selected.length >= MAX ? "#f8fafc" : "white" }}/>
            <button type="button" onClick={addOwn} disabled={!input.trim() || selected.length >= MAX}
              style={{ padding:".4rem .8rem", borderRadius:".4rem", border:"none", background:"#6366f1", color:"white", fontWeight:700, fontSize:".78rem", cursor:"pointer", opacity: !input.trim() || selected.length >= MAX ? .4 : 1 }}>
              Add
            </button>
          </div>
        )}

        {/* Home KWs */}
        {activeSection === "home" && (
          homeKws.length > 0
            ? <div style={{ display:"flex", flexWrap:"wrap", gap:".35rem" }}>{homeKws.map(kw => <KwChip key={kw} kw={kw}/>)}</div>
            : <p style={{ color:"#94a3b8", fontSize:".78rem", margin:0 }}>Add Company Name and Industry in Company Profile to see suggestions here.</p>
        )}

        {/* Service KWs */}
        {activeSection === "service" && (
          serviceKws.length > 0
            ? <div style={{ display:"flex", flexWrap:"wrap", gap:".35rem" }}>{serviceKws.map(kw => <KwChip key={kw} kw={kw}/>)}</div>
            : <p style={{ color:"#94a3b8", fontSize:".78rem", margin:0 }}>No service keywords found. Run the AI Crawl in Company Profile to discover them.</p>
        )}

        {/* Location KWs */}
        {activeSection === "location" && (
          locationKws.length > 0
            ? <div style={{ display:"flex", flexWrap:"wrap", gap:".35rem" }}>{locationKws.map(kw => <KwChip key={kw} kw={kw}/>)}</div>
            : <p style={{ color:"#94a3b8", fontSize:".78rem", margin:0 }}>No location keywords found. Run the AI Crawl in Company Profile to discover them.</p>
        )}
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface PRFormData {
  about: string; quote: string; keywords: string[]; wordCount: string;
  mainFocus: string; theme: string; videoUrl: string; mapsEmbed: string;
  featuredImage: File | null;
  includePartnerQuote: "no" | "yes";
  partnerQuote: string;
  partnerAttribution: string;
  mediaType: "topic" | "article" | "authority";
}

interface PRCreatorProps {
  companyData: CompanyData;
  customPRPrompt: string;
  selectedTopic: (Topic & { selectedIdea?: string }) | null;
  onClearTopic: () => void;
  onNavigateToTopics: () => void;
  onOpenCompanyData: () => void;
  onPlaceOrder: (packageType: string, prTitle: string, prContent: string) => void;
  onOpenCheckout: (packageType: string, prTitle: string, prContent: string) => void;
  onOpenCredits: () => void;
  onNavigateToPublished?: () => void;
  onOpenHelp?: () => void;
  locationId: string;
  showToast: (msg: string, type?: "success" | "error") => void;
}

const PROXY = "https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/supabase-proxy";
const TIER_CONFIG = {
  Starter:  { color:"#6366f1", light:"#eef2ff", words:"350",  outlets:"200+", readers:"2.2M",   authority:69  },
  Standard: { color:"#8929bd", light:"#f5f3ff", words:"500",  outlets:"300+", readers:"26.4M",  authority:88  },
  Premium:  { color:"#d97706", light:"#fffbeb", words:"1000", outlets:"450+", readers:"224.5M", authority:94  },
} as const;
type PRTier = keyof typeof TIER_CONFIG;

export default function PRCreator({
  companyData, customPRPrompt,
  selectedTopic, onClearTopic, onNavigateToTopics,
  onOpenCompanyData, onPlaceOrder, onOpenCheckout, onOpenCredits, onNavigateToPublished, onOpenHelp, locationId, showToast,
}: PRCreatorProps) {
  const [prFormData,           setPrFormData]           = useState<PRFormData>({ about: "", quote: "", keywords: [], wordCount: "500", mainFocus: "Company News", theme: "thought-provoking", videoUrl: "", mapsEmbed: "", featuredImage: null, includePartnerQuote: "no", partnerQuote: "", partnerAttribution: "", mediaType: "topic" });
  const [orderConfirm,         setOrderConfirm]         = useState<{ tier: PRTier; title: string } | null>(null);
  const [ctaPulse,             setCtaPulse]             = useState(false);
  const [agreedToTerms,        setAgreedToTerms]        = useState(false);
  const [selectedTier,         setSelectedTierState]    = useState<PRTier>("Standard");
  const [credits,              setCredits]              = useState<Record<string,number>>({ starter_credits:0, standard_credits:0, premium_credits:0 });

  // Fetch credits on mount
  useEffect(() => {
    if (!locationId) return;
    fetch(PROXY, { method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ table:"profiles", operation:"select", eq:{ location_id:locationId } }) })
      .then(r => r.json()).then(d => { if (d.data) setCredits(d.data); }).catch(() => {});
  }, [locationId]);

  const setSelectedTier = (tier: PRTier) => {
    setSelectedTierState(tier);
    setPrFormData(p => ({ ...p, wordCount: TIER_CONFIG[tier].words }));
  };

  const tierCredits = (tier: PRTier) => credits[`${tier.toLowerCase()}_credits`] ?? 0;
  const [generatedPR,          setGeneratedPR]          = useState("");
  const [isLoading,            setIsLoading]            = useState(false);
  const [showGeneratedView,    setShowGeneratedView]    = useState(false);
  const [showRefineDialog,     setShowRefineDialog]     = useState(false);
  const [refinementInstructions, setRefinementInstructions] = useState("");
  const [refinementCount,      setRefinementCount]      = useState(0);
  const [enhancingAbout,       setEnhancingAbout]       = useState(false);
  const [enhancingQuote,       setEnhancingQuote]       = useState(false);
  const [showFocusDropdown,    setShowFocusDropdown]    = useState(false);
  const [showThemeDropdown,    setShowThemeDropdown]    = useState(false);
  const [refMode,              setRefMode]              = useState<"topic" | "external">("topic");
  const [externalRef,          setExternalRef]          = useState("");
  const [imagePreviewUrl,      setImagePreviewUrl]      = useState<string | null>(null);
  const externalRefEl = useRef<HTMLDivElement>(null);

  const { name: companyName, industry, websiteUrl: siteUrl, quoteAttribution } = companyData;


  const generatePressRelease = async () => {
    if (!prFormData.about.trim() || !prFormData.quote.trim()) {
      showToast("Please fill in both the About and Quote fields", "error"); return;
    }
    // Media type validation
    if (prFormData.mediaType === "topic" && !selectedTopic) {
      showToast("Please select a Trending Topic or change Media Type", "error"); return;
    }
    if (prFormData.mediaType === "article" && !externalRef.trim()) {
      showToast("Please paste an article for the Existing Article option, or change Media Type", "error"); return;
    }
    setIsLoading(true); setShowGeneratedView(false); setRefinementCount(0);
    try {
      const { about, quote, keywords: kw, wordCount, mainFocus, theme, videoUrl, partnerQuote, partnerAttribution, includePartnerQuote } = prFormData;
      const kwText   = kw.length > 0 ? kw.join(", ") : "no specific keywords";
      const topicRef = selectedTopic && prFormData.mediaType === "topic" ? `\nBase this on trending angle: "${selectedTopic.selectedIdea || selectedTopic.title}"` : "";
      const extRef   = externalRef.trim() && prFormData.mediaType === "article" ? `\nUse the following as a style/structure reference — adapt the format and tone but write entirely new content for ${companyName || "this company"}:\n---\n${externalRef.trim()}\n---` : "";
      const coAbout  = companyData.about ? `\nCompany background: ${companyData.about}` : "";
      const contact  = [companyData.email, companyData.phone, companyData.address].filter(Boolean).join(" | ");

      // Build owner quote block (paragraph 3) — h2 attribution for consistency
      const ownerName = quoteAttribution || "Company Spokesperson";
      const ownerQuoteBlock = `<h2>${ownerName}, shared:</h2>\n<p><em>"${quote}"</em></p>`;

      // Build partner quote block (paragraph 5) if included
      const hasPartner = includePartnerQuote === "yes" && partnerQuote.trim();
      const partnerQuoteBlock = hasPartner
        ? `<h2>${partnerAttribution || "Partner"}, added:</h2>\n<p><em>"${partnerQuote}"</em></p>`
        : "";

      // Contact info — company name + labeled fields, tight spacing (margin:0 overrides prose)
      const cEmail   = companyData.email   ? `<p style="margin:0">Email: ${companyData.email}</p>` : "";
      const cPhone   = companyData.phone   ? `<p style="margin:0">Phone: ${companyData.phone}</p>` : "";
      const cAddress = companyData.address ? `<p style="margin:0">Address: ${companyData.address}</p>` : "";
      const cWebsite = siteUrl ? `<p style="margin:0">Website: <a href="${siteUrl}" target="_blank">${siteUrl}</a></p>` : "";
      const contactHTML = `<p style="margin:0"><strong>${companyName || "Company"}</strong></p>${cEmail}${cPhone}${cAddress}${cWebsite}`;

      // Keyword hyperlinking instruction
      const kwLinkInstruction = kw.length === 1
        ? `Hyperlink the keyword "${kw[0]}" exactly TWICE in the body paragraphs using <a href="${siteUrl || "#"}" target="_blank">${kw[0]}</a>. Do not hyperlink it more than twice.`
        : kw.length >= 2
        ? `Hyperlink "${kw[0]}" exactly ONCE and "${kw[1]}" exactly ONCE in the body paragraphs using <a href="${siteUrl || "#"}" target="_blank">keyword</a> tags. Do not hyperlink any keyword more than once.`
        : "";

      const prompt = customPRPrompt
        ? customPRPrompt
            .replace(/{companyName}/g, companyName).replace(/{industry}/g, industry)
            .replace(/{websiteUrl}/g, siteUrl).replace(/{mainFocus}/g, mainFocus)
            .replace(/{theme}/g, theme).replace(/{targetWords}/g, wordCount)
            .replace(/{keywordsText}/g, kwText).replace(/{about}/g, about)
            .replace(/{quote}/g, quote).replace(/{quoteAttribution}/g, quoteAttribution)
        : `Write a professional press release for ${companyName || "our company"} in the ${industry || "business"} industry.
REQUIREMENTS: ~${wordCount} words, focus: ${mainFocus}, tone: ${theme}, keywords: ${kwText}, website: ${siteUrl || "N/A"}.${topicRef}${extRef}${coAbout}
CONTENT: ${about}
${videoUrl ? `VIDEO REFERENCE: ${videoUrl}` : ""}

HEADLINE RULE: The <h1> title must be 10 words or fewer. Be punchy and newsworthy.

KEYWORD LINKS: ${kwLinkInstruction || "No keywords specified."}

HYPERLINKS: Any mention of the company website (${siteUrl || "N/A"}) must be a clickable <a href="${siteUrl || "#"}" target="_blank"> link.

MANDATORY STRUCTURE — output exactly this HTML, preserving paragraph order:
<h1>[Compelling headline — MAX 10 WORDS]</h1>
<p><strong>FOR IMMEDIATE RELEASE</strong></p>
<p>[City, State] — [Dateline intro paragraph about the news]</p>
<p>[2nd body paragraph expanding on the news — include keyword hyperlinks here]</p>
${ownerQuoteBlock}
<p>[4th paragraph: supporting detail, context, or additional company info]</p>
${hasPartner ? partnerQuoteBlock : "<p>[5th paragraph: call to action or closing detail]</p>"}
${hasPartner ? "<p>[6th paragraph: call to action or closing detail]</p>" : ""}
<h2>About ${companyName || "Company"}</h2>
<p>[Company boilerplate description. Include <a href="${siteUrl || "#"}" target="_blank">${siteUrl || "website"}</a> as a link.]</p>
<h2>Media Contact</h2>
${contactHTML}

RULES:
- Title MUST be 10 words or fewer — no exceptions.
- Keep the owner's quote as paragraph 3${hasPartner ? " and partner's quote as paragraph 5" : ""}.
- All h2 headings (About, Contact, and quote attributions) use <h2> tags.
- Contact details: output each one as its own <p> tag — NO labels like "Email:", "Phone:", "Address:", "Website:". Just the raw value.
- Do NOT add "Learn more at...", "Visit our website", "Visit ${siteUrl}", or ANY website URL or link inside the About section paragraph. The website appears only in Contact Information.
- Make it genuinely newsworthy and professionally written.`;

      const text = await callClaude(prompt, "You are an expert PR writer at a top agency. Write polished, publish-ready HTML press releases.", 2000);
      setGeneratedPR(text);
      setShowGeneratedView(true);
      setCtaPulse(false);
      showToast("Press release generated!");
      // Start pulsating CTA after 30 seconds
      setTimeout(() => setCtaPulse(true), 30000);
    } catch {
      showToast("Generation failed — please try again", "error");
    }
    setIsLoading(false);
  };

  const refinePressRelease = async () => {
    if (!refinementInstructions.trim() || refinementCount >= 5) return;
    setIsLoading(true);
    try {
      const text = await callClaude(
        `Refine this press release per these instructions: "${refinementInstructions}"\n\nCurrent press release:\n${generatedPR}\n\nReturn the complete refined version in proper HTML.`,
        "You are an expert PR editor. Apply the requested changes while maintaining professional quality.",
        2000
      );
      setGeneratedPR(text);
      setRefinementCount(p => p + 1);
      setShowRefineDialog(false);
      setRefinementInstructions("");
      showToast(`PR refined! (${refinementCount + 1}/5 used)`);
    } catch { showToast("Refinement failed — try again", "error"); }
    setIsLoading(false);
  };

  const handlePlaceOrder = (packageType?: string) => {
    const pkg = packageType ?? selectedTier;
    const h1Match = generatedPR.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const prTitle = h1Match ? h1Match[1].replace(/<[^>]*>/g, "") : prFormData.about.slice(0, 80) || "Press Release";
    onPlaceOrder(pkg, prTitle, generatedPR);
    setOrderConfirm({ tier: pkg as PRTier, title: prTitle });
  };

  return (
    <div className="animate-fadein">
      {/* Full-screen generating overlay — rendered at body level */}
      {isLoading && createPortal(
        <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(88,28,135,0.75)", backdropFilter:"blur(3px)", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:"1.25rem" }}>
          <div style={{ width:52, height:52, border:"4px solid rgba(255,255,255,.2)", borderTopColor:"white", borderRadius:"50%", animation:"spin .8s linear infinite" }}/>
          <div style={{ color:"white", fontWeight:700, fontSize:"1.15rem", letterSpacing:".02em" }}>Generating Press Release…</div>
          <div style={{ color:"rgba(255,255,255,.6)", fontSize:".82rem" }}>This usually takes 15–30 seconds</div>
        </div>,
        document.body
      )}
      {showGeneratedView && generatedPR ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="card" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: ".75rem" }}>
              <h2 className="font-display" style={{ fontSize: "1.2rem", fontWeight: 700, color: "#0f172a" }}>Generated Press Release</h2>
              <button onClick={() => {
                setShowGeneratedView(false);
                // Restore external ref content into the contentEditable div
                setTimeout(() => {
                  if (externalRefEl.current && externalRef) {
                    externalRefEl.current.innerHTML = externalRef;
                  }
                }, 50);
              }} className="btn-secondary" style={{ fontSize: ".8rem" }}>
                <BackIcon size={14}/> Back to Edit
              </button>
            </div>
            {/* Featured image above PR content */}
            {imagePreviewUrl && (
              <div style={{ marginBottom: "1rem" }}>
                <img src={imagePreviewUrl} alt="Featured" style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: ".5rem", border: "1px solid #e2e8f0" }}/>
              </div>
            )}
            <div className="prose" style={{ maxWidth: "none", padding: "1rem", background: "#f8fafc", borderRadius: ".6rem", border: "1px solid #e2e8f0" }}
              dangerouslySetInnerHTML={{ __html: generatedPR }}/>
            <div style={{ display: "flex", gap: ".75rem", marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid #f1f5f9", flexWrap: "wrap" }}>
              <button onClick={() => { navigator.clipboard.writeText(generatedPR.replace(/<[^>]*>/g, "")); showToast("Copied!"); }} className="btn-secondary"><ClipboardIcon size={15}/> Copy Text</button>
              <button onClick={() => { navigator.clipboard.writeText(generatedPR); showToast("HTML copied!"); }} className="btn-secondary"><CopyIcon size={15}/> Copy HTML</button>
              <button onClick={() => setShowRefineDialog(true)} disabled={refinementCount >= 5} className="btn-primary" style={{ marginLeft: "auto" }}>
                <SparklesIcon size={15}/> Refine with AI {refinementCount > 0 && `(${refinementCount}/5)`}
              </button>
            </div>
          </div>

          {/* Sticky CTA at bottom */}
          {(() => {
            const cfg = TIER_CONFIG[selectedTier];
            const bal = tierCredits(selectedTier);
            return (
              <>
                <style>{`
                  @keyframes pulse-ring {
                    0%   { box-shadow: 0 0 0 0 ${cfg.color}60; }
                    70%  { box-shadow: 0 0 0 12px ${cfg.color}00; }
                    100% { box-shadow: 0 0 0 0 ${cfg.color}00; }
                  }
                  .cta-pulse { animation: pulse-ring 1.5s ease-out infinite !important; }
                `}</style>
                <div style={{ position:"sticky", bottom:0, background:`linear-gradient(135deg, ${cfg.color}18, ${cfg.color}08)`, border:`2px solid ${cfg.color}40`, borderRadius:"1rem", padding:"1rem 1.5rem", backdropFilter:"blur(8px)", zIndex:10 }} className={ctaPulse ? "cta-pulse" : ""}>
                  <style>{`@keyframes pulse-ring { 0%{box-shadow:0 0 0 0 ${cfg.color}60} 70%{box-shadow:0 0 0 12px ${cfg.color}00} 100%{box-shadow:0 0 0 0 ${cfg.color}00} } .cta-pulse{animation:pulse-ring 1.5s ease-out infinite!important}`}</style>
                  {/* Agree checkbox */}
                  <label style={{ display:"flex", alignItems:"center", gap:".6rem", marginBottom:".75rem", cursor:"pointer", fontSize:".82rem", color:"#374151" }}>
                    <input type="checkbox" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)}
                      style={{ width:16, height:16, accentColor:cfg.color, cursor:"pointer", flexShrink:0 }}/>
                    I agree to the&nbsp;
                    <button type="button" onClick={onOpenHelp} style={{ background:"none", border:"none", padding:0, color:cfg.color, fontWeight:700, cursor:"pointer", fontSize:".82rem", textDecoration:"underline" }}>
                      Editorial Standards
                    </button>
                  </label>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"1.25rem", flexWrap:"wrap" }}>
                    <div>
                      <div style={{ fontWeight:800, fontSize:"1rem", color:"#1e293b", marginBottom:".2rem" }}>Ready to Publish?</div>
                      <div style={{ fontSize:".82rem", color:"#64748b" }}>
                        <span style={{ fontWeight:700, color:cfg.color }}>{selectedTier} Package</span> · {bal > 0 ? <span style={{ color:"#16a34a", fontWeight:600 }}>{bal} credit{bal>1?"s":""} available</span> : <span style={{ color:"#ef4444", fontWeight:600 }}>No credits available</span>}
                      </div>
                    </div>
                    {bal > 0
                      ? <button onClick={() => { if (!agreedToTerms) { showToast("Please agree to the Editorial Standards first", "error"); return; } handlePlaceOrder(); }}
                          style={{ background: agreedToTerms ? `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)` : "#e2e8f0", color: agreedToTerms ? "white" : "#94a3b8", border:"none", borderRadius:".6rem", padding:".75rem 1.5rem", fontWeight:800, fontSize:".95rem", cursor: agreedToTerms ? "pointer" : "not-allowed", whiteSpace:"nowrap", boxShadow: agreedToTerms ? `0 4px 14px ${cfg.color}40` : "none", transition:"all .2s" }}>
                          🚀 Order & Launch
                        </button>
                      : <button onClick={onOpenCredits} style={{ background:"#ef4444", color:"white", border:"none", borderRadius:".6rem", padding:".75rem 1.5rem", fontWeight:800, fontSize:".95rem", cursor:"pointer", whiteSpace:"nowrap" }}>
                          Buy {selectedTier} Credits →
                        </button>
                    }
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: "1.25rem" }}>
            <h2 className="font-display" style={{ fontSize: "1.3rem", fontWeight: 700, color: "#0f172a", marginBottom: ".2rem" }}>Media Content Creator</h2>
            <p style={{ color: "#64748b", fontSize: ".875rem" }}>Fill in the details and AI will write a professional, publish-ready press release.</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>

            {/* ── PR PACKAGE SELECTOR (field #1) ── */}
            <div>
              <label className="field-label">PR Package <span style={{ color: "#ef4444" }}>*</span></label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: ".75rem" }}>
                {(Object.entries(TIER_CONFIG) as [PRTier, typeof TIER_CONFIG[PRTier]][]).map(([tier, cfg]) => {
                  const bal = tierCredits(tier);
                  const isSelected = selectedTier === tier;
                  const noCredits = bal === 0;
                  return (
                    <div key={tier} onClick={() => setSelectedTier(tier)} style={{ border: `2px solid ${isSelected ? cfg.color : "#e2e8f0"}`, borderRadius: ".75rem", padding: "1rem", cursor: "pointer", background: isSelected ? cfg.light : "white", transition: "all .15s", position: "relative", boxShadow: isSelected ? `0 4px 14px ${cfg.color}30` : "none" }}>
                      {/* Credit badge */}
                      <div style={{ position: "absolute", top: 8, right: 8, background: noCredits ? "#fef2f2" : "#f0fdf4", color: noCredits ? "#ef4444" : "#10b981", fontSize: ".65rem", fontWeight: 700, padding: ".15rem .45rem", borderRadius: "99px", border: `1px solid ${noCredits ? "#fecaca" : "#bbf7d0"}` }}>
                        {noCredits ? "0 credits" : `${bal} credit${bal > 1 ? "s" : ""}`}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: ".9rem", color: isSelected ? cfg.color : "#1e293b", marginBottom: ".25rem" }}>{tier}</div>
                      <div style={{ fontSize: ".7rem", color: "#64748b", lineHeight: 1.4 }}>
                        {cfg.outlets} outlets · {cfg.words} words<br/>{cfg.readers} readers · DA {cfg.authority}
                      </div>
                      {isSelected && noCredits && (
                        <div style={{ marginTop:".5rem", fontSize:".7rem", color:cfg.color, fontWeight:600, textAlign:"center" }}>
                          ↓ See below to add credits
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* ── ALL FIELDS BELOW — disabled when no credits ── */}
            <div style={{ position:"relative" }}>
              {tierCredits(selectedTier) === 0 && (
                <div style={{ position:"absolute", inset:0, zIndex:10, borderRadius:".75rem", background:"rgba(248,250,252,0.7)", backdropFilter:"blur(1px)", cursor:"not-allowed", display:"flex", alignItems:"flex-start", justifyContent:"center", paddingTop:"3rem" }}>
                  <div style={{ background:"white", border:"1.5px solid #fecaca", borderRadius:".75rem", padding:".75rem 1.25rem", display:"flex", alignItems:"center", gap:".6rem", boxShadow:"0 4px 16px rgba(0,0,0,.08)" }}>
                    <span style={{ fontSize:"1.1rem" }}>🔒</span>
                    <span style={{ fontSize:".82rem", fontWeight:600, color:"#ef4444" }}>Purchase {selectedTier} credits to fill in this form</span>
                    <button onClick={onOpenCredits} style={{ background:"#ef4444", color:"white", border:"none", borderRadius:".4rem", padding:".3rem .7rem", fontSize:".75rem", fontWeight:700, cursor:"pointer" }}>Buy Credits</button>
                  </div>
                </div>
              )}
              <div style={{ display:"flex", flexDirection:"column", gap:"1.1rem", pointerEvents: tierCredits(selectedTier) === 0 ? "none" : "auto", opacity: tierCredits(selectedTier) === 0 ? 0.45 : 1, transition:"opacity .2s" }}>

            {/* Media Type — horizontal slim boxes */}
            <div>
              <label className="field-label">Media Type <span style={{ color: "#ef4444" }}>*</span></label>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:".5rem" }}>
                {([
                  { id:"topic",     icon:"📰", title:"Trending Topic",    desc:"Base on news" },
                  { id:"article",   icon:"📋", title:"Existing Article",  desc:"Reference article" },
                  { id:"authority", icon:"🏛️", title:"Authority",          desc:"Industry expert" },
                  { id:"freestyle", icon:"✍️", title:"Freestyle",          desc:"Open form" },
                ] as const).map(opt => (
                  <button key={opt.id} type="button" onClick={() => setPrFormData(p => ({ ...p, mediaType: opt.id }))}
                    style={{ border:`2px solid ${prFormData.mediaType===opt.id ? "#6366f1" : "#e2e8f0"}`, borderRadius:".6rem", padding:".6rem .65rem", background: prFormData.mediaType===opt.id ? "#eef2ff" : "white", cursor:"pointer", textAlign:"left", transition:"all .15s", display:"flex", alignItems:"center", gap:".5rem", boxShadow: prFormData.mediaType===opt.id ? "0 2px 8px rgba(99,102,241,.2)" : "none" }}>
                    <span style={{ fontSize:"1rem", flexShrink:0 }}>{opt.icon}</span>
                    <div>
                      <div style={{ fontWeight:700, fontSize:".75rem", color: prFormData.mediaType===opt.id ? "#4338ca" : "#1e293b", lineHeight:1.2 }}>{opt.title}</div>
                      <div style={{ fontSize:".65rem", color:"#94a3b8", lineHeight:1.2 }}>{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Content based on selected media type */}
              <div style={{ marginTop:".75rem" }}>
                {prFormData.mediaType === "topic" && (
                  selectedTopic ? (
                    <div style={{ background: "#f0f4ff", border: "1px solid #c7d2fe", borderRadius: ".6rem", padding: ".875rem 1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <p style={{ fontWeight: 600, color: "#3730a3", fontSize: ".875rem", marginBottom: ".25rem" }}>{selectedTopic.title}</p>
                          <p style={{ fontSize: ".75rem", color: "#6366f1" }}>Source: {selectedTopic.source}</p>
                          {selectedTopic.selectedIdea && <p style={{ fontSize: ".75rem", color: "#4338ca", marginTop: ".35rem", background: "#e0e7ff", padding: ".25rem .5rem", borderRadius: ".35rem", display: "inline-block" }}>Angle: {selectedTopic.selectedIdea}</p>}
                        </div>
                        <button onClick={onClearTopic} style={{ fontSize: ".75rem", color: "#6366f1", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>Clear</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: ".6rem", padding: ".875rem", textAlign: "center" }}>
                      <p style={{ color: "#94a3b8", fontSize: ".8rem" }}>No topic selected — <button onClick={onNavigateToTopics} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontWeight: 600, fontSize: ".8rem" }}>browse Trending Topics →</button></p>
                    </div>
                  )
                )}

                {prFormData.mediaType === "article" && (
                  <div>
                    <div
                      ref={externalRefEl}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={e => setExternalRef((e.currentTarget as HTMLDivElement).innerHTML)}
                    onPaste={e => {
                      e.preventDefault();
                      const html = e.clipboardData.getData("text/html");
                      const plain = e.clipboardData.getData("text/plain");

                      let cleaned = "";
                      if (html) {
                        const doc = new DOMParser().parseFromString(html, "text/html");

                        // Remove Word namespace / meta junk
                        doc.querySelectorAll("o\\:p, w\\:sdt, w\\:sdtContent, xml, meta, style, link").forEach(el => el.remove());

                        // Strip every inline style and Word class (MsoNormal, etc.)
                        doc.querySelectorAll("[style]").forEach(el => el.removeAttribute("style"));
                        doc.querySelectorAll("[class]").forEach(el => el.removeAttribute("class"));
                        doc.querySelectorAll("[lang]").forEach(el => el.removeAttribute("lang"));

                        // Remove empty block elements Word uses as spacers
                        // Catches <p></p>, <p> </p>, <p>&nbsp;</p>, <p><br></p>
                        doc.querySelectorAll("p, div, span").forEach(el => {
                          const txt = el.textContent?.replace(/[\u00A0\s]/g, "") ?? "";
                          const hasOnlyBr = el.children.length === 1 && el.children[0].tagName === "BR";
                          if (txt === "" && !hasOnlyBr && el.childNodes.length <= 1) el.remove();
                        });

                        // Unwrap meaningless spans (no bold/italic/underline/link inside)
                        doc.querySelectorAll("span").forEach(span => {
                          if (!span.querySelector("a, b, strong, i, em, u")) {
                            span.replaceWith(...Array.from(span.childNodes));
                          }
                        });

                        cleaned = doc.body.innerHTML
                          // collapse sequences of whitespace-only block elements Word leaves behind
                          .replace(/(<p[^>]*>\s*<\/p>\s*)+/gi, "")
                          .replace(/(<div[^>]*>\s*<\/div>\s*)+/gi, "")
                          .trim();
                      } else {
                        // Plain-text fallback: wrap each paragraph in <p>
                        cleaned = plain.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("");
                      }

                      document.execCommand("insertHTML", false, cleaned);
                      if (externalRefEl.current) setExternalRef(externalRefEl.current.innerHTML);
                    }}
                    data-placeholder="Paste a previous press release, news article, or any reference content here. Formatting from Word (bold, italics, headers, links) will be preserved. AI will use it as a style and structure guide — writing completely original content for your company."
                    className="field-input"
                    style={{
                      minHeight: "160px", lineHeight: 1.6, fontSize: ".82rem",
                      overflowY: "auto", maxHeight: "320px",
                      cursor: "text",
                    }}
                  />
                  <style>{`
                    [contenteditable]:empty:before {
                      content: attr(data-placeholder);
                      color: #94a3b8;
                      pointer-events: none;
                      display: block;
                    }
                    [contenteditable] b, [contenteditable] strong { font-weight: 700; }
                    [contenteditable] i, [contenteditable] em { font-style: italic; }
                    [contenteditable] u { text-decoration: underline; }
                    [contenteditable] a { color: #4f46e5; text-decoration: underline; }
                    [contenteditable] h1 { font-size: 1.3rem; font-weight: 700; margin: .5rem 0 .2rem; }
                    [contenteditable] h2 { font-size: 1.1rem; font-weight: 700; margin: .4rem 0 .15rem; }
                    [contenteditable] h3 { font-size: .95rem; font-weight: 700; margin: .35rem 0 .1rem; }
                    [contenteditable] p  { margin: 0; line-height: 1.55; }
                    [contenteditable] p + p { margin-top: .35rem; }
                    [contenteditable] div + div { margin-top: .35rem; }
                    [contenteditable] ul { padding-left: 1.25rem; list-style: disc; margin: .25rem 0; }
                    [contenteditable] ol { padding-left: 1.25rem; list-style: decimal; margin: .25rem 0; }
                    [contenteditable] li { margin-bottom: .15rem; }
                  `}</style>
                  {externalRef.replace(/<[^>]*>/g, "").trim() && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: ".35rem" }}>
                      <span style={{ fontSize: ".72rem", color: "#94a3b8" }}>
                        {externalRef.replace(/<[^>]*>/g, "").trim().split(/\s+/).length} words pasted
                      </span>
                      <button onClick={() => {
                        setExternalRef("");
                        if (externalRefEl.current) externalRefEl.current.innerHTML = "";
                      }} style={{ fontSize: ".72rem", color: "#6366f1", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>Clear</button>
                    </div>
                  )}
                </div>
                )}

                {prFormData.mediaType === "authority" && (
                  <div style={{ background:"#f8fafc", border:"1px dashed #cbd5e1", borderRadius:".6rem", padding:"1rem", textAlign:"center" }}>
                    <p style={{ color:"#94a3b8", fontSize:".8rem" }}>🏛️ Authority Building options coming soon. Your PR will be crafted to position you as an industry leader.</p>
                  </div>
                )}

                {prFormData.mediaType === "freestyle" && (
                  <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:".6rem", padding:".75rem 1rem" }}>
                    <p style={{ color:"#15803d", fontSize:".8rem", margin:0 }}>✍️ Freestyle mode — fill out the form below and AI will craft your press release from scratch based on your inputs.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Company Name + Quote Attribution (read-only) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".75rem" }}>
              {([["Company Name", companyName], ["Quote Attribution", quoteAttribution]] as [string, string][]).map(([lbl, val]) => (
                <div key={lbl}>
                  <label className="field-label">{lbl}</label>
                  <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                    <input value={val} disabled className="field-input" style={{ background: "#f8fafc", color: val ? "#475569" : "#c0c9d4" }}/>
                    {!val && <button onClick={onOpenCompanyData} style={{ fontSize: ".7rem", color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>Set →</button>}
                  </div>
                </div>
              ))}
            </div>

            {/* Main Focus + Theme */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".75rem" }}>
              <div>
                <label className="field-label">Main Focus</label>
                <div style={{ position: "relative" }}>
                  <button type="button" onClick={() => { setShowFocusDropdown(p => !p); setShowThemeDropdown(false); }} className="field-input" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: ".5rem", fontWeight: 500 }}>{FOCUS_OPTIONS.find(f => f.value === prFormData.mainFocus)?.emoji} {prFormData.mainFocus}</span>
                    <span style={{ color: "#94a3b8", fontSize: ".7rem" }}>▼</span>
                  </button>
                  {showFocusDropdown && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid #e2e8f0", borderRadius: ".5rem", boxShadow: "0 8px 24px rgba(0,0,0,.12)", zIndex: 20, overflow: "hidden", marginTop: "4px" }}>
                      {FOCUS_OPTIONS.map(f => (
                        <button key={f.value} type="button" onClick={() => { setPrFormData(p => ({ ...p, mainFocus: f.value })); setShowFocusDropdown(false); }}
                          style={{ width: "100%", textAlign: "left", padding: ".6rem .875rem", background: prFormData.mainFocus === f.value ? "#f0f4ff" : "white", border: "none", cursor: "pointer", display: "flex", gap: ".6rem", alignItems: "flex-start" }}>
                          <span>{f.emoji}</span>
                          <div><p style={{ fontWeight: 600, fontSize: ".82rem", color: "#1e293b", marginBottom: "2px" }}>{f.value}</p><p style={{ fontSize: ".72rem", color: "#94a3b8" }}>{f.desc}</p></div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="field-label">Theme & Style</label>
                <div style={{ position: "relative" }}>
                  <button type="button" onClick={() => { setShowThemeDropdown(p => !p); setShowFocusDropdown(false); }} className="field-input" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: ".5rem", fontWeight: 500 }}>{THEME_OPTIONS.find(t => t.value === prFormData.theme)?.emoji} {THEME_OPTIONS.find(t => t.value === prFormData.theme)?.label}</span>
                    <span style={{ color: "#94a3b8", fontSize: ".7rem" }}>▼</span>
                  </button>
                  {showThemeDropdown && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid #e2e8f0", borderRadius: ".5rem", boxShadow: "0 8px 24px rgba(0,0,0,.12)", zIndex: 20, overflow: "hidden", marginTop: "4px" }}>
                      {THEME_OPTIONS.map(t => (
                        <button key={t.value} type="button" onClick={() => { setPrFormData(p => ({ ...p, theme: t.value })); setShowThemeDropdown(false); }}
                          style={{ width: "100%", textAlign: "left", padding: ".6rem .875rem", background: prFormData.theme === t.value ? "#f0f4ff" : "white", border: "none", cursor: "pointer", display: "flex", gap: ".6rem", alignItems: "flex-start" }}>
                          <span>{t.emoji}</span>
                          <div><p style={{ fontWeight: 600, fontSize: ".82rem", color: "#1e293b", marginBottom: "2px" }}>{t.label}</p><p style={{ fontSize: ".72rem", color: "#94a3b8" }}>{t.desc}</p></div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Keywords */}
            <div>
              <label className="field-label">Target Keywords <span style={{ color: "#94a3b8", fontWeight: 400 }}>(pick up to 2)</span></label>
              <KeywordPicker
                selected={prFormData.keywords}
                onChange={kw => setPrFormData(p => ({ ...p, keywords: kw }))}
                companyName={companyData.name}
                industry={companyData.industry}
                servicePages={companyData.servicePages || []}
                locationPages={companyData.locationPages || []}
              />
            </div>

            {/* About field with AI enhance */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: ".35rem" }}>
                <label className="field-label" style={{ margin: 0 }}>What is the Press Release About? <span style={{ color: "#ef4444" }}>*</span></label>
                <button type="button" disabled={enhancingAbout || !prFormData.about.trim()} onClick={async () => {
                  setEnhancingAbout(true);
                  try {
                    const result = await callClaude(`Rewrite the following press release topic/description to be professional, clear, and compelling. Fix grammar, improve structure, expand if too short (aim for 3-5 sentences), and make it suitable for a press release. Return ONLY the improved text, no commentary:\n\n${prFormData.about}`, "You are a professional PR copywriter. Return only the improved text.");
                    setPrFormData(p => ({ ...p, about: result.trim() }));
                  } catch { showToast("Enhancement failed — check API key", "error"); }
                  setEnhancingAbout(false);
                }} style={{ display: "flex", alignItems: "center", gap: ".3rem", background: "none", border: "1px solid #c7d2fe", borderRadius: ".4rem", padding: ".2rem .55rem", fontSize: ".72rem", fontWeight: 600, color: enhancingAbout || !prFormData.about.trim() ? "#a5b4fc" : "#4f46e5", cursor: enhancingAbout || !prFormData.about.trim() ? "not-allowed" : "pointer", transition: "all .15s", whiteSpace: "nowrap" }}>
                  {enhancingAbout ? <><LoaderIcon size={11}/> Enhancing…</> : <>✨ Enhance with AI</>}
                </button>
              </div>
              <textarea value={prFormData.about} onChange={e => setPrFormData(p => ({ ...p, about: e.target.value }))} placeholder="Describe the news, announcement, or story in detail..." className="field-input" style={{ height: "150px", resize: "vertical", lineHeight: 1.6 }}/>
            </div>

            {/* Quote field with AI enhance */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: ".35rem" }}>
                <label className="field-label" style={{ margin: 0 }}>Executive's Quote <span style={{ color: "#ef4444" }}>*</span></label>
                <button type="button" disabled={enhancingQuote || !prFormData.quote.trim()} onClick={async () => {
                  setEnhancingQuote(true);
                  try {
                    const result = await callClaude(`Rewrite the following executive quote to sound polished, authoritative, and press-release-ready. Fix grammar, improve vocabulary, make it confident and quotable (1-3 sentences). Return ONLY the improved quote text, no attribution, no quotation marks, no commentary:\n\n${prFormData.quote}`, "You are a professional PR copywriter. Return only the improved quote text.");
                    setPrFormData(p => ({ ...p, quote: result.trim().replace(/^[""]|[""]$/g, "") }));
                  } catch { showToast("Enhancement failed — check API key", "error"); }
                  setEnhancingQuote(false);
                }} style={{ display: "flex", alignItems: "center", gap: ".3rem", background: "none", border: "1px solid #c7d2fe", borderRadius: ".4rem", padding: ".2rem .55rem", fontSize: ".72rem", fontWeight: 600, color: enhancingQuote || !prFormData.quote.trim() ? "#a5b4fc" : "#4f46e5", cursor: enhancingQuote || !prFormData.quote.trim() ? "not-allowed" : "pointer", transition: "all .15s", whiteSpace: "nowrap" }}>
                  {enhancingQuote ? <><LoaderIcon size={11}/> Enhancing…</> : <>✨ Enhance with AI</>}
                </button>
              </div>
              <textarea value={prFormData.quote} onChange={e => setPrFormData(p => ({ ...p, quote: e.target.value }))} placeholder="Enter a compelling quote from a company spokesperson..." className="field-input" style={{ height: "80px", resize: "vertical", lineHeight: 1.6 }}/>
            </div>

            {/* Partner Quote toggle */}
            <div>
              <label className="field-label">Include a Partner's Quote</label>
              <select value={prFormData.includePartnerQuote} onChange={e => setPrFormData(p => ({ ...p, includePartnerQuote: e.target.value as "yes"|"no" }))} className="field-input">
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            {/* Partner Quote fields (shown when Yes) */}
            {prFormData.includePartnerQuote === "yes" && (
              <>
                <div>
                  <label className="field-label">Partner's Quote <span style={{ color: "#94a3b8", fontWeight: 400 }}>(optional)</span></label>
                  <textarea value={prFormData.partnerQuote} onChange={e => setPrFormData(p => ({ ...p, partnerQuote: e.target.value }))} placeholder="Enter a quote from the partner..." className="field-input" style={{ height: "80px", resize: "vertical", lineHeight: 1.6 }}/>
                </div>
                <div>
                  <label className="field-label">Partner's Name, Position &amp; Company</label>
                  <input value={prFormData.partnerAttribution} onChange={e => setPrFormData(p => ({ ...p, partnerAttribution: e.target.value }))} placeholder="e.g. Jane Smith, CEO of Acme Corp" className="field-input"/>
                </div>
              </>
            )}

            {/* Optional media */}
            <details>
              <summary style={{ fontSize: ".82rem", fontWeight: 600, color: "#64748b", cursor: "pointer", padding: ".5rem 0", borderTop: "1px solid #f1f5f9", userSelect: "none" }}>＋ Optional Media (Image, Video, Map)</summary>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".75rem", marginTop: ".75rem" }}>
                <div>
                  <label className="field-label">Featured Image</label>
                  <div className="field-input" style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                    <UploadIcon size={14}/>
                    <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) { setPrFormData(p => ({ ...p, featuredImage: f })); setImagePreviewUrl(URL.createObjectURL(f)); showToast("Image added"); } }} style={{ flex: 1, fontSize: ".78rem", border: "none", outline: "none" }}/>
                    {prFormData.featuredImage && <CheckIcon size={14}/>}
                  </div>
                </div>
                <div>
                  <label className="field-label">YouTube URL</label>
                  <input type="url" value={prFormData.videoUrl} onChange={e => setPrFormData(p => ({ ...p, videoUrl: e.target.value }))} placeholder="https://youtube.com/..." className="field-input"/>
                </div>
              </div>
              <div style={{ marginTop: ".75rem" }}>
                <label className="field-label">Google Maps Embed</label>
                <textarea value={prFormData.mapsEmbed} onChange={e => setPrFormData(p => ({ ...p, mapsEmbed: e.target.value }))} placeholder="Paste Google Maps embed code here..." className="field-input" style={{ height: "70px", resize: "vertical" }}/>
              </div>
            </details>

            {/* Actions */}
            <div style={{ display: "flex", gap: ".75rem", paddingTop: ".25rem" }}>
              <button onClick={generatePressRelease} disabled={isLoading} className="btn-primary" style={{ flex: 1, justifyContent: "center", padding: ".8rem" }}>
                {isLoading ? <><LoaderIcon size={16}/> Generating...</> : <><SparklesIcon size={16}/> Generate Press Release</>}
              </button>
              <button onClick={() => { setPrFormData({ about: "", quote: "", keywords: [], wordCount: "500", mainFocus: "Company News", theme: "thought-provoking", videoUrl: "", mapsEmbed: "", featuredImage: null, includePartnerQuote: "no", partnerQuote: "", partnerAttribution: "" }); onClearTopic(); setExternalRef(""); setImagePreviewUrl(null); if (externalRefEl.current) externalRefEl.current.innerHTML = ""; showToast("Form cleared"); }} className="btn-secondary">Clear</button>
            </div>
              </div>{/* end inner fields div */}
            </div>{/* end disabled wrapper */}
          </div>
        </div>
      )}

      {/* Refine Dialog */}
      {showRefineDialog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1rem" }}>
          <div className="card modal-panel" style={{ maxWidth: "460px", width: "100%", padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".75rem" }}>
              <h2 className="font-display" style={{ fontSize: "1.1rem", fontWeight: 700 }}>Refine with AI</h2>
              <button onClick={() => setShowRefineDialog(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}><XIcon size={18}/></button>
            </div>
            <p style={{ fontSize: ".82rem", color: "#64748b", marginBottom: "1rem" }}>Describe your changes.{refinementCount > 0 && <span style={{ color: "#f59e0b", fontWeight: 600 }}> ({refinementCount}/5 used)</span>}</p>
            <textarea value={refinementInstructions} onChange={e => setRefinementInstructions(e.target.value)} placeholder="e.g., Make it more persuasive, add statistics, shorten the intro..." className="field-input" style={{ height: "110px", resize: "none", marginBottom: "1rem" }}/>
            <div style={{ display: "flex", gap: ".75rem" }}>
              <button onClick={refinePressRelease} disabled={isLoading || !refinementInstructions.trim()} className="btn-primary" style={{ flex: 1, justifyContent: "center" }}>
                {isLoading ? <><LoaderIcon size={15}/> Refining...</> : <><SparklesIcon size={15}/> Refine</>}
              </button>
              <button onClick={() => { setShowRefineDialog(false); setRefinementInstructions(""); }} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Order Confirm Modal */}
      {orderConfirm && createPortal((() => {
        const cfg = TIER_CONFIG[orderConfirm.tier];
        // Fire confetti
        setTimeout(() => {
          const c = (window as any).confetti;
          if (typeof c === "function") {
            const end = Date.now() + 2500;
            const colors = [cfg.color, "#10b981", "#f59e0b", "#6366f1", "#f43f5e"];
            const frame = () => {
              c({ particleCount: 3, angle: 60,  spread: 55, startVelocity: 60, origin: { x: 0, y: 0.5 }, colors });
              c({ particleCount: 3, angle: 120, spread: 55, startVelocity: 60, origin: { x: 1, y: 0.5 }, colors });
              if (Date.now() < end) requestAnimationFrame(frame);
            };
            frame();
          }
        }, 50);
        return (
          <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,.6)", backdropFilter:"blur(6px)" }}>
            <div style={{ background:"white", borderRadius:"1.25rem", width:"100%", maxWidth:440, padding:"2.5rem", textAlign:"center", boxShadow:"0 32px 80px rgba(0,0,0,.3)", margin:"1rem" }}>
              <div style={{ width:80, height:80, borderRadius:"50%", background:`linear-gradient(135deg, ${cfg.color}22, ${cfg.color}44)`, border:`3px solid ${cfg.color}`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 1.25rem", fontSize:"2.2rem" }}>
                📬
              </div>
              <h2 style={{ fontWeight:900, fontSize:"1.3rem", color:"#1e293b", margin:"0 0 .5rem" }}>PR Submitted!</h2>
              <p style={{ color:"#64748b", fontSize:".88rem", margin:"0 0 1.25rem", lineHeight:1.6 }}>
                Your <strong>{orderConfirm.tier} Press Release</strong> has been submitted and is pending review.
              </p>
              <div style={{ background:`linear-gradient(135deg, ${cfg.color}10, ${cfg.color}06)`, border:`1px solid ${cfg.color}30`, borderRadius:".75rem", padding:"1rem 1.25rem", marginBottom:"1.5rem", textAlign:"left" }}>
                <div style={{ fontSize:".75rem", fontWeight:600, color:"#64748b", marginBottom:".5rem", textTransform:"uppercase", letterSpacing:".05em" }}>What happens next</div>
                <div style={{ display:"flex", flexDirection:"column", gap:".5rem" }}>
                  {[
                    { icon:"👤", text:"A human editor will review your content for quality and compliance" },
                    { icon:"⏱️", text:"Review process takes 24–48 hours" },
                    { icon:"📡", text:"Once approved, your PR will be distributed across our network" },
                    { icon:"📊", text:"You'll receive a report with all your publication links" },
                  ].map(s => (
                    <div key={s.icon} style={{ display:"flex", alignItems:"flex-start", gap:".6rem", fontSize:".78rem", color:"#374151" }}>
                      <span>{s.icon}</span><span>{s.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex", gap:".75rem" }}>
                <button onClick={() => { setOrderConfirm(null); onNavigateToPublished?.(); }} style={{ flex:1, padding:".7rem", borderRadius:".6rem", border:"none", cursor:"pointer", fontWeight:700, fontSize:".85rem", background:`linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)`, color:"white", boxShadow:`0 4px 14px ${cfg.color}40` }}>
                  Check Order Status
                </button>
                <button onClick={() => setOrderConfirm(null)} style={{ padding:".7rem 1rem", borderRadius:".6rem", border:"1px solid #e2e8f0", cursor:"pointer", fontWeight:600, fontSize:".85rem", background:"white", color:"#64748b" }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })(), document.body)}
    </div>
  );
}

