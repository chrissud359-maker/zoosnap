# Media prompts for ZooSnap Tycoon

Paste these into your GenAI apps and save the results into `assets/` with the **exact file names** shown. Images can be `.png`, `.jpg` or `.webp`, and audio can be `.mp3` or `.wav`. A missing file falls back to emoji or silence, so add things in any order.

Replace **[ANIMAL]** with your group's animals. The file name uses the animal's `id` from `config.js` (for example `assets/animals/lion.png`).

> **Assignment check:** text comes from Claude (already in `text.js`). Make the images with one app and the audio with a different app (or two), and list them all in the submission notes. Exported AI audio counts; code-generated beeps don't.

---

## Images (e.g. ChatGPT / DALL·E, Gemini, Adobe Firefly, Canva AI)

**Shared style.** Add this to every image prompt so the art matches:
> cheerful flat vector illustration, soft shading, bright warm safari palette, clean shapes, friendly and cute, no text, no letters, no watermark

### Must-have: the 6 animals (square, 1:1)
Save as `assets/animals/<id>.png`. These appear walking around inside the 3D enclosures, on the adoption card and in the enclosure panel.
> A single [ANIMAL] portrait, full body, centered, facing slightly toward the viewer, on a plain soft pastel background, square, cheerful flat vector illustration, soft shading, bright warm safari palette, clean shapes, friendly and cute, no text, no letters, no watermark

**Tip:** use these same 6 images as the **phone photos** for training and playing. Give each animal a *different* background color, which makes the model's job easier. Then make 1–2 extra versions of each (different pose or angle) so the model learns the animal, not just one picture.

### Nice to have
| File | Shape | Prompt (add the shared style) |
|---|---|---|
| `assets/title.png` | landscape 4:3 | The colorful entrance gate of a small friendly zoo at golden hour, a wooden arch sign with no words, happy families walking in, a lion, elephant and giraffe peeking over the fence |
| `assets/end_legendary.png` | landscape 16:9 | A packed, thriving zoo celebrating at sunset, confetti, a golden trophy on a podium, happy crowds and animals |
| `assets/end_collector.png` | landscape 16:9 | A happy family of many different zoo animals posing together for a group photo, celebration |
| `assets/end_success.png` | landscape 16:9 | A cheerful zoo entrance with a long happy line of visitors and balloons on a sunny day |
| `assets/end_struggling.png` | landscape 16:9 | A quiet zoo on a gray drizzly day, a few visitors with umbrellas, hopeful animals peeking out |
| `assets/end_bankrupt.png` | landscape 16:9 | A zoo gate closed with a big padlock and chain, autumn leaves blowing, slightly sad but cartoonish |
| `assets/end_empty.png` | landscape 16:9 | Empty zoo enclosures around a fountain with tumbleweeds rolling by and one bored pigeon, funny cartoon style |

---

## Music (e.g. Suno or Udio)
Save as `assets/music.mp3`. It loops.
> Upbeat, playful instrumental background music for a cozy zoo tycoon video game. Marimba, ukulele, light hand percussion and pizzicato strings, bright and bouncy, 110 BPM, seamless loop, no vocals.

Make it instrumental (no lyrics) so it doesn't fight the narration.

---

## Narration (e.g. ElevenLabs text-to-speech)
Pick a warm, upbeat "nature documentary host" voice. The game lowers the music while these play.

| File | Script |
|---|---|
| `assets/voice_intro.mp3` | Welcome, Director! Your brand-new zoo has three empty enclosures around the fountain, six hundred dollars in the bank, and a line of curious visitors at the gate. Snap animal photos to adopt residents, keep them happy, and fill this place with visitors. Good luck! |
| `assets/voice_end_legendary.mp3` | Incredible! Your zoo is the talk of the state. The animals are thriving, the crowds are endless, and you are officially a tycoon. |
| `assets/voice_end_collector.mp3` | Every species, one zoo! You met your goal with a full house of animals. Families will travel for hours to see them all. |
| `assets/voice_end_success.mp3` | You did it! The visitor goal is met, the gates stay open, and the future looks bright. |
| `assets/voice_end_struggling.mp3` | Your zoo survived, but the crowds never quite showed up. The animals are still waiting for their big moment. Next season, perhaps? |
| `assets/voice_end_bankrupt.mp3` | Oh no. Two nights in the red was too many, and the bank has closed the gates. Next time, keep an eye on that upkeep! |
| `assets/voice_end_empty.mp3` | Eight days and not a single animal. The visitors bought one pretzel and went home. Try snapping an animal photo next time! |

---

## Sound effects (e.g. ElevenLabs Sound Effects)
| File | Prompt |
|---|---|
| `assets/sfx_adopt.mp3` | Short happy cartoon fanfare with a sparkle chime, video game reward, 1.5 seconds |
| `assets/sfx_success.mp3` | Bright cheerful success jingle, xylophone arpeggio going up, 1 second |
| `assets/sfx_fail.mp3` | Gentle cartoon "womp womp" with a sad trombone slide, 1 second |
| `assets/sfx_alert.mp3` | Playful zoo alarm, quick siren whoop with a bell, urgent but cute, 1.5 seconds |
| `assets/sfx_coin.mp3` | Cash register "cha-ching" with coins, short, 0.8 seconds |
| `assets/sfx_day.mp3` | Soft evening chime with distant crickets, end of the day, 2 seconds |

### Animal calls (one per animal)
Save as `assets/animals/<id>.mp3`. These play when an animal is recognized or recaptured.
> A short, clear [ANIMAL] call, friendly not scary, single sound, no background noise, 1.5 seconds

(Lion roar, elephant trumpet, monkey chatter, penguin squawk, giraffe hum, snake hiss, or whatever fits your animals.)
