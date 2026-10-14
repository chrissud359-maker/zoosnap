/* =====================================================================
   ZOOSNAP TYCOON - SCREENS, CAMERA, AUDIO
   Game rules live in sim.js, settings in config.js, text in text.js.
   ===================================================================== */
(function () {
  "use strict";
  const CFG = window.ZOO_CONFIG, TXT = window.ZOO_TEXT, Sim = window.ZooSim;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const SPEED = Math.max(0.1, Math.min(60, parseFloat(params.get("speed")) || 1)); // for testing only
  const SEED = params.has("seed") ? parseInt(params.get("seed"), 10) : null;
  const SPECIES = CFG.SPECIES;
  const byId = {};
  SPECIES.forEach((s) => (byId[s.id] = s));
  const norm = (s) => String(s == null ? "" : s).trim().toLowerCase();
  const classToId = {};
  SPECIES.forEach((s) => (classToId[norm(s.className)] = s.id));
  const RULES = Sim.RULES;

  const fill = (str, vars) => {
    str = String(str);
    // "a {animal}" becomes "an Elephant" when the animal starts with a vowel
    if (vars && vars.animal) str = str.replace(/\b([aA]) \{animal\}/g, (m, a) => (/^[aeiou]/i.test(vars.animal) ? a + "n" : a) + " {animal}");
    return str.replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] != null ? vars[k] : m));
  };
  const aAn = (w) => (/^[aeiou]/i.test(w) ? "an " : "a ") + w;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const money = (n) => (n < 0 ? "−$" : "$") + fmt(Math.abs(n));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked: fine */ } },
  };

  /* ================= media with graceful fallbacks ================= */
  const IMG_EXT = ["png", "jpg", "jpeg", "webp"];
  const imgCache = {}, imgReady = {};
  let imgVersion = 0;
  function resolveImage(base) {
    if (!imgCache[base]) {
      imgCache[base] = new Promise((res) => {
        let i = 0;
        const im = new Image();
        im.onload = () => res(im.src);
        im.onerror = () => { i++; if (i < IMG_EXT.length) im.src = base + "." + IMG_EXT[i]; else res(null); };
        im.src = base + "." + IMG_EXT[0];
      }).then((url) => { imgReady[base] = url; imgVersion++; return url; });
    }
    return imgCache[base];
  }
  // put an image in <img> if it exists, otherwise leave the emoji fallback showing
  function setImg(img, base, fallbackEl) {
    img.classList.add("hidden");
    if (fallbackEl) fallbackEl.classList.remove("hidden");
    img.dataset.base = base;
    resolveImage(base).then((url) => {
      if (img.dataset.base !== base) return;
      if (url) { img.src = url; img.classList.remove("hidden"); if (fallbackEl) fallbackEl.classList.add("hidden"); }
    });
  }

  const AUD_EXT = ["mp3", "wav", "ogg", "m4a"];
  const sounds = {};
  let soundOn = store.get("zoo_sound") !== "0";
  let musicOn = store.get("zoo_music") !== "0";
  let voicePlaying = null;
  function getSound(base, el) {
    if (sounds[base]) return sounds[base];
    const a = el || new Audio();
    const rec = { a, ok: null };
    let i = 0;
    a.preload = "auto";
    a.addEventListener("error", () => {
      i++;
      if (i < AUD_EXT.length) { a.src = base + "." + AUD_EXT[i]; a.load(); } else rec.ok = false;
    });
    a.addEventListener("canplay", () => (rec.ok = true));
    a.src = base + "." + AUD_EXT[0];
    sounds[base] = rec;
    return rec;
  }
  function music() { return getSound("assets/music", $("music")); }
  function play(base, opts) {
    opts = opts || {};
    if (!soundOn) return;
    const r = getSound(base);
    if (r.ok === false) return;
    const a = r.a;
    try { a.currentTime = 0; } catch (e) { /* not loaded yet */ }
    a.volume = opts.volume != null ? opts.volume : 0.8;
    if (opts.voice) {
      if (voicePlaying && voicePlaying !== a) voicePlaying.pause();
      voicePlaying = a;
      duck(true);
      a.onended = () => { if (voicePlaying === a) { voicePlaying = null; duck(false); } };
    }
    const p = a.play();
    if (p && p.catch) p.catch(() => { if (opts.voice) duck(false); });
  }
  function duck(on) { music().a.volume = on ? 0.12 : 0.35; }
  function updateMusic() {
    const m = music();
    if (soundOn && musicOn && currentScreen !== "title") {
      m.a.volume = voicePlaying ? 0.12 : 0.35;
      const p = m.a.play();
      if (p && p.catch) p.catch(() => {});
    } else m.a.pause();
  }
  function setSound(on) {
    soundOn = on;
    store.set("zoo_sound", on ? "1" : "0");
    Object.values(sounds).forEach((r) => (r.a.muted = !on));
    if (!on && voicePlaying) { voicePlaying.pause(); voicePlaying = null; }
    $("soundBtn").textContent = on ? "🔊" : "🔇";
    $("soundBtn").classList.toggle("off", !on);
    updateMusic();
  }
  function setMusic(on) {
    musicOn = on;
    store.set("zoo_music", on ? "1" : "0");
    $("musicBtn").classList.toggle("off", !on);
    updateMusic();
  }
  function preloadMedia() {
    ["assets/title"].concat(SPECIES.map((s) => "assets/animals/" + s.id)).forEach(resolveImage);
  }
  function preloadSounds() {
    ["sfx_adopt", "sfx_success", "sfx_fail", "sfx_alert", "sfx_coin", "sfx_day", "voice_intro"].forEach((n) => getSound("assets/" + n));
    SPECIES.forEach((s) => getSound("assets/animals/" + s.id));
    music();
  }

  /* ================= model + camera ================= */
  let model = null, modelLabels = [], webcam = null, camOK = null, manualMode = false;

  async function loadModel() {
    if (typeof tf === "undefined" || typeof tmImage === "undefined") throw new Error("The AI libraries in lib/ didn't load.");
    if (window.ZOO_MODEL_PACK) return { m: await ZooModelPack.loadPack(window.ZOO_MODEL_PACK), src: "model/model-pack.js" };
    if (CFG.MODEL_URL) {
      let u = CFG.MODEL_URL.trim();
      if (!u.endsWith("/")) u += "/";
      return { m: await tmImage.load(u + "model.json", u + "metadata.json"), src: "your Teachable Machine link" };
    }
    if (location.protocol === "file:") throw new Error("No model-pack.js found. Make one with pack-model.html (see README).");
    return { m: await tmImage.load("model/model.json", "model/metadata.json"), src: "the model/ folder" };
  }
  function modelReady(m, src) {
    model = m;
    modelLabels = m.getClassLabels();
    const chip = $("modelStatus");
    chip.className = "chip ok";
    chip.textContent = "🧠 Model ready (" + modelLabels.length + " classes, from " + src + ")";
    $("modelLoadBox").classList.add("hidden");
    const unknown = modelLabels.filter((l) => !classToId[norm(l)] && norm(l) !== norm(CFG.NOTHING_CLASS));
    const missing = SPECIES.filter((s) => !modelLabels.some((l) => norm(l) === norm(s.className)));
    const msgs = [];
    if (missing.length) msgs.push("These animals have no matching class in your model, so they can't be adopted by camera: " + missing.map((s) => s.name).join(", ") + ". Check className in config.js.");
    if (unknown.length) msgs.push("These model classes aren't in config.js and will count as \"nothing\": " + unknown.join(", ") + ".");
    $("modelWarn").textContent = msgs.join(" ");
    $("modelWarn").classList.toggle("hidden", !msgs.length);
    refreshStartButtons();
  }
  function modelFailed(err) {
    console.warn("Model not loaded:", err);
    model = null;
    const chip = $("modelStatus");
    chip.className = "chip bad";
    chip.textContent = "🧠 No model loaded: " + ((err && err.message) || err);
    $("modelLoadBox").classList.toggle("hidden", typeof tmImage === "undefined");
    refreshStartButtons();
  }
  function refreshStartButtons() {
    $("startBtn").disabled = !model;
    $("manualBtn").classList.toggle("hidden", !!model && camOK !== false);
  }

  async function setupWebcam() {
    const cam = new tmImage.Webcam(280, 280, true);
    await cam.setup({ facingMode: "user" });
    cam.webcam.muted = true;
    cam.webcam.setAttribute("playsinline", "");
    await cam.play();
    webcam = cam;
  }

  /* ================= screens ================= */
  let currentScreen = "title";
  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    $(id + "Screen").classList.add("active");
    currentScreen = id;
    updateMusic();
    window.scrollTo(0, 0);
  }

  let zooName = store.get("zoo_name") || pick(TXT.zooNames);
  function initTitle() {
    document.title = TXT.title;
    $("tagline").textContent = TXT.tagline;
    const em = SPECIES.map((s) => s.emoji);
    document.querySelector(".titleArtFallback").innerHTML = esc(em.slice(0, 3).join("")) + "<br>" + esc(em.slice(3).join(""));
    $("zooName").value = zooName;
    $("goalText").textContent = fmt(RULES.goalVisitors);
    $("daysText").textContent = RULES.totalDays;
    $("shuffleName").onclick = () => {
      let n = pick(TXT.zooNames);
      if (n === $("zooName").value && TXT.zooNames.length > 1) n = pick(TXT.zooNames.filter((x) => x !== n));
      $("zooName").value = n;
    };
    resolveImage("assets/title").then((url) => {
      if (url) { $("titleArt").src = url; $("titleArtWrap").classList.add("hasImg"); }
    });
    showBest();
  }
  function showBest() {
    let best = null;
    try { best = JSON.parse(store.get("zoo_best") || "null"); } catch (e) { best = null; }
    $("bestScore").textContent = best && best.score ? "🏅 Best score on this computer: " + fmt(best.score) + " (" + best.zoo + ")" : "";
    return best;
  }

  async function startGame(manual) {
    zooName = ($("zooName").value.trim() || pick(TXT.zooNames)).slice(0, 24);
    $("zooName").value = zooName;
    store.set("zoo_name", zooName);
    preloadSounds();
    if (!manual && model && !webcam) {
      $("startBtn").disabled = true;
      const chip = $("camStatus");
      chip.className = "chip wait";
      chip.textContent = "📷 Allow camera access in your browser…";
      try {
        await setupWebcam();
        camOK = true;
        chip.className = "chip ok";
        chip.textContent = "📷 Camera ready";
      } catch (e) {
        camOK = false;
        webcam = null;
        chip.className = "chip bad";
        chip.textContent = "📷 Camera unavailable: " + ((e && e.message) || e) + " Allow camera access and try again, or play without a camera.";
        refreshStartButtons();
        return;
      } finally {
        $("startBtn").disabled = !model;
      }
    }
    manualMode = !!manual || !model || !webcam;
    newGame();
  }

  /* ================= game state on screen ================= */
  let sim = null, uiPaused = false, adoptOpen = false, adoptCardId = null, adoptConf = null, adoptPen = null;
  let lastFrame = 0, coinAcc = 0, coinTimer = 0, idleTimer = 0;
  let jamWarnDay = 0;
  let warnedUpkeepDay = 0, emptyNagDay = 0, selectedPen = -1, panelSig = "";
  let zoo = null; // the 3D zoo view (zoo3d.js)

  function ensureZoo() {
    if (zoo) return;
    zoo = Zoo3D.create($("zoo"), {
      species: SPECIES,
      flat: params.get("flat") === "1",
      fixedQuality: params.get("hq") === "1", // testing only
      getImage: (id) => imgReady["assets/animals/" + id] || null,
      onPenClick: (i) => openPen(i),
      onHover: (kind, data, x, y) => zooHover(kind, data, x, y),
      onGateClick: () => {
        const b = document.querySelector('[data-buy="gate"]');
        b.classList.remove("pulse"); void b.offsetWidth; b.classList.add("pulse");
        b.scrollIntoView({ block: "nearest", behavior: "smooth" });
      },
    });
    if (zoo.mode() === "flat") $("viewHint").textContent = "Click an enclosure to manage it";
  }
  function zooInfo() {
    const st = sim.state, m = sim.metrics();
    return {
      zooName,
      buildCost: sim.nextCost("expand"),
      escapingUid: st.event && st.event.kind === "escape" ? st.event.animalUid : null,
      visitorTarget: Math.min(40, Math.round(st.inside * 0.3)),
      queue: st.event || m.turnedAway < 0.05 ? 0 : Math.min(14, Math.ceil(m.turnedAway * 1.2)),
      gateLevel: st.upgrades.gate,
      gateCap: m.capacity,
      inside: Math.round(st.inside),
      pens: st.pens.map((p, i) => ({
        built: p.built, speciesId: p.speciesId, cap: p.cap, qol: p.qol,
        animals: sim.penAnimals(i).map((a) => ({ uid: a.uid, speciesId: a.speciesId, happiness: a.happiness, hidden: a.hiddenDays > 0 })),
      })),
    };
  }

  function newGame() {
    sim = Sim.create({ species: SPECIES, zooName, seed: SEED });
    uiPaused = false; adoptOpen = false; adoptCardId = null; adoptPen = null;
    coinAcc = 0; coinTimer = 0; idleTimer = 0; warnedUpkeepDay = 0; emptyNagDay = 0; jamWarnDay = 0;
    closePen();
    hideTip();
    closeScanner();
    ["adoptCard", "choiceCard", "pauseOverlay"].forEach((id) => $(id).classList.add("hidden"));
    $("toasts").innerHTML = "";
    $("log").innerHTML = "";
    $("hudZoo").textContent = zooName;
    $("hudDays").textContent = RULES.totalDays;
    $("hudGoal").textContent = fmt(RULES.goalVisitors);
    $("coins").innerHTML = "";
    show("game");
    ensureZoo();
    zoo.clearVisitors();
    zoo.resetView();
    const intro = fill(TXT.intro, { zoo: zooName, goal: fmt(RULES.goalVisitors), days: RULES.totalDays });
    addLog(fill(pick(TXT.dayStart), { day: 1, zoo: zooName }));
    addLog(intro);
    toast(intro, "", 6500);
    play("assets/voice_intro", { voice: true, volume: 1 });
    render(true);
    lastFrame = performance.now();
  }

  function frame(now) {
    const realDt = Math.min(0.25, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (currentScreen === "game" && sim && !sim.state.over) {
      sim.state.paused = uiPaused || adoptOpen;
      const before = sim.state.visitorsTotal;
      const per = sim.metrics().perVisitor;
      const outs = sim.step(realDt * (sim.state.event ? 1 : SPEED)); // test speed-up never shortens event timers
      if (!sim.state.paused && !sim.state.event) {
        coinAcc += Math.max(0, sim.state.visitorsTotal - before) * per;
        coinTimer += realDt; idleTimer += realDt * SPEED;
        if (coinTimer >= 1) { if (coinAcc >= 1) coin("+$" + fmt(coinAcc)); coinAcc = 0; coinTimer = 0; }
        if (idleTimer >= 11) {
          idleTimer = 0;
          if (sim.state.animals.length) addLog(pick(TXT.idle));
          else if (emptyNagDay !== sim.state.day) { emptyNagDay = sim.state.day; toast(TXT.needAnimals, "", 4500); }
        }
      }
      outs.forEach(handleOut);
      if (currentScreen === "game") render(false);
    }
    if (currentScreen === "game" && sim && zoo) zoo.frame(realDt, zooInfo(), uiPaused);
    scanFrame(now);
    requestAnimationFrame(frame);
  }

  function handleOut(o) {
    const st = sim.state;
    if (o.type === "event") {
      play("assets/sfx_alert");
      if (o.event.kind === "choice") showChoice(o.event);
      else openScanner(o.event.kind, o.event);
    } else if (o.type === "eventResolved") {
      closeScanner();
      const t = TXT.events[o.kind];
      const msg = fill(t.fail, { animal: byId[o.speciesId].name, zoo: zooName });
      toast(msg, "bad", 5000);
      addLog(msg, "bad");
      play("assets/sfx_fail");
    } else if (o.type === "dayEnd") {
      const msg = "🌙 Day " + o.day + " closed: " + fmt(o.visitors) + " visitors, earned " + money(o.earned) + ", upkeep −$" + fmt(o.upkeep) + "." +
        (o.turnedAway > 0 ? " " + fmt(o.turnedAway) + " turned away at the entrance." : "");
      addLog(msg);
      toast(msg, "", 3500);
      play("assets/sfx_day", { volume: 0.6 });
      if (o.debt && !st.over) {
        const d = fill(TXT.debtWarning, { zoo: zooName });
        toast(d, "bad", 6000);
        addLog(d, "bad");
      }
      if (o.newDay) addLog(fill(pick(TXT.dayStart), { day: o.newDay, zoo: zooName }));
    } else if (o.type === "gameOver") {
      setTimeout(() => showEnd(o.ending), 400);
    }
  }

  /* ---------------- rendering ---------------- */
  function render(force) {
    const st = sim.state, m = sim.metrics();
    $("hudDay").textContent = st.day;
    $("dayBar").style.width = Math.min(100, (st.dayTime / RULES.dayLength) * 100) + "%";
    $("hudMoney").textContent = (st.money < 0 ? "−" : "") + fmt(Math.abs(st.money));
    $("hudUpkeep").textContent = fmt(m.upkeep);
    $("moneyStat").classList.toggle("danger", st.money < m.upkeep);
    $("hudVisitors").textContent = fmt(Math.floor(st.visitorsTotal));
    $("goalBar").style.width = Math.min(100, (st.visitorsTotal / RULES.goalVisitors) * 100) + "%";
    const full = Math.round(m.stars);
    $("hudStars").textContent = "★".repeat(full) + "☆".repeat(5 - full);
    $("hudVps").textContent = m.vps.toFixed(1);
    const jam = m.turnedAway > 0.05 && !st.event;
    $("hudGate").textContent = jam ? "🚧 Full! turning away " + m.turnedAway.toFixed(1) + "/sec" : "🎟️ " + Math.round(m.inside) + " / " + m.capacity + " inside";
    $("hudGate").classList.toggle("jam", jam);
    if (jam && m.turnedAway > 0.5 && jamWarnDay !== st.day) {
      jamWarnDay = st.day;
      const msg = "🚧 The zoo is full (" + m.capacity + " visitors)! New arrivals are being turned away at the gate." + (sim.nextCost("gate") != null ? " Buy a Bigger entrance to raise capacity." : "");
      toast(msg, "bad", 5000);
      addLog(msg, "bad");
    }

    if (st.money < m.upkeep && st.animals.length && st.dayTime > RULES.dayLength * 0.6 && warnedUpkeepDay !== st.day && !st.event) {
      warnedUpkeepDay = st.day;
      toast(TXT.upkeepWarning + " (need $" + fmt(m.upkeep) + ")", "bad", 4000);
    }

    // shop
    const busy = !!st.event;
    const shopInfo = {
      expand: sim.builtCount() + "/" + RULES.maxPens + " enclosures",
      snack: "Level " + st.upgrades.snack + "/" + RULES.snackCost.length + " · +$1 per visitor",
      ads: "Level " + st.upgrades.ads + "/" + RULES.adsCost.length + " · +20% visitors",
      gate: "Holds " + m.capacity + " visitors at once",
    };
    document.querySelectorAll("[data-buy]").forEach((b) => {
      const k = b.dataset.buy, cost = sim.nextCost(k);
      b.disabled = busy || cost == null || st.money < cost;
      $(k + "Cost").textContent = cost == null ? (k === "treat" ? "—" : "MAX") : "$" + fmt(cost);
      if (shopInfo[k]) $(k + "Info").textContent = shopInfo[k];
    });
    $("adoptBtn").disabled = busy;

    refreshPen();
    refreshTip();
  }

  function coin(text) {
    const c = document.createElement("div");
    c.className = "coin";
    c.textContent = text;
    $("coins").appendChild(c);
    setTimeout(() => c.remove(), 1500);
  }
  function addLog(msg, cls) {
    const li = document.createElement("li");
    li.textContent = msg;
    if (cls) li.className = cls;
    const log = $("log");
    log.insertBefore(li, log.firstChild);
    while (log.children.length > 6) log.removeChild(log.lastChild);
  }
  function toast(msg, cls, ms) {
    const box = $("toasts");
    const t = document.createElement("div");
    t.className = "toast" + (cls ? " " + cls : "");
    t.textContent = msg;
    box.appendChild(t);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 320); }, ms || 3500);
  }

  /* ---------------- shop & habitats ---------------- */
  function buy(key) {
    if (!sim || sim.state.over || sim.state.event) return;
    const r = sim.buy(key);
    if (r.ok) {
      play("assets/sfx_coin", { volume: 0.6 });
      const names = { gate: "🎟️ Entrance upgraded: the zoo now holds " + RULES.gateCap[sim.state.upgrades.gate] + " visitors at once!", expand: "🏗️ A new enclosure is ready!", snack: "🍿 Snack stand upgraded!", ads: "📣 Ad campaign launched!", treat: "🍉 Treat time! Every animal is happier." };
      addLog(names[key] + " (−$" + fmt(r.cost) + ")", "good");
      render(true);
    }
  }
  document.querySelectorAll("[data-buy]").forEach((b) => (b.onclick = () => buy(b.dataset.buy)));

  /* ---------------- enclosure panel ---------------- */
  function penName(i) {
    const p = sim.state.pens[i];
    if (!p.built) return "Site " + (i + 1);
    return p.speciesId ? byId[p.speciesId].name + " enclosure" : "Empty enclosure";
  }
  function openPen(i) {
    if (!sim || sim.state.over) return;
    selectedPen = i;
    panelSig = "";
    $("penPanel").classList.remove("hidden");
    if (zoo) {
      zoo.select(i);
      // open on the opposite side of the enclosure so it stays visible and clickable
      const pr = $("park").getBoundingClientRect(), pt = zoo.projectPen(i);
      $("penPanel").classList.toggle("right", pt.x < pr.left + pr.width / 2);
    }
    play("assets/sfx_coin", { volume: 0.15 });
    refreshPen();
  }
  function closePen() {
    selectedPen = -1;
    $("penPanel").classList.add("hidden");
    if (zoo) zoo.select(-1);
  }
  function refreshPen() {
    if (selectedPen < 0 || !sim) return;
    const st = sim.state, i = selectedPen, p = st.pens[i], busy = !!st.event || st.over;
    const list = sim.penAnimals(i);
    const capCost = sim.penUpgradeCost(i, "cap"), qolCost = sim.penUpgradeCost(i, "qol"), buildCost = sim.nextCost("expand");
    const sig = [i, p.built, p.speciesId, p.cap, p.qol, Math.floor(st.money), busy, imgVersion,
      list.map((a) => a.uid + ":" + Math.round(a.happiness) + ":" + a.hiddenDays).join(",")].join("|");
    if (sig === panelSig) return;
    panelSig = sig;
    const sp = p.speciesId ? byId[p.speciesId] : null;
    $("ppTitle").textContent = (sp ? sp.emoji + " " : p.built ? "＋ " : "🔨 ") + penName(i);
    $("ppSub").textContent = !p.built ? "An empty plot beside the fountain. Build an enclosure here to house more animals."
      : sp ? sp.role + " · " + sp.trait : "Any species can move in. Snap an animal photo to adopt one here.";
    $("ppAnimals").innerHTML = !p.built ? "" : list.length ? list.map((a, k) => {
      const h = Math.round(a.happiness), col = h > 60 ? "#2f7d4f" : h > 30 ? "#e0a100" : "#d64532";
      const url = imgReady["assets/animals/" + a.speciesId];
      return '<div class="ppA" data-tip="animal" data-uid="' + a.uid + '"><span class="ppPic">' + (url ? '<img alt="" src="' + esc(url) + '">' : esc(byId[a.speciesId].emoji)) + "</span>" +
        '<span class="ppN">' + esc(byId[a.speciesId].name) + " " + (k + 1) + (a.hiddenDays > 0 ? " · 🙈 hiding" : "") + "</span>" +
        '<span class="hb"><span style="width:' + h + "%;background:" + col + '"></span></span><span class="ppH">' + h + "%</span></div>";
    }).join("") : '<p class="ppEmpty">No animals yet.</p>';
    $("ppUpgrades").classList.toggle("hidden", !p.built);
    $("ppCap").textContent = p.cap + "/" + RULES.capMax + " animals";
    $("ppQol").textContent = "★".repeat(p.qol) + "☆".repeat(RULES.qolMax - p.qol);
    $("ppCapBtn").textContent = capCost == null ? "MAX" : "Expand · $" + fmt(capCost);
    $("ppCapBtn").disabled = busy || capCost == null || st.money < capCost;
    $("ppQolBtn").textContent = qolCost == null ? "MAX" : "Upgrade · $" + fmt(qolCost);
    $("ppQolBtn").disabled = busy || qolCost == null || st.money < qolCost;
    const room = p.built && (!p.speciesId || list.length < p.cap);
    $("ppAdopt").classList.toggle("hidden", !p.built);
    $("ppAdopt").disabled = busy || !room;
    $("ppAdopt").textContent = room ? "📷 Snap to adopt " + (sp ? "another " + sp.name : "an animal here") : "Full: expand the fence to add more";
    $("ppBuild").classList.toggle("hidden", p.built);
    $("ppBuild").disabled = busy || buildCost == null || st.money < buildCost;
    $("ppBuild").textContent = buildCost == null ? "All enclosures built" : "🔨 Build enclosure here · $" + fmt(buildCost);
  }
  function penUpgrade(kind) {
    const i = selectedPen;
    if (i < 0 || !sim || sim.state.event) return;
    const r = sim.upgradePen(i, kind);
    if (!r.ok) return;
    play("assets/sfx_coin", { volume: 0.6 });
    const p = sim.state.pens[i];
    const msg = kind === "cap" ? "🐾 " + penName(i) + " fence expanded: room for " + p.cap + " animals!" : "🌿 " + penName(i) + " comfort upgraded: the animals love it!";
    addLog(msg + " (−$" + fmt(r.cost) + ")", "good");
    toast(msg, "good", 2600);
    panelSig = "";
    render(true);
  }
  $("ppCapBtn").onclick = () => penUpgrade("cap");
  $("ppQolBtn").onclick = () => penUpgrade("qol");
  $("ppClose").onclick = closePen;
  $("ppAdopt").onclick = () => openAdopt(selectedPen);
  $("ppBuild").onclick = () => {
    if (selectedPen < 0 || !sim || sim.state.event) return;
    const r = sim.buildPen(selectedPen);
    if (!r.ok) return;
    play("assets/sfx_coin", { volume: 0.6 });
    addLog("🏗️ A new enclosure is ready! (−$" + fmt(r.cost) + ")", "good");
    panelSig = "";
    render(true);
  };
  $("resetView").onclick = () => zoo && zoo.resetView();

  /* ---------------- scanner ---------------- */
  let scan = null;
  function openAdopt(pen) {
    if (!sim || sim.state.over || sim.state.event || uiPaused) return;
    adoptPen = typeof pen === "number" && pen >= 0 ? pen : null;
    adoptOpen = true;
    openScanner("adopt", null);
  }
  function openScanner(mode, ev) {
    const now = performance.now();
    scan = { mode, ev, stab: Sim.createStabilizer(CFG.CONFIDENCE, CFG.HOLD_MS), busy: false, last: 0,
      cooldownUntil: now + 400, openedAt: now, lastLockAt: now, tipShown: false };
    const card = $("scanner").querySelector(".scanCard");
    card.classList.toggle("manual", manualMode);
    card.classList.toggle("urgent", mode !== "adopt");
    const sp = ev ? byId[ev.speciesId] : null;
    if (mode === "adopt") {
      $("scanTitle").textContent = TXT.scanner.adoptTitle;
      $("scanHelp").textContent = manualMode ? TXT.scanner.manual : TXT.scanner.adoptHelp;
    } else {
      const t = TXT.events[mode];
      $("scanTitle").textContent = t.title;
      $("scanHelp").textContent = fill(t.text, { animal: sp.name, zoo: zooName }) + (manualMode ? " " + TXT.scanner.manual : "");
    }
    $("scanTimer").classList.toggle("hidden", mode === "adopt");
    $("scanCancel").classList.toggle("hidden", mode !== "adopt");
    $("scanFeedback").textContent = "";
    $("scanFeedback").className = "feedback";
    $("lockBar").style.width = "0%";
    $("scanStatus").textContent = manualMode ? "" : TXT.scanner.show;
    if (manualMode) {
      $("manualPick").classList.remove("hidden");
      $("manualPick").innerHTML = SPECIES.map((s) => '<button data-id="' + esc(s.id) + '"><span class="e">' + esc(s.emoji) + "</span>" + esc(s.name) + "</button>").join("");
    } else {
      $("manualPick").classList.add("hidden");
      const holder = $("camHolder");
      if (webcam && webcam.canvas.parentNode !== holder) { holder.innerHTML = ""; holder.appendChild(webcam.canvas); }
      $("predBars").innerHTML = modelLabels.map((l, i) => {
        const id = classToId[norm(l)];
        const label = id ? byId[id].emoji + " " + byId[id].name : "∅ " + l;
        return '<div class="bar" id="pb' + i + '"><span>' + esc(label) + '</span><div class="tr"><div class="fl"></div></div><span class="pc">0%</span></div>';
      }).join("");
    }
    $("scanner").classList.remove("hidden");
    updateTimer();
  }
  function closeScanner() {
    scan = null;
    $("scanner").classList.add("hidden");
  }
  function updateTimer() {
    if (!scan || scan.mode === "adopt" || !sim || !sim.state.event) return;
    const ev = sim.state.event;
    const left = Math.max(0, ev.timeLeft);
    $("scanTimerBar").style.width = (left / ev.timeMax) * 100 + "%";
    $("scanTimerText").textContent = "⏱ " + Math.ceil(left) + "s";
  }
  function scanFrame(now) {
    if (!scan) return;
    updateTimer();
    if (manualMode || !webcam || !model) return;
    webcam.update();
    if (scan.busy || now - scan.last < 100) return;
    const s = scan;
    s.busy = true;
    s.last = now;
    model.predict(webcam.canvas)
      .then((preds) => { if (scan === s) onPredictions(preds, performance.now()); })
      .catch((e) => console.warn("prediction failed", e))
      .then(() => { s.busy = false; });
  }
  function onPredictions(preds, now) {
    let best = null;
    preds.forEach((p, i) => {
      if (!best || p.probability > best.probability) best = p;
      const row = $("pb" + i);
      if (row) {
        row.querySelector(".fl").style.width = Math.round(p.probability * 100) + "%";
        row.querySelector(".pc").textContent = Math.round(p.probability * 100) + "%";
      }
    });
    preds.forEach((p, i) => { const row = $("pb" + i); if (row) row.classList.toggle("top", p === best); });
    if (uiPaused || !best) return;
    const id = classToId[norm(best.className)] || null;
    if (now < scan.cooldownUntil) { scan.stab.reset(); $("lockBar").style.width = "0%"; return; }
    const locked = scan.stab.push(id, best.probability, now);
    $("lockBar").style.width = Math.round(scan.stab.progress(now) * 100) + "%";
    if (id && best.probability >= CFG.CONFIDENCE) $("scanStatus").textContent = fill(TXT.scanner.holding, { shown: byId[id].name });
    else if (id) $("scanStatus").textContent = TXT.scanner.notSure;
    else $("scanStatus").textContent = TXT.scanner.show;
    if (!scan.tipShown && now - scan.lastLockAt > 9000) {
      scan.tipShown = true;
      if (!$("scanFeedback").textContent) { $("scanFeedback").textContent = TXT.scanner.stuckTip; $("scanFeedback").className = "feedback tip"; }
    }
    if (locked) onLock(locked, best.probability);
  }
  function onLock(id, prob, manual) {
    if (!scan) return;
    scan.lastLockAt = performance.now();
    if (scan.mode === "adopt") {
      closeScanner();
      showAdoptCard(id, prob, manual);
      return;
    }
    const want = scan.ev.speciesId, kind = scan.mode;
    const r = sim.submitScan(id);
    if (!r.ok) { closeScanner(); return; }
    if (r.success) {
      closeScanner();
      const msg = fill(TXT.events[kind].success, { animal: byId[want].name, zoo: zooName });
      toast(msg, "good", 5000);
      addLog(msg, "good");
      play("assets/sfx_success");
      play("assets/animals/" + want, { volume: 0.9 });
    } else {
      const fb = $("scanFeedback");
      fb.textContent = fill(pick(TXT.wrong), { shown: byId[id].name, animal: byId[want].name });
      fb.className = "feedback";
      void fb.offsetWidth; // restart the shake animation
      fb.className = "feedback bad";
      scan.cooldownUntil = performance.now() + 1200;
      scan.stab.reset();
      $("lockBar").style.width = "0%";
    }
  }
  $("manualPick").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-id]");
    if (b && scan && !uiPaused) onLock(b.dataset.id, 1, true);
  });
  $("scanCancel").onclick = () => { if (scan && scan.mode === "adopt") { closeScanner(); adoptOpen = false; } };

  /* ---------------- adopt card ---------------- */
  function showAdoptCard(id, prob, manual) {
    adoptCardId = id;
    adoptConf = manual ? null : prob;
    const s = byId[id];
    setImg($("acImg"), "assets/animals/" + s.id, $("acEmoji"));
    $("acEmoji").textContent = s.emoji;
    $("acConf").textContent = s.name + (manual ? " (picked by hand)" : " (" + Math.round(prob * 100) + "% sure)");
    $("acName").textContent = s.emoji + " " + s.name;
    $("acRole").textContent = s.role;
    $("acCost").textContent = "$" + fmt(s.cost);
    $("acAppeal").textContent = "+" + s.appeal;
    $("acUpkeep").textContent = "$" + fmt(s.upkeep);
    $("acOwned").textContent = sim.state.animals.filter((a) => a.speciesId === id).length;
    $("acTrait").textContent = "✨ " + s.trait;
    const chk = sim.canAdopt(id, adoptPen);
    $("acAdopt").disabled = !chk.ok;
    $("acAdopt").textContent = "Adopt for $" + fmt(s.cost);
    let dest = "";
    if (chk.pen >= 0) {
      const p = sim.state.pens[chk.pen], n = sim.penAnimals(chk.pen).length;
      dest = "🏠 Moves into enclosure " + (chk.pen + 1) + (p.speciesId ? " with the other " + s.name + "s (" + (n + 1) + "/" + p.cap + ")" : " (empty, becomes the " + s.name + " enclosure)") + ".";
      if (adoptPen != null && chk.pen !== adoptPen) dest += " The enclosure you picked can't take " + aAn(s.name) + ".";
    }
    $("acPen").textContent = dest;
    $("acWhy").textContent = chk.ok ? "" : chk.reason === "noslot"
      ? "No room for " + aAn(s.name) + ". Expand the fence of " + aAn(s.name) + " enclosure, or build a new enclosure."
      : chk.reason === "money" ? "You need $" + fmt(s.cost - sim.state.money) + " more." : "";
    $("adoptCard").classList.remove("hidden");
    play("assets/animals/" + s.id, { volume: 0.9 });
  }
  $("acAdopt").onclick = () => {
    const id = adoptCardId;
    const r = sim.adopt(id, adoptPen);
    if (!r.ok) return;
    $("adoptCard").classList.add("hidden");
    adoptOpen = false;
    const msg = fill(pick(TXT.adopt), { animal: byId[id].name, zoo: zooName });
    toast(msg, "good", 4000);
    addLog(msg, "good");
    play("assets/sfx_adopt");
    if (selectedPen >= 0) openPen(r.pen);
    render(true);
  };
  $("acRescan").onclick = () => { $("adoptCard").classList.add("hidden"); openScanner("adopt", null); };
  $("acClose").onclick = () => { $("adoptCard").classList.add("hidden"); adoptOpen = false; };
  $("adoptBtn").onclick = () => openAdopt(null);

  /* ---------------- choice events ---------------- */
  let choiceEv = null;
  function choiceVars(ev) { return { animal: ev.speciesId ? byId[ev.speciesId].name : "", price: fmt(ev.price || 0), zoo: zooName }; }
  function showChoice(ev) {
    choiceEv = ev;
    const t = TXT.events[ev.key], v = choiceVars(ev);
    $("chTitle").textContent = t.title;
    $("chText").textContent = fill(t.text, v);
    $("chA").textContent = fill(t.A, v);
    $("chB").textContent = fill(t.B, v);
    $("chA").disabled = sim.state.money < ev.costA;
    if ($("chA").disabled) $("chA").textContent += " (not enough cash)";
    $("choiceCard").classList.remove("hidden");
  }
  function choose(opt) {
    if (!choiceEv || uiPaused) return;
    const ev = choiceEv;
    const r = sim.resolveChoice(opt);
    if (!r.ok) return;
    choiceEv = null;
    $("choiceCard").classList.add("hidden");
    const t = TXT.events[ev.key];
    const msg = fill(t.results[r.result], choiceVars(ev));
    const bad = r.result === "B_fail" || (ev.key === "heatwave" && opt === "B") || (ev.key === "circus" && opt === "A");
    toast(msg, bad ? "bad" : "good", 5000);
    addLog(msg, bad ? "bad" : "good");
    play(bad ? "assets/sfx_fail" : "assets/sfx_success", { volume: 0.7 });
    render(true);
  }
  $("chA").onclick = () => choose("A");
  $("chB").onclick = () => choose("B");

  /* ---------------- pause, sound, keys ---------------- */
  function setPaused(p) {
    if (!sim || sim.state.over || currentScreen !== "game") return;
    uiPaused = p;
    $("pauseOverlay").classList.toggle("hidden", !p);
    $("pauseBtn").textContent = p ? "▶\uFE0F" : "⏸\uFE0F";
  }
  $("pauseBtn").onclick = () => setPaused(!uiPaused);
  $("resumeBtn").onclick = () => setPaused(false);
  $("quitBtn").onclick = () => { setPaused(false); newGame(); };
  $("soundBtn").onclick = () => setSound(!soundOn);
  $("musicBtn").onclick = () => setMusic(!musicOn);
  document.addEventListener("keydown", (e) => {
    if (e.target && /input|textarea/i.test(e.target.tagName)) {
      if (e.key === "Enter" && e.target.id === "zooName" && !$("startBtn").disabled) $("startBtn").click();
      return;
    }
    if (e.key === "p" || e.key === "P") setPaused(!uiPaused);
    if (e.key === "m" || e.key === "M") setSound(!soundOn);
    if (e.key === "Escape" && scan && scan.mode === "adopt") $("scanCancel").click();
    else if (e.key === "Escape" && selectedPen >= 0) closePen();
  });


  /* ---------------- hover pop-ups ---------------- */
  // Every interactive element with data-tip="key" shows a small info card on hover.
  // Enclosures and animals in the 3D zoo show one too (via zoo3d.js onHover).
  let tipState = null;
  const EVENT_DAYS = { request: "📸 Photo request", escape: "🚨 Possible escape", choice: "🎲 Surprise event" };
  const row = (k, v, cls) => '<div class="tr' + (cls ? " " + cls : "") + '"><span>' + k + "</span><b>" + v + "</b></div>";
  const hbar = (h) => { const c = h > 60 ? "#2f7d4f" : h > 30 ? "#e0a100" : "#d64532"; return '<span class="hb"><span style="width:' + Math.round(h) + "%;background:" + c + '"></span></span>'; };
  const mood = (h) => (h >= 80 ? "Thrilled 😄" : h >= 60 ? "Happy 🙂" : h >= 35 ? "Restless 😐" : "Miserable 😢");
  const tipCard = (title, body) => "<h4>" + title + "</h4>" + body;

  function penTip(i) {
    if (!sim) return "";
    const st = sim.state, p = st.pens[i], list = sim.penAnimals(i);
    if (!p.built) {
      const c = sim.nextCost("expand");
      return tipCard("🔨 Empty plot " + (i + 1), "<p>Build an enclosure here to house another species.</p>" +
        row("Build cost", c == null ? "—" : "$" + fmt(c), c != null && st.money < c ? "bad" : "") + '<p class="hint">Click to open</p>');
    }
    const sp = p.speciesId ? byId[p.speciesId] : null;
    let body = sp ? "<p>" + esc(sp.trait) + "</p>" : "<p>Empty: any species can move in.</p>";
    list.forEach((a, k) => {
      body += '<div class="ta">' + esc(byId[a.speciesId].emoji) + " " + esc(byId[a.speciesId].name) + " " + (k + 1) +
        (a.hiddenDays > 0 ? " 🙈" : "") + hbar(a.happiness) + "<small>" + Math.round(a.happiness) + "%</small></div>";
    });
    const upkeep = list.reduce((t, a) => t + byId[a.speciesId].upkeep, 0);
    body += row("🐾 Capacity", list.length + " / " + p.cap + (p.cap < RULES.capMax ? " (next: $" + fmt(sim.penUpgradeCost(i, "cap")) + ")" : " (max)")) +
      row("🌿 Comfort", "★".repeat(p.qol) + "☆".repeat(RULES.qolMax - p.qol) + (p.qol < RULES.qolMax ? " (next: $" + fmt(sim.penUpgradeCost(i, "qol")) + ")" : "")) +
      (list.length ? row("Upkeep / night", "$" + fmt(upkeep)) : "") +
      '<p class="hint">Click to manage this enclosure</p>';
    return tipCard((sp ? esc(sp.emoji) + " " : "＋ ") + "Enclosure " + (i + 1) + (sp ? " · " + esc(sp.name) + "s" : ""), body);
  }
  function animalTip(uid) {
    if (!sim) return "";
    const a = sim.state.animals.find((x) => x.uid === uid);
    if (!a) return "";
    const sp = byId[a.speciesId];
    const escaping = sim.state.event && sim.state.event.animalUid === uid;
    return tipCard(esc(sp.emoji + " " + sp.name), (escaping ? '<p class="bad">🚨 On the loose! Show ' + esc(aAn(sp.name)) + " photo to the camera.</p>" : "") +
      '<div class="ta">' + mood(a.happiness) + hbar(a.happiness) + "<small>" + Math.round(a.happiness) + "%</small></div>" +
      row("Appeal", "+" + sp.appeal) + row("Upkeep / night", "$" + sp.upkeep) + row("Lives in", "Enclosure " + (a.pen + 1)) +
      "<p>" + esc(sp.trait) + "</p>");
  }
  function choiceTip(opt) {
    const ev = choiceEv;
    if (!ev) return "";
    const v = choiceVars(ev);
    const fx = {
      circus: { A: ["+$" + v.price, "Lose your " + v.animal, "Reputation −12"], B: ["Reputation +3"] },
      heatwave: { A: ["−$120", "All animals +10 happiness"], B: ["All animals −25 happiness"] },
      influencer: { A: ["−$150", "+50% visitors today and tomorrow"], B: ["Nothing happens"] },
      baby: { A: ["Free baby " + v.animal + " (needs room)", "Reputation +3"], B: ["+$150", "Reputation +8"] },
      fieldtrip: { A: ["−$100", "Reputation +12"], B: ["Reputation −4"] },
      inspector: { A: ["−$100", "All animals +10 happiness", "Reputation +5"], B: ["50%: reputation +8", "50%: reputation −15"] },
    }[ev.key][opt];
    return tipCard(opt === "A" ? "If you choose this…" : "If you choose this…", "<ul>" + fx.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul>");
  }
  function shopTip(k) {
    const st = sim.state, c = sim.nextCost(k);
    const cost = c == null ? (k === "treat" ? "No animals yet" : "Fully upgraded") : "$" + fmt(c);
    const base = {
      expand: ["🏗️ New enclosure", "Builds an enclosure on the next free plot around the fountain. More enclosures = more species = a variety bonus (+15% visitors per extra species).", "Built", sim.builtCount() + " / " + RULES.maxPens],
      snack: ["🍿 Snack stand", "Every visitor spends $1 more per level.", "Level", st.upgrades.snack + " / " + RULES.snackCost.length],
      ads: ["📣 Ad campaign", "Each level brings 20% more visitors (but they still have to fit through the entrance).", "Level", st.upgrades.ads + " / " + RULES.adsCost.length],
      gate: ["🎟️ Bigger entrance", "Total visitor capacity: how many people can be inside the zoo at once. When it's full, new arrivals line up at the gate and get turned away until others leave.", "Capacity",
        RULES.gateCap[st.upgrades.gate] + (st.upgrades.gate < RULES.gateCost.length ? " → " + RULES.gateCap[st.upgrades.gate + 1] + " visitors" : " visitors (max)")],
      treat: ["🍉 Animal treats", "Every animal gets +25 happiness right now. Happy animals attract more visitors and raise your rating.", "Animals", String(st.animals.length)],
    }[k];
    return tipCard(base[0], "<p>" + base[1] + "</p>" + row(base[2], base[3]) + row("Cost", cost, c != null && st.money < c ? "bad" : ""));
  }
  function tipFor(key, el) {
    if (!sim && /^(day|cash|visitors|rating|shop-|cap|qol|adopthere|build|choice|animal|acadopt)/.test(key)) return "";
    const st = sim ? sim.state : null, m = sim ? sim.metrics() : null;
    switch (key) {
      case "day": {
        const next = RULES.eventPlan[st.day + 1];
        return tipCard("📅 Day " + st.day + " of " + RULES.totalDays, "<p>Each day lasts about " + RULES.dayLength + " seconds. Upkeep is paid every night.</p>" +
          row("Today", RULES.eventPlan[st.day] ? EVENT_DAYS[RULES.eventPlan[st.day]] : "Quiet day") + (st.day < RULES.totalDays ? row("Tomorrow", next ? EVENT_DAYS[next] : "Quiet day") : row("Tomorrow", "🏁 Final results")));
      }
      case "cash": {
        const perSec = m.vps * m.perVisitor;
        return tipCard("💰 Cash " + money(st.money), row("Earning now", "$" + perSec.toFixed(1) + " / sec") + row("Each visitor pays", "$" + m.perVisitor) +
          row("Upkeep tonight", "−$" + fmt(m.upkeep), st.money < m.upkeep ? "bad" : "") + "<p>Two nights in a row below $0 and the bank closes the zoo.</p>");
      }
      case "visitors": {
        const left = Math.max(0, RULES.goalVisitors - st.visitorsTotal);
        return tipCard("🚶 Visitors", row("So far", fmt(Math.floor(st.visitorsTotal)) + " / " + fmt(RULES.goalVisitors)) + row("Arriving now", m.vps.toFixed(1) + " / sec") +
          row("Want to come", m.demand.toFixed(1) + " / sec") + row("Inside right now", Math.round(m.inside) + " / " + m.capacity) +
          (m.turnedAway > 0.05 ? row("Turned away", m.turnedAway.toFixed(1) + " / sec", "bad") : "") + row("Turned away so far", fmt(Math.floor(st.stats.turnedAway))) +
          row("Still needed", left ? fmt(Math.ceil(left)) : "Goal reached! 🎉") + row("Species variety bonus", "×" + m.variety.toFixed(2)) +
          "<p>More animals, happier animals, comfort upgrades, ads and a good rating all bring more visitors.</p>");
      }
      case "rating":
        return tipCard("⭐ Rating", row("Reputation", Math.round(st.reputation) + " / 100") + row("Visitor multiplier", "×" + m.repMult.toFixed(2)) + row("Average happiness", m.avgHappy ? Math.round(m.avgHappy) + "%" : "—") +
          "<p>Goes up with happy animals, caught escapes and kind choices. Goes down with escapes, unhappy animals and debt.</p>");
      case "pause": return tipCard(uiPaused ? "▶ Resume" : "⏸ Pause", "<p>Stops the clock. Shortcut: <kbd>P</kbd></p>");
      case "music": return tipCard("🎵 Music " + (musicOn ? "on" : "off"), "<p>Turns the background music on or off.</p>");
      case "sound": return tipCard(soundOn ? "🔊 Sound on" : "🔇 Sound off", "<p>Mutes or unmutes all music, narration and sound effects. Shortcut: <kbd>M</kbd></p>");
      case "resetview": return tipCard("⟲ Reset view", "<p>Puts the camera back so the entrance is at the front.</p>");
      case "close": return tipCard("Close", "<p>Close this panel. The game keeps running.</p>");
      case "adopt": return tipCard("📷 Snap to Adopt", "<p>Hold an animal photo up to the webcam. Our AI model recognizes the species, and you can adopt it.</p><p>It moves into an enclosure with that species (if there's room) or an empty one.</p>");
      case "shop-expand": return shopTip("expand");
      case "shop-snack": return shopTip("snack");
      case "shop-ads": return shopTip("ads");
      case "shop-gate": return shopTip("gate");
      case "shop-treat": return shopTip("treat");
      case "cap": {
        if (selectedPen < 0) return "";
        const p = st.pens[selectedPen], c = sim.penUpgradeCost(selectedPen, "cap");
        return tipCard("🐾 Expand the fence", c == null ? "<p>This enclosure is already as big as it gets (" + RULES.capMax + " animals).</p>" :
          "<p>Room for " + (p.cap + 1) + " animals instead of " + p.cap + ". Only the same species can share an enclosure.</p>" + row("Cost", "$" + fmt(c), st.money < c ? "bad" : ""));
      }
      case "qol": {
        if (selectedPen < 0) return "";
        const p = st.pens[selectedPen], c = sim.penUpgradeCost(selectedPen, "qol");
        if (c == null) return tipCard("🌿 Comfort maxed", "<p>Pond, rocks, trees and a shelter: this enclosure is luxury living.</p>");
        const n = p.qol + 1;
        return tipCard("🌿 Comfort level " + n, "<p>" + (n === 1 ? "Adds a pond, rocks and bushes." : "Adds shade trees and a shelter.") + "</p>" +
          row("Happiness loss", Math.round(RULES.qolDecayCut * n * 100) + "% slower") + row("Visitor appeal", "+" + Math.round(RULES.qolAppeal * n * 100) + "%") +
          row("Right now", "+" + RULES.qolInstant + " happiness") + row("Cost", "$" + fmt(c), st.money < c ? "bad" : ""));
      }
      case "adopthere": return tipCard("📷 Adopt into this enclosure", "<p>Opens the camera. The animal you show moves in here if it fits (same species, or the enclosure is empty).</p>");
      case "build": return tipCard("🔨 Build here", "<p>Turns this plot into a new enclosure with capacity for 1 animal. Upgrade it later.</p>");
      case "choiceA": return choiceTip("A");
      case "choiceB": return choiceTip("B");
      case "animal": return animalTip(Number(el && el.dataset.uid));
      case "acadopt": {
        if (!adoptCardId) return "";
        const chk = sim.canAdopt(adoptCardId, adoptPen), sp = byId[adoptCardId];
        return tipCard("Adopt the " + esc(sp.name), row("Cost", "$" + fmt(sp.cost)) + row("Upkeep / night", "$" + sp.upkeep) +
          (chk.pen >= 0 ? row("Goes to", "Enclosure " + (chk.pen + 1)) : row("Goes to", "No room", "bad")));
      }
      case "rescan": return tipCard("Scan another", "<p>Go back to the camera and show a different animal.</p>");
      case "start": return tipCard("Open the gates!", "<p>Starts the game and turns on your webcam so the AI can recognize animal photos.</p>");
      case "manual": return tipCard("Play without a camera", "<p>Pick animals from buttons instead of showing photos. Use this if your webcam isn't working.</p>");
      case "shuffle": return tipCard("🎲 Random name", "<p>Pick a random zoo name.</p>");
      case "again": return tipCard("↻ Play again", "<p>Start a fresh zoo with the same name.</p>");
      case "menu": return tipCard("Main menu", "<p>Back to the title screen to rename your zoo.</p>");
    }
    return "";
  }

  function showTip(html, x, y) {
    const t = $("tip");
    if (!html) { hideTip(); return; }
    if (t.innerHTML !== html) t.innerHTML = html;
    t.classList.remove("hidden");
    const pad = 14, w = t.offsetWidth, h = t.offsetHeight;
    let left = x + 16, top = y + 18;
    if (left + w > window.innerWidth - pad) left = x - w - 14;
    if (top + h > window.innerHeight - pad) top = y - h - 14;
    t.style.left = Math.max(pad, left) + "px";
    t.style.top = Math.max(pad, top) + "px";
  }
  function hideTip() { tipState = null; $("tip").classList.add("hidden"); }
  function refreshTip() {
    if (!tipState) return;
    if (tipState.el && !document.body.contains(tipState.el)) { hideTip(); return; }
    if (tipState.el && tipState.el.offsetParent === null) { hideTip(); return; }
    const html = tipState.el ? tipFor(tipState.key, tipState.el) : tipState.kind === "pen" ? penTip(tipState.data) : tipState.kind === "gate" ? gateTip() : animalTip(tipState.data);
    showTip(html, tipState.x, tipState.y);
  }
  function gateTip() {
    if (!sim) return "";
    const st = sim.state, m = sim.metrics(), c = sim.nextCost("gate");
    return tipCard("🎟️ " + esc(zooName) + " entrance", row("Inside right now", Math.round(m.inside) + " / " + m.capacity) + row("Arriving", m.vps.toFixed(1) + " / sec") + row("Want to come", m.demand.toFixed(1) + " / sec") +
      (m.turnedAway > 0.05 ? row("Turned away", m.turnedAway.toFixed(1) + " / sec", "bad") : row("Line", "None, all good")) +
      row("Ticket booths", String(1 + st.upgrades.gate)) +
      (c != null ? row("Next upgrade", "$" + fmt(c) + " → holds " + RULES.gateCap[st.upgrades.gate + 1]) : row("Upgrades", "Maxed")) +
      '<p class="hint">Click to find the Bigger entrance upgrade</p>');
  }
  function zooHover(kind, data, x, y) {
    if (!kind) { if (tipState && !tipState.el) hideTip(); return; }
    tipState = { kind, data, x, y };
    refreshTip();
  }
  let tipTouch = false;
  document.addEventListener("pointerdown", (e) => { tipTouch = e.pointerType === "touch"; if (tipTouch) hideTip(); }, true);
  document.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch" || tipTouch) return;
    const el = e.target.closest ? e.target.closest("[data-tip]") : null;
    if (el) { tipState = { el, key: el.dataset.tip, x: e.clientX, y: e.clientY }; refreshTip(); }
    else if (tipState && tipState.el) hideTip();
    else if (tipState) { tipState.x = e.clientX; tipState.y = e.clientY; }
  });
  document.addEventListener("pointerleave", hideTip);
  window.addEventListener("blur", hideTip);

  /* ---------------- ending ---------------- */
  function showEnd(key) {
    if (!sim) return;
    closeScanner();
    closePen();
    hideTip();
    ["adoptCard", "choiceCard", "pauseOverlay"].forEach((id) => $(id).classList.add("hidden"));
    adoptOpen = false; uiPaused = false; choiceEv = null;
    const st = sim.state, m = sim.metrics(), e = TXT.endings[key];
    $("endEmoji").textContent = e.emoji;
    setImg($("endImg"), "assets/end_" + key, $("endEmoji"));
    $("endTitle").textContent = e.title;
    $("endText").textContent = fill(e.text, { zoo: zooName });
    const s = st.stats;
    const stats = [
      [fmt(Math.floor(st.visitorsTotal)) + " / " + fmt(RULES.goalVisitors), "visitors"],
      [money(st.money), "cash left"],
      ["★".repeat(Math.round(m.stars)) + "☆".repeat(5 - Math.round(m.stars)), "rating"],
      [st.animals.length + " (" + m.distinct + " species)", "animals"],
      [s.recaptured + " / " + (s.recaptured + s.escapesMissed), "escapes caught"],
      [s.requestsDone + " / " + (s.requestsDone + s.requestsMissed), "photo requests"],
      [s.adopted, "adopted"],
      ["Day " + st.day, "reached"],
    ];
    $("endStats").innerHTML = stats.map((x) => "<div><b>" + esc(x[0]) + "</b><span>" + esc(x[1]) + "</span></div>").join("");
    const score = key === "bankrupt" ? Math.floor(st.visitorsTotal / 2)
      : Math.floor(st.visitorsTotal) + Math.max(0, Math.floor(st.money / 2)) + Math.round(st.reputation) * 5;
    $("endScore").textContent = fmt(score);
    $("endScore").title = key === "bankrupt" ? "Half your visitors (bankrupt)" : "visitors + half your cash + 5 × reputation";
    const best = showBest();
    if (!best || score > best.score) {
      store.set("zoo_best", JSON.stringify({ score, zoo: zooName }));
      $("endBest").textContent = score > 0 ? "🏅 New best on this computer!" : "";
    } else $("endBest").textContent = "(best: " + fmt(best.score) + ", " + best.zoo + ")";
    show("end");
    const good = key === "legendary" || key === "collector" || key === "success";
    play(good ? "assets/sfx_success" : "assets/sfx_fail", { volume: 0.7 });
    play("assets/voice_end_" + key, { voice: true, volume: 1 });
  }
  $("againBtn").onclick = () => newGame();
  $("menuBtn").onclick = () => { show("title"); showBest(); };

  /* ---------------- boot ---------------- */
  $("startBtn").onclick = () => startGame(false);
  $("manualBtn").onclick = () => startGame(true);
  $("modelFiles").addEventListener("change", async (e) => {
    const chip = $("modelStatus");
    chip.className = "chip wait";
    chip.textContent = "🧠 Loading your model files…";
    try {
      const pack = await ZooModelPack.filesToPack(e.target.files);
      modelReady(await ZooModelPack.loadPack(pack), "the files you chose");
    } catch (err) { modelFailed(err); }
  });
  initTitle();
  setSound(soundOn);
  setMusic(musicOn);
  preloadMedia();
  loadModel().then((r) => modelReady(r.m, r.src), modelFailed);
  requestAnimationFrame((t) => { lastFrame = t; frame(t); });

  // handy for testing in the browser console
  window.__zoo = {
    get sim() { return sim; }, get scan() { return scan; }, get model() { return model; },
    get manual() { return manualMode; }, get screen() { return currentScreen; }, get zoo() { return zoo; }, get selectedPen() { return selectedPen; },
    openPen, tipFor, penTip,
    sounds, setPaused, newGame,
  };
})();
