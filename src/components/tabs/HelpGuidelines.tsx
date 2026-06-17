import { useState } from "react";

const TABS = [
  { id: "editorial",  label: "Editorial Standards" },
  { id: "prohibited", label: "Prohibited Content"  },
  { id: "support",    label: "Support & Resources" },
] as const;
const VIDEO_TUTORIALS_URL = "https://xtremeplatform.com/kb/marketing/media-blast-boosters/";
type TabId = typeof TABS[number]["id"];

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 style={{ fontWeight:700, fontSize:".95rem", color:"#1e293b", margin:"1.5rem 0 .6rem", display:"flex", alignItems:"center", gap:".5rem" }}>{children}</h3>
);

const Rule = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display:"flex", gap:".6rem", marginBottom:".55rem" }}>
    <span style={{ width:6, height:6, borderRadius:"50%", background:"#6366f1", flexShrink:0, marginTop:".45rem" }}/>
    <span style={{ fontSize:".83rem", color:"#374151", lineHeight:1.65 }}>{children}</span>
  </div>
);

const ProhibitedRule = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display:"flex", gap:".6rem", marginBottom:".55rem" }}>
    <span style={{ fontSize:".8rem", flexShrink:0, marginTop:".1rem" }}>🚫</span>
    <span style={{ fontSize:".83rem", color:"#374151", lineHeight:1.65 }}>{children}</span>
  </div>
);

const ResourceLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" style={{ color:"#6366f1", fontWeight:600, textDecoration:"underline" }}>{children}</a>
);

interface Props { onOpenHelp?: () => void; }
export default function HelpGuidelines({ onOpenHelp }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("editorial");

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display:"flex", gap:".25rem", background:"white", borderRadius:".75rem", padding:".35rem", marginBottom:"1.5rem", boxShadow:"0 1px 3px rgba(0,0,0,.06)", border:"1px solid #f1f5f9", width:"fit-content" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding:".5rem 1.1rem", borderRadius:".5rem", border:"none", cursor:"pointer", fontWeight:600, fontSize:".82rem", transition:"all .15s",
            background: activeTab===t.id ? "linear-gradient(135deg,#8929bd,#4338ca)" : "transparent",
            color: activeTab===t.id ? "white" : "#64748b",
            boxShadow: activeTab===t.id ? "0 2px 8px rgba(137,41,189,.3)" : "none",
          }}>{t.label}</button>
        ))}
        <a href={VIDEO_TUTORIALS_URL} target="_blank" rel="noopener noreferrer"
          style={{ padding:".5rem 1.1rem", borderRadius:".5rem", border:"none", cursor:"pointer", fontWeight:600, fontSize:".82rem", transition:"all .15s", background:"transparent", color:"#64748b", textDecoration:"none", display:"flex", alignItems:"center", gap:".35rem", whiteSpace:"nowrap" }}
          onMouseOver={e => { (e.currentTarget as HTMLAnchorElement).style.background = "#f1f5f9"; (e.currentTarget as HTMLAnchorElement).style.color = "#1e293b"; }}
          onMouseOut={e => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = "#64748b"; }}>
          🎬 Video Tutorials ↗
        </a>
      </div>

      {/* ── EDITORIAL STANDARDS ── */}
      {activeTab === "editorial" && (
        <div className="card" style={{ padding:"1.75rem" }}>
          <div style={{ background:"linear-gradient(135deg,#4f46e5,#7c3aed)", borderRadius:".75rem", padding:"1rem 1.25rem", marginBottom:"1.5rem" }}>
            <p style={{ color:"rgba(255,255,255,.9)", fontSize:".85rem", margin:0, lineHeight:1.6 }}>
              This section covers the "rules of the road" for your content to ensure a <strong>100% approval rate</strong> from our editorial team.
            </p>
          </div>

          <SectionTitle>📋 General Content Requirements</SectionTitle>
          <Rule><strong>Newsworthiness:</strong> All press releases must share timely, relevant information about an event or announcement regarding your business community.</Rule>
          <Rule><strong>Professional Tone:</strong> Content must be written in strictly professional language. Avoid superlatives, hype, jargon, or direct address (using "you" or "I"), except within official quotations.</Rule>
          <Rule><strong>Prohibited Phrasing:</strong> Do not use "spam" or promotional phrases like "Click here" or "Great business opportunity". Avoid exclamation marks and ALL CAPS used for emphasis.</Rule>
          <Rule><strong>Length & Accuracy:</strong> We suggest a length of 450 to 800 words to ensure pickup by Google News. All submissions must be free of spelling and grammatical errors.</Rule>

          <SectionTitle>🖊️ Formatting Your Release</SectionTitle>
          <Rule><strong>Headlines:</strong> Must be short, to the point, and summarize the release purpose. Do not capitalize every word; only capitalize the first letter and proper nouns.</Rule>
          <Rule><strong>Summary:</strong> Provide a maximum of 250 characters that includes your company name and key terms. Do not include links in the summary.</Rule>
          <Rule><strong>Media Contact:</strong> A valid phone number and email address are required for every distribution.</Rule>
          <Rule><strong>Links & Keywords:</strong> You may embed HTML links in the body. Tagged keywords should be used to help search engines and journalists categorize your news.</Rule>
        </div>
      )}

      {/* ── PROHIBITED CONTENT ── */}
      {activeTab === "prohibited" && (
        <div className="card" style={{ padding:"1.75rem" }}>
          <div style={{ background:"linear-gradient(135deg,#dc2626,#b91c1c)", borderRadius:".75rem", padding:"1rem 1.25rem", marginBottom:"1.5rem" }}>
            <p style={{ color:"rgba(255,255,255,.9)", fontSize:".85rem", margin:0, lineHeight:1.6 }}>
              To maintain the high authority of the <strong>Media Blast Boosters™</strong> network, Xtreme Websites® strictly enforces a <strong>zero-tolerance policy</strong> for the following topics.
            </p>
          </div>

          <SectionTitle>🚫 Strictly Prohibited Niches</SectionTitle>
          <ProhibitedRule><strong>Financial & Crypto:</strong> Payday loans, credit scores/reports, and initial coin offerings (ICOs) or trading of Cryptocurrency/tokens. (Blockchain technology content is allowed.)</ProhibitedRule>
          <ProhibitedRule><strong>Health & Supplements:</strong> Weight-loss products, nutritional supplements (e.g., Garcinia Cambogia), medical alternatives, erectile dysfunction, and cosmetic body modifications.</ProhibitedRule>
          <ProhibitedRule><strong>Regulated Goods:</strong> Alcohol, Tobacco, Marijuana/Cannabis, Guns, Weapons, and Explosives.</ProhibitedRule>
          <ProhibitedRule><strong>Adult & Lifestyle:</strong> Adult/Sex content, dating sites, gambling/betting, and explicit music or podcasts.</ProhibitedRule>

          <SectionTitle>⚖️ Legal & Ethical Restrictions</SectionTitle>
          <ProhibitedRule><strong>Harmful Content:</strong> We do not allow content intended to harm a reputation or incite hatred, bigotry, or violence.</ProhibitedRule>
          <ProhibitedRule><strong>Litigation:</strong> PRs must not allege illegal behavior or breach of contract, or threaten any party with legal action.</ProhibitedRule>
          <ProhibitedRule><strong>Schemes:</strong> Affiliate marketing links, get-rich-quick schemes, or services to buy social media followers are banned.</ProhibitedRule>
        </div>
      )}

      {/* ── SUPPORT & RESOURCES ── */}
      {activeTab === "support" && (
        <div className="card" style={{ padding:"1.75rem" }}>
          <div style={{ background:"linear-gradient(135deg,#0ea5e9,#0284c7)", borderRadius:".75rem", padding:"1rem 1.25rem", marginBottom:"1.5rem" }}>
            <p style={{ color:"rgba(255,255,255,.9)", fontSize:".85rem", margin:0, lineHeight:1.6 }}>
              Need extra help getting your Press Release ready? Use the resources below.
            </p>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
            {[
              {
                icon:"📚", title:"Knowledge Base",
                color:"#eef2ff", border:"#c7d2fe",
                content: <>For deep dives into our "Media Positioning" strategy, visit the <ResourceLink href="https://xtremeplatform.com/kb/marketing/media-blast-boosters/">Media Blast Boosters™ Help Center</ResourceLink>.</>
              },
              {
                icon:"🛠️", title:"Technical Support",
                color:"#f0fdf4", border:"#bbf7d0",
                content: <>If you encounter issues with the dashboard or your credit balance, please <ResourceLink href="https://xtremeplatform.com/my-tickets/">Open a Support Ticket</ResourceLink>.</>
              },
              {
                icon:"⚖️", title:"Legal Responsibility",
                color:"#fffbeb", border:"#fde68a",
                content: <>Xtreme Websites® reminds all users that it is the company's responsibility to ensure all information is accurate and that professional claims regarding legal or criminal matters can be substantiated with attested documents.</>
              },
            ].map(r => (
              <div key={r.title} style={{ background:r.color, border:`1px solid ${r.border}`, borderRadius:".75rem", padding:"1.1rem 1.25rem" }}>
                <div style={{ display:"flex", alignItems:"center", gap:".5rem", marginBottom:".4rem" }}>
                  <span style={{ fontSize:"1.1rem" }}>{r.icon}</span>
                  <strong style={{ fontSize:".88rem", color:"#1e293b" }}>{r.title}</strong>
                </div>
                <p style={{ fontSize:".83rem", color:"#374151", margin:0, lineHeight:1.65 }}>{r.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
