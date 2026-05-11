import { useState, useEffect, ReactNode } from "react";

const SESSION_KEY = "mbb_session";

// Trusted origins — HL installs + direct dev/preview access
const ALLOWED_ORIGINS = [
  "https://app.xtremeautomator.com",
  "https://app.gohighlevel.com",
  "https://app.leadconnectorhq.com",
  "https://media-blast-boosters.vercel.app",
  "https://mediablast.xlogic.app",
];

// Dev mode: bypass all checks in local dev OR when ?dev_access=mbb2026 is in URL
const DEV_MODE = import.meta.env.DEV ||
  new URLSearchParams(window.location.search).get("dev_access") === "mbb2026";

interface Session { location_id: string; validated_at: number; }

export function getSession(): Session | null {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? "null"); } catch { return null; }
}

function setSession(location_id: string) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ location_id, validated_at: Date.now() }));
}

interface Props { locationId: string | null; children: ReactNode; }

export default function AuthGuard({ locationId, children }: Props) {
  const [status, setStatus] = useState<"checking" | "ok" | "blocked">("checking");

  useEffect(() => {
    const validate = async () => {
      // DEV MODE: bypass all checks
      if (DEV_MODE) { setStatus("ok"); return; }

      // No location_id → always block
      if (!locationId) { setStatus("blocked"); return; }

      // Valid cached session for this location → skip re-validation
      const session = getSession();
      if (session && session.location_id === locationId) {
        setStatus("ok"); return;
      }

      // Must be in an iframe (HL always embeds in iframe)
      const inFrame = window !== window.top;
      if (!inFrame) { setStatus("blocked"); return; }

      // Check referrer origin against allowed HL origins
      // If referrer is empty (some browsers omit it for cross-origin), allow if in iframe
      const referrerOrigin = document.referrer ? (() => {
        try { return new URL(document.referrer).origin; } catch { return ""; }
      })() : "";

      const originAllowed = !referrerOrigin || ALLOWED_ORIGINS.includes(referrerOrigin);
      if (!originAllowed) { setStatus("blocked"); return; }

      // Passed all checks — trust the location_id from HL's custom value
      setSession(locationId);
      setStatus("ok");
    };
    validate();
  }, [locationId]);

  if (status === "checking") return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#0f0a1e" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:40, height:40, border:"3px solid rgba(255,255,255,.1)", borderTopColor:"#8929bd", borderRadius:"50%", animation:"spin .8s linear infinite", margin:"0 auto 1rem" }}/>
        <div style={{ color:"rgba(255,255,255,.4)", fontSize:".85rem" }}>Loading…</div>
      </div>
    </div>
  );

  if (status === "blocked") return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#0f0a1e", fontFamily:"system-ui,sans-serif" }}>
      <div style={{ textAlign:"center", maxWidth:360, padding:"2rem" }}>
        <img src="/logo.png" alt="MBB" style={{ width:64, height:64, objectFit:"contain", marginBottom:"1.5rem", opacity:.8, display:"block", margin:"0 auto 1.5rem" }}/>
        <h2 style={{ color:"white", fontWeight:700, marginBottom:".5rem", fontSize:"1.25rem" }}>Access Restricted</h2>
        <p style={{ color:"rgba(255,255,255,.4)", fontSize:".85rem", lineHeight:1.6 }}>
          This dashboard must be accessed through your platform account. Please log in to your account to continue.
        </p>
      </div>
    </div>
  );

  return <>{children}</>;
}

