// Baby Steps — Home Upgrade v3.1
const BASE_RPS = 1/1;
const UPGRADE_DEFS = [
  {key:"tree",   label:"Tree",    base:50,  growth:1.8, max:10, icons:["🌱","🌿","🌳","🌸"]},
  {key:"bench",  label:"Bench",   base:80,  growth:1.8, max:10, icons:["🪵","🪑","🪑✨","🪑🌼"]},
  {key:"pond",   label:"Pond",    base:120, growth:1.85,max:10, icons:["💧","🌊","🐟","🦆"]},
  {key:"lamp",   label:"Lamp",    base:200, growth:1.9, max:10, icons:["🕯️","🔦","💡","✨"]},
  {key:"path",   label:"Path",    base:160, growth:1.85,max:10, icons:["🟫","🧱","🧱✨","🏵️"]},
  {key:"fountain",label:"Fountain",base:300, growth:1.95,max:10, icons:["💧","⛲","⛲✨","🌈"]},
];

const DEFAULT_STATE = {
  coins: 0,
  lastTs: Date.now(),
  permRps: 0,
  chores: [
    {name:"Fold laundry", inc:0.10},
    {name:"Empty dishwasher", inc:0.10},
    {name:"Water plants", inc:0.05}
  ],
  upgrades: UPGRADE_DEFS.reduce((acc,u)=>{acc[u.key]=0; return acc;}, {}),
};

function loadState(){
  try {
    const raw = localStorage.getItem("bs-upgrade-v3_1-state");
    if (!raw) return { ...DEFAULT_STATE };
    const obj = JSON.parse(raw);
    // migrate chores if old format
    let chores = obj.chores;
    if (Array.isArray(chores) && typeof chores[0]==="string"){
      chores = chores.map(n=>({name:n, inc:0.10}));
    }
    const mergedUpgrades = {...DEFAULT_STATE.upgrades, ...(obj.upgrades||{})};
    const merged = {...DEFAULT_STATE, ...obj, chores: chores||DEFAULT_STATE.chores, upgrades: mergedUpgrades};
    Object.keys(merged.upgrades).forEach(k=>{
      if (!UPGRADE_DEFS.find(u=>u.key===k)) delete merged.upgrades[k];
    });
    return merged;
  } catch(e){
    return { ...DEFAULT_STATE };
  }
}
function saveState(s){ localStorage.setItem("bs-upgrade-v3_1-state", JSON.stringify(s)); }

function currentRps(s){ return BASE_RPS + s.permRps; }
function currentRpm(s){ return currentRps(s) * 60; }

function accrue(s){
  const now = Date.now();
  const dt = Math.max(0, Math.floor((now - s.lastTs)/1000));
  if (dt > 0){
    s.coins += dt * currentRps(s);
    s.lastTs += dt*1000;
  }
}

function fmtInt(n){ return Math.floor(n).toLocaleString(); }
function fmtNum(n){ return (Math.round(n*100)/100).toLocaleString(); }

function updateUI(s){
  document.getElementById("coins").textContent = fmtInt(s.coins);
  document.getElementById("rateSec").textContent = fmtNum(currentRps(s));
  document.getElementById("rateMin").textContent = fmtInt(currentRpm(s));
  document.getElementById("permBoost").textContent = fmtNum(s.permRps);
  renderGarden(s);
  renderUpgrades(s);
  renderChores(s);
  const tip = document.getElementById("installTip");
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  tip.style.display = standalone ? "none" : "block";
}

function renderGarden(s){
  const g = document.getElementById("garden");
  g.innerHTML = "";
  UPGRADE_DEFS.forEach(def=>{
    const level = s.upgrades[def.key] || 0;
    const stageCount = def.icons.length;
    const stageIndex = Math.min(stageCount-1, Math.floor((level/def.max)*stageCount));
    const icon = def.icons[stageIndex] || def.icons[0];
    const plot = document.createElement("div");
    plot.className = "plot";
    plot.title = `${def.label} Lv.${level}`;
    plot.textContent = icon;
    g.appendChild(plot);
  });
}

function renderUpgrades(s){
  const grid = document.getElementById("upgradesGrid");
  grid.innerHTML = "";
  UPGRADE_DEFS.forEach(def=>{
    const level = s.upgrades[def.key] || 0;
    const cost = upgradeCost(def, level);
    const btn = document.createElement("button");
    btn.className = level%2 ? "secondary" : "";
    btn.disabled = level >= def.max || s.coins < cost;
    btn.textContent = level >= def.max ? `${def.label} (MAX)` : `${def.label} Lv.${level} → ${level+1} (cost ${fmtInt(cost)})`;
    btn.onclick = ()=>{
      const st = loadState();
      if (st.upgrades[def.key] >= def.max) return;
      const c = upgradeCost(def, st.upgrades[def.key]);
      if (st.coins >= c){
        st.coins -= c;
        st.upgrades[def.key] += 1;
        saveState(st); updateUI(st); haptic();
      }
    };
    grid.appendChild(btn);
  });
}

function upgradeCost(def, level){
  if (level >= def.max) return Infinity;
  return Math.floor(def.base * Math.pow(def.growth, level));
}

function renderChores(s){
  const list = document.getElementById("choreList");
  list.innerHTML = "";
  s.chores.forEach((ch, idx)=>{
    const row = document.createElement("div");
    row.className = "row";
    row.style.justifyContent = "space-between";
    const label = document.createElement("div");
    label.textContent = `${ch.name}  (+${fmtNum(ch.inc)}/sec)`;
    const grp = document.createElement("div");
    grp.className="row";
    const del = document.createElement("button");
    del.className="secondary";
    del.textContent="Remove";
    del.style.padding="8px 10px";
    del.onclick = ()=>{
      const st = loadState();
      st.chores.splice(idx,1);
      saveState(st); updateUI(st);
    };
    const done = document.createElement("button");
    done.textContent = `Complete (+${fmtNum(ch.inc)}/sec)`;
    done.style.padding="8px 10px";
    done.onclick = ()=>{
      const st = loadState();
      st.permRps += Number(ch.inc)||0;
      saveState(st); updateUI(st); haptic();
    };
    grp.appendChild(del); grp.appendChild(done);
    row.appendChild(label); row.appendChild(grp);
    list.appendChild(row);
  });
}

function addChore(){
  const dlg = document.getElementById("choreDialog");
  const nameEl = document.getElementById("choreInput");
  const valEl = document.getElementById("choreValue");
  dlg.showModal();
  document.getElementById("saveChore").onclick = ()=>{
    const name = (nameEl.value||"").trim();
    const inc = parseFloat(valEl.value||"0") || 0;
    if (name){
      const s = loadState();
      s.chores.push({name, inc});
      saveState(s);
      updateUI(s);
    }
    dlg.close();
    nameEl.value=""; valEl.value="0.10";
  };
  document.getElementById("cancelChore").onclick = ()=>dlg.close();
}

function openGames(){
  const dlg = document.getElementById("gamesDialog");
  dlg.showModal();
  document.getElementById("closeGames").onclick = ()=>dlg.close();
}

// Odd Tile (10× RPS)
function gameOdd(){
  const dlg = document.getElementById("puzzleDialog");
  const grid = document.getElementById("puzzleGrid");
  grid.innerHTML = "";
  const oddIndex = Math.floor(Math.random()*9);
  for(let i=0;i<9;i++){
    const tile = document.createElement("button");
    tile.className = "tile";
    const diff = i===oddIndex ? 12 : 0;
    const hue = 210;
    tile.style.background = `hsl(${hue} 90% ${85 - diff}%)`;
    tile.onclick = ()=>{
      if (i===oddIndex){
        const rps = currentRps(loadState());
        const reward = Math.max(1, Math.floor(rps * 10));
        const st = loadState();
        st.coins += reward;
        saveState(st); updateUI(st);
        alert(`Nice! +${reward} coins`);
        dlg.close();
      } else {
        alert("Not quite—try again!");
      }
    };
    grid.appendChild(tile);
  }
  dlg.showModal();
}

// Match-3 Lite (60s) — same as v3
const M3_EMOJIS = ["🔵","🟢","🟡","🟣","🟠"];
function gameM3(){
  const dlg = document.getElementById("m3Dialog");
  const gridEl = document.getElementById("m3Grid");
  const scoreEl = document.getElementById("m3Score");
  const timerEl = document.getElementById("m3Timer");
  let grid = Array.from({length:5}, ()=> Array.from({length:5}, ()=> M3_EMOJIS[Math.floor(Math.random()*M3_EMOJIS.length)]));
  let selected = null;
  let score = 0;
  let running = true;

  function render(){
    gridEl.innerHTML = "";
    for (let r=0;r<5;r++){
      for (let c=0;c<5;c++){
        const cell = document.createElement("button");
        cell.className = "m3-cell";
        if (selected && selected.r===r && selected.c===c) cell.classList.add("m3-selected");
        cell.textContent = grid[r][c];
        cell.onclick = ()=>{
          if (!selected){ selected = {r,c}; render(); return; }
          const dr = Math.abs(selected.r - r), dc = Math.abs(selected.c - c);
          if (dr+dc===1){
            swap(selected.r, selected.c, r, c);
            if (!resolveMatches()){
              swap(selected.r, selected.c, r, c);
            }
            selected = null; render();
          } else { selected = {r,c}; render(); }
        };
        gridEl.appendChild(cell);
      }
    }
    scoreEl.textContent = String(score);
  }
  function swap(r1,c1,r2,c2){ const t = grid[r1][c1]; grid[r1][c1] = grid[r2][c2]; grid[r2][c2] = t; }
  function resolveMatches(){
    let matched = false;
    const mark = Array.from({length:5}, ()=> Array(5).fill(false));
    for (let r=0;r<5;r++){
      let run=1;
      for (let c=1;c<=5;c++){
        if (c<5 && grid[r][c]===grid[r][c-1]){ run++; }
        else {
          if (run>=3){ matched = true; for (let k=0;k<run;k++){ mark[r][c-1-k]=true; } score += run; }
          run=1;
        }
      }
    }
    for (let c=0;c<5;c++){
      let run=1;
      for (let r=1;r<=5;r++){
        if (r<5 && grid[r][c]===grid[r-1][c]){ run++; }
        else {
          if (run>=3){ matched = true; for (let k=0;k<run;k++){ mark[r-1-k][c]=true; } score += run; }
          run=1;
        }
      }
    }
    if (!matched) return false;
    for (let r=4;r>=0;r--){
      for (let c=0;c<5;c++){
        if (mark[r][c]){
          for (let k=r;k>0;k--){ grid[k][c] = grid[k-1][c]; }
          grid[0][c] = M3_EMOJIS[Math.floor(Math.random()*M3_EMOJIS.length)];
        }
      }
    }
    setTimeout(()=>{ resolveMatches(); render(); }, 150);
    return true;
  }

  render();
  dlg.showModal();
  let tLeft = 60;
  timerEl.textContent = String(tLeft);
  const tInt = setInterval(()=>{
    if (!running) return;
    tLeft--; timerEl.textContent = String(tLeft);
    if (tLeft<=0){
      clearInterval(tInt);
      running = false;
      const rps = currentRps(loadState());
      const reward = Math.max(1, Math.floor(rps * Math.max(5, score)));
      const st = loadState();
      st.coins += reward;
      saveState(st); updateUI(st);
      alert(`Time! Score: ${score}\nReward: +${reward} coins`);
      dlg.close();
    }
  }, 1000);

  document.getElementById("closeM3").onclick = ()=>{ running=false; clearInterval(tInt); dlg.close(); };
}

// Sudoku 9×9 (100× RPS)
const SDK_PUZZLES = [
  {p:"53..7....6..195....98....6.8...6...34..8.3..17...2...6....28....419..5....8..79", s:"534678912672195348198342567859761423342589671761423895973254186415936287286817934"},
  {p:"..9748...7...........2.1.9..1..7.....3...2.....6..8..2.6.9...........5...3.142..", s:"129748356748356219563291487912873564835462971476915823251689743394127658687534192"},
  {p:"1....7.9.3..2.....9..3..2..8..5...6..4..1..8..6...4..2..8..5..9.....3..6.2.1....", s:"186537492342296851957318246891524367274163985563879412418752639729681534635941728"},
  {p:"..3.2.6..9..3.5..1..18.64..7..9..2..5.1.8.3..2..6..4..53.18..1..2.5..6..9.4.3..", s:"483921657967345821251876493734592186519168342826437519345781269172659834698214375"},
  {p:".2.6.8..5..1...2..8..2.7..9..7...5..4.....7..5...1..3..1.6.4..6..3...7..7..2.1.", s:"123678495751439286846251739917362548432895671568714923291586347684123957375947162"}
];

function gameSdk(){
  const dlg = document.getElementById("sdkDialog");
  let current = SDK_PUZZLES[Math.floor(Math.random()*SDK_PUZZLES.length)];
  let sel = {r:0,c:0};
  const gridEl = document.getElementById("sdkGrid");

  function renderPuzzle(pstr){
    gridEl.innerHTML = "";
    for (let r=0;r<9;r++){
      for (let c=0;c<9;c++){
        const idx = r*9+c;
        const ch = pstr[idx];
        const cell = document.createElement("div");
        cell.className = "sdk-cell";
        if (r%3===2 && c===8) cell.classList.add("sdk-rowSep");
        if (c%3===2) cell.classList.add("sdk-colSep");
        const span = document.createElement("span");
        if (ch==='.' || ch==='0'){ span.textContent = ""; }
        else { span.textContent = ch; cell.classList.add("given"); }
        cell.appendChild(span);
        cell.onclick = ()=>{
          if (cell.classList.contains("given")) return;
          Array.from(gridEl.children).forEach(n=>n.classList.remove("sel"));
          cell.classList.add("sel");
          sel = {r,c};
        };
        gridEl.appendChild(cell);
      }
    }
  }

  function setNumber(n){
    const idx = sel.r*9+sel.c;
    const cell = gridEl.children[idx];
    if (!cell || cell.classList.contains("given")) return;
    cell.firstChild.textContent = String(n);
  }

  function gridToString(){
    let s = "";
    for (let i=0;i<81;i++){
      const cell = gridEl.children[i];
      const v = cell.firstChild.textContent;
      s += v==="" ? "." : v;
    }
    return s;
  }

  function isSolved(){ return gridToString() === current.s; }

  function checkConflicts(){
    const vals = [];
    for (let i=0;i<81;i++){
      const cell = gridEl.children[i];
      const v = cell.firstChild.textContent;
      vals.push(v===""?".":v);
      cell.classList.remove("sdk-bad");
    }
    function markBad(indices){ indices.forEach(i=> gridEl.children[i].classList.add("sdk-bad")); }
    for (let r=0;r<9;r++){
      const seen = {}; for (let c=0;c<9;c++){ const i=r*9+c; const v=vals[i]; if (v!=="."){ if (seen[v]!=null){ markBad([i, seen[v]]);} else seen[v]=i; } }
    }
    for (let c=0;c<9;c++){
      const seen = {}; for (let r=0;r<9;r++){ const i=r*9+c; const v=vals[i]; if (v!=="."){ if (seen[v]!=null){ markBad([i, seen[v]]);} else seen[v]=i; } }
    }
    for (let br=0;br<3;br++){
      for (let bc=0;bc<3;bc++){
        const seen = {};
        for (let r=0;r<3;r++){
          for (let c=0;c<3;c++){
            const rr=br*3+r, cc=bc*3+c;
            const i=rr*9+cc; const v=vals[i];
            if (v!=="."){ if (seen[v]!=null){ markBad([i, seen[v]]);} else seen[v]=i; }
          }
        }
      }
    }
  }

  document.querySelectorAll(".sdk-keypad button").forEach(b=>{
    b.onclick = ()=>{ setNumber(b.dataset.n); checkConflicts(); };
  });
  document.getElementById("sdkCheck").onclick = ()=>{
    if (isSolved()){
      const rps = currentRps(loadState());
      const reward = Math.max(1, Math.floor(rps * 100));
      const st = loadState();
      st.coins += reward;
      saveState(st); updateUI(st);
      alert(`Solved! +${reward} coins`);
      dlg.close();
    } else {
      alert("Not solved yet — check for conflicts (red).");
      checkConflicts();
    }
  };
  document.getElementById("sdkNew").onclick = ()=>{
    current = SDK_PUZZLES[Math.floor(Math.random()*SDK_PUZZLES.length)];
    renderPuzzle(current.p);
  };
  document.getElementById("sdkClose").onclick = ()=> dlg.close();

  renderPuzzle(current.p);
  dlg.showModal();
}

function registerSW(){
  if ('serviceWorker' in navigator){
    navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  }
}

function haptic(){ if (navigator.vibrate) navigator.vibrate(20); }

(function init(){
  const s = loadState();
  accrue(s); s.lastTs = Date.now(); saveState(s);
  document.getElementById("addChoreBtn").onclick = addChore;
  document.getElementById("openGames").onclick = openGames;
  document.getElementById("gameOdd").onclick = gameOdd;
  document.getElementById("gameM3").onclick = gameM3;
  document.getElementById("gameSdk").onclick = gameSdk;

  setInterval(()=>{
    const st = loadState();
    accrue(st); st.lastTs = Date.now(); saveState(st); updateUI(st);
  }, 1000);

  document.addEventListener("visibilitychange", ()=>{
    const st = loadState();
    accrue(st); st.lastTs = Date.now(); saveState(st); updateUI(st);
  });

  updateUI(s);
  registerSW();
})();