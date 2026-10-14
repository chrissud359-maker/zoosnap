/* =====================================================================
   ZOOSNAP TYCOON - MODEL PACKING HELPERS
   Turns a Teachable Machine export (the .zip, or model.json +
   metadata.json + weights.bin) into one "pack" object, and loads a pack
   into a working model. Packing lets the game run by double-clicking
   index.html (browsers block loading model files directly from disk).
   ===================================================================== */
(function () {
  "use strict";

  function toBase64(bytes) {
    let s = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(s);
  }
  function fromBase64(b64) {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  const base = (p) => String(p).split("/").pop();

  // files: FileList/array of File objects (a TM .zip, or the 3 exported files)
  async function filesToPack(files) {
    files = Array.from(files || []);
    const entries = {}; // basename -> {text(), bytes()}
    for (const f of files) {
      if (/\.zip$/i.test(f.name)) {
        if (!window.JSZip) throw new Error("ZIP support failed to load (lib/jszip.min.js).");
        const zip = await JSZip.loadAsync(f);
        const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir && !/__MACOSX/.test(n));
        for (const n of names) {
          const zf = zip.files[n];
          entries[base(n)] = { text: () => zf.async("string"), bytes: () => zf.async("uint8array") };
        }
      } else {
        entries[base(f.name)] = {
          text: () => f.text(),
          bytes: async () => new Uint8Array(await f.arrayBuffer()),
        };
      }
    }
    if (!entries["model.json"]) throw new Error("Couldn't find model.json. Choose the .zip from Teachable Machine (Export > Tensorflow.js > Download) or all three files.");
    if (!entries["metadata.json"]) throw new Error("Couldn't find metadata.json. Choose the .zip from Teachable Machine, or select all three files together.");
    const modelJson = await entries["model.json"].text();
    const metadataJson = await entries["metadata.json"].text();
    let model, meta;
    try { model = JSON.parse(modelJson); } catch (e) { throw new Error("model.json is not valid JSON."); }
    try { meta = JSON.parse(metadataJson); } catch (e) { throw new Error("metadata.json is not valid JSON."); }
    if (!model.modelTopology || !model.weightsManifest) throw new Error("model.json doesn't look like a Teachable Machine image model.");
    if (!Array.isArray(meta.labels) || !meta.labels.length) throw new Error("metadata.json has no class labels.");
    const weights = [];
    for (const group of model.weightsManifest) {
      for (const p of group.paths) {
        const name = base(p);
        if (!entries[name]) throw new Error("Missing weights file '" + name + "'. Select it too, or use the .zip.");
        weights.push({ name, base64: toBase64(await entries[name].bytes()) });
      }
    }
    return { format: "zoosnap-model-pack-1", packedAt: new Date().toISOString(), labels: meta.labels, modelJson, metadataJson, weights };
  }

  function packToScript(pack) {
    return "/* Packed Teachable Machine model for ZooSnap Tycoon. Classes: " +
      pack.labels.join(", ").replace(/\*\//g, "") + " */\nwindow.ZOO_MODEL_PACK = " + JSON.stringify(pack) + ";\n";
  }

  async function loadPack(pack) {
    if (!pack || pack.format !== "zoosnap-model-pack-1") throw new Error("model-pack.js is not a valid ZooSnap model pack.");
    const files = [new File([pack.modelJson], "model.json", { type: "application/json" })];
    pack.weights.forEach((w) => files.push(new File([fromBase64(w.base64)], w.name, { type: "application/octet-stream" })));
    const layersModel = await tf.loadLayersModel(tf.io.browserFiles(files));
    return new tmImage.CustomMobileNet(layersModel, JSON.parse(pack.metadataJson));
  }

  window.ZooModelPack = { filesToPack, packToScript, loadPack };
})();
