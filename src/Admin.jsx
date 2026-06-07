import { useState, useEffect, useCallback } from "react";

// ─── ADMIN ROUTES (confirmed from admin.js + server.js) ──────────────────────
// POST /api/auth/login                     { email, password }
// GET  /api/admin/stats                    → { totalUsers, active_users, pendingWithdrawals, commissionSum, paymentSum }
// GET  /api/admin/users                    → [ ...users ]
// GET  /api/admin/withdrawals              → [ ...withdrawals ] (pending)
// POST /api/admin/withdrawals/:id/approve  → approve + notify user
// POST /api/admin/withdrawals/:id/reject   → refund wallet + notify user
// GET  /api/admin/payments                 → [ ...payments ]
// GET  /api/admin/commissions              → [ ...commissions ]

const API = "https://nexus-referral-backend.onrender.com";

const req = async (path, opts = {}) => {
  const token = localStorage.getItem("nx_admin_token");
  const res = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
};

// ─── Tokens ──────────────────────────────────────────────────────────────────
const C = {
  bg:           "#060810",
  surface:      "#0b0e18",
  card:         "#0f1320",
  border:       "#181f32",
  borderHover:  "#232d48",
  accent:       "#4f8ef7",
  accentBg:     "#4f8ef710",
  accentBorder: "#4f8ef725",
  gold:         "#f0b429",
  goldBg:       "#f0b42910",
  green:        "#10b981",
  greenBg:      "#10b98110",
  red:          "#f43f5e",
  redBg:        "#f43f5e10",
  orange:       "#fb923c",
  orangeBg:     "#fb923c10",
  purple:       "#a78bfa",
  purpleBg:     "#a78bfa10",
  text:         "#d8e0f0",
  sub:          "#4a5270",
  grad:         "linear-gradient(135deg,#4f8ef7,#8b5cf6)",
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:${C.bg};color:${C.text};font-family:'Outfit',sans-serif;min-height:100vh}
input,button,select,textarea{font-family:inherit}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:${C.surface}}
::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.up{animation:up .28s ease both}
.u1{animation:up .28s .04s ease both}
.u2{animation:up .28s .08s ease both}
.u3{animation:up .28s .12s ease both}
`;

// ─── Primitives ───────────────────────────────────────────────────────────────
const Spin = ({ size=16, color="#fff" }) => (
  <span style={{width:size,height:size,border:`2px solid ${color}25`,borderTopColor:color,
    borderRadius:"50%",display:"inline-block",animation:"spin .65s linear infinite",flexShrink:0}}/>
);

const Toast = ({ msg, type, onClose }) => {
  useEffect(()=>{ const t=setTimeout(onClose,4500); return()=>clearTimeout(t); },[onClose]);
  const col = type==="error"?C.red:type==="success"?C.green:type==="warn"?C.orange:C.accent;
  return (
    <div style={{position:"fixed",top:16,right:16,zIndex:9999,background:C.card,
      border:`1px solid ${col}44`,borderRadius:10,padding:"12px 16px",color:col,fontSize:13,
      maxWidth:300,boxShadow:"0 8px 40px #00000099",animation:"up .2s ease",lineHeight:1.4}}>
      {msg}
    </div>
  );
};

const Btn = ({ children, onClick, loading, variant="primary", small, full, disabled, style={} }) => {
  const vs = {
    primary:{ background:C.grad,color:"#fff" },
    success:{ background:`linear-gradient(135deg,${C.green},#059669)`,color:"#fff" },
    danger: { background:`linear-gradient(135deg,${C.red},#be123c)`,color:"#fff" },
    ghost:  { background:"transparent",color:C.accent,border:`1px solid ${C.border}` },
    subtle: { background:C.surface,color:C.sub,border:`1px solid ${C.border}` },
    gold:   { background:`linear-gradient(135deg,${C.gold},#b45309)`,color:"#050300",fontWeight:700 },
  };
  return (
    <button onClick={onClick} disabled={!!loading||!!disabled}
      style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,
        borderRadius:8,border:"none",cursor:loading||disabled?"not-allowed":"pointer",
        fontWeight:600,fontSize:small?11:13,padding:small?"6px 13px":"10px 20px",
        transition:"all .15s",width:full?"100%":undefined,
        opacity:loading||disabled?.6:1,...vs[variant],...style}}>
      {loading?<Spin/>:null}{children}
    </button>
  );
};

const Input = ({ label, error, ...props }) => (
  <div style={{display:"flex",flexDirection:"column",gap:5}}>
    {label&&<label style={{fontSize:10,color:C.sub,fontFamily:"'Fira Code',monospace",letterSpacing:.7}}>{label}</label>}
    <input {...props} style={{background:C.surface,border:`1px solid ${error?C.red:C.border}`,
      borderRadius:8,padding:"10px 13px",color:C.text,fontSize:13,outline:"none",
      transition:"border .15s,box-shadow .15s",...props.style}}
      onFocus={e=>{e.target.style.borderColor=error?C.red:C.accent;e.target.style.boxShadow=`0 0 0 3px ${error?C.red:C.accent}15`}}
      onBlur={e=>{e.target.style.borderColor=error?C.red:C.border;e.target.style.boxShadow="none"}}
    />
    {error&&<span style={{fontSize:11,color:C.red}}>{error}</span>}
  </div>
);

const Card = ({ children, style={}, className="" }) => (
  <div className={className} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:13,padding:20,...style}}>
    {children}
  </div>
);

const Badge = ({ label, color=C.sub }) => (
  <span style={{background:`${color}18`,color,border:`1px solid ${color}28`,padding:"2px 9px",
    borderRadius:20,fontSize:10,fontWeight:600,textTransform:"capitalize",
    fontFamily:"'Fira Code',monospace",whiteSpace:"nowrap"}}>
    {label}
  </span>
);

const Avatar = ({ name="" }) => {
  const ch = (name[0]||"?").toUpperCase();
  const colors = ["#4f8ef7","#10b981","#f0b429","#a78bfa","#f43f5e","#fb923c"];
  const col = colors[ch.charCodeAt(0)%colors.length];
  return (
    <div style={{width:32,height:32,borderRadius:9,background:`${col}22`,border:`1px solid ${col}44`,
      display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:col,flexShrink:0}}>
      {ch}
    </div>
  );
};

// ─── Stat card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon, color, sub, className }) => (
  <Card className={className} style={{flex:1,minWidth:140}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
      <div style={{fontSize:10,color:C.sub,fontFamily:"'Fira Code',monospace",letterSpacing:.7}}>{label}</div>
      <div style={{fontSize:22}}>{icon}</div>
    </div>
    <div style={{fontSize:28,fontWeight:800,color:color||C.text,lineHeight:1}}>{value??<span style={{color:C.border}}>—</span>}</div>
    {sub&&<div style={{fontSize:11,color:C.sub,marginTop:5}}>{sub}</div>}
  </Card>
);

// ─── Table ────────────────────────────────────────────────────────────────────
const Table = ({ heads, rows, empty }) => (
  rows.length===0
    ? <div style={{textAlign:"center",padding:44,color:C.sub,fontSize:13}}>{empty||"No data"}</div>
    : <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:500}}>
          <thead>
            <tr style={{background:C.surface}}>
              {heads.map(h=>(
                <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:10,color:C.sub,
                  fontFamily:"'Fira Code',monospace",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row,i)=>(
              <tr key={i} style={{borderBottom:`1px solid ${C.border}`,transition:"background .1s"}}
                onMouseEnter={e=>e.currentTarget.style.background=C.surface}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                {row.map((cell,j)=>(
                  <td key={j} style={{padding:"11px 14px",fontSize:13,verticalAlign:"middle"}}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
);

// ─── Confirm dialog ───────────────────────────────────────────────────────────
const Confirm = ({ title, body, confirmLabel, confirmVariant="danger", onConfirm, onCancel, loading }) => (
  <div onClick={e=>e.target===e.currentTarget&&onCancel()}
    style={{position:"fixed",inset:0,background:"#000000bb",zIndex:300,display:"flex",
      alignItems:"center",justifyContent:"center",padding:20}}>
    <Card style={{width:"100%",maxWidth:360,animation:"up .2s ease"}}>
      <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>{title}</div>
      <div style={{fontSize:13,color:C.sub,marginBottom:20,lineHeight:1.5}}>{body}</div>
      <div style={{display:"flex",gap:10}}>
        <Btn variant="subtle" onClick={onCancel} full>Cancel</Btn>
        <Btn variant={confirmVariant} onClick={onConfirm} loading={loading} full>{confirmLabel}</Btn>
      </div>
    </Card>
  </div>
);

// ─── User detail modal ────────────────────────────────────────────────────────
const UserModal = ({ user, onClose }) => {
  const fmtDate = s => s?new Date(s).toLocaleString():"—";
  const fmtMoney = n => `$${Number(n||0).toFixed(2)}`;
  const rows = [
    ["Membership ID", user.membership_id||"—"],
    ["Full Name",     user.full_name||user.name||"—"],
    ["Email",         user.email||"—"],
    ["Phone",         user.phone||"—"],
    ["Referral Code", user.referral_code||"—"],
    ["Referred By",   user.referred_by||"—"],
    ["Rank",          user.rank||"Starter"],
    ["Wallet",        fmtMoney(user.wallet?.balance??user.balance)],
    ["Status",        user.is_active?"Active":"Inactive"],
    ["Joined",        fmtDate(user.created_at)],
  ];
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{position:"fixed",inset:0,background:"#000000bb",zIndex:200,display:"flex",
        alignItems:"center",justifyContent:"center",padding:20}}>
      <Card style={{width:"100%",maxWidth:440,animation:"up .2s ease",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <Avatar name={user.full_name||user.name||"?"}/>
            <div>
              <div style={{fontWeight:700,fontSize:15}}>{user.full_name||user.name||"User"}</div>
              <div style={{fontSize:11,color:C.sub}}>{user.email}</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.sub,cursor:"pointer",fontSize:22,lineHeight:1}}>×</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:0,border:`1px solid ${C.border}`,borderRadius:9,overflow:"hidden"}}>
          {rows.map(([k,v],i)=>(
            <div key={k} style={{display:"flex",padding:"10px 14px",borderBottom:i<rows.length-1?`1px solid ${C.border}`:"none",
              background:i%2===0?C.surface:"transparent"}}>
              <div style={{width:130,fontSize:11,color:C.sub,fontFamily:"'Fira Code',monospace",flexShrink:0}}>{k}</div>
              <div style={{fontSize:13,fontFamily:"'Fira Code',monospace",color:C.text,wordBreak:"break-all"}}>{v}</div>
            </div>
          ))}
        </div>
        <Btn variant="subtle" onClick={onClose} full style={{marginTop:14}}>Close</Btn>
      </Card>
    </div>
  );
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
const LoginScreen = ({ onAuth }) => {
  const [form, setForm] = useState({ email:"", password:"" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  const submit = async () => {
    if (!form.email||!form.password) return setErr("Both fields required");
    setErr(""); setLoading(true);
    try {
      const data = await req("/api/auth/login",{ method:"POST", body:JSON.stringify(form) });
      const token = data.token||data.accessToken;
      const user = data.user||data;
      if (!user?.is_admin && !user?.role?.includes?.("admin")) {
        throw new Error("Access denied — admin accounts only");
      }
      if (token) localStorage.setItem("nx_admin_token", token);
      onAuth(user);
    } catch(e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20,
      background:`radial-gradient(ellipse 70% 40% at 50% -5%,#4f8ef718,transparent 60%),${C.bg}`}}>
      <div style={{width:"100%",maxWidth:380}} className="up">
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:11,marginBottom:8}}>
            <div style={{width:44,height:44,borderRadius:13,background:C.grad,display:"flex",
              alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,
              boxShadow:"0 4px 24px #4f8ef740"}}>N</div>
            <div style={{textAlign:"left"}}>
              <div style={{fontSize:20,fontWeight:800}}>Nexus Admin</div>
              <div style={{fontSize:10,color:C.sub,fontFamily:"'Fira Code',monospace"}}>Creative Wealth Cycle</div>
            </div>
          </div>
          <p style={{fontSize:12,color:C.sub}}>Restricted to administrators only</p>
        </div>
        <Card>
          <div style={{display:"flex",flexDirection:"column",gap:14}}
            onKeyDown={e=>e.key==="Enter"&&submit()}>
            <Input label="ADMIN EMAIL" type="email" placeholder="admin@cwc.com"
              value={form.email} onChange={set("email")}/>
            <Input label="PASSWORD" type="password" placeholder="••••••••"
              value={form.password} onChange={set("password")}/>
            {err&&<div style={{background:C.redBg,border:`1px solid ${C.red}30`,borderRadius:8,
              padding:"9px 13px",fontSize:12,color:C.red}}>{err}</div>}
            <Btn onClick={submit} loading={loading} full style={{marginTop:4}}>Sign In to Admin Panel</Btn>
          </div>
        </Card>
      </div>
    </div>
  );
};

// ─── MAIN ADMIN PANEL ─────────────────────────────────────────────────────────
const AdminPanel = ({ admin, onLogout }) => {
  const [tab, setTab] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [payments, setPayments] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null); // { id, action:"approve"|"reject", name }
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [search, setSearch] = useState("");
  const [wFilter, setWFilter] = useState("pending"); // pending | approved | rejected | all

  const showToast = (msg, type="success") => setToast({msg,type});
  const fmtDate  = s => s?new Date(s).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}):"—";
  const fmtMoney = n => `$${Number(n||0).toFixed(2)}`;

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s,u,w,p,c] = await Promise.allSettled([
        req("/api/admin/stats"),
        req("/api/admin/users"),
        req("/api/admin/withdrawals"),
        req("/api/admin/payments"),
        req("/api/admin/commissions"),
      ]);
      if (s.status==="fulfilled") setStats(s.value?.data||s.value);
      if (u.status==="fulfilled") { const d=u.value; setUsers(d?.users||d?.data||(Array.isArray(d)?d:[])); }
      if (w.status==="fulfilled") { const d=w.value; setWithdrawals(d?.withdrawals||d?.data||(Array.isArray(d)?d:[])); }
      if (p.status==="fulfilled") { const d=p.value; setPayments(d?.payments||d?.data||(Array.isArray(d)?d:[])); }
      if (c.status==="fulfilled") { const d=c.value; setCommissions(d?.commissions||d?.data||(Array.isArray(d)?d:[])); }
    } catch(e) { showToast("Load error: "+e.message,"error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(()=>{ loadAll(); },[loadAll]);

  const handleWithdrawal = async () => {
    if (!confirm) return;
    setConfirmLoading(true);
    try {
      await req(`/api/admin/withdrawals/${confirm.id}/${confirm.action}`,{ method:"POST" });
      showToast(`Withdrawal ${confirm.action}d successfully`,"success");
      setConfirm(null);
      loadAll();
    } catch(e) { showToast(e.message,"error"); }
    finally { setConfirmLoading(false); }
  };

  // Filtered data
  const filteredUsers = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.full_name||u.name||"").toLowerCase().includes(q)
      || (u.email||"").toLowerCase().includes(q)
      || (u.membership_id||"").toLowerCase().includes(q)
      || (u.referral_code||"").toLowerCase().includes(q);
  });

  const filteredWithdrawals = withdrawals.filter(w =>
    wFilter==="all" ? true : (w.status||"pending")===wFilter
  );

  const pendingCount = withdrawals.filter(w=>(w.status||"pending")==="pending").length;

  const TABS = [
    { id:"dashboard",   label:"Dashboard",              icon:"📊" },
    { id:"users",       label:`Users (${users.length})`, icon:"👥" },
    { id:"withdrawals", label:`Withdrawals${pendingCount?` · ${pendingCount} pending`:""}`, icon:"💸" },
    { id:"payments",    label:`Payments (${payments.length})`, icon:"💳" },
    { id:"commissions", label:`Commissions (${commissions.length})`, icon:"🔗" },
  ];

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column"}}>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      {confirm && (
        <Confirm
          title={confirm.action==="approve" ? "Approve Withdrawal" : "Reject Withdrawal"}
          body={confirm.action==="approve"
            ? `Approve ${fmtMoney(confirm.amount)} withdrawal for ${confirm.name}? This will mark it as paid.`
            : `Reject ${fmtMoney(confirm.amount)} withdrawal for ${confirm.name}? The amount will be refunded to their wallet.`
          }
          confirmLabel={confirm.action==="approve" ? "Yes, Approve" : "Yes, Reject"}
          confirmVariant={confirm.action==="approve" ? "success" : "danger"}
          onConfirm={handleWithdrawal}
          onCancel={()=>setConfirm(null)}
          loading={confirmLoading}
        />
      )}
      {selectedUser && <UserModal user={selectedUser} onClose={()=>setSelectedUser(null)}/>}

      {/* ── Sidebar ── */}
      <div style={{display:"flex",minHeight:"100vh"}}>
        <aside style={{width:220,flexShrink:0,background:C.surface,borderRight:`1px solid ${C.border}`,
          display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",overflowY:"auto"}}>
          {/* Logo */}
          <div style={{padding:"18px 16px",borderBottom:`1px solid ${C.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:9}}>
              <div style={{width:34,height:34,borderRadius:10,background:C.grad,display:"flex",
                alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:17}}>N</div>
              <div>
                <div style={{fontWeight:700,fontSize:13}}>Nexus Admin</div>
                <div style={{fontSize:9,color:C.sub,fontFamily:"'Fira Code',monospace"}}>CWC Platform</div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{flex:1,padding:"10px 8px"}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",
                  borderRadius:9,border:"none",cursor:"pointer",textAlign:"left",marginBottom:2,
                  transition:"all .15s",fontWeight:tab===t.id?600:500,fontSize:13,
                  background:tab===t.id?C.accentBg:"transparent",
                  color:tab===t.id?C.accent:C.sub,
                  borderLeft:tab===t.id?`2px solid ${C.accent}`:"2px solid transparent"}}>
                <span style={{fontSize:16}}>{t.icon}</span>
                <span style={{flex:1,lineHeight:1.3}}>{t.label}</span>
              </button>
            ))}
          </nav>

          {/* Admin info */}
          <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:10}}>
              <Avatar name={admin?.full_name||admin?.name||"A"}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {admin?.full_name||admin?.name||"Admin"}
                </div>
                <div style={{fontSize:10,color:C.sub,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {admin?.email||""}
                </div>
              </div>
            </div>
            <Btn variant="subtle" small full onClick={onLogout}>Logout</Btn>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main style={{flex:1,padding:"22px 20px",overflowX:"hidden"}}>

          {loading && !stats ? (
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,padding:80,color:C.sub}}>
              <Spin size={24} color={C.accent}/> Loading admin data…
            </div>
          ) : (

            /* ══ DASHBOARD ══ */
            tab==="dashboard" ? (
              <div>
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:22,fontWeight:800,marginBottom:4}}>Dashboard</div>
                  <div style={{fontSize:13,color:C.sub}}>Platform overview — Nexus Referral / Creative Wealth Cycle</div>
                </div>

                <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20}}>
                  <StatCard className="up"  label="TOTAL USERS"       value={stats?.totalUsers??stats?.total_users??users.length} icon="👥" color={C.accent} sub="All registered members"/>
                  <StatCard className="u1"  label="ACTIVE USERS"      value={stats?.active_users??stats?.activeUsers??0} icon="✅" color={C.green} sub="Active members"/>
                  <StatCard className="u2"  label="PENDING WITHDRAWALS" value={pendingCount} icon="⏳" color={C.orange} sub="Awaiting approval"/>
                  <StatCard className="u3"  label="TOTAL PAYMENTS"    value={fmtMoney(stats?.paymentSum??stats?.total_payments)} icon="💳" color={C.purple} sub="Membership fees collected"/>
                </div>

                <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20}}>
                  <StatCard label="COMMISSIONS PAID" value={fmtMoney(stats?.commissionSum??stats?.total_commissions)} icon="🔗" color={C.gold} sub="Level 1 + Level 2"/>
                  <StatCard label="TOTAL WITHDRAWALS" value={withdrawals.length} icon="💸" color={C.red} sub="All time requests"/>
                  <StatCard label="TOTAL COMMISSIONS" value={commissions.length} icon="📈" color={C.accent}/>
                  <StatCard label="TOTAL PAYMENTS"    value={payments.length} icon="🧾" color={C.green}/>
                </div>

                {/* Pending withdrawals quick list */}
                {pendingCount > 0 && (
                  <Card style={{marginBottom:16,borderColor:`${C.orange}30`,background:C.orangeBg}} className="up">
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:15,color:C.orange}}>⏳ Pending Withdrawals ({pendingCount})</div>
                        <div style={{fontSize:12,color:C.sub,marginTop:2}}>Requires your action</div>
                      </div>
                      <Btn variant="ghost" small onClick={()=>setTab("withdrawals")}>View All</Btn>
                    </div>
                    <Table
                      heads={["Member","Amount","Bank","Date","Actions"]}
                      rows={withdrawals.filter(w=>(w.status||"pending")==="pending").slice(0,5).map(w=>[
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          <Avatar name={w.user?.full_name||w.user_name||"?"}/>
                          <div>
                            <div style={{fontWeight:600,fontSize:13}}>{w.user?.full_name||w.user_name||"—"}</div>
                            <div style={{fontSize:11,color:C.sub}}>{w.user?.email||""}</div>
                          </div>
                        </div>,
                        <span style={{color:C.gold,fontWeight:700}}>{fmtMoney(w.amount)}</span>,
                        w.bank_name||"—",
                        <span style={{color:C.sub,fontSize:12}}>{fmtDate(w.created_at)}</span>,
                        <div style={{display:"flex",gap:6}}>
                          <Btn variant="success" small onClick={()=>setConfirm({id:w.id,action:"approve",name:w.user?.full_name||w.user_name||"user",amount:w.amount})}>✓ Approve</Btn>
                          <Btn variant="danger"  small onClick={()=>setConfirm({id:w.id,action:"reject", name:w.user?.full_name||w.user_name||"user",amount:w.amount})}>✕ Reject</Btn>
                        </div>,
                      ])}
                      empty="No pending withdrawals"
                    />
                  </Card>
                )}

                {/* Recent users */}
                <Card className="up">
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div style={{fontWeight:700,fontSize:15}}>Recent Members</div>
                    <Btn variant="ghost" small onClick={()=>setTab("users")}>View All</Btn>
                  </div>
                  <Table
                    heads={["Member","Membership ID","Referral Code","Rank","Joined"]}
                    rows={[...users].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,8).map(u=>[
                      <div style={{display:"flex",gap:8,alignItems:"center",cursor:"pointer"}} onClick={()=>setSelectedUser(u)}>
                        <Avatar name={u.full_name||u.name||"?"}/>
                        <div>
                          <div style={{fontWeight:600,fontSize:13}}>{u.full_name||u.name||"—"}</div>
                          <div style={{fontSize:11,color:C.sub}}>{u.email}</div>
                        </div>
                      </div>,
                      <span style={{fontFamily:"'Fira Code',monospace",fontSize:11,color:C.sub}}>{u.membership_id||"—"}</span>,
                      <span style={{fontFamily:"'Fira Code',monospace",fontSize:11,color:C.accent}}>{u.referral_code||"—"}</span>,
                      <Badge label={u.rank||"Starter"} color={C.accent}/>,
                      <span style={{color:C.sub,fontSize:12}}>{fmtDate(u.created_at)}</span>,
                    ])}
                    empty="No users yet"
                  />
                </Card>
              </div>

            /* ══ USERS ══ */
            ) : tab==="users" ? (
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10}}>
                  <div>
                    <div style={{fontSize:20,fontWeight:800,marginBottom:2}}>Members</div>
                    <div style={{fontSize:12,color:C.sub}}>{users.length} total registered users</div>
                  </div>
                  <input value={search} onChange={e=>setSearch(e.target.value)}
                    placeholder="Search name, email, ID, code…"
                    style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 14px",
                      color:C.text,fontSize:13,outline:"none",width:240}}
                    onFocus={e=>e.target.style.borderColor=C.accent}
                    onBlur={e=>e.target.style.borderColor=C.border}
                  />
                </div>
                <Card style={{padding:0,overflow:"hidden"}} className="up">
                  <Table
                    heads={["Member","Membership ID","Referral Code","Referred By","Rank","Wallet","Status","Joined","Detail"]}
                    rows={filteredUsers.map(u=>[
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <Avatar name={u.full_name||u.name||"?"}/>
                        <div>
                          <div style={{fontWeight:600,fontSize:13}}>{u.full_name||u.name||"—"}</div>
                          <div style={{fontSize:11,color:C.sub}}>{u.email}</div>
                          <div style={{fontSize:10,color:C.sub}}>{u.phone||""}</div>
                        </div>
                      </div>,
                      <span style={{fontFamily:"'Fira Code',monospace",fontSize:11,color:C.sub}}>{u.membership_id||"—"}</span>,
                      <span style={{fontFamily:"'Fira Code',monospace",fontSize:11,color:C.accent}}>{u.referral_code||"—"}</span>,
                      <span style={{fontFamily:"'Fira Code',monospace",fontSize:11,color:C.sub}}>{u.referred_by||"—"}</span>,
                      <Badge label={u.rank||"Starter"} color={C.accent}/>,
                      <span style={{color:C.gold,fontWeight:600}}>{fmtMoney(u.wallet?.balance??u.balance)}</span>,
                      <Badge label={u.is_active?"Active":"Inactive"} color={u.is_active?C.green:C.sub}/>,
                      <span style={{color:C.sub,fontSize:11}}>{fmtDate(u.created_at)}</span>,
                      <Btn variant="ghost" small onClick={()=>setSelectedUser(u)}>View</Btn>,
                    ])}
                    empty="No users found"
                  />
                </Card>
              </div>

            /* ══ WITHDRAWALS ══ */
            ) : tab==="withdrawals" ? (
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,flexWrap:"wrap",gap:10}}>
                  <div>
                    <div style={{fontSize:20,fontWeight:800,marginBottom:2}}>Withdrawals</div>
                    <div style={{fontSize:12,color:C.sub}}>{pendingCount} pending · {withdrawals.length} total</div>
                  </div>
                  {/* Filter tabs */}
                  <div style={{display:"flex",gap:4,background:C.surface,padding:3,borderRadius:9,border:`1px solid ${C.border}`}}>
                    {["pending","approved","rejected","all"].map(f=>(
                      <button key={f} onClick={()=>setWFilter(f)}
                        style={{padding:"6px 13px",borderRadius:7,border:"none",cursor:"pointer",
                          fontWeight:600,fontSize:11,transition:"all .15s",textTransform:"capitalize",
                          background:wFilter===f?C.card:"transparent",
                          color:wFilter===f?C.text:C.sub}}>
                        {f} {f!=="all"?`(${withdrawals.filter(w=>(w.status||"pending")===f).length})`:""}
                      </button>
                    ))}
                  </div>
                </div>
                <Card style={{padding:0,overflow:"hidden"}} className="up">
                  <Table
                    heads={["Member","Amount","Bank","Account No.","Account Name","Status","Date","Actions"]}
                    rows={filteredWithdrawals.map(w=>{
                      const s = w.status||"pending";
                      const sc = s==="approved"?C.green:s==="rejected"?C.red:C.orange;
                      return [
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          <Avatar name={w.user?.full_name||w.user_name||"?"}/>
                          <div>
                            <div style={{fontWeight:600,fontSize:13}}>{w.user?.full_name||w.user_name||"—"}</div>
                            <div style={{fontSize:11,color:C.sub}}>{w.user?.email||""}</div>
                          </div>
                        </div>,
                        <span style={{color:C.gold,fontWeight:700}}>{fmtMoney(w.amount)}</span>,
                        w.bank_name||"—",
                        <span style={{fontFamily:"'Fira Code',monospace",fontSize:11}}>{w.account_number||"—"}</span>,
                        w.account_name||"—",
                        <Badge label={s} color={sc}/>,
                        <span style={{color:C.sub,fontSize:12}}>{fmtDate(w.created_at)}</span>,
                        s==="pending"
                          ? <div style={{display:"flex",gap:6}}>
                              <Btn variant="success" small onClick={()=>setConfirm({id:w.id,action:"approve",name:w.user?.full_name||w.user_name||"user",amount:w.amount})}>✓</Btn>
                              <Btn variant="danger"  small onClick={()=>setConfirm({id:w.id,action:"reject", name:w.user?.full_name||w.user_name||"user",amount:w.amount})}>✕</Btn>
                            </div>
                          : <Badge label={s==="approved"?"Processed":"Refunded"} color={s==="approved"?C.green:C.sub}/>,
                      ];
                    })}
                    empty={`No ${wFilter==="all"?"":wFilter} withdrawals`}
                  />
                </Card>
              </div>

            /* ══ PAYMENTS ══ */
            ) : tab==="payments" ? (
              <div>
                <div style={{marginBottom:18}}>
                  <div style={{fontSize:20,fontWeight:800,marginBottom:2}}>Payments</div>
                  <div style={{fontSize:12,color:C.sub}}>Membership fee payments · {payments.length} total</div>
                </div>
                <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:18}}>
                  <StatCard label="TOTAL COLLECTED" value={fmtMoney(payments.reduce((s,p)=>s+Number(p.amount||0),0))} color={C.green} icon="💰"/>
                  <StatCard label="TOTAL RECORDS"   value={payments.length} color={C.accent} icon="🧾"/>
                </div>
                <Card style={{padding:0,overflow:"hidden"}} className="up">
                  <Table
                    heads={["Member","Amount","Reference","Status","Date"]}
                    rows={payments.map(p=>[
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <Avatar name={p.user?.full_name||p.user_name||"?"}/>
                        <div>
                          <div style={{fontWeight:600,fontSize:13}}>{p.user?.full_name||p.user_name||"—"}</div>
                          <div style={{fontSize:11,color:C.sub}}>{p.user?.email||""}</div>
                        </div>
                      </div>,
                      <span style={{color:C.green,fontWeight:700}}>{fmtMoney(p.amount)}</span>,
                      <span style={{fontFamily:"'Fira Code',monospace",fontSize:11,color:C.sub}}>{p.reference||p.ref||"—"}</span>,
                      <Badge label={p.status||"completed"} color={C.green}/>,
                      <span style={{color:C.sub,fontSize:12}}>{fmtDate(p.created_at)}</span>,
                    ])}
                    empty="No payments yet"
                  />
                </Card>
              </div>

            /* ══ COMMISSIONS ══ */
            ) : (
              <div>
                <div style={{marginBottom:18}}>
                  <div style={{fontSize:20,fontWeight:800,marginBottom:2}}>Commissions</div>
                  <div style={{fontSize:12,color:C.sub}}>Level 1 & Level 2 referral commissions · {commissions.length} total</div>
                </div>
                <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:18}}>
                  <StatCard label="TOTAL PAID OUT"  value={fmtMoney(commissions.reduce((s,c)=>s+Number(c.amount||0),0))} color={C.gold} icon="🔗"/>
                  <StatCard label="LEVEL 1"  value={commissions.filter(c=>c.level===1||c.level==="1").length} color={C.accent} icon="👤"/>
                  <StatCard label="LEVEL 2"  value={commissions.filter(c=>c.level===2||c.level==="2").length} color={C.green} icon="👥"/>
                </div>
                <Card style={{padding:0,overflow:"hidden"}} className="up">
                  <Table
                    heads={["Earner","From","Level","Amount","Status","Date"]}
                    rows={commissions.map(c=>[
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <Avatar name={c.user?.full_name||c.earner_name||"?"}/>
                        <div>
                          <div style={{fontWeight:600,fontSize:13}}>{c.user?.full_name||c.earner_name||"—"}</div>
                          <div style={{fontSize:11,color:C.sub}}>{c.user?.email||""}</div>
                        </div>
                      </div>,
                      <span style={{fontSize:13}}>{c.from_name||c.from||"—"}</span>,
                      <Badge label={`Level ${c.level||1}`} color={c.level===2||c.level==="2"?C.green:C.accent}/>,
                      <span style={{color:C.gold,fontWeight:700}}>{fmtMoney(c.amount)}</span>,
                      <Badge label={c.status||"paid"} color={C.green}/>,
                      <span style={{color:C.sub,fontSize:12}}>{fmtDate(c.created_at)}</span>,
                    ])}
                    empty="No commissions yet"
                  />
                </Card>
              </div>
            )
          )}
        </main>
      </div>
    </div>
  );
};

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [admin, setAdmin] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("nx_admin_token");
    if (token) {
      req("/api/admin/stats")
        .then(() => {
          // token still valid — try to get admin user info
          return req("/api/auth/me").catch(()=>null);
        })
        .then(d => setAdmin(d?.user||d||{ email:"admin" }))
        .catch(() => localStorage.removeItem("nx_admin_token"))
        .finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []);

  const logout = () => { localStorage.removeItem("nx_admin_token"); setAdmin(null); };

  if (!ready) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg}}>
      <Spin size={30} color={C.accent}/>
    </div>
  );

  return (
    <>
      <style>{css}</style>
      {admin
        ? <AdminPanel admin={admin} onLogout={logout}/>
        : <LoginScreen onAuth={u=>setAdmin(u)}/>
      }
    </>
  );
}
