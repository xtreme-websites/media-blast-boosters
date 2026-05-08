import { useState, useEffect, useCallback } from "react";
import { SUPABASE_URL, SUPABASE_ANON } from "../../lib/supabase";

interface Notification {
  id: string;
  location_id: string;
  key: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
}

interface Props {
  locationId: string;
  onUnreadChange: (count: number) => void;
}

const KEY_ICONS: Record<string, string> = {
  mc_scheduled: "📅", mc_submitted: "🚀", mc_rejected: "⚠️",
  ab_approval: "🪄",
  tt_digest: "🔥", ca_digest: "📊",
  tw_not_created: "🛡️", tw_not_verified: "🛡️",
  credits_low: "💳", credits_promotion: "⭐",
};

const dbHdr = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json" };

export default function AlertsTab({ locationId, onUnreadChange }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/notifications?location_id=eq.${locationId}&order=created_at.desc&limit=50`,
        { headers: dbHdr }
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setNotifications(data);
        onUnreadChange(data.filter((n: Notification) => !n.read).length);
      }
    } catch {}
    setLoading(false);
  }, [locationId]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markRead = async (id: string) => {
    await fetch(`${SUPABASE_URL}/rest/v1/notifications?id=eq.${id}`, {
      method: "PATCH", headers: { ...dbHdr, Prefer: "return=minimal" },
      body: JSON.stringify({ read: true }),
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    onUnreadChange(notifications.filter(n => !n.read && n.id !== id).length);
  };

  const markAllRead = async () => {
    await fetch(`${SUPABASE_URL}/rest/v1/notifications?location_id=eq.${locationId}&read=eq.false`, {
      method: "PATCH", headers: { ...dbHdr, Prefer: "return=minimal" },
      body: JSON.stringify({ read: true }),
    });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    onUnreadChange(0);
  };

  const unread = notifications.filter(n => !n.read).length;

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.25rem" }}>
        <div>
          <h2 style={{ fontWeight:900, fontSize:"1.3rem", color:"#1e293b", margin:"0 0 .2rem" }}>
            🔔 Alerts
            {unread > 0 && <span style={{ marginLeft:".5rem", background:"#ef4444", color:"white", fontSize:".65rem", fontWeight:900, padding:".15rem .45rem", borderRadius:"99px" }}>{unread}</span>}
          </h2>
          <p style={{ color:"#64748b", fontSize:".83rem", margin:0 }}>All your activity notifications in one place</p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead}
            style={{ fontSize:".75rem", fontWeight:600, color:"#6366f1", background:"#eef2ff", border:"none", borderRadius:".4rem", padding:".35rem .75rem", cursor:"pointer" }}>
            Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding:"3rem", textAlign:"center", color:"#94a3b8" }}>Loading…</div>
      ) : notifications.length === 0 ? (
        <div className="card" style={{ padding:"3rem", textAlign:"center" }}>
          <div style={{ fontSize:"2.5rem", marginBottom:".75rem" }}>🔔</div>
          <div style={{ fontWeight:700, color:"#1e293b", marginBottom:".3rem" }}>No notifications yet</div>
          <div style={{ fontSize:".82rem", color:"#94a3b8" }}>You'll see activity updates here as they happen</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:".5rem" }}>
          {notifications.map(n => (
            <div key={n.id} onClick={() => !n.read && markRead(n.id)}
              style={{ display:"flex", gap:".85rem", padding:".9rem 1rem", borderRadius:".75rem", background: n.read ? "white" : "#faf5ff",
                border: n.read ? "1px solid #f1f5f9" : "1px solid #e9d5ff", cursor: n.read ? "default" : "pointer", transition:"all .15s" }}>
              <div style={{ width:38, height:38, borderRadius:".5rem", background: n.read ? "#f8fafc" : "linear-gradient(135deg,#eef2ff,#f5f3ff)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.1rem", flexShrink:0 }}>
                {KEY_ICONS[n.key] || "📢"}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight: n.read ? 600 : 700, fontSize:".85rem", color:"#1e293b", marginBottom:".2rem" }}>{n.title}</div>
                <div style={{ fontSize:".78rem", color:"#64748b", lineHeight:1.5 }}>{n.message}</div>
                <div style={{ fontSize:".68rem", color:"#94a3b8", marginTop:".35rem" }}>{timeAgo(n.created_at)}</div>
              </div>
              {!n.read && <div style={{ width:8, height:8, borderRadius:"50%", background:"#8929bd", flexShrink:0, marginTop:6 }}/>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
