import { useState, useEffect } from "react";
import { CompanyData } from "../../lib/constants";

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
const PROXY = "https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/supabase-proxy";
const post = (body: object) => fetch(PROXY, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) }).then(r => r.json());

export default function Settings({ locationId, companyData, showToast }: Props) {
  const [prefs, setPrefs]     = useState<Prefs>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [emailInput, setEmailInput]         = useState("");

  const profileEmail = (companyData as any).email || "";

  useEffect(() => {
    if (!locationId) return;
    post({ table:"notification_preferences", operation:"select", eq:{ location_id: locationId } })
      .then(d => {
        if (d?.data) {
          setPrefs(p => ({ ...p, ...d.data }));
          if (d.data.notification_email) {
            setEmailInput(d.data.notification_email);
            setEmailConfirmed(true);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...prefs, notification_email: emailConfirmed ? emailInput : "", location_id: locationId, updated_at: new Date().toISOString() };
      const d = await post({ table:"notification_preferences", operation:"upsert", onConflict:"location_id", data: payload });
      if (d?.error) throw new Error("Save failed");
      showToast("Notification preferences saved");
    } catch {
      showToast("Save failed — please try again", "error");
    }
    setSaving(false);
  };

  const toggle  = (key: keyof Prefs) => setPrefs(p => ({ ...p, [key]: !p[key] }));
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
      style={{ fontSize:".73rem", padding:".3rem .6rem", borderRadius:".4rem", border:"1px solid #e2e8f0", background:"white", color:"#374151", fontWeight:600, cursor:"pointer" }}>
      {FREQ_OPTIONS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>)}
    </select>
  );

  const Section = ({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) => (
    <div style={{ marginBottom:"1.5rem" }}>
      <div style={{ display:"flex", alignItems:"center", gap:".5rem", marginBottom:".65rem", paddingBottom:".5rem", borderBottom:"2px solid #f1f5f9" }}>
        <span style={{ fontSize:"1rem" }}>{icon}</span>
        <h3 style={{ margin:0, fontWeight:800, fontSize:".88rem", color:"#1e293b" }}>{title}</h3>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:".35rem" }}>{children}</div>
    </div>
  );

  const Row = ({ label, desc, inappKey, emailKey, extra }: {
    label: string; desc: string;
    inappKey?: keyof Prefs; emailKey?: keyof Prefs;
    extra?: React.ReactNode;
  }) => (
    <div style={{ display:"flex", alignItems:"center", padding:".7rem .9rem", borderRadius:".55rem", gap:"1rem", background:"white", border:"1px solid #f1f5f9" }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:".84rem", color:"#1e293b" }}>{label}</div>
        <div style={{ fontSize:".73rem", color:"#94a3b8", marginTop:".1rem" }}>{desc}</div>
      </div>
      {extra && <div style={{ flexShrink:0 }}>{extra}</div>}
      {inappKey && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:".2rem", flexShrink:0 }}>
          <span style={{ fontSize:".58rem", fontWeight:800, color:"#6366f1", textTransform:"uppercase", letterSpacing:".06em" }}>In-App</span>
          <Toggle k={inappKey}/>
        </div>
      )}
      {emailKey && (
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:".2rem", flexShrink:0 }}>
          <span style={{ fontSize:".58rem", fontWeight:800, color:"#8929bd", textTransform:"uppercase", letterSpacing:".06em" }}>Email</span>
          <Toggle k={emailKey}/>
        </div>
      )}
    </div>
  );

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1rem", paddingTop:".5rem" }}>
      {[1,2,3,4,5].map(i => <div key={i} style={{ height:60, background:"#f8fafc", borderRadius:".65rem", border:"1px solid #f1f5f9" }}/>)}
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom:"1.75rem" }}>
        <h2 style={{ fontWeight:900, fontSize:"1.3rem", color:"#1e293b", margin:"0 0 .3rem" }}>Notification Settings</h2>
        <p style={{ color:"#64748b", fontSize:".84rem", margin:0 }}>Control how and when you receive updates from Media Blast Boosters™</p>
      </div>

      {/* Email section */}
      <div className="card" style={{ padding:"1.25rem 1.35rem", marginBottom:"2rem", border:"1.5px solid #e0e7ff", background:"linear-gradient(135deg,#fafaff,#f5f3ff)" }}>
        <div style={{ fontWeight:700, fontSize:".9rem", color:"#1e293b", marginBottom:".2rem" }}>📧 Email Notifications</div>
        <div style={{ fontSize:".78rem", color:"#64748b", marginBottom:"1rem" }}>
          Choose where email alerts are sent. You can use your company profile email or enter a different one.
        </div>

        {!emailConfirmed ? (
          <div style={{ display:"flex", flexDirection:"column", gap:".65rem" }}>
            {profileEmail && (
              <button onClick={() => { setEmailInput(profileEmail); setEmailConfirmed(true); }}
                style={{ display:"flex", alignItems:"center", gap:".75rem", padding:".75rem 1rem", borderRadius:".6rem", border:"2px solid #c7d2fe", background:"white", cursor:"pointer", textAlign:"left", width:"100%" }}>
                <span style={{ fontSize:"1.1rem" }}>✅</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:".83rem", color:"#1e293b" }}>Use company profile email</div>
                  <div style={{ fontSize:".75rem", color:"#6366f1", fontWeight:600 }}>{profileEmail}</div>
                </div>
              </button>
            )}
            <div style={{ padding:".75rem 1rem", borderRadius:".6rem", border:"2px solid #e2e8f0", background:"white" }}>
              <div style={{ fontWeight:700, fontSize:".83rem", color:"#1e293b", marginBottom:".5rem" }}>
                {profileEmail ? "Or use a different email" : "Enter your notification email"}
              </div>
              <div style={{ display:"flex", gap:".5rem" }}>
                <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)}
                  placeholder="your@email.com"
                  style={{ flex:1, padding:".5rem .75rem", borderRadius:".45rem", border:"1.5px solid #e2e8f0", fontSize:".84rem", outline:"none", color:"#1e293b" }}/>
                <button onClick={() => { if (emailInput.includes("@")) setEmailConfirmed(true); }}
                  disabled={!emailInput.includes("@")}
                  style={{ padding:".5rem 1rem", borderRadius:".45rem", border:"none", background: emailInput.includes("@") ? "linear-gradient(135deg,#6366f1,#8929bd)" : "#e2e8f0", color: emailInput.includes("@") ? "white" : "#94a3b8", fontWeight:700, fontSize:".82rem", cursor: emailInput.includes("@") ? "pointer" : "not-allowed" }}>
                  Confirm
                </button>
              </div>
              <div style={{ fontSize:".7rem", color:"#94a3b8", marginTop:".35rem" }}>Separate multiple addresses with commas</div>
            </div>
          </div>
        ) : (
          <div style={{ display:"flex", alignItems:"center", gap:".75rem", padding:".7rem 1rem", borderRadius:".55rem", background:"#f0fdf4", border:"1.5px solid #bbf7d0" }}>
            <span>✅</span>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:".82rem", color:"#15803d" }}>Email confirmed</div>
              <div style={{ fontSize:".75rem", color:"#166534" }}>{emailInput}</div>
            </div>
            <button onClick={() => setEmailConfirmed(false)}
              style={{ fontSize:".73rem", color:"#6366f1", background:"none", border:"none", cursor:"pointer", fontWeight:600, textDecoration:"underline" }}>
              Change
            </button>
          </div>
        )}
      </div>

      {/* Column headers */}
      <div style={{ display:"flex", alignItems:"center", padding:"0 .9rem", marginBottom:".4rem" }}>
        <div style={{ flex:1 }}/>
        <div style={{ width:56, textAlign:"center", fontSize:".62rem", fontWeight:800, color:"#6366f1", textTransform:"uppercase", letterSpacing:".07em" }}>In-App</div>
        <div style={{ width:56, textAlign:"center", fontSize:".62rem", fontWeight:800, color:"#8929bd", textTransform:"uppercase", letterSpacing:".07em" }}>Email</div>
      </div>

      <Section icon="✍️" title="Media Creator">
        <Row label="PR Scheduled" desc="When you schedule a press release for a future date" inappKey="mc_scheduled_inapp" emailKey="mc_scheduled_email"/>
        <Row label="PR Submitted" desc="When a PR is submitted to the distribution network" inappKey="mc_submitted_inapp" emailKey="mc_submitted_email"/>
        <Row label="PR Rejected / Revision Needed" desc="When a submitted PR requires changes" inappKey="mc_rejected_inapp" emailKey="mc_rejected_email"/>
      </Section>

      <Section icon="🏆" title="Authority Builder">
        <Row label="AI Draft Ready for Review" desc="When an auto-generated PR is ready for your approval" inappKey="ab_approval_inapp" emailKey="ab_approval_email"/>
      </Section>

      <Section icon="🔥" title="Trending Topics">
        <Row label="Trending Topics Digest" desc="Regular summary of trending topics in your industry"
          inappKey="tt_inapp" emailKey="tt_email" extra={<FreqSelect k="tt_frequency"/>}/>
      </Section>

      <Section icon="📊" title="Competitor Analysis">
        <Row label="Competitor Activity Report" desc="Updates on competitor movements and positioning"
          inappKey="ca_inapp" emailKey="ca_email" extra={<FreqSelect k="ca_frequency"/>}/>
      </Section>

      <Section icon="🛡️" title="Trust Widget">
        <Row label="Widget Not Set Up" desc="Reminder if no Trust Widget has been created after 7 days" inappKey="tw_not_created_inapp" emailKey="tw_not_created_email"/>
        <Row label="Widget Not Verified" desc="Alert if your widget isn't verified within 48 hours of setup" inappKey="tw_not_verified_inapp" emailKey="tw_not_verified_email"/>
      </Section>

      <Section icon="💳" title="Media Credits">
        <Row label="Low Credit Alert" desc="When any tier drops to 1 credit remaining" inappKey="credits_low_inapp" emailKey="credits_low_email"/>
        <Row label="Promotions & Offers" desc="Special deals and bonus credit opportunities" inappKey="credits_promotions_inapp" emailKey="credits_promotions_email"/>
      </Section>

      <div style={{ display:"flex", justifyContent:"flex-end", paddingTop:"1rem", borderTop:"1px solid #f1f5f9", marginTop:".5rem" }}>
        <button onClick={save} disabled={saving}
          style={{ padding:".75rem 2rem", borderRadius:".65rem", border:"none", background: saving ? "#e2e8f0" : "linear-gradient(135deg,#6366f1,#8929bd)", color: saving ? "#94a3b8" : "white", fontWeight:800, fontSize:".9rem", cursor: saving ? "not-allowed" : "pointer", boxShadow: saving ? "none" : "0 4px 14px rgba(99,102,241,.3)" }}>
          {saving ? "Saving…" : "Save Preferences"}
        </button>
      </div>
    </div>
  );
}
