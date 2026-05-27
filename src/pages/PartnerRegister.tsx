import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase-partner";

const REGISTER_URL = "https://rsaoscgotumlvsbzwdiy.supabase.co/functions/v1/partner-register";

async function registerPost(body: object) {
  const res = await fetch(REGISTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

const inp: React.CSSProperties = {
  width: "100%", padding: ".6rem .85rem", border: "1.5px solid #e2e8f0",
  borderRadius: ".5rem", fontSize: ".9rem", boxSizing: "border-box", outline: "none",
  background: "white", color: "#1e293b",
};
const label: React.CSSProperties = {
  fontSize: ".78rem", fontWeight: 700, color: "#374151", display: "block", marginBottom: ".3rem",
};

export default function PartnerRegister() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";

  const [phase, setPhase] = useState<"loading"|"form"|"done"|"error">("loading");
  const [inviteData, setInviteData] = useState<{ name: string; email: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // form state
  const [name,     setName]     = useState("");
  const [company,  setCompany]  = useState("");
  const [contact,  setContact]  = useState("");
  const [phone,    setPhone]    = useState("");
  const [website,  setWebsite]  = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!token) { setErrorMsg("No invitation token found. Please use the link from your invitation email."); setPhase("error"); return; }
    registerPost({ operation: "validate_token", token }).then(d => {
      if (d.ok) {
        setInviteData({ name: d.name, email: d.email });
        setName(d.name);
        setPhase("form");
      } else {
        setErrorMsg(d.error || "Invalid invitation.");
        setPhase("error");
      }
    }).catch(() => { setErrorMsg("Failed to validate invitation. Please try again."); setPhase("error"); });
  }, [token]);

  const handleSubmit = async () => {
    setFormError("");
    if (!name.trim()) return setFormError("Name is required.");
    if (password.length < 8) return setFormError("Password must be at least 8 characters.");
    if (password !== confirm) return setFormError("Passwords do not match.");
    setSubmitting(true);
    const d = await registerPost({ operation: "complete_registration", token, name, company, contact, phone, website, password });
    if (d.ok) {
      // Auto sign-in
      await supabase.auth.signInWithPassword({ email: inviteData!.email, password });
      setPhase("done");
      setTimeout(() => navigate("/partner"), 2000);
    } else {
      setFormError(d.error || "Registration failed. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1a0a2e,#2d1054,#0f172a)", display:"flex", alignItems:"center", justifyContent:"center", padding:"1.5rem" }}>
      <div style={{ width:"100%", maxWidth:480 }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:"2rem" }}>
          <img src="/logo.png" alt="MBB" style={{ width:56, height:56, borderRadius:"50%", marginBottom:".75rem" }} />
          <div style={{ color:"white", fontSize:"1.25rem", fontWeight:900, letterSpacing:"-.01em" }}>Media Blast Boosters™</div>
          <div style={{ color:"rgba(255,255,255,.45)", fontSize:".8rem", marginTop:".25rem", textTransform:"uppercase", letterSpacing:".08em" }}>Partner Portal Registration</div>
        </div>

        <div style={{ background:"white", borderRadius:"1rem", padding:"2rem", boxShadow:"0 24px 60px rgba(0,0,0,.4)" }}>

          {/* Loading */}
          {phase === "loading" && (
            <div style={{ textAlign:"center", padding:"2rem 0", color:"#64748b" }}>
              <div style={{ fontSize:"1.5rem", marginBottom:".75rem" }}>⏳</div>
              Validating your invitation…
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div style={{ textAlign:"center", padding:"1rem 0" }}>
              <div style={{ fontSize:"2.5rem", marginBottom:".75rem" }}>⚠️</div>
              <div style={{ fontWeight:800, fontSize:"1.05rem", color:"#dc2626", marginBottom:".5rem" }}>Invitation Invalid</div>
              <div style={{ color:"#64748b", fontSize:".88rem", lineHeight:1.6 }}>{errorMsg}</div>
            </div>
          )}

          {/* Done */}
          {phase === "done" && (
            <div style={{ textAlign:"center", padding:"1rem 0" }}>
              <div style={{ fontSize:"2.5rem", marginBottom:".75rem" }}>🎉</div>
              <div style={{ fontWeight:800, fontSize:"1.1rem", color:"#1e293b", marginBottom:".5rem" }}>Welcome aboard!</div>
              <div style={{ color:"#64748b", fontSize:".88rem" }}>Your account is ready. Redirecting to your partner dashboard…</div>
            </div>
          )}

          {/* Form */}
          {phase === "form" && inviteData && (
            <>
              <div style={{ marginBottom:"1.5rem" }}>
                <div style={{ fontWeight:900, fontSize:"1.1rem", color:"#1e293b", marginBottom:".35rem" }}>Complete Your Registration</div>
                <div style={{ fontSize:".82rem", color:"#64748b" }}>
                  Creating account for <strong>{inviteData.email}</strong>
                </div>
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:".85rem" }}>
                {/* Email – read only */}
                <div>
                  <label style={label}>Email</label>
                  <input value={inviteData.email} readOnly style={{ ...inp, background:"#f8fafc", color:"#94a3b8", cursor:"not-allowed" }} />
                </div>

                {/* Name */}
                <div>
                  <label style={label}>Full Name *</label>
                  <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your full name" style={inp}
                    onFocus={e=>(e.target.style.borderColor="#8929bd")} onBlur={e=>(e.target.style.borderColor="#e2e8f0")} />
                </div>

                {/* Company */}
                <div>
                  <label style={label}>Company / Agency *</label>
                  <input value={company} onChange={e=>setCompany(e.target.value)} placeholder="e.g. NewswireJet" style={inp}
                    onFocus={e=>(e.target.style.borderColor="#8929bd")} onBlur={e=>(e.target.style.borderColor="#e2e8f0")} />
                </div>

                {/* Contact */}
                <div>
                  <label style={label}>Primary Contact Name <span style={{ fontWeight:400, color:"#94a3b8" }}>(optional)</span></label>
                  <input value={contact} onChange={e=>setContact(e.target.value)} placeholder="Contact person for communications" style={inp}
                    onFocus={e=>(e.target.style.borderColor="#8929bd")} onBlur={e=>(e.target.style.borderColor="#e2e8f0")} />
                </div>

                {/* Phone + Website side by side */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:".65rem" }}>
                  <div>
                    <label style={label}>Phone *</label>
                    <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+1 (555) 000-0000" style={inp}
                      onFocus={e=>(e.target.style.borderColor="#8929bd")} onBlur={e=>(e.target.style.borderColor="#e2e8f0")} />
                  </div>
                  <div>
                    <label style={label}>Website <span style={{ fontWeight:400, color:"#94a3b8" }}>(optional)</span></label>
                    <input value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://yoursite.com" style={inp}
                      onFocus={e=>(e.target.style.borderColor="#8929bd")} onBlur={e=>(e.target.style.borderColor="#e2e8f0")} />
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height:1, background:"#f1f5f9", margin:".25rem 0" }} />

                {/* Password */}
                <div>
                  <label style={label}>Password *</label>
                  <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" style={inp}
                    onFocus={e=>(e.target.style.borderColor="#8929bd")} onBlur={e=>(e.target.style.borderColor="#e2e8f0")} />
                </div>
                <div>
                  <label style={label}>Confirm Password *</label>
                  <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repeat your password" style={inp}
                    onFocus={e=>(e.target.style.borderColor="#8929bd")} onBlur={e=>(e.target.style.borderColor="#e2e8f0")}
                    onKeyDown={e=>{ if(e.key==="Enter") handleSubmit(); }} />
                </div>

                {formError && (
                  <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:".45rem", padding:".6rem .85rem", color:"#dc2626", fontSize:".82rem", fontWeight:600 }}>
                    {formError}
                  </div>
                )}

                <button onClick={handleSubmit} disabled={submitting || !name || !company || !phone || !password || !confirm}
                  style={{ padding:".75rem", borderRadius:".5rem", border:"none", background:submitting||!name||!company||!phone||!password||!confirm?"#e2e8f0":"linear-gradient(135deg,#6366f1,#8929bd)", color:submitting||!name||!company||!phone||!password||!confirm?"#94a3b8":"white", fontWeight:800, fontSize:".95rem", cursor:submitting||!name||!company||!phone||!password||!confirm?"not-allowed":"pointer", marginTop:".25rem" }}>
                  {submitting ? "Creating Account…" : "Create Account & Sign In →"}
                </button>
              </div>
            </>
          )}
        </div>

        <div style={{ textAlign:"center", marginTop:"1.25rem", color:"rgba(255,255,255,.3)", fontSize:".72rem" }}>
          Already have an account? <a href="/partner" style={{ color:"rgba(255,255,255,.5)", textDecoration:"underline" }}>Sign in here</a>
        </div>
      </div>
    </div>
  );
}
