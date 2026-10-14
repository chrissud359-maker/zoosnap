/* =====================================================================
   ZOOSNAP TYCOON - 3D ZOO VIEW
   A circular zoo: enclosures ring a central fountain, a marked entrance
   at the front, and little 3D visitors walking around to view animals.
   Uses Three.js (lib/three.min.js). If WebGL isn't available it falls back
   to a flat top-down map that works the same way.
   Animals are drawn as picture "cut-outs" floating over the scene so your
   AI-generated animal art also works when index.html is double-clicked.
   ===================================================================== */
(function () {
  "use strict";
  const TAU = Math.PI * 2;
  const SLOTS = 7;                 // 6 enclosure sites + the entrance gap
  const L = {
    penR: 10.6,                    // distance from fountain to enclosure centers
    ringIn: 3.35, ringOut: 5.95,   // walking plaza around the fountain
    walkR: 4.65,                   // where visitors stroll
    viewR: 6.55,                   // where visitors stand to look at an enclosure
    penSize: [3.0, 3.3, 3.6],      // enclosure radius at capacity 1/2/3
    ground: 23, gateZ: 13.8, spawnZ: 19.5,
  };
  const penAngle = (i) => ((i + 1) * TAU) / SLOTS; // angle 0 = entrance, toward the camera
  const polar = (th, r) => ({ x: Math.sin(th) * r, z: Math.cos(th) * r });
  const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const DEFAULT_HABITATS = ["#d9b46b", "#b9a487", "#5d9c46", "#dcecf3", "#ccb978", "#8e9d56"];

  function create(container, opts) {
    const species = opts.species, byId = {};
    species.forEach((s, i) => { byId[s.id] = s; s._habitat = s.habitat || DEFAULT_HABITATS[i % DEFAULT_HABITATS.length]; });
    const getImg = opts.getImage || (() => null);
    const onPenClick = opts.onPenClick || (() => {});
    const onHover = opts.onHover || (() => {});
    const onGateClick = opts.onGateClick || (() => {}); // (kind, data, clientX, clientY) for hover pop-ups
    const forceFlat = !!opts.flat;

    container.classList.add("zooView");
    const labelLayer = document.createElement("div"); labelLayer.className = "zv-labels";
    const spriteLayer = document.createElement("div"); spriteLayer.className = "zv-sprites";
    let mode = "3d", renderer = null, scene, camera, raycaster, canvas;
    let width = 1, height = 1;

    /* ---------------- camera orbit ---------------- */
    const cam = { az: 0, el: 0.92, dist: 40, target: { x: 0, y: 0, z: 2.6 } };
    const CAM0 = { az: 0, el: 0.92, dist: 40 };

    /* ---------------- shared 3D bits ---------------- */
    const G = {}, M = {};
    const mat = (hex, extra) => {
      const k = hex + (extra ? JSON.stringify(extra) : "");
      if (!M[k]) M[k] = new THREE.MeshLambertMaterial(Object.assign({ color: hex }, extra || {}));
      return M[k];
    };
    function mesh(geo, material, x, y, z, cast, receive) {
      const m = new THREE.Mesh(geo, material);
      m.position.set(x || 0, y || 0, z || 0);
      m.castShadow = !!cast; m.receiveShadow = receive !== false;
      return m;
    }

    const pens = []; // per site: { group, hit, sig, popT }
    let gateSign = null, gateSignName = null, fountainSpray = null, ripples = [];
    const flags = [], gateBooths = [], gateLanes = [];
    let gateLevelShown = -1;
    // automatic quality: weaker computers drop shadows / detail so the game stays smooth
    const perf = { t: 0, frames: 0, level: 0, maxVisitors: 40 };
    let flatEls = null;

    function init3D() {
      if (forceFlat || typeof THREE === "undefined") return false;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
      } catch (e) { renderer = null; return false; }
      if (!renderer || !renderer.getContext()) return false;
      canvas = renderer.domElement;
      canvas.className = "zv-canvas";
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      scene = new THREE.Scene();
      scene.background = new THREE.Color("#cfe9f2");
      scene.fog = new THREE.Fog("#cfe9f2", 55, 95);
      camera = new THREE.PerspectiveCamera(38, 1, 0.5, 200);
      raycaster = new THREE.Raycaster();

      scene.add(new THREE.HemisphereLight("#fffaf0", "#7aa368", 1.6));
      const sun = new THREE.DirectionalLight("#fff1d6", 2.2);
      sun.position.set(14, 26, 12);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 70 });
      sun.shadow.bias = -0.0008;
      scene.add(sun);

      // geometries reused everywhere
      G.box = new THREE.BoxGeometry(1, 1, 1);
      G.post = new THREE.CylinderGeometry(0.07, 0.08, 1.05, 6);
      G.trunk = new THREE.CylinderGeometry(0.16, 0.22, 1.2, 7);
      G.cone = new THREE.ConeGeometry(1, 2.2, 8);
      G.ball = new THREE.SphereGeometry(1, 10, 8);
      G.rock = new THREE.DodecahedronGeometry(0.45, 0);
      G.roof = new THREE.ConeGeometry(1, 0.9, 4);
      G.body = new THREE.CylinderGeometry(0.17, 0.24, 0.55, 8);
      G.head = new THREE.SphereGeometry(0.17, 10, 8);
      G.leg = new THREE.BoxGeometry(0.11, 0.42, 0.12);
      G.hat = new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10);

      buildWorld();
      for (let i = 0; i < SLOTS - 1; i++) {
        const g = new THREE.Group();
        const p = polar(penAngle(i), L.penR);
        g.position.set(p.x, 0, p.z);
        scene.add(g);
        const hit = new THREE.Mesh(new THREE.CylinderGeometry(L.penSize[2], L.penSize[2], 2.4, 20), new THREE.MeshBasicMaterial({ visible: false }));
        hit.position.set(p.x, 1.2, p.z);
        hit.userData.pen = i;
        scene.add(hit);
        pens.push({ group: g, hit, sig: "", popT: 0 });
      }
      container.appendChild(canvas);
      return true;
    }

    function buildWorld() {
      // grass + outer hedge
      const ground = mesh(new THREE.CircleGeometry(L.ground, 72), mat("#8fc47f"), 0, 0, 0);
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);
      const outer = mesh(new THREE.RingGeometry(L.ground, 120, 72, 1), mat("#a9d39a"), 0, -0.02, 0);
      outer.rotation.x = -Math.PI / 2;
      scene.add(outer);
      const hedge = mesh(new THREE.TorusGeometry(L.ground - 0.4, 0.55, 6, 96, TAU - 0.34), mat("#4f8a43"), 0, 0.3, 0, true);
      hedge.rotation.x = -Math.PI / 2;
      hedge.rotation.z = Math.PI / 2 + 0.17; // gap lines up with the entrance path
      hedge.scale.z = 1.4;
      scene.add(hedge);

      // plaza ring path, spokes to each enclosure, entrance path
      const sand = mat("#ecdcb0");
      const plaza = mesh(new THREE.RingGeometry(L.ringIn, L.ringOut, 72), sand, 0, 0.03, 0);
      plaza.rotation.x = -Math.PI / 2;
      scene.add(plaza);
      const edge = mesh(new THREE.RingGeometry(L.ringOut, L.ringOut + 0.18, 72), mat("#cdb784"), 0, 0.035, 0);
      edge.rotation.x = -Math.PI / 2;
      scene.add(edge);
      for (let i = 0; i < SLOTS - 1; i++) {
        const th = penAngle(i), len = L.penR - L.ringOut;
        const p = polar(th, L.ringOut + len / 2 - 0.2);
        const spoke = mesh(new THREE.PlaneGeometry(1.6, len), sand, p.x, 0.028, p.z);
        spoke.rotation.x = -Math.PI / 2;
        spoke.rotation.z = th;
        scene.add(spoke);
      }
      const ent = mesh(new THREE.PlaneGeometry(2.8, L.ground - L.ringOut + 1), sand, 0, 0.029, L.ringOut + (L.ground - L.ringOut + 1) / 2 - 0.3);
      ent.rotation.x = -Math.PI / 2;
      scene.add(ent);
      const outside = mesh(new THREE.PlaneGeometry(3.2, 40), mat("#d9c79a"), 0, -0.01, L.ground + 18);
      outside.rotation.x = -Math.PI / 2;
      scene.add(outside);

      // flower bed + fountain
      const bed = mesh(new THREE.RingGeometry(2.45, L.ringIn, 48), mat("#6fae5c"), 0, 0.04, 0);
      bed.rotation.x = -Math.PI / 2;
      scene.add(bed);
      const flowers = new THREE.InstancedMesh(G.ball, mat("#ffffff"), 64);
      const fc = ["#ff7aa2", "#ffd166", "#ffffff", "#c77dff", "#ff9f1c"].map((c) => new THREE.Color(c));
      const dm = new THREE.Object3D();
      for (let k = 0; k < 64; k++) {
        const p = polar((k / 64) * TAU + rnd(-0.03, 0.03), rnd(2.6, 3.2));
        dm.position.set(p.x, 0.14, p.z);
        dm.scale.setScalar(rnd(0.09, 0.15));
        dm.updateMatrix();
        flowers.setMatrixAt(k, dm.matrix);
        flowers.setColorAt(k, fc[k % fc.length]);
      }
      scene.add(flowers);

      const stone = mat("#c9c3b6"), stoneDark = mat("#aca596");
      scene.add(mesh(new THREE.CylinderGeometry(2.25, 2.45, 0.62, 40), stone, 0, 0.31, 0, true));
      const water = mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.06, 40), mat("#5fb7e5", { transparent: true, opacity: 0.92 }), 0, 0.6, 0);
      scene.add(water);
      scene.add(mesh(new THREE.CylinderGeometry(0.28, 0.36, 1.7, 14), stoneDark, 0, 1.35, 0, true));
      scene.add(mesh(new THREE.CylinderGeometry(0.95, 0.35, 0.3, 24), stone, 0, 2.2, 0, true));
      scene.add(mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.04, 24), mat("#6cc3ee"), 0, 2.36, 0));
      scene.add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.5, 10), stoneDark, 0, 2.6, 0, true));
      // ripples
      for (let k = 0; k < 3; k++) {
        const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40), new THREE.MeshBasicMaterial({ color: "#e6f6ff", transparent: true, opacity: 0.6 }));
        r.rotation.x = -Math.PI / 2;
        r.position.y = 0.64;
        r.userData.t = k / 3;
        scene.add(r);
        ripples.push(r);
      }
      // spray particles
      const N = 220, pos = new Float32Array(N * 3), vel = [];
      for (let k = 0; k < N; k++) vel.push(newDrop({}, true));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      fountainSpray = new THREE.Points(geo, new THREE.PointsMaterial({ color: "#d8f1ff", size: 0.13, transparent: true, opacity: 0.9, depthWrite: false }));
      fountainSpray.userData.drops = vel;
      scene.add(fountainSpray);

      // entrance gate + ticket booth
      const wood = mat("#8a5a3b"), brick = mat("#c96f4a"), cream = mat("#fff4dc");
      for (const sx of [-1, 1]) {
        const pillar = mesh(G.box, brick, sx * 2.15, 2.1, L.gateZ, true);
        pillar.scale.set(0.7, 4.2, 0.7);
        scene.add(pillar);
        const cap = mesh(G.roof, mat("#2f7d4f"), sx * 2.15, 4.55, L.gateZ, true);
        cap.scale.set(0.62, 0.9, 0.62);
        cap.rotation.y = Math.PI / 4;
        scene.add(cap);
        const flagPole = mesh(G.post, wood, sx * 2.15, 5.4, L.gateZ, true);
        flagPole.scale.set(0.6, 1.2, 0.6);
        scene.add(flagPole);
        const flag = mesh(new THREE.PlaneGeometry(0.8, 0.45), mat(sx < 0 ? "#e85d4a" : "#ffb703", { side: THREE.DoubleSide }), sx * 2.15 + 0.42, 5.75, L.gateZ, true);
        flags.push(flag);
        scene.add(flag);
      }
      const beam = mesh(G.box, wood, 0, 3.75, L.gateZ, true);
      beam.scale.set(5.2, 1.15, 0.45);
      scene.add(beam);
      gateSign = mesh(new THREE.PlaneGeometry(5.0, 1.05), new THREE.MeshBasicMaterial({ color: "#ffffff" }), 0, 3.75, L.gateZ + 0.42);
      scene.add(gateSign);
      const booth = new THREE.Group();
      booth.position.set(3.7, 0, L.gateZ + 1.9);
      const hut = mesh(G.box, cream, 0, 0.9, 0, true);
      hut.scale.set(1.5, 1.8, 1.3);
      booth.add(hut);
      const broof = mesh(G.roof, mat("#e85d4a"), 0, 2.2, 0, true);
      broof.scale.set(1.25, 1, 1.15);
      broof.rotation.y = Math.PI / 4;
      booth.add(broof);
      const win = mesh(G.box, mat("#4a90b8"), -0.76, 1.1, 0, false);
      win.scale.set(0.05, 0.55, 0.8);
      booth.add(win);
      scene.add(booth);
      // extra ticket booths appear as the entrance is upgraded (visitor capacity)
      const boothSpots = [[-3.7, L.gateZ + 1.9], [5.9, L.gateZ + 2.6], [-5.9, L.gateZ + 2.6]];
      boothSpots.forEach(([bx, bz], k) => {
        const b = booth.clone();
        b.position.set(bx, 0, bz);
        if (bx < 0) b.rotation.y = Math.PI; // window faces the path
        b.visible = false;
        scene.add(b);
        gateBooths.push(b);
      });
      // turnstile lanes in front of the arch (one more per level)
      for (let k = 0; k < 4; k++) {
        const lane = new THREE.Group();
        const x = -1.35 + k * 0.9;
        const post = mesh(G.box, mat("#5b6168"), x, 0.45, L.gateZ + 1.2, true);
        post.scale.set(0.16, 0.9, 0.5);
        lane.add(post);
        const arm = mesh(G.box, mat("#ffd166"), x + 0.32, 0.72, L.gateZ + 1.2, true);
        arm.scale.set(0.55, 0.06, 0.06);
        lane.add(arm);
        lane.visible = k === 0;
        scene.add(lane);
        gateLanes.push(lane);
      }

      // trees around the edge and between enclosures (not on the entrance path)
      const spots = [];
      for (let i = 0; i < SLOTS; i++) {
        const th = ((i + 0.5) * TAU) / SLOTS;
        spots.push([th, 14.6 + rnd(-0.4, 0.4)]);
      }
      for (let k = 0; k < 46; k++) {
        const th = rnd(0.32, TAU - 0.32);
        spots.push([th, rnd(15.8, L.ground - 1.3)]);
      }
      spots.push([0.42, 17.5], [-0.42, 17.5], [0.5, 20.4], [-0.5, 20.4]);
      const trunks = new THREE.InstancedMesh(G.trunk, mat("#7a5232"), spots.length);
      const leaves = new THREE.InstancedMesh(G.cone, mat("#ffffff"), spots.length);
      const greens = ["#3f8f4a", "#2f7d4f", "#5aa04a", "#4c9a3f"].map((c) => new THREE.Color(c));
      trunks.castShadow = leaves.castShadow = true;
      spots.forEach(([th, r], k) => {
        const p = polar(th, r), s = rnd(0.8, 1.35);
        dm.position.set(p.x, 0.6 * s, p.z); dm.scale.set(s, s, s); dm.rotation.set(0, 0, 0); dm.updateMatrix();
        trunks.setMatrixAt(k, dm.matrix);
        dm.position.set(p.x, 2.2 * s, p.z); dm.scale.set(s * 1.05, s, s * 1.05); dm.updateMatrix();
        leaves.setMatrixAt(k, dm.matrix);
        leaves.setColorAt(k, greens[k % greens.length]);
      });
      scene.add(trunks, leaves);

      // benches + lamp posts on the plaza
      for (let i = 0; i < SLOTS; i++) {
        const th = ((i + 0.5) * TAU) / SLOTS;
        if (i === SLOTS - 1) continue;
        const p = polar(th, L.ringOut - 0.45);
        const bench = mesh(G.box, wood, p.x, 0.32, p.z, true);
        bench.scale.set(1.3, 0.12, 0.45);
        bench.rotation.y = th + Math.PI / 2;
        scene.add(bench);
        const lp = polar(th + 0.12, L.ringOut + 0.25);
        const lamp = mesh(G.post, mat("#3b3f44"), lp.x, 1.1, lp.z, true);
        lamp.scale.set(0.8, 2.1, 0.8);
        scene.add(lamp);
        const bulb = mesh(G.ball, mat("#fff3b0", { emissive: "#fff0a0", emissiveIntensity: 0.6 }), lp.x, 2.3, lp.z);
        bulb.scale.setScalar(0.2);
        scene.add(bulb);
      }
    }

    function newDrop(d, scatter) {
      const th = Math.random() * TAU, sp = rnd(0.55, 1.15);
      d.x = 0; d.y = 2.85; d.z = 0;
      d.vx = Math.sin(th) * sp; d.vz = Math.cos(th) * sp; d.vy = rnd(1.9, 2.7);
      if (scatter) { const t = Math.random() * 1.2; d.x += d.vx * t; d.z += d.vz * t; d.y += d.vy * t - 3 * t * t; }
      return d;
    }

    function setGateSign(name) {
      if (!gateSign || name === gateSignName) return;
      gateSignName = name;
      const c = document.createElement("canvas");
      c.width = 1024; c.height = 214;
      const x = c.getContext("2d");
      x.fillStyle = "#1e5636"; x.fillRect(0, 0, 1024, 214);
      x.strokeStyle = "#ffd166"; x.lineWidth = 10; x.strokeRect(12, 12, 1000, 190);
      x.fillStyle = "#ffffff"; x.textAlign = "center"; x.textBaseline = "middle";
      let fs = 92;
      x.font = "700 " + fs + "px Fredoka, 'Trebuchet MS', sans-serif";
      while (x.measureText(name).width > 900 && fs > 40) { fs -= 4; x.font = "700 " + fs + "px Fredoka, 'Trebuchet MS', sans-serif"; }
      x.fillText(name, 512, 92);
      x.fillStyle = "#ffd166"; x.font = "600 44px Fredoka, 'Trebuchet MS', sans-serif";
      x.fillText("★  ENTRANCE  ★", 512, 170);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      if (gateSign.material.map) gateSign.material.map.dispose();
      gateSign.material.map = tex;
      gateSign.material.needsUpdate = true;
    }

    /* ---------------- enclosure models ---------------- */
    function penSig(p) { return [p.built, p.speciesId, p.cap, p.qol].join("|"); }
    function rebuildPen(i, p) {
      const rec = pens[i], g = rec.group;
      while (g.children.length) {
        const c = g.children.pop();
        if (c.isInstancedMesh) c.dispose();
      }
      const th = penAngle(i);
      g.rotation.y = th; // local -z points... we keep local +z pointing away from the fountain
      if (!p.built) {
        const patch = mesh(new THREE.CircleGeometry(L.penSize[0], 28), mat("#9cc98a"), 0, 0.05, 0);
        patch.rotation.x = -Math.PI / 2;
        g.add(patch);
        const stakes = new THREE.InstancedMesh(G.post, mat("#c8a46e"), 12);
        const dm = new THREE.Object3D();
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * TAU;
          dm.position.set(Math.sin(a) * L.penSize[0], 0.25, Math.cos(a) * L.penSize[0]);
          dm.scale.set(1, 0.5, 1); dm.updateMatrix();
          stakes.setMatrixAt(k, dm.matrix);
        }
        stakes.castShadow = true;
        g.add(stakes);
        const sp = mesh(G.post, mat("#8a5a3b"), 0, 0.75, -1.2, true);
        sp.scale.set(1, 1.4, 1);
        g.add(sp);
        const board = mesh(G.box, mat("#ffd166"), 0, 1.35, -1.2, true);
        board.scale.set(1.4, 0.7, 0.08);
        board.rotation.y = Math.PI;
        g.add(board);
        return;
      }
      const R = L.penSize[p.cap - 1];
      const sp = p.speciesId ? byId[p.speciesId] : null;
      const base = mesh(new THREE.CylinderGeometry(R, R + 0.08, 0.14, 40), mat(sp ? sp._habitat : "#c9a97a"), 0, 0.07, 0);
      g.add(base);
      // fence: posts + two rails
      const n = Math.round(R * 7);
      const posts = new THREE.InstancedMesh(G.post, mat("#8a5a3b"), n);
      const dm = new THREE.Object3D();
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU;
        dm.position.set(Math.sin(a) * R, 0.6, Math.cos(a) * R);
        dm.scale.set(1, 1, 1); dm.updateMatrix();
        posts.setMatrixAt(k, dm.matrix);
      }
      posts.castShadow = true;
      g.add(posts);
      for (const y of [0.5, 0.95]) {
        const rail = mesh(new THREE.TorusGeometry(R, 0.045, 5, 48), mat("#a8744c"), 0, y, 0, true);
        rail.rotation.x = Math.PI / 2;
        g.add(rail);
      }
      // comfort upgrades: pond + rocks, then trees + shelter
      if (p.qol >= 1) {
        const pond = mesh(new THREE.CylinderGeometry(R * 0.36, R * 0.36, 0.05, 24), mat("#5fb7e5"), R * 0.35, 0.16, R * 0.25);
        pond.scale.z = 0.7;
        g.add(pond);
        g.add(mesh(G.rock, mat("#9a9a92"), -R * 0.45, 0.35, R * 0.3, true));
        const r2 = mesh(G.rock, mat("#b0aea3"), -R * 0.25, 0.25, R * 0.55, true);
        r2.scale.setScalar(0.6);
        g.add(r2);
        const bush = mesh(G.ball, mat("#4f9a45"), R * 0.62, 0.35, -R * 0.2, true);
        bush.scale.set(0.5, 0.4, 0.5);
        g.add(bush);
      }
      if (p.qol >= 2) {
        for (const [x, z, s] of [[-R * 0.55, -R * 0.35, 0.8], [R * 0.05, R * 0.68, 0.65]]) {
          const t = mesh(G.trunk, mat("#7a5232"), x, 0.5 * s, z, true);
          t.scale.setScalar(s);
          g.add(t);
          const c = mesh(G.cone, mat("#3f8f4a"), x, 1.9 * s, z, true);
          c.scale.setScalar(s * 0.85);
          g.add(c);
        }
        const hut = mesh(G.box, mat("#e7c79a"), R * 0.3, 0.55, R * 0.62 - 0.4, true);
        hut.scale.set(1.2, 0.9, 0.9);
        g.add(hut);
        const roof = mesh(G.roof, mat("#a0522d"), R * 0.3, 1.35, R * 0.62 - 0.4, true);
        roof.scale.set(1.0, 0.8, 0.8);
        roof.rotation.y = Math.PI / 4;
        g.add(roof);
      }
      rec.popT = 0.45;
    }

    /* ---------------- visitors ---------------- */
    const SHIRTS = ["#e85d4a", "#ffb703", "#3a86ff", "#8338ec", "#2a9d8f", "#fb5607", "#ff006e", "#06d6a0", "#ffffff"];
    const SKIN = ["#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffdbac"];
    const PANTS = ["#264653", "#3d405b", "#6d597a", "#1d3557", "#5c4033"];
    const visitors = [];
    let spawnTimer = 0, vId = 1;

    function makeVisitorMesh(kid) {
      const g = new THREE.Group();
      const shirt = mat(SHIRTS[Math.floor(Math.random() * SHIRTS.length)]);
      const pants = mat(PANTS[Math.floor(Math.random() * PANTS.length)]);
      const legs = [];
      for (const sx of [-0.08, 0.08]) {
        const hip = new THREE.Group();
        hip.position.set(sx, 0.42, 0);
        const leg = mesh(G.leg, pants, 0, -0.21, 0, true);
        hip.add(leg);
        g.add(hip);
        legs.push(hip);
      }
      const body = mesh(G.body, shirt, 0, 0.7, 0, true);
      g.add(body);
      const head = mesh(G.head, mat(SKIN[Math.floor(Math.random() * SKIN.length)]), 0, 1.13, 0, true);
      g.add(head);
      if (Math.random() < 0.35) g.add(mesh(G.hat, mat(SHIRTS[Math.floor(Math.random() * SHIRTS.length)]), 0, 1.28, 0, true));
      g.scale.setScalar(kid ? 0.9 : 1.3);
      g.userData.legs = legs;
      return g;
    }

    function spawnVisitor() {
      const kid = Math.random() < 0.3;
      const v = {
        id: vId++, x: rnd(-0.9, 0.9), z: L.spawnZ + rnd(0, 1.5), path: [], state: "entering",
        speed: rnd(1.6, 2.2) * (kid ? 1.15 : 1), views: 0, maxViews: 2 + Math.floor(Math.random() * 3),
        leaving: false, wait: 0, face: null, walkT: Math.random() * 10, rOff: rnd(-0.6, 0.6), dir: Math.random() < 0.5 ? -1 : 1,
        obj: null, dom: null, kid,
      };
      v.path.push({ x: v.x * 0.8, z: L.gateZ }, { x: v.x * 0.6, z: L.ringOut - 0.3 }, ringPoint(0.0 + v.x * 0.05, L.walkR + v.rOff));
      if (mode === "3d") { v.obj = makeVisitorMesh(kid); v.obj.position.set(v.x, 0, v.z); scene.add(v.obj); }
      else { v.dom = document.createElement("div"); v.dom.className = "zv-dot" + (kid ? " kid" : ""); v.dom.style.background = SHIRTS[v.id % SHIRTS.length]; spriteLayer.appendChild(v.dom); }
      visitors.push(v);
    }
    function ringPoint(th, r) { return polar(th, r); }
    function ringPath(fromTh, toTh, r) {
      const d = angDiff(fromTh, toTh), steps = Math.max(1, Math.ceil(Math.abs(d) / 0.14)), out = [];
      for (let k = 1; k <= steps; k++) out.push(polar(fromTh + (d * k) / steps, r));
      return out;
    }
    function removeVisitor(v) {
      if (v.obj) scene.remove(v.obj);
      if (v.dom) v.dom.remove();
      if (v.bubble) v.bubble.remove();
    }

    function planVisitor(v, info) {
      const th = Math.atan2(v.x, v.z), r = L.walkR + v.rOff;
      if (v.leaving || v.views >= v.maxViews) {
        v.state = "exiting";
        v.path = ringPath(th, 0, r).concat([{ x: v.x * 0.2 + rnd(-0.6, 0.6), z: L.ringOut }, { x: rnd(-0.9, 0.9), z: L.gateZ }, { x: rnd(-0.9, 0.9), z: L.spawnZ + 2 }]);
        return;
      }
      // pick an enclosure: busier, happier enclosures attract more people
      let total = 0;
      const w = info.pens.map((p, i) => {
        const vis = p.animals.filter((a) => !a.hidden && a.uid !== info.escapingUid).length;
        const x = p.built ? (vis ? 1 + vis * 1.5 + (p.qol || 0) : 0.15) : 0.03;
        total += x;
        return x;
      });
      let r0 = Math.random() * total, target = 0;
      for (let i = 0; i < w.length; i++) { r0 -= w[i]; if (r0 <= 0) { target = i; break; } }
      const pth = penAngle(target) + rnd(-0.09, 0.09);
      v.target = target;
      v.state = "toPen";
      v.path = ringPath(th, pth, r).concat([polar(pth, L.viewR + rnd(-0.25, 0.2))]);
    }

    function updateVisitors(dt, info, paused) {
      const want = info.visitorTarget;
      const active = visitors.filter((v) => !v.leaving).length;
      if (active > want) {
        let extra = active - want;
        for (const v of visitors) { if (extra <= 0) break; if (!v.leaving) { v.leaving = true; extra--; } }
      }
      spawnTimer -= dt;
      if (!paused && active < want && spawnTimer <= 0 && visitors.length < 60) { spawnVisitor(); spawnTimer = rnd(0.25, 0.7); }
      for (let i = visitors.length - 1; i >= 0; i--) {
        const v = visitors[i];
        let moving = false;
        if (!paused) {
          if (v.wait > 0) {
            v.wait -= dt;
            if (v.wait <= 0) { v.views++; v.state = "back"; v.path = [polar(Math.atan2(v.x, v.z), L.walkR + v.rOff)]; }
          } else if (v.path.length) {
            const t = v.path[0], dx = t.x - v.x, dz = t.z - v.z, d = Math.hypot(dx, dz), step = v.speed * dt;
            if (d <= step) { v.x = t.x; v.z = t.z; v.path.shift(); } else { v.x += (dx / d) * step; v.z += (dz / d) * step; }
            v.face = Math.atan2(dx, dz);
            moving = true;
          } else if (v.state === "toPen") {
            v.state = "viewing";
            v.wait = rnd(2.2, 4.8);
            const c = polar(penAngle(v.target), L.penR);
            v.face = Math.atan2(c.x - v.x, c.z - v.z);
            const p = info.pens[v.target];
            const vis = p.animals.filter((a) => !a.hidden && a.uid !== info.escapingUid);
            if (vis.length && Math.random() < 0.45) {
              const avg = vis.reduce((t, a) => t + a.happiness, 0) / vis.length;
              bubble(v, avg >= 65 ? "❤️" : avg < 35 ? "😕" : "📸");
            } else if (p.built && !vis.length && Math.random() < 0.3) bubble(v, "🤷");
          } else if (v.state === "exiting") {
            removeVisitor(v); visitors.splice(i, 1); continue;
          } else planVisitor(v, info);
        }
        v.walkT += moving ? dt * 9 : 0;
        if (v.obj) {
          v.obj.position.set(v.x, moving ? Math.abs(Math.sin(v.walkT)) * 0.05 : 0, v.z);
          if (v.face != null) v.obj.rotation.y = v.face;
          const sw = moving ? Math.sin(v.walkT) * 0.6 : 0;
          v.obj.userData.legs[0].rotation.x = sw;
          v.obj.userData.legs[1].rotation.x = -sw;
        }
      }
    }
    function bubble(v, emoji) {
      if (v.bubble) v.bubble.remove();
      const b = document.createElement("div");
      b.className = "zv-bubble";
      b.textContent = emoji;
      labelLayer.appendChild(b);
      v.bubble = b;
      v.bubbleT = 2.2;
    }

    /* ---------------- line at the entrance (turned-away visitors) ---------------- */
    const queue = [];
    function updateQueue(dt, n, paused) {
      while (queue.length < n) {
        const q = { k: queue.length, t: Math.random() * 10, kid: Math.random() < 0.3 };
        const p = queuePos(q.k);
        if (mode === "3d") { q.obj = makeVisitorMesh(q.kid); q.obj.position.set(p.x, 0, p.z); q.obj.rotation.y = Math.PI; scene.add(q.obj); }
        else { q.dom = document.createElement("div"); q.dom.className = "zv-dot" + (q.kid ? " kid" : ""); q.dom.style.background = SHIRTS[(queue.length * 3) % SHIRTS.length]; spriteLayer.appendChild(q.dom); }
        q.x = p.x; q.z = p.z;
        queue.push(q);
      }
      while (queue.length > n) { const q = queue.pop(); if (q.obj) scene.remove(q.obj); if (q.dom) q.dom.remove(); }
      queue.forEach((q) => {
        if (!paused) q.t += dt;
        if (q.obj) {
          q.obj.position.y = Math.max(0, Math.sin(q.t * 2.2)) * 0.04;          // shifting from foot to foot
          q.obj.rotation.y = Math.PI + Math.sin(q.t * 0.7) * 0.25;            // looking around impatiently
        }
      });
    }
    function queuePos(k) {
      // a snaking line outside the gate, just past the ticket booths
      const row = Math.floor(k / 7), col = k % 7;
      return { x: (row % 2 ? -1 : 1) * 0.55, z: L.gateZ + 3.4 + col * 0.8 + row * 0.15 };
    }
    function setGateLevel(n) {
      if (n === gateLevelShown) return;
      gateLevelShown = n;
      gateBooths.forEach((b, k) => (b.visible = k < n));
      gateLanes.forEach((l, k) => (l.visible = k <= n));
    }

    /* ---------------- animals (picture cut-outs) ---------------- */
    const animals = new Map(); // uid -> { x, z, tx, tz, wait, dom, img, pen, bornT }
    function syncAnimals(info, dt, paused) {
      const seen = new Set();
      info.pens.forEach((p, i) => {
        const R = L.penSize[(p.cap || 1) - 1] - 0.85;
        const c = polar(penAngle(i), L.penR);
        p.animals.forEach((a) => {
          seen.add(a.uid);
          let s = animals.get(a.uid);
          if (!s) {
            const dom = document.createElement("div");
            dom.className = "zv-animal";
            dom.dataset.uid = a.uid;
            dom.addEventListener("pointerenter", (e) => onHover("animal", a.uid, e.clientX, e.clientY));
            dom.addEventListener("pointermove", (e) => onHover("animal", a.uid, e.clientX, e.clientY));
            dom.addEventListener("pointerleave", () => onHover(null));
            dom.addEventListener("click", () => { const st = animals.get(a.uid); if (st) onPenClick(st.pen); });
            spriteLayer.appendChild(dom);
            s = { x: c.x, z: c.z, tx: c.x, tz: c.z, wait: rnd(0, 1), dom, imgKey: null, born: 0.5, phase: Math.random() * TAU };
            animals.set(a.uid, s);
          }
          s.pen = i; s.speciesId = a.speciesId; s.hidden = a.hidden; s.happy = a.happiness;
          const sp = byId[a.speciesId];
          const url = getImg(a.speciesId);
          const key = (url || "") + sp.emoji;
          if (s.imgKey !== key) {
            s.imgKey = key;
            s.dom.innerHTML = url ? '<img alt="" src="' + esc(url) + '">' : '<span class="e">' + esc(sp.emoji) + "</span>";
            s.dom.title = sp.name;
          }
          const escaping = a.uid === info.escapingUid;
          s.escaping = escaping;
          if (paused) return;
          if (s.born > 0) s.born = Math.max(0, s.born - dt);
          if (escaping) {
            // runs laps around the plaza until it is caught
            const th = Math.atan2(s.x, s.z), r = Math.hypot(s.x, s.z);
            const goal = polar(th + 0.9, L.walkR - 0.4);
            if (r > L.ringOut + 0.5) { s.tx = goal.x; s.tz = goal.z; }
            else { s.tx = goal.x; s.tz = goal.z; }
            s.wait = 0;
            move(s, 3.2, dt);
            return;
          }
          const dx = s.x - c.x, dz = s.z - c.z;
          if (Math.hypot(dx, dz) > R + 0.3) { s.tx = c.x; s.tz = c.z; move(s, 3.2, dt); return; } // walk home
          if (s.wait > 0) { s.wait -= dt; return; }
          if (move(s, 0.75, dt)) {
            const ang = Math.random() * TAU, rr = Math.sqrt(Math.random()) * R;
            s.tx = c.x + Math.sin(ang) * rr; s.tz = c.z + Math.cos(ang) * rr;
            s.wait = rnd(0.8, 3.5);
          }
        });
      });
      for (const [uid, s] of animals) if (!seen.has(uid)) { s.dom.remove(); animals.delete(uid); }
    }
    function move(s, speed, dt) {
      const dx = s.tx - s.x, dz = s.tz - s.z, d = Math.hypot(dx, dz), st = speed * dt;
      s.moving = d > 0.01;
      if (s.moving) s.flip = dx < 0;
      if (d <= st) { s.x = s.tx; s.z = s.tz; s.moving = false; return true; }
      s.x += (dx / d) * st; s.z += (dz / d) * st;
      return false;
    }

    /* ---------------- labels ---------------- */
    const labels = [];
    let gateLabel = null;
    function buildLabels() {
      for (let i = 0; i < SLOTS - 1; i++) {
        const el = document.createElement("button");
        el.className = "zv-label";
        el.dataset.pen = i;
        el.addEventListener("click", (e) => { e.stopPropagation(); onPenClick(i); });
        el.addEventListener("pointerenter", (e) => { setHover(i); onHover("pen", i, e.clientX, e.clientY); });
        el.addEventListener("pointermove", (e) => onHover("pen", i, e.clientX, e.clientY));
        el.addEventListener("pointerleave", () => { setHover(-1); onHover(null); });
        labelLayer.appendChild(el);
        labels.push({ el, sig: "" });
      }
      gateLabel = document.createElement("div");
      gateLabel.className = "zv-gate";
      gateLabel.innerHTML = "🎟️ Entrance";
      gateLabel.addEventListener("pointerenter", (e) => onHover("gate", null, e.clientX, e.clientY));
      gateLabel.addEventListener("pointermove", (e) => onHover("gate", null, e.clientX, e.clientY));
      gateLabel.addEventListener("pointerleave", () => onHover(null));
      gateLabel.addEventListener("click", () => onGateClick());
      labelLayer.appendChild(gateLabel);
    }
    function labelHtml(i, p, info) {
      if (!p.built) return { cls: "site", html: "<b>🔨 Build</b><small>" + (info.buildCost != null ? "$" + Number(info.buildCost).toLocaleString("en-US") : "max") + "</small>" };
      if (!p.speciesId) return { cls: "empty", html: "<b>＋ Empty</b><small>" + "🐾".repeat(1) + " " + p.cap + " · " + (p.qol ? "🌿" + p.qol : "comfort 0") + "</small>" };
      const sp = byId[p.speciesId];
      const vis = p.animals.length;
      const avg = vis ? p.animals.reduce((t, a) => t + a.happiness, 0) / vis : 0;
      const col = avg > 60 ? "#2f7d4f" : avg > 30 ? "#e0a100" : "#d64532";
      const hid = p.animals.some((a) => a.hidden) ? " 🙈" : "";
      return {
        cls: "full",
        html: "<b>" + esc(sp.emoji + " " + sp.name) + hid + "</b><small>🐾 " + vis + "/" + p.cap + (p.qol ? " · 🌿" + p.qol : "") + "</small>" +
          '<span class="hb"><span style="width:' + Math.round(avg) + "%;background:" + col + '"></span></span>',
      };
    }

    /* ---------------- projection ---------------- */
    const tmpV = typeof THREE !== "undefined" ? new THREE.Vector3() : null;
    let flatScale = 10, flatCx = 0, flatCy = 0;
    function project(x, y, z) {
      if (mode === "3d") {
        tmpV.set(x, y, z).project(camera);
        return { x: (tmpV.x * 0.5 + 0.5) * width, y: (-tmpV.y * 0.5 + 0.5) * height, d: tmpV.z, vis: tmpV.z < 1 && tmpV.z > -1 };
      }
      return { x: flatCx + x * flatScale, y: flatCy + z * flatScale * 0.82 - y * flatScale * 0.55, d: 0.5 - z * 0.001, vis: true };
    }

    /* ---------------- flat fallback ---------------- */
    function initFlat() {
      mode = "flat";
      container.classList.add("flat");
      flatEls = document.createElement("div");
      flatEls.className = "zv-flat";
      flatEls.innerHTML = '<div class="zv-f-ground"></div><div class="zv-f-plaza"></div><div class="zv-f-fountain">⛲</div><div class="zv-f-path"></div>';
      for (let i = 0; i < SLOTS - 1; i++) {
        const d = document.createElement("div");
        d.className = "zv-f-pen";
        d.dataset.pen = i;
        d.addEventListener("click", () => onPenClick(i));
        d.addEventListener("pointermove", (e) => onHover("pen", i, e.clientX, e.clientY));
        d.addEventListener("pointerleave", () => onHover(null));
        flatEls.appendChild(d);
      }
      container.appendChild(flatEls);
    }
    function layoutFlat(info) {
      flatScale = Math.min(width / 46, height / 40);
      flatCx = width / 2; flatCy = height / 2 - flatScale * 1.5;
      const S = flatScale;
      const place = (el, x, z, w, h) => {
        const p = project(x, 0, z);
        Object.assign(el.style, { left: p.x - (w * S) / 2 + "px", top: p.y - (h * S * 0.82) / 2 + "px", width: w * S + "px", height: h * S * 0.82 + "px" });
      };
      place(flatEls.children[0], 0, 0, L.ground * 2, L.ground * 2);
      place(flatEls.children[1], 0, 0, L.ringOut * 2, L.ringOut * 2);
      place(flatEls.children[2], 0, 0, 4.6, 4.6);
      flatEls.children[2].style.fontSize = S * 3 + "px";
      const pth = flatEls.children[3], a = project(0, 0, L.ringOut), b = project(0, 0, L.ground);
      Object.assign(pth.style, { left: a.x - S * 1.4 + "px", top: a.y + "px", width: S * 2.8 + "px", height: b.y - a.y + "px" });
      info.pens.forEach((p, i) => {
        const el = flatEls.children[4 + i], c = polar(penAngle(i), L.penR), R = p.built ? L.penSize[p.cap - 1] : L.penSize[0];
        place(el, c.x, c.z, R * 2, R * 2);
        el.className = "zv-f-pen" + (p.built ? (p.speciesId ? " full" : " empty") : " site") + " q" + (p.qol || 0);
        el.style.background = p.built && p.speciesId ? byId[p.speciesId]._habitat : "";
      });
    }

    /* ---------------- input: orbit, zoom, click ---------------- */
    const pointers = new Map();
    let dragMoved = 0, pinch0 = 0, hoverPen = -1;
    function bindInput() {
      const el = canvas;
      el.addEventListener("pointerdown", (e) => {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        el.setPointerCapture(e.pointerId);
        dragMoved = 0;
        if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); }
      });
      el.addEventListener("pointermove", (e) => {
        const p = pointers.get(e.pointerId);
        if (!p) { hover(e); return; }
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        dragMoved += Math.abs(dx) + Math.abs(dy);
        if (pointers.size === 1) {
          cam.az -= dx * 0.006;
          cam.el = Math.max(0.42, Math.min(1.35, cam.el + dy * 0.004));
        } else if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinch0) cam.dist = Math.max(24, Math.min(64, cam.dist * (pinch0 / d)));
          pinch0 = d;
        }
      });
      const up = (e) => {
        if (pointers.has(e.pointerId) && pointers.size === 1 && dragMoved < 7) {
          const i = pick(e);
          if (i >= 0) onPenClick(i);
        }
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinch0 = 0;
      };
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", (e) => { pointers.delete(e.pointerId); pinch0 = 0; });
      el.addEventListener("pointerleave", () => { setHover(-1); onHover(null); });
      el.addEventListener("wheel", (e) => {
        e.preventDefault();
        cam.dist = Math.max(24, Math.min(64, cam.dist * (e.deltaY > 0 ? 1.08 : 0.93)));
      }, { passive: false });
    }
    function pick(e) {
      const r = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(pens.map((p) => p.hit), false);
      return hits.length ? hits[0].object.userData.pen : -1;
    }
    let hoverT = 0;
    function hover(e) {
      const now = performance.now();
      if (now - hoverT < 60) return;
      hoverT = now;
      const i = pick(e);
      setHover(i);
      onHover(i >= 0 ? "pen" : null, i, e.clientX, e.clientY);
    }
    function setHover(i) {
      if (i === hoverPen) return;
      hoverPen = i;
      if (canvas) canvas.style.cursor = i >= 0 ? "pointer" : "grab";
      labels.forEach((l, k) => l.el.classList.toggle("hover", k === i));
    }

    /* ---------------- frame ---------------- */
    let lastInfo = null, time = 0, selected = -1;
    function resize() {
      const r = container.getBoundingClientRect();
      width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
      if (renderer) { renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }
    }
    function updateCamera() {
      // pull back a little on tall/narrow screens so the whole circle fits
      const fit = Math.max(1, 1.3 / (width / height));
      const d = cam.dist * fit;
      camera.position.set(cam.target.x + Math.sin(cam.az) * Math.cos(cam.el) * d, cam.target.y + Math.sin(cam.el) * d, cam.target.z + Math.cos(cam.az) * Math.cos(cam.el) * d);
      camera.lookAt(cam.target.x, cam.target.y, cam.target.z);
      scene.fog.near = d + 12; scene.fog.far = d + 60; // keep the haze behind the zoo, however far the camera is
    }

    function adaptQuality(dt) {
      if (!renderer || perf.level >= 2 || opts.fixedQuality) return;
      perf.t += dt; perf.frames++;
      if (perf.t < 3) return;
      const fps = perf.frames / perf.t;
      perf.t = 0; perf.frames = 0;
      if (fps >= 28) return;
      perf.level++;
      if (perf.level === 1) {
        renderer.shadowMap.enabled = false;
        scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
        renderer.setPixelRatio(1);
        resize();
      } else perf.maxVisitors = 18;
      console.info("ZooSnap: lowered 3D quality to keep the game smooth (level " + perf.level + ", " + fps.toFixed(0) + " fps)");
    }

    function frame(dt, info, paused) {
      lastInfo = info;
      time += dt;
      adaptQuality(dt);
      if (info.visitorTarget > perf.maxVisitors) info.visitorTarget = perf.maxVisitors;
      if (mode === "3d") {
        setGateSign(info.zooName);
        info.pens.forEach((p, i) => {
          const sig = penSig(p);
          if (pens[i].sig !== sig) { const first = !pens[i].sig; pens[i].sig = sig; rebuildPen(i, p); if (first) pens[i].popT = 0; }
          const rec = pens[i];
          if (rec.popT > 0) { rec.popT = Math.max(0, rec.popT - dt); const k = rec.popT / 0.45; rec.group.scale.setScalar(1 + Math.sin(k * Math.PI) * 0.07); }
          else rec.group.scale.setScalar(1);
          rec.hit.material.visible = false;
        });
        if (!paused) {
          // fountain
          const pos = fountainSpray.geometry.attributes.position, drops = fountainSpray.userData.drops;
          for (let k = 0; k < drops.length; k++) {
            const d = drops[k];
            d.vy -= 6 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
            if (d.y < 0.62) newDrop(d, false);
            pos.setXYZ(k, d.x, d.y, d.z);
          }
          pos.needsUpdate = true;
          ripples.forEach((r) => {
            r.userData.t = (r.userData.t + dt * 0.45) % 1;
            const t = r.userData.t;
            r.scale.setScalar(0.4 + t * 1.55);
            r.material.opacity = 0.6 * (1 - t);
          });
          flags.forEach((o) => { o.rotation.y = Math.sin(time * 3 + o.position.x) * 0.35; });
        }
        updateCamera();
      } else layoutFlat(info);

      if (mode === "3d") setGateLevel(info.gateLevel || 0);
      updateQueue(dt, info.queue || 0, paused);
      updateVisitors(dt, info, paused);
      syncAnimals(info, dt, paused);
      if (renderer) renderer.render(scene, camera);
      place2D(info);
    }

    function place2D(info) {
      // labels above each enclosure
      info.pens.forEach((p, i) => {
        const c = polar(penAngle(i), L.penR), R = p.built ? L.penSize[p.cap - 1] : L.penSize[0];
        let pr;
        if (mode === "3d") {
          // sit the label above the far side of the fence so it never covers the animals
          const dx = c.x - camera.position.x, dz = c.z - camera.position.z, d = Math.hypot(dx, dz) || 1;
          pr = project(c.x + (dx / d) * R * 0.95, 1.5, c.z + (dz / d) * R * 0.95);
        } else pr = project(c.x, 0, c.z - R * 1.05);
        const lab = labels[i], h = labelHtml(i, p, info);
        const sig = h.cls + h.html;
        if (lab.sig !== sig) { lab.sig = sig; lab.el.innerHTML = h.html; lab.el.className = "zv-label " + h.cls + (i === hoverPen ? " hover" : "") + (i === selected ? " sel" : ""); }
        lab.el.style.transform = "translate(" + Math.round(pr.x) + "px," + Math.round(pr.y) + "px) translate(-50%,-100%)";
        lab.el.style.display = pr.vis ? "" : "none";
      });
      const g = project(0, mode === "3d" ? 6.3 : 0, mode === "3d" ? L.gateZ : L.gateZ + 1);
      gateLabel.style.transform = "translate(" + Math.round(g.x) + "px," + Math.round(g.y) + "px) translate(-50%,-100%)";
      const gtxt = info.queue > 0 ? "🚧 Zoo full! Line at the entrance" : "🎟️ Entrance · " + info.inside + "/" + info.gateCap + " inside";
      if (gateLabel.textContent !== gtxt) gateLabel.textContent = gtxt;
      gateLabel.classList.toggle("jam", info.queue > 0);
      queue.forEach((q) => {
        if (!q.dom) return;
        const b = project(q.x, 0, q.z);
        q.dom.style.transform = "translate(" + Math.round(b.x - 4) + "px," + Math.round(b.y - 9) + "px)";
      });
      // animal cut-outs: size from perspective, sorted by depth
      for (const s of animals.values()) {
        if (s.hidden) { s.dom.style.display = "none"; continue; }
        s.dom.style.display = "";
        const base = project(s.x, 0.12, s.z), top = project(s.x, 2.7, s.z);
        const size = Math.max(14, Math.abs(base.y - top.y));
        const bob = s.moving ? Math.abs(Math.sin(time * 9 + s.phase)) * size * 0.08 : Math.sin(time * 2 + s.phase) * size * 0.02;
        const pop = s.born > 0 ? 1 - s.born / 0.5 : 1;
        const scale = pop < 1 ? 0.3 + 0.7 * (1 - Math.pow(1 - pop, 3)) + Math.sin(pop * Math.PI) * 0.15 : 1;
        s.dom.style.width = s.dom.style.height = size + "px";
        s.dom.style.fontSize = size * 0.82 + "px";
        s.dom.style.transform = "translate(" + Math.round(base.x - size / 2) + "px," + Math.round(base.y - size - bob) + "px) scale(" + (s.flip ? -scale : scale) + "," + scale + ")";
        s.dom.style.zIndex = String(1000 - Math.round(base.d * 900));
        s.dom.classList.toggle("escaping", !!s.escaping);
        s.dom.classList.toggle("sad", s.happy < 35);
      }
      for (const v of visitors) {
        const p = project(v.x, 1.9 * (v.kid ? 0.7 : 1), v.z);
        if (v.dom) {
          const b = project(v.x, 0, v.z);
          v.dom.style.transform = "translate(" + Math.round(b.x - 4) + "px," + Math.round(b.y - 9) + "px)";
          v.dom.style.zIndex = String(1000 - Math.round(b.d * 900));
        }
        if (v.bubble) {
          v.bubbleT -= 1 / 60;
          if (v.bubbleT <= 0) { v.bubble.remove(); v.bubble = null; continue; }
          v.bubble.style.transform = "translate(" + Math.round(p.x) + "px," + Math.round(p.y - (2.2 - v.bubbleT) * 10) + "px) translate(-50%,-100%)";
          v.bubble.style.opacity = Math.min(1, v.bubbleT * 2);
        }
      }
    }

    /* ---------------- public api ---------------- */
    container.appendChild(spriteLayer);
    container.appendChild(labelLayer);
    const ok3d = init3D();
    if (!ok3d) initFlat(); else bindInput();
    buildLabels();
    resize();
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(resize).observe(container);
    else window.addEventListener("resize", resize);

    return {
      mode: () => mode,
      frame,
      resize,
      resetView() { Object.assign(cam, CAM0); },
      select(i) { selected = i; labels.forEach((l, k) => { l.el.classList.toggle("sel", k === i); }); },
      clearVisitors() { visitors.splice(0).forEach(removeVisitor); queue.splice(0).forEach((q) => { if (q.obj) scene.remove(q.obj); if (q.dom) q.dom.remove(); }); for (const s of animals.values()) s.dom.remove(); animals.clear(); },
      visitorCount: () => visitors.length,
      debug: () => ({ queue: queue.length, gateLevel: gateLevelShown, booths: gateBooths.filter((b) => b.visible).length, quality: perf.level, mode, visitors: visitors.length, animals: animals.size, cam: Object.assign({}, cam), states: visitors.reduce((m, v) => ((m[v.state] = (m[v.state] || 0) + 1), m), {}) }),
      projectPen(i) { const c = polar(penAngle(i), L.penR); const r = container.getBoundingClientRect(); const p = project(c.x, 0.5, c.z); return { x: r.left + p.x, y: r.top + p.y }; },
      pickAt(clientX, clientY) { return mode === "3d" ? pick({ clientX, clientY }) : -1; },
    };
  }

  window.Zoo3D = { create, SLOTS };
})();
