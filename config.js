/* =====================================================================
   ZOOSNAP TYCOON - SETTINGS YOUR GROUP EDITS
   ---------------------------------------------------------------------
   1) SPECIES: change `className` to match your Teachable Machine classes
      (not case sensitive), and `name` / `emoji` to the animal you chose.
      `id` is used for file names in assets/animals/ (use lowercase, no spaces).
      `habitat` is the ground color of that animal's enclosure in the 3D zoo.
      Keep the numbers as they are unless you want to rebalance the game:
      each slot is a different "role" (star, cheap crowd-pleaser, etc.).
   2) MODEL: leave MODEL_URL empty to use model/model-pack.js or the
      model/ folder, or paste your Teachable Machine share link.
   ===================================================================== */
window.ZOO_CONFIG = {
  MODEL_URL: "",            // e.g. "https://teachablemachine.withgoogle.com/models/AbC123xyz/"
  NOTHING_CLASS: "Nothing", // your "no animal" class (any class not listed below also counts as nothing)
  CONFIDENCE: 0.85,         // the model must be at least this sure...
  HOLD_MS: 700,             // ...for this long (milliseconds) before an animal is "locked in"

  SPECIES: [
    { id: "lion", habitat: "#d9b46b", className: "Lion", name: "Lion", emoji: "🦁",
      role: "Star attraction", cost: 400, appeal: 11, upkeep: 40,
      trait: "Showstopper: +2 reputation every day.", repPerDay: 2 },

    { id: "elephant", habitat: "#b9a487", className: "Elephant", name: "Elephant", emoji: "🐘",
      role: "Gentle giant", cost: 500, appeal: 13, upkeep: 45,
      trait: "Calming: all animals lose happiness 30% slower.", calm: 0.3 },

    { id: "monkey", habitat: "#5d9c46", className: "Monkey", name: "Monkey", emoji: "🐒",
      role: "Cheeky crowd-pleaser", cost: 150, appeal: 5, upkeep: 15,
      trait: "Escape artist: much more likely to break out.", escapeWeight: 4 },

    { id: "penguin", habitat: "#dcecf3", className: "Penguin", name: "Penguin", emoji: "🐧",
      role: "Social butterfly", cost: 120, appeal: 4, upkeep: 12,
      trait: "Huddle: +1.5 appeal for every other one you own.", herdBonus: 1.5 },

    { id: "giraffe", habitat: "#ccb978", className: "Giraffe", name: "Giraffe", emoji: "🦒",
      role: "Snack magnet", cost: 300, appeal: 8, upkeep: 30,
      trait: "Feeding deck: +$1 from every visitor.", snackPerVisitor: 1 },

    { id: "snake", habitat: "#8e9d56", className: "Snake", name: "Snake", emoji: "🐍",
      role: "Low-maintenance oddity", cost: 200, appeal: 6, upkeep: 8,
      trait: "Cold-blooded: barely loses happiness.", selfDecay: 0.3 },
  ],
};
