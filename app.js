// Baby Steps — Home Upgrade
const BASE_RATE = 1; // coins per second
const BOOST_MULTIPLIER = 10;
const BOOST_DURATION_MS = 30 * 60 * 1000; // 30 minutes

const DEFAULT_STATE = {
  coins: 0,
  lastTs: Date.now(),
  boostUntil: 0,
  chores: ["Fold laundry", "Empty dishwasher", "Water plants"],
  puzzleLastClaimDate: null, // "YYYY-MM-DD" string
  upgrades: { tree: 0, bench: 0, pond: 0 } // levels 0..3
};

function loadState(){
  try {
    const raw = localStorage.getItem("bs-upgrade-state");
    if (!raw) return { ...DEFAULT_STATE };
    const obj = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...obj,
      upgrades: { ...DEFAULT_STATE.upgrades, ...(obj.upgrades||{}) },
      chores: Array.isArray(obj.chores) ? obj.chores : DEFAULT_STATE.chores.slice()
    };
  } catch(e){
    return { ...DEFAULT_STATE };
  }
}
function saveState(s){
  localStorage.setItem("bs-upgrade-state", JSON.stringify(s));
}

function todayStr(d=new Date()){
  return d.toISOString().slice(0,10);
}

function currentMultiplier(s){
  return (Date.now() < s.boostUntil) ? BOOST_MULTIPLIER : 1;
}

function accrue(s){
  const now = Date.now();
  const dt = Math.max(0, Math.floor((now - s.lastTs)/1000)); // seconds
  if (dt > 0){
    const mult = currentMultiplier(s);
    s.coins += dt * BASE_RATE * mult;
    s.lastTs = s.lastTs + dt*1000;
  }
}

function fmt(n){
  return Math.floor(n).toLocaleString();
}

function updateUI(s){
  document.getElementById("coins").textContent = fmt(s.coins);
  document.getElementById("rate").textContent = (BASE_RATE * currentMultiplier(s)).toString();
  const boostEl = document.getElementById("boost");
  boostEl.textContent = "x" + currentMultiplier(s);
  const left = s.boostUntil - Date.now();
  const bt = document.getElementById("boostTimer");
  if (left > 0){
    const m = Math.floor(left/60000), sec = Math.floor((left%60000)/1000);
    bt.textContent = ` · ${m}:${sec.toString().padStart(2,"0")}`;
  } else {
    bt.textContent = "";
  }
  // garden visuals
  renderGarden(s);
  // chores
  renderChores(s);
  // install tip
  const tip = document.getElementById("installTip");
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  tip.style.display = standalone ? "none" : "block";
}

function renderGarden(s){
  const stagesTree = ["🌱","🌿","🌳","🌸"];
  const stagesBench = ["🪵","🪑","🪑✨","🪑🌼"];
  const stagesPond = ["💧","🌊","🐟","🦆"];
  document.getElementById("plot-tree").textContent = stagesTree[Math.min(3, s.upgrades.tree||0)];
  document.getElementById("plot-bench").textContent = stagesBench[Math.min(3, s.upgrades.bench||0)];
  document.getElementById("plot-pond").textContent = stagesPond[Math.min(3, s.upgrades.pond||0)];
  // button labels & availability
  const costs = costsFor(s);
  document.getElementById("upgradeTree").textContent = `Upgrade Tree (cost ${costs.tree})`;
  document.getElementById("upgradeBench").textContent = `Upgrade Bench (cost ${costs.bench})`;
  document.getElementById("upgradePond").textContent = `Upgrade Pond (cost ${costs.pond})`;
  ["tree","bench","pond"].forEach(k=>{
    const btn = document.getElementById("upgrade"+k[0].toUpperCase()+k.slice(1));
    btn.disabled = s.upgrades[k] >= 3 || s.coins < costs[k];
  });
}

function costsFor(s){
  // simple escalating costs per level (0->1: base, 1->2: *2, 2->3: *3)
  const base = { tree: 50, bench: 80, pond: 100 };
  const mult = {0:1, 1:2, 2:3, 3:Infinity};
  return {
    tree: Math.floor(base.tree * (mult[s.upgrades.tree]||1)),
    bench: Math.floor(base.bench * (mult[s.upgrades.bench]||1)),
    pond: Math.floor(base.pond * (mult[s.upgrades.pond]||1)),
  };
}

function upgrade(s, key){
  const costs = costsFor(s);
  if (s.upgrades[key] >= 3) return;
  const cost = costs[key];
  if (s.coins >= cost){
    s.coins -= cost;
    s.upgrades[key] += 1;
    saveState(s);
    updateUI(s);
    haptic();
  }
}

function haptic(){ if (navigator.vibrate) navigator.vibrate(30); }

function renderChores(s){
  const list = document.getElementById("choreList");
  list.innerHTML = "";
  s.chores.forEach((name, idx)=>{
    const row = document.createElement("div");
    row.className = "row";
    row.style.justifyContent = "space-between";
    const label = document.createElement("div");
    label.textContent = name;
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
    done.textContent = "Complete (+x10 for 30m)";
    done.style.padding="8px 10px";
    done.onclick = ()=>{
      const st = loadState();
      const now = Date.now();
      st.boostUntil = Math.max(now, st.boostUntil) + BOOST_DURATION_MS; // refresh/extend
      saveState(st); updateUI(st); haptic();
    };
    grp.appendChild(del); grp.appendChild(done);
    row.appendChild(label); row.appendChild(grp);
    list.appendChild(row);
  });
}

function addChore(){
  const dlg = document.getElementById("choreDialog");
  dlg.showModal();
  document.getElementById("saveChore").onclick = ()=>{
    const txt = (document.getElementById("choreInput").value||"").trim();
    if (txt){
      const s = loadState();
      s.chores.push(txt);
      saveState(s);
      updateUI(s);
    }
    dlg.close();
    document.getElementById("choreInput").value="";
  };
  document.getElementById("cancelChore").onclick = ()=>dlg.close();
}

function openPuzzle(){
  // Allow +10 once per calendar day
  const s = loadState();
  const today = todayStr();
  const already = s.puzzleLastClaimDate === today;
  const dlg = document.getElementById("puzzleDialog");
  const grid = document.getElementById("puzzleGrid");
  grid.innerHTML = "";
  // Build 8 tiles + 1 odd tile
  const oddIndex = Math.floor(Math.random()*9);
  for(let i=0;i<9;i++){
    const tile = document.createElement("button");
    tile.className = "tile";
    const diff = i===oddIndex ? 12 : 0;
    const hue = 210;
    tile.style.background = `hsl(${hue} 90% ${85 - diff}%)`;
    tile.onclick = ()=>{
      if (i===oddIndex){
        if (!already){
          const st = loadState();
          st.coins += 10;
          st.puzzleLastClaimDate = today;
          saveState(st);
          updateUI(st);
          alert("Nice! +10 coins");
        } else {
          alert("Puzzle bonus already claimed today—come back tomorrow.");
        }
        dlg.close();
      } else {
        alert("Not quite—try again!");
      }
    };
    grid.appendChild(tile);
  }
  dlg.showModal();
  document.getElementById("closePuzzle").onclick = ()=>dlg.close();
}

function registerSW(){
  if ('serviceWorker' in navigator){
    navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  }
}

(function init(){
  const s = loadState();
  // Accrue on load
  accrue(s);
  s.lastTs = Date.now();
  saveState(s);
  // UI hooks
  document.getElementById("upgradeTree").onclick = ()=>{ const st=loadState(); upgrade(st,'tree'); };
  document.getElementById("upgradeBench").onclick = ()=>{ const st=loadState(); upgrade(st,'bench'); };
  document.getElementById("upgradePond").onclick = ()=>{ const st=loadState(); upgrade(st,'pond'); };
  document.getElementById("addChoreBtn").onclick = addChore;
  document.getElementById("openPuzzle").onclick = openPuzzle;

  // Idle ticker (visual + accrual)
  setInterval(()=>{
    const st = loadState();
    accrue(st);
    st.lastTs = Date.now();
    saveState(st);
    updateUI(st);
  }, 1000);

  // Visibility accrual catch-up
  document.addEventListener("visibilitychange", ()=>{
    const st = loadState();
    accrue(st);
    st.lastTs = Date.now();
    saveState(st);
    updateUI(st);
  });

  // First paint
  updateUI(s);
  registerSW();
})();