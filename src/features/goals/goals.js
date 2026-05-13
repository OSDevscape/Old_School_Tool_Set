import {
  initPage, storage, showToast, sendLocalNotification,
  xpToLevel, xpForLevel, fmtXP, SKILL_MAP,
  STORAGE_KEYS, requestPushPermission,
  player, updateHeaderName,
} from '/src/app/shared.js';

initPage('goals');
updateHeaderName();

/* ── Skills list ────────────────────────────────────────── */
// Build SKILLS directly from SKILL_MAP (imported from shared.js) so icons & colors always match
const SKILL_ORDER = [
  'attack','defence','strength','hitpoints','ranged','prayer','magic',
  'cooking','woodcutting','fletching','fishing','firemaking','crafting',
  'smithing','mining','herblore','agility','thieving','slayer','farming',
  'runecrafting','hunter','construction','sailing',
];
const SKILLS = SKILL_ORDER
  .filter(k => SKILL_MAP[k])
  .map(k => ({ key: k, label: SKILL_MAP[k].name, icon: SKILL_MAP[k].icon }));

const MAX_TOTAL = 2376, MAX_QP = 310;
const PROF_ICONS = { ironman:'⚔️', hardcore:'💀', ultimate:'🔱', regular:'👤', gim:'👥', ghcim:'☠️', ugim:'🔱' };

/* ── Profile helpers ────────────────────────────────────── */
const PROFILES_KEY    = 'osts_profiles_v2';
const ACTIVE_PROF_KEY = 'osts_active_profile_v2';
const getProfiles    = () => storage.get(PROFILES_KEY, []);
const getActiveId    = () => storage.get(ACTIVE_PROF_KEY, null);
const setActiveId    = id => storage.set(ACTIVE_PROF_KEY, id);
const getActiveProf  = () => { const id=getActiveId(); return id ? getProfiles().find(p=>p.id===id)||null : null; };

/* ── Per-profile goal storage ───────────────────────────── */
const goalsKey = () => { const p=getActiveProf(); return p ? `osts-goals-v2-${p.id}` : 'osts-goals-v2-guest'; };
// QP is calculated and saved by quests.html whenever user ticks a quest
const qpKey   = () => { const p=getActiveProf(); return p ? `osts-qp-v1-${p.id}` : 'osts-qp-v1-guest'; };
let goals = [];
const loadGoals = () => { goals = storage.get(goalsKey(), []); };
const saveGoals = () => storage.set(goalsKey(), goals);

/* ── Live data ──────────────────────────────────────────── */
let liveData = null, lastRefreshed = null;
const liveXP    = sk  => liveData?.skills?.[sk]?.experience ?? null;
const liveLevel = sk  => liveData?.skills?.[sk]?.level      ?? null;
const liveTotal = ()  => liveData?.skills?.overall?.level   ?? null;

// Pull skills straight from the profile's cached WOM snapshot — no network needed
function loadLiveFromCache() {
  const p = getActiveProf();

  // Try 1: profile's cached WOM snapshot
  let snap = p?.cachedData?.latestSnapshot?.data;

  // Try 2: the global player cache (most recent WOM fetch from Overview)
  if (!snap?.skills) {
    const globalCache = storage.get(STORAGE_KEYS.PLAYER_CACHE, null);
    snap = globalCache?.latestSnapshot?.data;
  }

  if (!snap?.skills) return false;

  liveData = { skills: snap.skills };
  lastRefreshed = p?.cachedData?.updatedAt ? new Date(p.cachedData.updatedAt) : null;
  return true;
}

/* ── Math helpers ───────────────────────────────────────── */
const fmtETA = hrs => {
  if (!hrs || hrs <= 0) return null;
  const d=Math.floor(hrs/24), h=Math.floor(hrs%24), m=Math.floor((hrs*60)%60);
  return [[d,'d'],[h,'h'],[!d&&m?m:0,'m']].filter(([v])=>v>0).map(([v,u])=>v+u).join(' ') || '<1m';
};
const goalXPTarget = g => g.type==='skill' ? xpForLevel(g.targetLevel) : g.targetValue;
const goalCur      = g => g.currentValue ?? 0;
const goalPct = g => {
  const t = goalXPTarget(g), c = goalCur(g);
  if (!t || t <= 0) return 0;
  return Math.min(100, Math.max(0, (c / t) * 100));
};

/* ── Goal card ──────────────────────────────────────────── */
/* ── Helpers shared by card + detail ─────────────────────── */
function skillColor(g) {
  return g.type==='skill' ? (SKILL_MAP[g.skill]?.color||'var(--gold)') : 'var(--gold)';
}
function goalIcon(g, size=34) {
  if (g.type==='skill') {
    const sk=SKILLS.find(s=>s.key===g.skill);
    return `<img src="${sk?.icon}" alt="${sk?.label||''}" width="${size}" height="${size}" style="object-fit:contain" onerror="this.style.display='none'">`;
  }
  const em={total:'📊',qp:'📜',custom:'⭐'}[g.type]||'⭐';
  return `<span class="gm-em" style="font-size:${Math.round(size*.65)}px">${em}</span>`;
}
function goalSub(g) {
  const cur=goalCur(g);
  if (g.type==='skill') { const sk=SKILLS.find(s=>s.key===g.skill); return `${sk?.label||g.skill} · Lv ${xpToLevel(cur)} → ${g.targetLevel}`; }
  if (g.type==='total') return `Total Level · ${cur} → ${g.targetValue}`;
  if (g.type==='qp')    return `Quest Points · ${cur} → ${g.targetValue}`;
  return `${cur.toLocaleString()} → ${goalXPTarget(g).toLocaleString()}`;
}
function msChips(g) {
  if (g.type!=='skill') return '';
  const cur=goalCur(g);
  const steps=[10,20,30,40,50,60,70,80,90,92,95,99].filter(l=>l<=g.targetLevel);
  let nextSet=false;
  return steps.map(l=>{
    const done=cur>=xpForLevel(l);
    const next=!done&&!nextSet?(nextSet=true,true):false;
    return `<span class="ms-chip ${done?'done':next?'next':''}">${l}</span>`;
  }).join('');
}

/* ── Compact grid card ───────────────────────────────────── */
function goalCardHTML(g) {
  const pct=goalPct(g), isDone=pct>=100;
  const col=skillColor(g);
  const barW=Math.min(100,pct).toFixed(1);
  return `<div class="goal-card${isDone?' done':''}" data-id="${g.id}" style="--gc:${col}" role="button" tabindex="0">
    <div class="goal-card-stripe"></div>
    <div class="goal-card-img">
      ${goalIcon(g,44)}
      ${isDone?'<div class="goal-done-badge">✓ Done</div>':''}
    </div>
    <div class="goal-card-info">
      <div class="goal-card-name">${g.name}</div>
      <div class="goal-bar-bg"><div class="goal-bar-fill" style="width:${barW}%"></div></div>
      <div class="goal-bar-pct">${pct.toFixed(1)}%</div>
    </div>
  </div>`;
}

/* ── Render grid ─────────────────────────────────────────── */
function renderGoals() {
  const q=(document.getElementById('goals-search')?.value||'').toLowerCase().trim();
  const list=document.getElementById('goals-list');
  const shown=q ? goals.filter(g=>g.name.toLowerCase().includes(q)) : goals;
  if (!shown.length) {
    list.style.display='block';
    list.innerHTML=`<div class="goals-notice" style="grid-column:1/-1">
      <div class="ni">🎯</div>
      <p>${q?'No goals match your search.':'No goals yet. Tap <b>+ Goal</b> to set your first milestone.'}</p>
    </div>`;
    return;
  }
  list.style.display='';
  list.innerHTML=shown.map(goalCardHTML).join('');
  list.querySelectorAll('.goal-card').forEach(card=>{
    card.onclick=()=>openGoalDetail(card.dataset.id);
    card.onkeydown=e=>{ if(e.key==='Enter'||e.key===' ') openGoalDetail(card.dataset.id); };
  });
}

function deleteGoal(id) {
  const g=goals.find(x=>x.id===id);
  if (!g||!confirm(`Delete "${g.name}"?`)) return;
  goals=goals.filter(x=>x.id!==id);
  saveGoals(); renderGoals(); closeGoalDetail();
  showToast(`${g.name} deleted`);
}

/* ── Goal detail modal ───────────────────────────────────── */
let detailGoalId=null;

function openGoalDetail(id) {
  const g=goals.find(x=>x.id===id); if(!g) return;
  detailGoalId=id;
  const pct=goalPct(g), isDone=pct>=100;
  const col=skillColor(g);
  const cur=goalCur(g), target=goalXPTarget(g), remaining=Math.max(0,target-cur);
  const barW=Math.min(100,pct).toFixed(1);

  // header
  document.getElementById('gm-icon').innerHTML=goalIcon(g,34);
  document.getElementById('gm-icon').style.cssText=`--gc:${col};border-color:${col}22`;
  document.getElementById('gm-title').textContent=g.name;
  document.getElementById('gm-sub').textContent=goalSub(g);

  // progress
  document.getElementById('gm-pct').textContent=pct.toFixed(1)+'%';
  document.getElementById('gm-pct').style.color=isDone?'var(--green)':col;
  const dispCur=g.type==='skill'?`${fmtXP(cur)} XP`:String(cur);
  const dispTgt=g.type==='skill'?`${fmtXP(target)} XP`:String(target);
  document.getElementById('gm-cur-tgt').textContent=`${dispCur} / ${dispTgt}`;
  const fill=document.getElementById('gm-bar-fill');
  fill.style.width=barW+'%';
  fill.style.background=isDone?'var(--green)':col;
  fill.className='gm-bar-fill'+(isDone?' done':'');

  // stats grid
  let remLabel='';
  if(g.type==='skill')      remLabel=`${fmtXP(remaining)} XP`;
  else if(g.type==='total') remLabel=`${remaining} levels`;
  else if(g.type==='qp')    remLabel=`${remaining} QP`;
  else                      remLabel=remaining.toLocaleString();

  const statsHTML=[
    `<div class="gm-stat"><div class="gs-label">Remaining</div><div class="gs-val">${remLabel}</div></div>`,
    `<div class="gm-stat"><div class="gs-label">Progress</div><div class="gs-val">${pct.toFixed(1)}%</div></div>`,
    g.xpPerHr>0?`<div class="gm-stat"><div class="gs-label">Rate</div><div class="gs-val">${fmtXP(g.xpPerHr)}/hr</div></div>`:'',
    g.xpPerHr>0&&remaining>0?(()=>{const eta=fmtETA(remaining/g.xpPerHr);return eta?`<div class="gm-stat"><div class="gs-label">ETA</div><div class="gs-val">${eta}</div></div>`:'';})():'',
  ].filter(Boolean).join('');
  document.getElementById('gm-stats').innerHTML=statsHTML;

  // milestones
  const msWrap=document.getElementById('gm-ms-wrap');
  const msHTML=msChips(g);
  if(msHTML){msWrap.style.display='block';document.getElementById('gm-milestones').innerHTML=msHTML;}
  else msWrap.style.display='none';

  document.getElementById('goal-detail-overlay').classList.add('show');
}

function closeGoalDetail(){ document.getElementById('goal-detail-overlay').classList.remove('show'); }

document.getElementById('gm-close-btn').onclick=closeGoalDetail;
document.getElementById('goal-detail-overlay').onclick=e=>{ if(e.target.id==='goal-detail-overlay') closeGoalDetail(); };
document.getElementById('gm-edit-btn').onclick=()=>{ closeGoalDetail(); openUpdateSheet(detailGoalId); };
document.getElementById('gm-del-btn').onclick=()=>deleteGoal(detailGoalId);

/* ── Profile chip ───────────────────────────────────────── */
function renderProfileChip() {
  const p=getActiveProf();
  document.getElementById('profile-chip').style.display    = p ? 'flex' : 'none';
  document.getElementById('no-profile-notice').style.display = p ? 'none' : 'block';
  if (!p) return;
  document.getElementById('pc-icon').textContent = PROF_ICONS[p.type]||'👤';
  document.getElementById('pc-rsn').textContent  = p.nickname||p.rsn;
  const timeStr = lastRefreshed
    ? lastRefreshed.toLocaleDateString([],{month:'short',day:'numeric'})
      +' '+lastRefreshed.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
    : '';
  document.getElementById('pc-time').textContent = timeStr ? `WOM · ${timeStr}` : 'Sync from Overview';
}

/* ── Sync goals from current liveData (no network) ─────────── */
function syncGoalsFromLive() {
  if (!liveData) return;
  const completed=[];
  goals.forEach(g=>{
    if (g.type==='skill') {
      const xp=liveXP(g.skill);
      if (xp===null) return;
      const was=goalPct(g)>=100;
      if (g.startValue==null) g.startValue=xp;
      g.currentValue=xp;
      if (!was&&goalPct(g)>=100) completed.push(g);
    } else if (g.type==='total') {
      const lv=liveTotal();
      if (lv===null) return;
      const was=goalPct(g)>=100;
      if (g.startValue==null) g.startValue=lv;
      g.currentValue=lv;
      if (!was&&goalPct(g)>=100) completed.push(g);
    } else if (g.type==='qp') {
      const qp = storage.get(qpKey(), null);
      if (qp===null) return;
      const was=goalPct(g)>=100;
      if (g.startValue==null) g.startValue=qp;
      g.currentValue=qp;
      if (!was&&goalPct(g)>=100) completed.push(g);
    }
  });
  /* 🎉 completion notifications */
  for (const g of completed) {
    sendLocalNotification('Goal Complete! 🎉',`You reached: ${g.name}`,'goal-done-'+g.id);
    showToast(`🎉 ${g.name} completed!`,5000);
  }
  /* 🔥 near-complete nudge */
  goals.forEach(g=>{
    const pct=goalPct(g);
    if (!g._near90&&pct>=90&&pct<100) {
      g._near90=true;
      sendLocalNotification('Almost there! 🔥',`${g.name} — ${pct.toFixed(0)}% done`,'goal-near-'+g.id);
    }
  });
}

/* ── Add Goal sheet ─────────────────────────────────────── */
let selType='skill', selSkill=null;

// Build skill grid
document.getElementById('gs-skill-grid').innerHTML=SKILLS.map(s=>
  `<button class="sf-skill-btn" data-skill="${s.key}">
    <img src="${s.icon}" alt="${s.label}" loading="lazy" onerror="this.style.display='none'">
    ${s.label}
  </button>`
).join('');

function getStoredQP() {
  return storage.get(qpKey(), null);
}

function syncLiveBox() {
  if (selType!=='skill'&&selType!=='total'&&selType!=='qp') return;
  const dot=document.getElementById('gs-live-dot');
  const lbl=document.getElementById('gs-live-lbl');
  const val=document.getElementById('gs-live-val');
  if (selType==='skill') {
    if (selSkill) {
      const xp=liveXP(selSkill), lv=liveLevel(selSkill);
      if (xp!==null) {
        dot.classList.add('live');
        lbl.textContent=`Lv ${lv} · ${fmtXP(xp)} XP`;
        val.textContent=xp.toLocaleString()+' XP';
      } else {
        dot.classList.remove('live');
        lbl.textContent=liveData?'Skill not found':'Load a profile on Overview first';
        val.textContent='—';
      }
    } else {
      dot.classList.remove('live');
      lbl.textContent='Select a skill above';
      val.textContent='—';
    }
  } else if (selType==='total') {
    const tot=liveTotal();
    dot.classList.toggle('live',tot!==null);
    lbl.textContent=tot?`Total Level ${tot}`:(liveData?'No data':'Load a profile on Overview first');
    val.textContent=tot?String(tot):'—';
  } else if (selType==='qp') {
    const qp=getStoredQP();
    dot.classList.toggle('live',qp!==null);
    lbl.textContent=qp!==null?'QP from Quest log':'Complete quests in the Quests page to auto-fill';
    val.textContent=qp!==null?String(qp):'—';
  }
}

function setType(type) {
  selType=type;
  document.querySelectorAll('.sf-type-btn').forEach(b=>b.classList.toggle('active',b.dataset.gtype===type));
  const live=type==='skill'||type==='total'||(type==='qp'&&getStoredQP()!==null);
  document.getElementById('gs-skill-wrap').classList.toggle('sf-hidden', type!=='skill');
  document.getElementById('gs-name-wrap').classList.toggle('sf-hidden',  type!=='custom');
  document.getElementById('gs-xphr-wrap').classList.toggle('sf-hidden',  type!=='skill');
  document.getElementById('gs-live-wrap').classList.toggle('sf-hidden',  !live);
  document.getElementById('gs-manual-wrap').classList.toggle('sf-hidden', live);
  const tl=document.getElementById('gs-target-lbl'), ti=document.getElementById('gs-target');
  const cl=document.getElementById('gs-current-lbl');
  if(type==='skill')       { tl.textContent='Target Level';  ti.placeholder='99';   ti.max=99; }
  else if(type==='total')  { tl.textContent='Target Level';  ti.placeholder='2376'; ti.max=MAX_TOTAL; }
  else if(type==='qp')     { tl.textContent='Target QP';     ti.placeholder='333';  ti.max=MAX_QP; cl.textContent='Current Quest Points'; }
  else                     { tl.textContent='Target Value';  ti.placeholder='e.g. 100'; ti.removeAttribute('max'); cl.textContent='Where you are now'; }
  if(live) syncLiveBox();
}

document.querySelectorAll('.sf-type-btn').forEach(b=>b.onclick=()=>setType(b.dataset.gtype));
document.querySelectorAll('.sf-skill-btn').forEach(b=>{
  b.onclick=()=>{
    selSkill=b.dataset.skill;
    document.querySelectorAll('.sf-skill-btn').forEach(x=>x.classList.toggle('active',x.dataset.skill===selSkill));
    syncLiveBox();
  };
});

function openAddSheet() {
  selSkill=null;
  document.querySelectorAll('.sf-skill-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('gs-title').textContent='Add Goal';
  document.getElementById('gs-err').textContent='';
  document.getElementById('gs-target').value='';
  document.getElementById('gs-xphr').value='';
  document.getElementById('gs-name').value='';
  document.getElementById('gs-current').value='';
  setType('skill');
  document.getElementById('goal-sheet-overlay').classList.add('show');
}

// ── Drag-to-close ─────────────────────────────────────────────────────────────
function makeDraggable(sheetEl, overlayEl, closeFn) {
  let startX = 0, startY = 0, dragY = 0, dragX = 0, active = false, dir = null;
  sheetEl.addEventListener('touchstart', e => {
    const top = sheetEl.getBoundingClientRect().top;
    if (e.touches[0].clientY - top > 80) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dragY = dragX = 0; dir = null; active = true;
    sheetEl.style.transition = 'none';
  }, { passive: true });
  window.addEventListener('touchmove', e => {
    if (!active) return;
    const dy = e.touches[0].clientY - startY;
    const dx = e.touches[0].clientX - startX;
    if (!dir) {
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) dir = 'h';
      else if (Math.abs(dy) > 8) dir = 'v';
    }
    if (dir === 'v') { dragY = Math.max(0, dy); sheetEl.style.transform = `translateY(${dragY}px)`; }
    else if (dir === 'h') { dragX = dx; sheetEl.style.transform = `translateX(${dragX}px)`; }
  }, { passive: true });
  window.addEventListener('touchend', () => {
    if (!active) return;
    active = false;
    sheetEl.style.transition = '';
    if ((dir === 'v' && dragY > 100) || (dir === 'h' && Math.abs(dragX) > 120)) {
      sheetEl.style.transform = '';
      closeFn();
    } else {
      sheetEl.style.transform = 'translateY(0)';
    }
    dragY = dragX = 0; dir = null;
  });
}

function closeAddSheet() {
  const s = document.getElementById('goal-sheet');
  if (s) s.style.transform = '';
  document.getElementById('goal-sheet-overlay').classList.remove('show');
}

document.getElementById('gs-close').onclick=closeAddSheet;
document.getElementById('goal-sheet-overlay').onclick=e=>{ if(e.target.id==='goal-sheet-overlay') closeAddSheet(); };
document.getElementById('add-goal-btn').onclick=openAddSheet;
makeDraggable(document.getElementById('goal-sheet'), document.getElementById('goal-sheet-overlay'), closeAddSheet);

document.getElementById('gs-submit').onclick=()=>{
  const err=document.getElementById('gs-err');
  err.textContent='';
  const tgt=parseInt(document.getElementById('gs-target').value);
  const xphr=parseInt(document.getElementById('gs-xphr').value)||0;
  const cname=document.getElementById('gs-name').value.trim();

  if(selType==='skill'&&!selSkill)    { err.textContent='Select a skill.'; return; }
  if(selType==='custom'&&!cname)      { err.textContent='Enter a goal name.'; return; }
  if(!tgt||tgt<1)                     { err.textContent='Enter a valid target.'; return; }
  if(selType==='skill'&&(tgt<2||tgt>99)) { err.textContent='Target level must be 2–99.'; return; }

  let cur;
  if(selType==='skill') {
    cur=liveXP(selSkill)??0;
    if(cur>=xpForLevel(tgt)){ err.textContent='You already have this level!'; return; }
  } else if(selType==='total') {
    cur=liveTotal()??0;
    if(cur>=tgt){ err.textContent='You already have this total level!'; return; }
  } else if(selType==='qp') {
    const stored = getStoredQP();
    cur = stored !== null ? stored : (parseInt(document.getElementById('gs-current').value)||0);
    if(cur>=tgt){ err.textContent='You already have this many Quest Points!'; return; }
  } else {
    cur=parseInt(document.getElementById('gs-current').value)||0;
  }

  const sk=selType==='skill'?SKILLS.find(s=>s.key===selSkill):null;
  const name=selType==='skill'  ? `${sk.label} ${tgt}` :
             selType==='total'  ? `Total Level ${tgt}`  :
             selType==='qp'     ? `${tgt} Quest Points` : cname;

  goals.unshift({
    id:'g-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
    type:selType, name,
    skill:       selType==='skill'?selSkill:undefined,
    targetLevel: selType==='skill'?tgt:undefined,
    targetValue: selType!=='skill'?tgt:undefined,
    currentValue:cur, startValue:cur,
    xpPerHr:xphr||undefined,
    createdAt:Date.now(), _near90:false,
  });
  saveGoals(); renderGoals(); closeAddSheet();
  showToast(`${name} added!`);
};

/* ── Update Progress sheet ──────────────────────────────── */
let editingId=null;
function openUpdateSheet(id) {
  const g=goals.find(x=>x.id===id); if(!g) return;
  editingId=id;
  document.getElementById('upd-title').textContent=g.name;
  document.getElementById('upd-sub').textContent=
    g.type==='skill'?'Override XP or adjust XP/hr':
    g.type==='total'?'Override total level':
    g.type==='qp'?'Update quest points':'Update value';
  document.getElementById('upd-val-lbl').textContent=
    g.type==='skill'?'Current XP':g.type==='total'?'Current Total Level':
    g.type==='qp'?'Current Quest Points':'Current Value';
  document.getElementById('upd-val').value=g.currentValue||'';
  document.getElementById('upd-xphr').value=g.xpPerHr||'';
  document.getElementById('upd-err').textContent='';
  document.getElementById('upd-api-note').style.display=(g.type==='skill'||g.type==='total')?'block':'none';
  document.getElementById('upd-xphr-wrap').style.display=g.type==='skill'?'flex':'none';
  document.getElementById('upd-sheet-overlay').classList.add('show');
}
function closeUpdateSheet() {
  const s = document.getElementById('upd-sheet');
  if (s) s.style.transform = '';
  document.getElementById('upd-sheet-overlay').classList.remove('show');
}
document.getElementById('upd-close').onclick=closeUpdateSheet;
document.getElementById('upd-sheet-overlay').onclick=e=>{ if(e.target.id==='upd-sheet-overlay') closeUpdateSheet(); };
makeDraggable(document.getElementById('upd-sheet'), document.getElementById('upd-sheet-overlay'), closeUpdateSheet);

document.getElementById('upd-submit').onclick=()=>{
  const g=goals.find(x=>x.id===editingId); if(!g) return;
  const v=parseInt(document.getElementById('upd-val').value);
  const hr=parseInt(document.getElementById('upd-xphr').value)||undefined;
  if(isNaN(v)||v<0){ document.getElementById('upd-err').textContent='Enter a valid value.'; return; }
  const was=goalPct(g)>=100;
  g.currentValue=v; if(hr!==undefined) g.xpPerHr=hr;
  saveGoals(); renderGoals(); closeUpdateSheet();
  showToast(`${g.name} updated!`);
  if(!was&&goalPct(g)>=100){
    sendLocalNotification('Goal Complete! 🎉',`You reached: ${g.name}`,'goal-done-'+g.id);
    showToast(`🎉 ${g.name} completed!`,5000);
  }
};

/* ── Settings – profile list ────────────────────────────── */
function renderProfileList() {
  const list=document.getElementById('sp-profile-list'); if(!list) return;
  const profiles=getProfiles(), activeId=getActiveId();
  if(!profiles.length){
    list.innerHTML=`<p style="font-size:12px;color:var(--muted)">No saved profiles. <a href="/Pages/overview.html">Search a player</a> to create one.</p>`;
    return;
  }
  list.innerHTML=[...profiles].sort((a,b)=>(b.id===activeId)-(a.id===activeId)).map(p=>`
    <div class="profile-card${p.id===activeId?' active':''}">
      <div class="profile-avatar">${PROF_ICONS[p.type]||'👤'}</div>
      <div class="profile-info">
        <div class="profile-name">${p.nickname||p.rsn}</div>
        <div class="profile-rsn">${p.rsn}</div>
      </div>
      ${p.id!==activeId
        ?`<button class="profile-act" data-load="${p.id}">Load</button>`
        :`<span style="font-size:10px;color:var(--gold)">Active</span>`}
    </div>`).join('');
  list.querySelectorAll('[data-load]').forEach(b=>b.addEventListener('click',()=>{
    const p=getProfiles().find(x=>x.id===b.dataset.load); if(!p) return;
    setActiveId(p.id);
    loadGoals(); liveData=null; lastRefreshed=null;
    loadLiveFromCache();
    syncGoalsFromLive();
    saveGoals();
    renderGoals(); renderProfileChip(); renderProfileList();
    showToast(`Switched to ${p.nickname||p.rsn}`);
  }));
}
document.getElementById('settings-btn')?.addEventListener('click',renderProfileList,true);

/* ── Push ───────────────────────────────────────────────── */
function updatePushStatus(){
  const el=document.getElementById('push-status'); if(!el) return;
  if(!('Notification' in window)){ el.textContent='Not supported.'; return; }
  el.textContent={granted:'✅ Notifications enabled',denied:'🚫 Blocked — check browser settings',default:'Not enabled yet.'}[Notification.permission];
}
document.getElementById('enable-push-btn')?.addEventListener('click',async()=>{
  try { await requestPushPermission(); showToast('Notifications enabled ✅'); updatePushStatus(); }
  catch(e){ showToast(e.message,4000); }
});

/* ── Clear goals ────────────────────────────────────────── */
document.getElementById('clear-goals-btn')?.addEventListener('click',()=>{
  if(!confirm('Clear all goals for this profile?')) return;
  goals=[]; saveGoals(); renderGoals(); showToast('Goals cleared');
});

/* ── Search ─────────────────────────────────────────────── */
document.getElementById('goals-search').addEventListener('input',renderGoals);

/* ── Boot ───────────────────────────────────────────────── */
loadGoals();
renderGoals();
renderProfileChip();
updatePushStatus();
// Sync from WOM cache if available
if (loadLiveFromCache()) {
  syncGoalsFromLive();
  saveGoals();
} else {
  // Even without WOM data, sync QP goals from quest checklist
  const qp = storage.get(qpKey(), null);
  if (qp !== null) {
    let changed = false;
    goals.forEach(g => {
      if (g.type==='qp') { if(g.startValue==null)g.startValue=qp; g.currentValue=qp; changed=true; }
    });
    if(changed) saveGoals();
  }
}
renderGoals();
renderProfileChip();
syncLiveBox();