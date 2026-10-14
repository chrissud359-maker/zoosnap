# ZooSnap Tycoon

A zoo tycoon browser game for AI & Society, set in a **3D circular zoo**: enclosures ring a central fountain, visitors stream in through the entrance gate and walk around to look at your animals. You adopt animals by holding a **photo of the animal on your phone** up to the webcam. A Teachable Machine image model that our group trained recognizes the species, and that animal joins your zoo. The model also decides events: when an animal escapes or a visitor asks to see one, you have to show the right photo before time runs out.

**Goal:** welcome 3,500 visitors in 8 days (each day is 30 seconds, about 5 minutes in all) without going bankrupt. There are six endings.

### What's in the game
- **Objective screen:** before day 1, a briefing explains the goal and controls. The clock doesn't start until you press **Open Day 1**, so you can adopt your first animals first.
- **Night break:** after each day the zoo closes, the scene dims, visitors go home and a summary shows the day's results and what happens tomorrow. The clock stays stopped while you adopt, upgrade and shop. Press **Open Day N** (or <kbd>Enter</kbd>) to continue.
- **3D zoo:** six enclosure sites around a fountain, a marked entrance gate, and little 3D visitors. The number of visitors follows your real visitor rate. They walk to the enclosures they like best, stop to look, and show ❤️ / 😕 / 📸 depending on how happy the animals are. Drag to spin, scroll or pinch to zoom.
- **Enclosures:** each holds one species. Click one to open its panel:
  - **🐾 Capacity** (fence size 1 → 2 → 3): more animals of that species.
  - **🌿 Comfort** (★☆ → ★★): pond, rocks, trees and a shelter appear. Animals lose happiness 35% / 70% slower and draw 15% / 30% more visitors.
  - **📷 Snap to adopt here**, or **🔨 Build** on an empty plot.
- **🎟️ Total visitor capacity:** the zoo can only hold so many people at once (60 at the start). When it's full, a line forms outside the gate and new arrivals are turned away until others leave. Buy **Bigger entrance** in the shop to raise capacity (60 → 100 → 150 → 225); new ticket booths and turnstiles appear at the gate. You can't reach the goal without it.
- **Hover pop-ups:** hover over anything interactive (enclosures, animals, stats, shop items, upgrade buttons, event choices) to see exactly what it does and what it costs.
- Shop: new enclosures, bigger entrance, snack stand, ads, animal treats. Events: escapes, photo requests and six choice events. When an animal escapes, you can see it running loose around the fountain.

---

## How to open and play (classmates and grader)

1. Unzip the folder.
2. Double-click **`index.html`**. Chrome or Edge works best. No internet or install is needed.
3. Type a zoo name, click **Open the gates!**, and click **Allow** when the browser asks for the camera.
4. Open the animal photos from the **`photos/`** folder on your phone (or print them). Click **📷 Snap to Adopt** and hold a photo up to the camera until the yellow bar fills.

- No camera? Click **Play without a camera** and pick animals from buttons instead.
- **P** pauses. **M** mutes. The 🎵 and 🔊 buttons control music and sound.

---

## Tonight's checklist (our group)

### 1. Pick the 6 animals → `config.js`
For each of the 6 slots, change `id`, `className`, `name`, `emoji` and (optionally) the enclosure ground color `habitat`. Keep the numbers; each slot is a different role (star attraction, cheap crowd-pleaser, escape artist, and so on). You can also rewrite the `trait` text.
- `className` must match the Teachable Machine class name (capital letters and spaces don't matter).
- `id` is the file name for that animal's image and sound (lowercase, no spaces).

### 2. Make the animal photos
Put 2–3 different photos of each animal in one phone album. Tip: use the AI-generated animal portraits from `PROMPTS.md` as the photos, so the cards in the game match what players hold up. Copy the photos into a `photos/` folder in this project so testers can use them too.

### 3. Train the model (teachablemachine.withgoogle.com)
1. **Get Started → Image Project → Standard image model.**
2. Make **7 classes**, named exactly like the `className`s in `config.js`, plus one called **`Nothing`**.
3. For each animal, click **Webcam** and **hold to record** about 150–300 samples of the phone showing that animal's photos. While recording, move the phone closer and farther, tilt it a little, and switch between the photos. Turn screen brightness all the way up.
4. For **Nothing**, record about 300 samples of: just your face, the empty background, your hand, and the phone showing its lock screen or a non-animal photo. *This is important.* It teaches the model to recognize the animal, not just "a phone is here".
5. Click **Train Model**. Then test in **Preview** with a different person, different lighting and the other photos. If one animal gets confused, add more samples of it and retrain.
6. **Export Model → Tensorflow.js → Download → Download my model.** You get a `.zip`.

### 4. Put the model in the game
Open **`pack-model.html`** (double-click it), drop in the `.zip`, click **Download model-pack.js**, and save that file into the **`model/`** folder. Then open `index.html`. The title screen should say *Model ready*.
> If the title screen shows a yellow warning about class names, the names in `config.js` don't match the model. Fix the spelling and reload.

*Alternative:* in Teachable Machine, click **Upload my model**, copy the link, and paste it as `MODEL_URL` in `config.js`. This needs internet during play.

### 5. Generate the media → `assets/`
Use **`PROMPTS.md`**. It has ready-to-paste prompts and the exact file names. Images can be `.png`, `.jpg` or `.webp`, and audio can be `.mp3` or `.wav`. Any file you skip just falls back to emoji or silence, so the game never breaks. For full credit, include at least the 6 animal images, the music and the narration. Generated text is already in `text.js`; feel free to rewrite it.

### 6. Test on another computer, then submit
Have someone who didn't build it unzip the folder and play a full game. Then zip the **whole folder** (including `model/`, `assets/`, `photos/` and `lib/`) and upload it with the notes below.

---

## How the ML affects the game
- **Adopting:** whatever animal the model recognizes is the animal you can adopt, and it moves into an enclosure (one with that species and room, or an empty one). Each species has a different cost, appeal, upkeep and special trait.
- **Escapes (days 4 and 7):** an animal breaks out. Show *that* animal within 20 seconds. If you show the wrong animal, the game tells you what it saw. If you miss, the animal hides for a day and you lose money and reputation.
- **Photo requests (days 2 and 6):** a visitor asks to see an animal. The right photo within 15 seconds earns +$150 and reputation.
- **Retrying:** an animal only "locks in" after the model is at least 85% sure for 0.7 seconds, so a shaky guess never counts. Players can keep trying, and live confidence bars show what the model sees. After 9 seconds without a lock, a tip appears (brightness, glare, distance). You can change `CONFIDENCE` and `HOLD_MS` in `config.js`.

## Troubleshooting
| Problem | Fix |
|---|---|
| "No model loaded" | Make `model/model-pack.js` with `pack-model.html` (step 4). |
| "Camera unavailable" | Click the camera icon in the address bar → Allow, then click Open the gates again. Close other apps using the camera (Zoom, Teams). |
| Wrong animal keeps locking in | Add more varied samples for both animals and for **Nothing**, retrain, and re-pack. Or raise `CONFIDENCE` to 0.9. |
| Never locks in | Brighter screen, fill the camera with the photo, avoid lights behind you, or lower `CONFIDENCE` to 0.75. |
| Want it as a web link | Upload the folder to GitHub Pages or Netlify Drop. It works there as-is. |
| 3D zoo is slow | The game lowers 3D detail automatically on slow computers. Closing other tabs helps. If the browser has no 3D support at all, a flat top-down map is used instead. |

## Files
`index.html` game page · `config.js` animals and model settings · `text.js` all game text · `sim.js` game rules · `game.js` screens, camera, audio and hover pop-ups · `zoo3d.js` the 3D zoo · `modelpack.js` + `pack-model.html` model packer · `lib/` TensorFlow.js 1.3.1, Teachable Machine 0.8.5, Three.js r159, JSZip 3.10.1 (local copies so it works offline) · `assets/` generated media · `model/` trained model.

---

## Submission notes (copy, then fill in the brackets)

**Game:** ZooSnap Tycoon, a 3D zoo tycoon game. Unzip and double-click `index.html` in Chrome, allow the camera, and hold the photos from `photos/` up to the webcam. (No camera: click "Play without a camera".)

**Group members:** [names]

**Apps used:** Teachable Machine (trained image model); Claude by Anthropic (game text and narration scripts; also helped write the code); [image app, e.g. ChatGPT / Gemini / Adobe Firefly] (animal, title and ending art); [audio app, e.g. ElevenLabs] (narration and sound effects); [music app, e.g. Suno] (background music).

**What our model recognizes and how it affects the game:** We trained a Teachable Machine image model to recognize six animals ([list]) shown as photos on a phone, plus a "Nothing" class. The recognized animal is the one the player can adopt and the enclosure it moves into. Each species has different costs and traits, so the model's prediction decides what your zoo becomes. During escape and photo-request events, the player must show the correct animal before a timer runs out, and success or failure changes money, reputation and whether the animal stays on display. A prediction only counts after 85% confidence for 0.7 seconds. Wrong animals show feedback, and players can retry until the timer ends.

**Credits:** Game code written for this project with help from Claude (Anthropic). [It does not use The Clockwork Garden example code / or: adapted ideas from The Clockwork Garden example]. TensorFlow.js and Teachable Machine library (Google, Apache 2.0), Three.js (MIT), JSZip (MIT), Fredoka font (Google Fonts, OFL). [Credit any other outside material.]
