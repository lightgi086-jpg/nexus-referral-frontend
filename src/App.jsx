import { useState, useEffect, useCallback } from "react";

// ─── CONFIRMED ROUTES (from server.js) ───────────────────────────────────────
// POST /api/auth/register   { full_name, email, phone, password, referral_code? }
// POST /api/auth/login      { email, password }
// GET  /api/users/dashboard → { user, wallet, directCount, indirectCount, recentCommissions, notifications, rank, nextRank }
// POST /api/payments/pay    (membership payment)
// POST /api/withdrawals/request { amount, bank_name, account_number, account_name }
// GET  /api/withdrawals/my
// GET  /api/admin/stats     (admin only)

const API = "https://nexus-referral-backend.onrender.com";

const req = async (path, opts = {}) => {
  const token = localStorage.getItem("nx_token");
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

// ─── Design tokens ───────────────────────────────────────────────────────────
const C = {
  bg: "#07090f",
  surface: "#0d1018",
  card: "#121620",
  border: "#1a2030",
  accent: "#00d4ff",
  accentBg: "#00d4ff0f",
  accentBorder: "#00d4ff25",
  gold: "#f0b429",
  goldBg: "#f0b4290f",
  goldBorder: "#f0b42925",
  green: "#10b981",
  greenBg: "#10b9810f",
  red: "#f43f5e",
  redBg: "#f43f5e0f",
  text: "#dde4f0",
  sub: "#5c6580",
  grad: "linear-gradient(135deg,#00d4ff 0%,#0062ff 100%)",
  gradGold: "linear-gradient(135deg,#f0b429 0%,#c97d10 100%)",
};

const RANK_COLOR = { Starter:C.sub, Bronze:"#cd7f32", Silver:"#a0aec0", Gold:C.gold, Platinum:"#67e8f9", Diamond:"#a78bfa" };

const css = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:${C.bg};color:${C.text};font-family:'Outfit',sans-serif;min-height:100vh}
input,button,select,textarea{font-family:inherit}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
@keyframes up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes glow{0%,100%{opacity:.7}50%{opacity:1}}
.up{animation:up .3s ease both}
.up1{animation:up .3s .05s ease both}
.up2{animation:up .3s .1s ease both}
.up3{animation:up .3s .15s ease both}
`;

// ─── Micro components ────────────────────────────────────────────────────────
const Spinner = ({ size=16, light }) => (
  <span style={{width:size,height:size,border:`2px solid ${light?"#ffffff30":C.border}`,borderTopColor:light?"#fff":C.accent,borderRadius:"50%",display:"inline-block",animation:"spin .65s linear infinite",flexShrink:0}}/>
);

const Toast = ({ msg, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 4500); return ()=>clearTimeout(t); }, [onClose]);
  const col = type==="error"?C.red:type==="success"?C.green:C.accent;
  return (
    <div style={{position:"fixed",top:16,right:16,zIndex:9999,background:C.card,border:`1px solid ${col}44`,borderRadius:10,padding:"12px 16px",color:col,fontSize:13,maxWidth:280,boxShadow:"0 8px 40px #00000090",animation:"up .2s ease"}}>
      {msg}
    </div>
  );
};

const Btn = ({ children, onClick, loading, variant="primary", full, small, disabled, style={} }) => {
  const vs = {
    primary: { background:C.grad, color:"#fff" },
    gold:    { background:C.gradGold, color:"#05030a", fontWeight:700 },
    ghost:   { background:"transparent", color:C.accent, border:`1px solid ${C.border}` },
    subtle:  { background:C.surface, color:C.sub, border:`1px solid ${C.border}` },
    danger:  { background:C.redBg, color:C.red, border:`1px solid ${C.red}30` },
  };
  return (
    <button onClick={onClick} disabled={!!loading||!!disabled}
      style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,borderRadius:9,border:"none",
        cursor:loading||disabled?"not-allowed":"pointer",fontWeight:600,fontSize:small?12:14,
        padding:small?"7px 15px":"11px 22px",transition:"all .15s",width:full?"100%":undefined,
        opacity:loading||disabled?.65:1,...vs[variant],...style}}>
      {loading?<Spinner light={variant==="primary"||variant==="gold"}/>:null}{children}
    </button>
  );
};

const Input = ({ label, error, ...props }) => (
  <div style={{display:"flex",flexDirection:"column",gap:5}}>
    {label && <label style={{fontSize:11,color:C.sub,fontFamily:"'Fira Code',monospace",letterSpacing:.7}}>{label}</label>}
    <input {...props} style={{background:C.surface,border:`1px solid ${error?C.red:C.border}`,borderRadius:8,
      padding:"10px 13px",color:C.text,fontSize:14,outline:"none",transition:"border .15s,box-shadow .15s",...props.style}}
      onFocus={e=>{e.target.style.borderColor=error?C.red:C.accent;e.target.style.boxShadow=`0 0 0 3px ${error?C.red:C.accent}18`}}
      onBlur={e=>{e.target.style.borderColor=error?C.red:C.border;e.target.style.boxShadow="none"}}
    />
    {error&&<span style={{fontSize:12,color:C.red}}>{error}</span>}
  </div>
);

const Card = ({ children, style={}, className="" }) => (
  <div className={className} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:20,...style}}>
    {children}
  </div>
);

const Badge = ({ label, color=C.sub }) => (
  <span style={{background:`${color}18`,color,border:`1px solid ${color}28`,padding:"2px 9px",borderRadius:20,
    fontSize:11,fontWeight:600,textTransform:"capitalize",fontFamily:"'Fira Code',monospace",whiteSpace:"nowrap"}}>
    {label}
  </span>
);

const CopyBtn = ({ text, label }) => {
  const [ok, setOk] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setOk(true); setTimeout(()=>setOk(false),2000); };
  return (
    <button onClick={copy} style={{background:ok?C.accentBg:C.surface,border:`1px solid ${ok?C.accent:C.border}`,
      borderRadius:7,padding:"7px 13px",color:ok?C.accent:C.sub,cursor:"pointer",fontSize:12,
      fontFamily:"'Fira Code',monospace",transition:"all .18s",whiteSpace:"nowrap"}}>
      {ok ? "✓ Copied" : (label || "Copy")}
    </button>
  );
};

const Stat = ({ label, value, color, icon, className }) => (
  <Card className={className} style={{flex:1,minWidth:130}}>
    <div style={{fontSize:10,color:C.sub,fontFamily:"'Fira Code',monospace",letterSpacing:.8,marginBottom:8}}>{label}</div>
    <div style={{fontSize:26,fontWeight:800,color:color||C.text,lineHeight:1}}>{value ?? <span style={{color:C.border}}>—</span>}</div>
    {icon && <div style={{fontSize:20,marginTop:8}}>{icon}</div>}
  </Card>
);

const EmptyState = ({ icon, title, sub, action }) => (
  <Card style={{textAlign:"center",padding:44,color:C.sub}}>
    <div style={{fontSize:38,marginBottom:10}}>{icon}</div>
    <div style={{fontWeight:600,color:C.text,marginBottom:5}}>{title}</div>
    {sub && <div style={{fontSize:13,marginBottom:action?18:0}}>{sub}</div>}
    {action}
  </Card>
);

// ─── Table wrapper ────────────────────────────────────────────────────────────
const Table = ({ heads, rows }) => (
  <div style={{overflow:"auto"}}>
    <table style={{width:"100%",borderCollapse:"collapse",minWidth:400}}>
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
          <tr key={i} style={{borderBottom:`1px solid ${C.border}`,transition:"background .12s"}}
            onMouseEnter={e=>e.currentTarget.style.background=C.surface}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            {row.map((cell,j)=>(
              <td key={j} style={{padding:"10px 14px",fontSize:13,verticalAlign:"middle"}}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── AUTH SCREEN ──────────────────────────────────────────────────────────────
const AuthScreen = ({ onAuth }) => {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ full_name:"", email:"", phone:"", password:"", referral_code:"" });
  const [errs, setErrs] = useState({});
  const [loading, setLoading] = useState(false);
  const [apiErr, setApiErr] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const code = p.get("ref") || p.get("referral_code") || p.get("code") || "";
    if (code) setForm(f=>({...f, referral_code:code}));
  }, []);

  const set = k => e => { setForm(f=>({...f,[k]:e.target.value})); setErrs(v=>({...v,[k]:""})); };

  const validate = () => {
    const e = {};
    if (mode==="register") {
      if (!form.full_name.trim()) e.full_name = "Full name required";
      if (!form.phone.trim()) e.phone = "Phone required";
    }
    if (!form.email.trim()) e.email = "Email required";
    if (!form.password) e.password = "Password required";
    else if (form.password.length < 6) e.password = "Min 6 characters";
    setErrs(e);
    return !Object.keys(e).length;
  };

  const submit = async () => {
    if (!validate()) return;
    setApiErr(""); setLoading(true);
    try {
      let data;
      if (mode==="login") {
        data = await req("/api/auth/login", { method:"POST",
          body: JSON.stringify({ email:form.email, password:form.password }) });
      } else {
        const body = { full_name:form.full_name, email:form.email, phone:form.phone, password:form.password };
        if (form.referral_code.trim()) body.referral_code = form.referral_code.trim();
        data = await req("/api/auth/register", { method:"POST", body: JSON.stringify(body) });
      }
      const token = data.token || data.accessToken;
      if (token) localStorage.setItem("nx_token", token);
      onAuth(data.user || data);
    } catch(e) {
      setApiErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onKey = e => { if (e.key==="Enter") submit(); };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20,
      background:`radial-gradient(ellipse 80% 40% at 50% -5%, #00d4ff15, transparent 60%), ${C.bg}`}}>
      <div style={{width:"100%",maxWidth:400}} className="up">

        {/* Brand */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:11,marginBottom:8}}>
            <div style={{width:42,height:42,borderRadius:13,background:C.grad,display:"flex",alignItems:"center",
              justifyContent:"center",fontSize:22,fontWeight:800,boxShadow:`0 4px 20px #00d4ff30`,animation:"glow 2.5s ease infinite"}}>
              N
            </div>
            <div style={{textAlign:"left"}}>
              <div style={{fontSize:20,fontWeight:800,letterSpacing:-.3}}>Nexus Referral</div>
              <div style={{fontSize:10,color:C.sub,fontFamily:"'Fira Code',monospace"}}>Creative Wealth Cycle</div>
            </div>
          </div>
          <p style={{fontSize:13,color:C.sub}}>Learn · Refer · Earn</p>
        </div>

        <Card>
          {/* Mode tabs */}
          <div style={{display:"flex",background:C.surface,borderRadius:9,padding:3,marginBottom:22,border:`1px solid ${C.border}`}}>
            {[["login","Sign In"],["register","Register"]].map(([m,l])=>(
              <button key={m} onClick={()=>{setMode(m);setApiErr("");setErrs({});}}
                style={{flex:1,padding:"8px",borderRadius:7,border:"none",cursor:"pointer",fontWeight:600,
                  fontSize:13,transition:"all .18s",background:mode===m?C.card:"transparent",
                  color:mode===m?C.text:C.sub,boxShadow:mode===m?"0 1px 6px #0005":"none"}}>
                {l}
              </button>
            ))}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:14}} onKeyDown={onKey}>
            {mode==="register" && <>
              <Input label="FULL NAME" placeholder="John Doe" value={form.full_name} onChange={set("full_name")} error={errs.full_name}/>
              <Input label="PHONE NUMBER" placeholder="+1 555 000 0000" value={form.phone} onChange={set("phone")} error={errs.phone}/>
            </>}
            <Input label="EMAIL ADDRESS" type="email" placeholder="you@example.com" value={form.email} onChange={set("email")} error={errs.email}/>
            <Input label="PASSWORD" type="password" placeholder="••••••••" value={form.password} onChange={set("password")} error={errs.password}/>
            {mode==="register" &&
              <Input label="REFERRAL CODE (OPTIONAL)" placeholder="e.g. JOHN4x9z" value={form.referral_code} onChange={set("referral_code")}/>
            }
            {apiErr && (
              <div style={{background:C.redBg,border:`1px solid ${C.red}30`,borderRadius:8,padding:"10px 13px",fontSize:13,color:C.red}}>
                {apiErr}
              </div>
            )}
            <Btn onClick={submit} loading={loading} full style={{marginTop:4}}>
              {mode==="login" ? "Sign In" : "Create Account"}
            </Btn>
          </div>
        </Card>

        <p style={{textAlign:"center",marginTop:14,fontSize:12,color:C.sub}}>
          {mode==="login" ? "New here? " : "Already have an account? "}
          <button onClick={()=>{setMode(mode==="login"?"register":"login");setApiErr("");}}
            style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontWeight:600,fontSize:12}}>
            {mode==="login" ? "Register" : "Sign In"}
          </button>
        </p>
      </div>
    </div>
  );
};

// ─── WITHDRAWAL MODAL ─────────────────────────────────────────────────────────
const WithdrawModal = ({ balance, onClose, onSuccess, showToast }) => {
  const [form, setForm] = useState({ amount:"", bank_name:"", account_number:"", account_name:"" });
  const [errs, setErrs] = useState({});
  const [loading, setLoading] = useState(false);
  const set = k => e => { setForm(f=>({...f,[k]:e.target.value})); setErrs(v=>({...v,[k]:""})); };

  const validate = () => {
    const e = {};
    const amt = parseFloat(form.amount);
    if (!form.amount || isNaN(amt)) e.amount = "Enter a valid amount";
    else if (amt < 5) e.amount = "Minimum withdrawal is $5.00";
    else if (amt > balance) e.amount = `Exceeds balance ($${Number(balance).toFixed(2)})`;
    if (!form.bank_name.trim()) e.bank_name = "Bank name required";
    if (!form.account_number.trim()) e.account_number = "Account number required";
    if (!form.account_name.trim()) e.account_name = "Account name required";
    setErrs(e); return !Object.keys(e).length;
  };

  const submit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await req("/api/withdrawals/request", { method:"POST", body: JSON.stringify({
        amount: parseFloat(form.amount),
        bank_name: form.bank_name.trim(),
        account_number: form.account_number.trim(),
        account_name: form.account_name.trim(),
      })});
      showToast("Withdrawal request submitted successfully!", "success");
      onSuccess(); onClose();
    } catch(e) { showToast(e.message, "error"); }
    finally { setLoading(false); }
  };

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{position:"fixed",inset:0,background:"#000000bb",zIndex:200,display:"flex",
        alignItems:"center",justifyContent:"center",padding:20}}>
      <Card style={{width:"100%",maxWidth:410,animation:"up .22s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div style={{fontSize:16,fontWeight:700}}>💸 Request Withdrawal</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.sub,cursor:"pointer",fontSize:20,lineHeight:1}}>×</button>
        </div>
        <div style={{background:C.accentBg,border:`1px solid ${C.accentBorder}`,borderRadius:8,
          padding:"9px 13px",fontSize:13,color:C.accent,marginBottom:16}}>
          Available balance: <strong>${Number(balance).toFixed(2)}</strong> · Min: $5.00
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:13}}>
          <Input label="AMOUNT (USD)" type="number" placeholder="5.00" value={form.amount} onChange={set("amount")} error={errs.amount}/>
          <Input label="BANK NAME" placeholder="e.g. Chase Bank" value={form.bank_name} onChange={set("bank_name")} error={errs.bank_name}/>
          <Input label="ACCOUNT NUMBER" placeholder="Account number" value={form.account_number} onChange={set("account_number")} error={errs.account_number}/>
          <Input label="ACCOUNT NAME" placeholder="Name on account" value={form.account_name} onChange={set("account_name")} error={errs.account_name}/>
          <div style={{display:"flex",gap:10,marginTop:4}}>
            <Btn variant="subtle" onClick={onClose} full>Cancel</Btn>
            <Btn variant="gold" onClick={submit} loading={loading} full>Submit Request</Btn>
          </div>
        </div>
      </Card>
    </div>
  );
};

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
const Dashboard = ({ user: seedUser, onLogout }) => {
  const [dash, setDash] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const showToast = (msg, type="success") => setToast({msg,type});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, w] = await Promise.allSettled([
        req("/api/users/dashboard"),
        req("/api/withdrawals/my"),
      ]);
      if (d.status==="fulfilled") setDash(d.value);
      if (w.status==="fulfilled") {
        const wd = w.value;
        setWithdrawals(wd?.withdrawals || wd?.data || (Array.isArray(wd)?wd:[]) );
      }
    } catch(e) {
      showToast("Load failed: "+e.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(()=>{ load(); },[load]);

  // Derived values from confirmed dashboard response shape
  const user            = dash?.user         || seedUser || {};
  const wallet          = dash?.wallet        || {};
  const balance         = Number(wallet.balance ?? 0);
  const directCount     = dash?.directCount   ?? 0;
  const indirectCount   = dash?.indirectCount ?? 0;
  const commissions     = dash?.recentCommissions ?? [];
  const notifications   = dash?.notifications ?? [];
  const rank            = dash?.rank          || user?.rank || "Starter";
  const nextRank        = dash?.nextRank      || dash?.next_rank;
  const rankColor       = RANK_COLOR[rank]    || C.accent;

  const referralCode    = user?.referral_code  || user?.referralCode || "";
  const membershipId    = user?.membership_id  || user?.membershipId || "";
  const referralLink    = referralCode
    ? `${window.location.origin}${window.location.pathname}?ref=${referralCode}`
    : "";
  const unread = notifications.filter(n=>!n.read&&!n.is_read).length;

  const TABS = [
    { id:"overview",      label:"Overview"   },
    { id:"referrals",     label:`Referrals (${directCount+indirectCount})` },
    { id:"earnings",      label:`Earnings (${commissions.length})` },
    { id:"withdrawals",   label:`Withdrawals (${withdrawals.length})` },
    { id:"notifications", label:`Inbox${unread?` · ${unread}`:""}` },
  ];

  const fmtDate = s => s ? new Date(s).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}) : "—";
  const fmtMoney = n => `$${Number(n||0).toFixed(2)}`;

  return (
    <div style={{minHeight:"100vh",background:C.bg}}>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={()=>setToast(null)}/>}
      {showWithdraw && <WithdrawModal balance={balance} onClose={()=>setShowWithdraw(false)} onSuccess={load} showToast={showToast}/>}

      {/* ── Header ── */}
      <header style={{borderBottom:`1px solid ${C.border}`,background:C.surface,padding:"12px 18px",
        display:"flex",alignItems:"center",justifyContent:"space-between",
        position:"sticky",top:0,zIndex:100,gap:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <div style={{width:33,height:33,borderRadius:9,background:C.grad,display:"flex",
            alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:17}}>N</div>
          <div>
            <div style={{fontWeight:700,fontSize:14,lineHeight:1.1}}>Nexus Referral</div>
            <div style={{fontSize:10,color:C.sub,fontFamily:"'Fira Code',monospace"}}>Creative Wealth Cycle</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",justifyContent:"flex-end"}}>
          <Badge label={rank} color={rankColor}/>
          <div style={{fontSize:13,fontWeight:600,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {user?.full_name||user?.name||user?.email||"User"}
          </div>
          <Btn variant="ghost" small onClick={onLogout}>Logout</Btn>
        </div>
      </header>

      <main style={{maxWidth:940,margin:"0 auto",padding:"22px 14px"}}>

        {/* ── Referral Link Banner ── */}
        <Card style={{marginBottom:20,borderColor:C.accentBorder,background:`linear-gradient(135deg,${C.accentBg},${C.card})`}} className="up">
          <div style={{marginBottom:10,display:"flex",flexWrap:"wrap",gap:8,justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:10,color:C.accent,fontFamily:"'Fira Code',monospace",letterSpacing:.8,marginBottom:2}}>YOUR REFERRAL LINK</div>
              <div style={{fontSize:12,color:C.sub}}>Earn commissions at Level 1 & Level 2</div>
            </div>
            {membershipId && (
              <div style={{background:C.goldBg,border:`1px solid ${C.goldBorder}`,borderRadius:7,
                padding:"4px 11px",fontSize:11,color:C.gold,fontFamily:"'Fira Code',monospace"}}>
                ID: {membershipId}
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{flex:1,minWidth:160,background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,
              padding:"8px 12px",fontFamily:"'Fira Code',monospace",fontSize:12,color:C.accent,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {referralLink || "—"}
            </div>
            {referralLink && <CopyBtn text={referralLink} label="Copy Link"/>}
            {referralCode && <CopyBtn text={referralCode} label="Copy Code"/>}
          </div>
        </Card>

        {/* ── Tabs ── */}
        <div style={{display:"flex",gap:2,marginBottom:20,overflowX:"auto",paddingBottom:2,borderBottom:`1px solid ${C.border}`}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{padding:"9px 15px",border:"none",borderBottom:`2px solid ${tab===t.id?C.accent:"transparent"}`,
                cursor:"pointer",fontWeight:600,fontSize:12,whiteSpace:"nowrap",transition:"all .15s",
                background:"transparent",color:tab===t.id?C.accent:C.sub}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,padding:64,color:C.sub}}>
            <Spinner size={22}/> Loading…
          </div>
        ) : (

          /* ── OVERVIEW ── */
          tab==="overview" ? (
            <div>
              <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:18}}>
                <Stat className="up"  label="WALLET BALANCE"    value={fmtMoney(balance)}   color={C.gold}  icon="💰"/>
                <Stat className="up1" label="DIRECT REFERRALS"  value={directCount}          color={C.accent} icon="👥"/>
                <Stat className="up2" label="INDIRECT REFERRALS"value={indirectCount}         color={C.green} icon="🔗"/>
                <Stat className="up3" label="CURRENT RANK"      value={rank}                 color={rankColor} icon="🏅"/>
              </div>

              {nextRank && (
                <Card style={{marginBottom:16,borderColor:C.goldBorder,background:C.goldBg}} className="up1">
                  <div style={{fontSize:10,color:C.gold,fontFamily:"'Fira Code',monospace",marginBottom:3}}>NEXT RANK</div>
                  <div style={{fontSize:13}}>Keep referring to unlock <strong style={{color:C.gold}}>{nextRank}</strong></div>
                </Card>
              )}

              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                <div style={{fontWeight:700,fontSize:15}}>Recent Commissions</div>
                <Btn variant="gold" small onClick={()=>setShowWithdraw(true)}>💸 Withdraw</Btn>
              </div>

              {commissions.length===0
                ? <EmptyState icon="📋" title="No commissions yet" sub="Share your link to start earning!"/>
                : <Card style={{padding:0,overflow:"hidden"}}>
                    <Table
                      heads={["From","Level","Amount","Date"]}
                      rows={commissions.map(c=>[
                        <span style={{fontWeight:500}}>{c.from_name||c.from||"—"}</span>,
                        <Badge label={`Level ${c.level||1}`} color={c.level===2?C.green:C.accent}/>,
                        <span style={{color:C.gold,fontWeight:700}}>{fmtMoney(c.amount)}</span>,
                        <span style={{color:C.sub}}>{fmtDate(c.created_at)}</span>,
                      ])}
                    />
                  </Card>
              }
            </div>

          /* ── REFERRALS ── */
          ) : tab==="referrals" ? (
            <div className="up">
              <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:18}}>
                <Card style={{flex:1,minWidth:130,borderColor:C.accentBorder,background:C.accentBg}}>
                  <div style={{fontSize:10,color:C.accent,fontFamily:"'Fira Code',monospace",marginBottom:6}}>LEVEL 1 — DIRECT</div>
                  <div style={{fontSize:32,fontWeight:800,color:C.accent}}>{directCount}</div>
                  <div style={{fontSize:12,color:C.sub,marginTop:4}}>You referred these members</div>
                </Card>
                <Card style={{flex:1,minWidth:130,borderColor:`${C.green}25`,background:C.greenBg}}>
                  <div style={{fontSize:10,color:C.green,fontFamily:"'Fira Code',monospace",marginBottom:6}}>LEVEL 2 — INDIRECT</div>
                  <div style={{fontSize:32,fontWeight:800,color:C.green}}>{indirectCount}</div>
                  <div style={{fontSize:12,color:C.sub,marginTop:4}}>Referred by your referrals</div>
                </Card>
              </div>
              <Card style={{textAlign:"center",padding:36}}>
                <div style={{fontSize:13,color:C.sub,marginBottom:14}}>Share your unique link to grow your network</div>
                <div style={{display:"flex",justifyContent:"center",gap:10,flexWrap:"wrap"}}>
                  {referralLink && <CopyBtn text={referralLink} label="📋 Copy Link"/>}
                  {referralCode && <CopyBtn text={referralCode} label="Copy Code"/>}
                </div>
                {referralLink && (
                  <div style={{marginTop:14,fontSize:12,color:C.sub,fontFamily:"'Fira Code',monospace",
                    wordBreak:"break-all"}}>{referralLink}</div>
                )}
              </Card>
            </div>

          /* ── EARNINGS ── */
          ) : tab==="earnings" ? (
            <div className="up">
              <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:18}}>
                <Stat label="WALLET BALANCE"   value={fmtMoney(balance)}      color={C.gold}/>
                <Stat label="TOTAL COMMISSIONS" value={commissions.length}      color={C.accent}/>
                <Stat label="TOTAL EARNED"      value={fmtMoney(commissions.reduce((s,c)=>s+Number(c.amount||0),0))} color={C.green}/>
              </div>
              <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>
                <Btn variant="gold" onClick={()=>setShowWithdraw(true)}>💸 Request Withdrawal</Btn>
              </div>
              {commissions.length===0
                ? <EmptyState icon="💎" title="No earnings yet" sub="Refer members to earn Level 1 & Level 2 commissions"/>
                : <Card style={{padding:0,overflow:"hidden"}}>
                    <Table
                      heads={["From","Level","Amount","Status","Date"]}
                      rows={commissions.map(c=>[
                        <span style={{fontWeight:500}}>{c.from_name||c.from||"—"}</span>,
                        <Badge label={`Level ${c.level||1}`} color={c.level===2?C.green:C.accent}/>,
                        <span style={{color:C.gold,fontWeight:700}}>{fmtMoney(c.amount)}</span>,
                        <Badge label={c.status||"paid"} color={C.green}/>,
                        <span style={{color:C.sub}}>{fmtDate(c.created_at)}</span>,
                      ])}
                    />
                  </Card>
              }
            </div>

          /* ── WITHDRAWALS ── */
          ) : tab==="withdrawals" ? (
            <div className="up">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={{fontWeight:700,fontSize:15}}>Withdrawal History</div>
                <Btn variant="gold" small onClick={()=>setShowWithdraw(true)}>+ New Request</Btn>
              </div>
              {withdrawals.length===0
                ? <EmptyState icon="📤" title="No withdrawals yet" sub="Minimum withdrawal amount is $5.00"
                    action={<Btn variant="gold" onClick={()=>setShowWithdraw(true)}>Request Withdrawal</Btn>}/>
                : <Card style={{padding:0,overflow:"hidden"}}>
                    <Table
                      heads={["Amount","Bank","Account No.","Account Name","Status","Date"]}
                      rows={withdrawals.map(w=>{
                        const s = w.status||"pending";
                        const sc = s==="approved"?C.green:s==="rejected"?C.red:C.gold;
                        return [
                          <span style={{color:C.gold,fontWeight:700}}>{fmtMoney(w.amount)}</span>,
                          w.bank_name||"—",
                          <span style={{fontFamily:"'Fira Code',monospace",fontSize:12}}>{w.account_number||"—"}</span>,
                          w.account_name||"—",
                          <Badge label={s} color={sc}/>,
                          <span style={{color:C.sub}}>{fmtDate(w.created_at)}</span>,
                        ];
                      })}
                    />
                  </Card>
              }
            </div>

          /* ── NOTIFICATIONS ── */
          ) : (
            <div className="up">
              {notifications.length===0
                ? <EmptyState icon="🔔" title="No notifications" sub="You're all caught up"/>
                : <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {notifications.map((n,i)=>{
                      const read = n.read||n.is_read;
                      return (
                        <Card key={i} style={{borderColor:read?C.border:C.accentBorder,
                          background:read?C.card:C.accentBg}}>
                          <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                            <div style={{width:7,height:7,borderRadius:"50%",marginTop:5,flexShrink:0,
                              background:read?C.border:C.accent}}/>
                            <div style={{flex:1}}>
                              <div style={{fontSize:14,fontWeight:read?400:600,marginBottom:4,lineHeight:1.4}}>
                                {n.message||n.title||n.body||"Notification"}
                              </div>
                              <div style={{fontSize:11,color:C.sub,fontFamily:"'Fira Code',monospace"}}>
                                {fmtDate(n.created_at)}
                              </div>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
              }
            </div>
          )
        )}
      </main>
    </div>
  );
};

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("nx_token");
    if (token) {
      req("/api/users/dashboard")
        .then(d => setUser(d?.user || d))
        .catch(() => localStorage.removeItem("nx_token"))
        .finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []);

  const logout = () => { localStorage.removeItem("nx_token"); setUser(null); };

  if (!ready) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg}}>
      <Spinner size={28}/>
    </div>
  );

  return (
    <>
      <style>{css}</style>
      {user
        ? <Dashboard user={user} onLogout={logout}/>
        : <AuthScreen onAuth={u=>setUser(u)}/>
      }
    </>
  );
}
