import { useState, useEffect } from "react";
import { CompanyData } from "../../lib/constants";
import { SUPABASE_URL, SUPABASE_ANON } from "../../lib/supabase";

interface Props {
  locationId: string;
  companyData: CompanyData;
  showToast: (msg: string, type?: string) => void;
}

type Prefs = {
  notification_email: string;
  mc_scheduled_inapp: boolean; mc_scheduled_email: boolean;
  mc_submitted_inapp: boolean; mc_submitted_email: boolean;
  mc_rejected_inapp: boolean;  mc_rejected_email: boolean;
  ab_approval_inapp: boolean;  ab_approval_email: boolean;
  tt_frequency: string; tt_inapp: boolean; tt_email: boolean;
  ca_frequency: string; ca_inapp: boolean; ca_email: boolean;
  tw_not_created_inapp: boolean; tw_not_created_email: boolean;
  tw_not_verified_inapp: boolean; tw_not_verified_email: boolean;
  credits_low_inapp: boolean;   credits_low_email: boolean;
  credits_promotions_inapp: boolean; credits_promotions_email: boolean;
};

const DEFAULT: Prefs = {
  notification_email: "",
  mc_scheduled_inapp:true,  mc_scheduled_email:false,
  mc_submitted_inapp:true,  mc_submitted_email:true,
  mc_rejected_inapp:true,   mc_rejected_email:true,
  ab_approval_inapp:true,   ab_approval_email:true,
  tt_frequency:"weekly",    tt_inapp:true,  tt_email:false,
  ca_frequency:"monthly",   ca_inapp:true,  ca_email:false,
  tw_not_created_inapp:true,  tw_not_created_email:false,
  tw_not_verified_inapp:true, tw_not_verified_email:true,
  credits_low_inapp:true,   credits_low_email:true,
  credits_promotions_inapp:true, credits_promotions_email:false,
};

const FREQ_OPTIONS = ["weekly","monthly","quarterly","off"];

const dbHdr = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json", Prefer: "return=representation" };

export default function Settings({ locationId, companyData, showToast }: Props) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (!locationId) return;
    fetch(`${SUPABASE_URL}/rest/v1/notification_preferences?location_id=eq.${locationId}&limit=1`, { headers: dbHdr })
      .then(r => r.json())
      .then(rows => {
        if (rows?.[0]) {
          setPrefs(p => ({ ...p, ...rows[0], notification_email: rows[0].notification_email || companyData.email || "" }));
        } else {
          setPrefs(p => ({ ...p, notification_email: companyData.email || "" }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/notification_preferences?on_conflict=location_id`, {
        method: "POST",
        headers: { ...dbHdr, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ ...prefs, location_id: locationId, updated_at: new Date().toISOString() }),
      });
      showToast("Notification preferences saved");
    } catch {
      showToast("Save failed — please try again", "error");
    }
    setSaving(false);
  };

  const toggle = (key: keyof Prefs) => setPrefs(p => ({ ...p, [key]: !p[key] }));
  const setFreq = (key: keyof Prefs, val: string) => setPrefs(p => ({ ...p, [key]: val }));

  const Toggle = ({ k }: { k: keyof Prefs }) => {
    const on = !!prefs[k];
    return (
      <button onClick={() => toggle(k)} style={{ position:"relative", width:40, height:22, borderRadius:99, border:"none", cursor:"pointer", padding:0, flexShrink:0, background: on ? "#6366f1" : "#cbd5e1", transition:"background .2s" }}>
        <div style={{ position:"absolute", top:2, left: on ? 20 : 2, width:18, height:18, borderRadius:"50%", background:"white", transition:"left .2s", boxShadow:"0 1px 3px rgba(0,0,0,.25)" }}/>
      </button>
    );
  };

  const FreqSelect = ({ k }: { k: keyof Prefs }) => (
    <select value={prefs[k] as string} onChange={e => setFreq(k, e.target.value)}
      style={{ fontSize:".73rem", padding:".25rem .5rem", borderRadius:".4rem", border:"1px solid #e2e8f0", background:"white", color:"#374151", fontWeight:600, cursor:"pointer" }}>
      {FREQ_OPTIONS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>)}
    </select>
  );

  const Section = ({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) => (
    <div style={{ marginBottom:"1.5rem" }}>
      <div style={{ display:"flex", alignItems:"center", gap:".5rem", marginBottom:".75rem", paddingBottom:".5rem", borderBottom:"2px solid #f1f5f9" }}>
        <span style={{ fontSize:"1.1rem" }}>{icon}</span>
        <h3 style={{ margin:0, fontWeight:800, fontSize:".9rem", color:"#1e293b", letterSpacing:".01em" }}>{title}</h3>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:".1rem" }}>{children}</div>
    </div>
  );

  const Row = ({ label, desc, inappKey, emailKey, extra }: {
    label: string; desc: string;
    inappKey?: keyof Prefs; emailKey?: keyof Prefs;
    extra?: React.ReactNode;
  }) => (
    <div style={{ display:"flex", alignItems:"center", padding:".7rem .85rem", borderRadius:".6rem", gap:"1rem", background:"white", border:"1px solid #f1f5f9", transition:"background .1s" }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:".85rem", color:"#1e293b" }}>{label}</div>
        <div style={{ fontSize:".73rem", color:"#94a3b8", marginTop:".1rem" }}>{desc}</div>
      </div>
      {extra && <div style={{ flexShrink:0 }}>{extra}</div>}
      {inappKey && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:".2rem", flexShrink:0 }}>
          <span style={{ fontSize:".6rem", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:".06em" }}>In-App</span>
          <Toggle k={inappKey}/>
        </div>
      )}
      {emailKey && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:".2rem", flexShrink:0 }}>
          <span style={{ fontSize:".6rem", fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:".06em" }}>Email</span>
          <Toggle k={emailKey}/>
        </div>
      )}
    </div>
  );

  if (loading) return <div style={{ padding:"3rem", textAlign:"center", color:"#94a3b8" }}>Loading preferences…</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:"1.5rem" }}>
        <h2 style={{ fontWeight:900, fontSize:"1.3rem", color:"#1e293b", margin:"0 0 .3rem" }}>Notification Settings</h2>
        <p style={{ color:"#64748b", fontSize:".84rem", margin:0 }}>Control how and when you receive updates from Media Blast Boosters™</p>
      </div>

      {/* Email address card */}
      <div className="card" style={{ padding:"1.25rem", marginBottom:"1.75rem", background:"linear-gradient(135deg,#fafafa,#f8faff)", border:"1.5px solid #e0e7ff" }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:"1rem", flexWrap:"wrap" }}>
          <div style={{ flex:1, minWidth:220 }}>
            <div style={{ fontWeight:700, fontSize:".88rem", color:"#1e293b", marginBottom:".2rem" }}>📧 Notification Email</div>
            <div style={{ fontSize:".75rem", color:"#64748b" }}>
              Where email alerts are sent. Separate multiple addresses with commas.
              {companyData.email && (
                <span style={{ display:"block", marginTop:".2rem", color:"#94a3b8" }}>
                  Company email on file: <strong>{companyData.email}</strong>
                </span>
              )}
            </div>
          </div>
          <input
            type="email"
            value={prefs.notification_email}
            onChange={e => setPrefs(p => ({ ...p, notification_email: e.target.value }))}
            placeholder={companyData.email || "your@email.com"}
            style={{ flex:"0 0 280px", padding:".55rem .85rem", borderRadius:".5rem", border:"1.5px solid #c7d2fe", fontSize:".85rem", outline:"none", color:"#1e293b" }}
          />
        </div>
      </div>

      {/* Column headers */}
      <div style={{ display:"flex", alignItems:"center", padding:"0 .85rem", marginBottom:".4rem", gap:"1rem" }}>
        <div style={{ flex:1 }}/>
        <div style={{ width:52, textAlign:"center", fontSize:".65rem", fontWeight:800, color:"#6366f1", textTransform:"uppercase", letterSpacing:".08em" }}>In-App</div>
        <div style={{ width:52, textAlign:"center", fontSize:".65rem", fontWeight:800, color:"#8929bd", textTransform:"uppercase", letterSpacing:".08em" }}>Email</div>
      </div>

      {/* Sections */}
      <Section icon="✍️" title="Media Creator">
        <Row label="PR Scheduled" desc="When you schedule a press release for a future date" inappKey="mc_scheduled_inapp" emailKey="mc_scheduled_email"/>
        <Row label="PR Submitted" desc="When a PR is submitted to the distribution network" inappKey="mc_submitted_inapp" emailKey="mc_submitted_email"/>
        <Row label="PR Rejected / Revision Needed" desc="When a submitted PR requires changes" inappKey="mc_rejected_inapp" emailKey="mc_rejected_email"/>
      </Section>

      <Section icon="🏆" title="Authority Builder">
        <Row label="AI Draft Ready for Review" desc="When an auto-generated PR is ready for your approval" inappKey="ab_approval_inapp" emailKey="ab_approval_email"/>
      </Section>

      <Section icon="🔥" title="Trending Topics">
        <Row label="Trending Topics Digest"
          desc="Regular summary of trending topics in your industry"
          inappKey="tt_inapp" emailKey="tt_email"
          extra={<FreqSelect k="tt_frequency"/>}/>
      </Section>

      <Section icon="📊" title="Competitor Analysis">
        <Row label="Competitor Activity Report"
          desc="Updates on competitor movements and positioning"
          inappKey="ca_inapp" emailKey="ca_email"
          extra={<FreqSelect k="ca_frequency"/>}/>
      </Section>

      <Section icon="🛡️" title="Trust Widget">
        <Row label="Widget Not Set Up" desc="Reminder if no Trust Widget has been created after 7 days" inappKey="tw_not_created_inapp" emailKey="tw_not_created_email"/>
        <Row label="Widget Not Verified" desc="Alert if your widget isn't verified within 48 hours of setup" inappKey="tw_not_verified_inapp" emailKey="tw_not_verified_email"/>
      </Section>

      <Section icon="💳" title="Media Credits">
        <Row label="Low Credit Alert" desc="When any tier drops to 1 credit remaining" inappKey="credits_low_inapp" emailKey="credits_low_email"/>
        <Row label="Promotions & Offers" desc="Special deals and bonus credit opportunities" inappKey="credits_promotions_inapp" emailKey="credits_promotions_email"/>
      </Section>

      {/* Save button */}
      <div style={{ display:"flex", justifyContent:"flex-end", paddingTop:"1rem", borderTop:"1px solid #f1f5f9", marginTop:"1rem" }}>
        <button onClick={save} disabled={saving}
          style={{ padding:".75rem 2rem", borderRadius:".65rem", border:"none", background: saving ? "#e2e8f0" : "linear-gradient(135deg,#6366f1,#8929bd)", color: saving ? "#94a3b8" : "white", fontWeight:800, fontSize:".9rem", cursor: saving ? "not-allowed" : "pointer", boxShadow: saving ? "none" : "0 4px 14px rgba(99,102,241,.3)" }}>
          {saving ? "Saving…" : "Save Preferences"}
        </button>
      </div>
    </div>
  );
}
