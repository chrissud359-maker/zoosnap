/* =====================================================================
   ZOOSNAP TYCOON - GAME RULES (no screen code in here)
   Runs in the browser (window.ZooSim) and in Node for testing.
   ===================================================================== */
(function (root) {
  "use strict";

  const RULES = {
    totalDays: 8,
    dayLength: 30,          // seconds of play per day
    eventAt: 0.45,          // events fire this far into a day
    startMoney: 600,
    startPens: 3,           // enclosures already built at the start
    maxPens: 6,             // enclosure sites around the fountain
    buildCost: [250, 350, 450],
    capMax: 3,              // animals per enclosure after upgrades (starts at 1)
    capCost: [150, 250],    // capacity upgrades: 1 -> 2 -> 3 animals
    qolMax: 2,
    qolCost: [120, 240],    // comfort upgrades
    qolDecayCut: 0.35,      // each comfort level: happiness drops 35% slower...
    qolAppeal: 0.15,        // ...and the animals there are 15% more appealing
    qolInstant: 15,         // instant happiness when you upgrade comfort
    extraSameSpecies: 0.85, // 2nd+ animal of a species is a bit less exciting
    snackCost: [200, 400],  // each level: +$1 per visitor
    adsCost: [150, 300, 450], // each level: +20% visitors
    gateCap: [60, 100, 150, 225], // total visitor capacity: most people inside the zoo at once
    stayTime: 5,              // seconds a visitor spends inside before leaving
    gateCost: [180, 300, 450],// "Bigger entrance" upgrades
    treatCost: 60,          // +25 happiness for every animal
    treatBoost: 25,
    ticket: 2,
    visitorRate: 0.2,       // visitors per second per point of appeal
    goalVisitors: 3500,
    baseDecay: 9,           // happiness lost per day
    requestTime: 15,
    escapeTime: 20,
    // which kind of event happens on which day
    eventPlan: { 2: "request", 3: "choice", 4: "escape", 5: "choice", 6: "request", 7: "escape" },
  };

  const CHOICES = ["circus", "heatwave", "influencer", "baby", "fieldtrip", "inspector"];

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function create(opts) {
    const species = opts.species;
    const byId = {};
    species.forEach((s) => (byId[s.id] = s));
    const rand = mulberry32(opts.seed != null ? opts.seed : (Date.now() & 0xffffffff));
    let uid = 1;

    const st = {
      zooName: opts.zooName || "My Zoo",
      day: 1, dayTime: 0, money: RULES.startMoney, reputation: 50,
      visitorsTotal: 0, visitorsToday: 0, earnedToday: 0,
      pens: Array.from({ length: RULES.maxPens }, (_, i) => ({ built: i < RULES.startPens, speciesId: null, cap: 1, qol: 0 })),
      animals: [],
      upgrades: { snack: 0, ads: 0, gate: 0 },
      turnedAwayToday: 0, inside: 0, admitRate: 0, awayRate: 0,
      boost: { mult: 1, untilDay: 0 },
      event: null, eventFiredToday: false, usedChoices: [],
      paused: false, over: false, ending: null, debtStrikes: 0,
      stats: { turnedAway: 0, adopted: 0, recaptured: 0, escapesMissed: 0, requestsDone: 0, requestsMissed: 0, sold: 0, peakVps: 0, penUpgrades: 0 },
    };

    /* ---------- derived numbers ---------- */
    function counts() {
      const c = {};
      st.animals.forEach((a) => (c[a.speciesId] = (c[a.speciesId] || 0) + 1));
      return c;
    }
    function animalAppeal(a, c, rank) {
      if (a.hiddenDays > 0) return 0;
      const s = byId[a.speciesId];
      const herd = (s.herdBonus || 0) * ((c[a.speciesId] || 1) - 1);
      const extra = rank > 0 ? RULES.extraSameSpecies : 1;
      const comfort = 1 + RULES.qolAppeal * st.pens[a.pen].qol;
      return (s.appeal + herd) * extra * comfort * (0.4 + 0.6 * a.happiness / 100);
    }
    function metrics() {
      const c = counts();
      const distinct = Object.keys(c).length;
      let appeal = 0;
      const seen = {};
      st.animals.forEach((a) => {
        const rank = seen[a.speciesId] || 0;
        seen[a.speciesId] = rank + 1;
        appeal += animalAppeal(a, c, rank);
      });
      const variety = distinct > 0 ? 1 + 0.15 * (distinct - 1) : 1;
      appeal *= variety;
      const repMult = 0.6 + (st.reputation / 100) * 0.8;
      const adsMult = 1 + 0.2 * st.upgrades.ads;
      const boostMult = st.day <= st.boost.untilDay ? st.boost.mult : 1;
      const demand = appeal > 0 ? (0.2 + appeal * RULES.visitorRate) * repMult * adsMult * boostMult : 0;
      const capacity = RULES.gateCap[st.upgrades.gate]; // most people inside at once
      const vps = st.admitRate;                          // visitors actually getting in (per second)
      const turnedAway = st.awayRate;                    // turned away because the zoo is full
      const inside = st.inside;
      let perVisitor = RULES.ticket + st.upgrades.snack;
      st.animals.forEach((a) => (perVisitor += a.hiddenDays > 0 ? 0 : byId[a.speciesId].snackPerVisitor || 0));
      const upkeep = st.animals.reduce((t, a) => t + byId[a.speciesId].upkeep, 0);
      const avgHappy = st.animals.length ? st.animals.reduce((t, a) => t + a.happiness, 0) / st.animals.length : 0;
      const stars = clamp(Math.round((1 + st.reputation / 25) * 2) / 2, 1, 5);
      return { appeal, variety, distinct, vps, demand, capacity, turnedAway, inside, perVisitor, upkeep, avgHappy, stars, repMult, adsMult, boostMult };
    }

    /* ---------- player actions ---------- */
    /* ---------- enclosures ---------- */
    function builtCount() { return st.pens.filter((p) => p.built).length; }
    function penAnimals(i) { return st.animals.filter((a) => a.pen === i); }
    // can enclosure i take one more animal of this species?
    function penFits(i, id) {
      const p = st.pens[i];
      if (!p || !p.built) return false;
      const n = penAnimals(i).length;
      return (p.speciesId === id && n < p.cap) || (p.speciesId == null && n === 0);
    }
    // best enclosure for a new animal: the preferred one if it fits, else one that
    // already has this species and has room, else an empty one. -1 if none.
    function penFor(id, preferred) {
      if (preferred != null && penFits(preferred, id)) return preferred;
      for (let i = 0; i < st.pens.length; i++) if (st.pens[i].speciesId === id && penFits(i, id)) return i;
      for (let i = 0; i < st.pens.length; i++) if (penFits(i, id)) return i;
      return -1;
    }
    function placeAnimal(id, pen, happiness) {
      st.pens[pen].speciesId = id;
      const a = { uid: uid++, speciesId: id, pen, happiness, hiddenDays: 0, adoptedDay: st.day };
      st.animals.push(a);
      return a;
    }
    function removeAnimal(animalUid) {
      const i = st.animals.findIndex((a) => a.uid === animalUid);
      if (i < 0) return null;
      const a = st.animals.splice(i, 1)[0];
      if (!penAnimals(a.pen).length) st.pens[a.pen].speciesId = null; // empty enclosures can take any species
      return a;
    }
    function penUpgradeCost(i, kind) {
      const p = st.pens[i];
      if (!p || !p.built) return null;
      if (kind === "cap") return p.cap < RULES.capMax ? RULES.capCost[p.cap - 1] : null;
      if (kind === "qol") return p.qol < RULES.qolMax ? RULES.qolCost[p.qol] : null;
      return null;
    }
    function upgradePen(i, kind) {
      if (st.over) return { ok: false, reason: "over" };
      const cost = penUpgradeCost(i, kind);
      if (cost == null) return { ok: false, reason: "max" };
      if (st.money < cost) return { ok: false, reason: "money" };
      st.money -= cost;
      const p = st.pens[i];
      if (kind === "cap") p.cap++;
      else {
        p.qol++;
        penAnimals(i).forEach((a) => (a.happiness = clamp(a.happiness + RULES.qolInstant, 0, 100)));
      }
      st.stats.penUpgrades++;
      return { ok: true, cost };
    }
    function buildPen(i) {
      if (st.over) return { ok: false, reason: "over" };
      if (i == null) i = st.pens.findIndex((p) => !p.built);
      const p = st.pens[i];
      if (!p || p.built) return { ok: false, reason: "max" };
      const cost = nextCost("expand");
      if (st.money < cost) return { ok: false, reason: "money" };
      st.money -= cost;
      p.built = true;
      return { ok: true, cost, pen: i };
    }

    /* ---------- player actions ---------- */
    function canAdopt(id, preferred) {
      const s = byId[id];
      if (!s) return { ok: false, reason: "unknown" };
      if (st.over) return { ok: false, reason: "over" };
      const pen = penFor(id, preferred);
      if (pen < 0) return { ok: false, reason: "noslot", pen };
      if (st.money < s.cost) return { ok: false, reason: "money", pen };
      return { ok: true, pen };
    }
    function adopt(id, preferred) {
      const chk = canAdopt(id, preferred);
      if (!chk.ok) return chk;
      st.money -= byId[id].cost;
      const a = placeAnimal(id, chk.pen, 85);
      st.stats.adopted++;
      return { ok: true, pen: chk.pen, animal: a };
    }
    function nextCost(key) {
      if (key === "expand") { const b = builtCount(); return b < RULES.maxPens ? RULES.buildCost[b - RULES.startPens] : null; }
      if (key === "snack") return st.upgrades.snack < RULES.snackCost.length ? RULES.snackCost[st.upgrades.snack] : null;
      if (key === "ads") return st.upgrades.ads < RULES.adsCost.length ? RULES.adsCost[st.upgrades.ads] : null;
      if (key === "gate") return st.upgrades.gate < RULES.gateCost.length ? RULES.gateCost[st.upgrades.gate] : null;
      if (key === "treat") return st.animals.length ? RULES.treatCost : null;
      return null;
    }
    function buy(key) {
      if (st.over) return { ok: false, reason: "over" };
      const cost = nextCost(key);
      if (cost == null) return { ok: false, reason: "max" };
      if (st.money < cost) return { ok: false, reason: "money" };
      if (key === "expand") return buildPen(null);
      st.money -= cost;
      if (key === "snack") st.upgrades.snack++;
      else if (key === "ads") st.upgrades.ads++;
      else if (key === "gate") st.upgrades.gate++;
      else if (key === "treat") st.animals.forEach((a) => (a.happiness = clamp(a.happiness + RULES.treatBoost, 0, 100)));
      return { ok: true, cost };
    }

    /* ---------- events ---------- */
    function visibleAnimals() { return st.animals.filter((a) => a.hiddenDays <= 0); }
    function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

    function choiceEligible(key) {
      const vis = visibleAnimals();
      if (key === "circus") return vis.length > 0;
      if (key === "baby") return vis.some((a) => penFor(a.speciesId) >= 0);
      return true;
    }
    function makeChoice(key) {
      const ev = { kind: "choice", key, timed: false };
      if (key === "circus") {
        const vis = visibleAnimals().slice().sort((a, b) => byId[b.speciesId].cost - byId[a.speciesId].cost);
        ev.animalUid = vis[0].uid; ev.speciesId = vis[0].speciesId;
        ev.price = Math.round(byId[vis[0].speciesId].cost * 1.5);
        ev.costA = 0;
      } else if (key === "baby") {
        const p = pick(visibleAnimals().filter((a) => penFor(a.speciesId) >= 0)); ev.speciesId = p.speciesId; ev.costA = 0;
      } else if (key === "heatwave") ev.costA = 120;
      else if (key === "influencer") ev.costA = 150;
      else if (key === "fieldtrip") ev.costA = 100;
      else if (key === "inspector") ev.costA = 100;
      return ev;
    }
    function fireEvent() {
      let type = RULES.eventPlan[st.day];
      if (!type) return null;
      let ev = null;
      const vis = visibleAnimals();
      if (type === "request" && vis.length) {
        const ids = [...new Set(vis.map((a) => a.speciesId))];
        ev = { kind: "request", speciesId: pick(ids), timed: true, timeLeft: RULES.requestTime, timeMax: RULES.requestTime };
      } else if (type === "escape" && vis.length) {
        const total = vis.reduce((t, a) => t + (byId[a.speciesId].escapeWeight || 1), 0);
        let r = rand() * total, chosen = vis[0];
        for (const a of vis) { r -= byId[a.speciesId].escapeWeight || 1; if (r <= 0) { chosen = a; break; } }
        ev = { kind: "escape", speciesId: chosen.speciesId, animalUid: chosen.uid, timed: true, timeLeft: RULES.escapeTime, timeMax: RULES.escapeTime };
      } else {
        let pool = CHOICES.filter((k) => choiceEligible(k) && st.usedChoices.indexOf(k) < 0);
        if (!pool.length) pool = CHOICES.filter(choiceEligible);
        if (!pool.length) return null;
        const key = pick(pool);
        st.usedChoices.push(key);
        ev = makeChoice(key);
      }
      st.event = ev;
      return ev;
    }

    function finishEvent(result) {
      const ev = st.event;
      st.event = null;
      return Object.assign({ kind: ev.kind, key: ev.key, speciesId: ev.speciesId }, result);
    }

    function resolveChoice(option) {
      const ev = st.event;
      if (!ev || ev.kind !== "choice") return { ok: false, reason: "noevent" };
      if (option === "A" && st.money < ev.costA) return { ok: false, reason: "money" };
      let res = option === "A" ? "A" : "B";
      if (option === "A") st.money -= ev.costA;
      const all = (d) => st.animals.forEach((a) => (a.happiness = clamp(a.happiness + d, 0, 100)));
      switch (ev.key) {
        case "circus":
          if (option === "A") {
            removeAnimal(ev.animalUid);
            st.money += ev.price; st.reputation -= 12; st.stats.sold++;
          } else st.reputation += 3;
          break;
        case "heatwave": option === "A" ? all(10) : all(-25); break;
        case "influencer": if (option === "A") st.boost = { mult: 1.5, untilDay: st.day + 1 }; break;
        case "baby":
          if (option === "A") {
            const pen = penFor(ev.speciesId);
            if (pen >= 0) { placeAnimal(ev.speciesId, pen, 100); res = "A"; }
            st.reputation += 3;
          } else { st.money += 150; st.reputation += 8; }
          break;
        case "fieldtrip": option === "A" ? (st.reputation += 12) : (st.reputation -= 4); break;
        case "inspector":
          if (option === "A") { all(10); st.reputation += 5; }
          else if (rand() < 0.5) { st.reputation += 8; res = "B_pass"; }
          else { st.reputation -= 15; res = "B_fail"; }
          break;
      }
      st.reputation = clamp(st.reputation, 0, 100);
      return Object.assign({ ok: true }, finishEvent({ result: res, price: ev.price }));
    }

    // The ML model recognized `speciesId` while an event wanted an animal.
    function submitScan(speciesId) {
      const ev = st.event;
      if (!ev || !ev.timed) return { ok: false, reason: "noevent" };
      if (speciesId !== ev.speciesId) return { ok: true, success: false, wrong: speciesId };
      if (ev.kind === "request") {
        st.money += 150; st.reputation = clamp(st.reputation + 6, 0, 100); st.stats.requestsDone++;
      } else {
        st.reputation = clamp(st.reputation + 4, 0, 100); st.stats.recaptured++;
        const a = st.animals.find((x) => x.uid === ev.animalUid);
        if (a) a.happiness = clamp(a.happiness + 10, 0, 100);
      }
      return Object.assign({ ok: true, success: true }, finishEvent({ result: "success" }));
    }
    function failTimedEvent() {
      const ev = st.event;
      if (ev.kind === "request") { st.reputation -= 5; st.stats.requestsMissed++; }
      else {
        const a = st.animals.find((x) => x.uid === ev.animalUid);
        if (a) a.hiddenDays = 2;
        st.money -= 100; st.reputation -= 10; st.stats.escapesMissed++;
      }
      st.reputation = clamp(st.reputation, 0, 100);
      return finishEvent({ result: "fail" });
    }

    /* ---------- time ---------- */
    function endDay() {
      const m = metrics();
      const out = { type: "dayEnd", day: st.day, visitors: Math.floor(st.visitorsToday), earned: Math.round(st.earnedToday), upkeep: m.upkeep, turnedAway: Math.floor(st.turnedAwayToday) };
      st.money -= m.upkeep;
      const calm = st.animals.reduce((mx, a) => Math.max(mx, byId[a.speciesId].calm || 0), 0);
      st.animals.forEach((a) => {
        const s = byId[a.speciesId];
        const comfort = 1 - RULES.qolDecayCut * st.pens[a.pen].qol;
        a.happiness = clamp(a.happiness - RULES.baseDecay * (s.selfDecay != null ? s.selfDecay : 1) * (1 - calm) * comfort, 0, 100);
        if (a.hiddenDays > 0) a.hiddenDays--;
      });
      if (st.animals.length) {
        st.reputation += (m.avgHappy - 55) / 8;
        st.animals.forEach((a) => (st.reputation += byId[a.speciesId].repPerDay || 0));
      } else st.reputation -= 3;
      if (st.money < 0) {
        st.debtStrikes++;
        st.animals.forEach((a) => (a.happiness = clamp(a.happiness - 15, 0, 100)));
        st.reputation -= 6;
        out.debt = true;
      } else st.debtStrikes = 0;
      st.reputation = clamp(st.reputation, 0, 100);
      st.visitorsToday = 0; st.earnedToday = 0; st.turnedAwayToday = 0; st.dayTime = 0;
      st.eventFiredToday = false;
      st.inside = 0; st.admitRate = 0; st.awayRate = 0; // everyone goes home at night
      if (st.debtStrikes >= 2) return [out, gameOver("bankrupt")];
      st.day++;
      if (st.day > RULES.totalDays) { st.day = RULES.totalDays; return [out, gameOver(finalEnding())]; }
      out.newDay = st.day;
      return [out];
    }
    function finalEnding() {
      const v = Math.floor(st.visitorsTotal);
      if (st.stats.adopted === 0) return "empty";
      const allSpecies = species.every((s) => st.animals.some((a) => a.speciesId === s.id));
      if (v >= RULES.goalVisitors && st.reputation >= 75) return "legendary";
      if (v >= RULES.goalVisitors && allSpecies) return "collector";
      if (v >= RULES.goalVisitors) return "success";
      return "struggling";
    }
    function gameOver(ending) {
      st.over = true; st.ending = ending; st.event = null;
      return { type: "gameOver", ending };
    }

    function step(dt) {
      if (st.over || st.paused || !(dt > 0)) return [];
      const outs = [];
      if (st.event) {
        if (st.event.timed) {
          st.event.timeLeft -= dt;
          if (st.event.timeLeft <= 0) outs.push(Object.assign({ type: "eventResolved" }, failTimedEvent()));
        }
        return outs; // the clock is frozen while an event is open
      }
      const m = metrics();
      st.stats.peakVps = Math.max(st.stats.peakVps, m.vps);
      // visitors leave after a while; new ones get in only while there's room inside
      st.inside = Math.max(0, st.inside - (st.inside / RULES.stayTime) * dt);
      const want = m.demand * dt;
      const v = Math.min(want, Math.max(0, m.capacity - st.inside));
      const away = want - v;
      st.inside += v;
      const k = Math.min(1, dt / 0.8);
      st.admitRate += (v / dt - st.admitRate) * k;
      st.awayRate += (away / dt - st.awayRate) * k;
      st.visitorsTotal += v; st.visitorsToday += v;
      st.turnedAwayToday += away; st.stats.turnedAway += away;
      st.money += v * m.perVisitor; st.earnedToday += v * m.perVisitor;
      st.dayTime += dt;
      if (!st.eventFiredToday && st.dayTime >= RULES.dayLength * RULES.eventAt) {
        st.eventFiredToday = true;
        const ev = fireEvent();
        if (ev) { outs.push({ type: "event", event: ev }); return outs; }
      }
      if (st.dayTime >= RULES.dayLength) outs.push(...endDay());
      return outs;
    }

    return { state: st, rules: RULES, species, byId, metrics, canAdopt, adopt, buy, nextCost, resolveChoice, submitScan, step,
      builtCount, penAnimals, penFor, penFits, penUpgradeCost, upgradePen, buildPen };
  }

  /* Locks in a prediction only when the same class stays confident for holdMs. */
  function createStabilizer(threshold, holdMs) {
    let cur = null, since = 0;
    return {
      push(label, prob, now) {
        if (!label || prob < threshold) { cur = null; return null; }
        if (label !== cur) { cur = label; since = now; return null; }
        return now - since >= holdMs ? label : null;
      },
      progress(now) { return cur ? Math.min(1, (now - since) / holdMs) : 0; },
      current() { return cur; },
      reset() { cur = null; since = 0; },
    };
  }

  const api = { create, createStabilizer, RULES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ZooSim = api;
})(typeof window !== "undefined" ? window : this);
