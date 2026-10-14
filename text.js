/* =====================================================================
   ZOOSNAP TYCOON - GAME TEXT (generated with Claude by Anthropic)
   Placeholders: {zoo} zoo name, {animal} species name, {shown} the animal
   the camera saw, {price} money amount, {day} day number.
   Feel free to rewrite any line in your group's voice.
   ===================================================================== */
window.ZOO_TEXT = {
  title: "ZooSnap Tycoon",
  tagline: "Build a zoo with nothing but a phone full of animal photos.",
  zooNames: ["Sunny Paws Zoo", "Wild Whiskers Park", "Roaring Meadows", "The Snapshot Safari", "Pawsitively Wild", "Hoof & Feather Gardens"],

  intro: "Welcome, Director! {zoo} has three empty enclosures around the fountain, $600 in the bank and a line of curious visitors at the gate. Snap animal photos to adopt residents, keep them happy, and welcome {goal} visitors in {days} days.",

  dayStart: [
    "Day {day}: the gates of {zoo} swing open!",
    "Day {day}: fresh coffee, fresh hay, fresh visitors.",
    "Day {day}: the ticket booth is buzzing.",
    "Day {day}: a school bus just pulled into the lot.",
  ],
  adopt: [
    "{zoo} welcomes a brand-new {animal}! Visitors press their noses to the glass.",
    "A {animal} moves in! Someone is already selling plush versions at the gift shop.",
    "The {animal} sniffs its new habitat and decides it approves.",
    "Big news: a {animal} joins {zoo}. Attendance is about to spike.",
  ],
  idle: [
    "A toddler just named a pigeon after you.",
    "The gift shop sold out of foam safari hats.",
    "Someone left a five-star review: \"The animals looked HAPPY.\"",
    "A keeper swears one of the animals winked at her.",
    "The snack line is longer than the ticket line. Good sign.",
    "A wedding party asked to take photos by the entrance.",
    "A local blogger is livestreaming from the main path.",
  ],
  needAnimals: "Your enclosures are empty. Tap \"Snap to Adopt\" and show the camera an animal photo!",
  debtWarning: "{zoo} is in debt! Get back above $0 by the end of tomorrow or the bank closes the zoo.",
  upkeepWarning: "Heads up: you can't cover tonight's upkeep yet.",

  scanner: {
    adoptTitle: "📷 Snap to Adopt",
    adoptHelp: "Hold an animal photo on your phone up to the camera. Keep it steady until it locks in.",
    requestTitle: "📸 Photo Request!",
    escapeTitle: "🚨 Escape!",
    show: "Show an animal photo…",
    holding: "Hold it steady… recognizing {shown}",
    notSure: "Not sure yet. Try tilting the phone to cut the glare, or move it closer.",
    stuckTip: "Having trouble? Turn your screen brightness up, fill the camera with the photo, and avoid bright lights behind you.",
    manual: "Camera unavailable: tap the animal you would show instead.",
  },

  wrong: [
    "That's a {shown}! We need the {animal}!",
    "Nope, that's a {shown}. Find the {animal}!",
    "A {shown}?! The visitor wants the {animal}!",
  ],

  events: {
    request: {
      title: "📸 Photo Request!",
      text: "A little visitor tugs your sleeve: \"Can I see the {animal}? Pleeease?\" Show a {animal} photo to the camera before time runs out!",
      success: "The kid squeals with joy and their parents buy annual passes. +$150, reputation up!",
      fail: "The kid's lip trembles. They leave without seeing the {animal}. Reputation down.",
    },
    escape: {
      title: "🚨 ESCAPE!",
      text: "The {animal} slipped out of its habitat and is loose near the snack bar! Scan a {animal} photo to guide it home before visitors panic.",
      success: "Gotcha! The {animal} trots back home to a round of applause. Reputation up!",
      fail: "The {animal} is hiding in the bushes and won't be on display tomorrow. Cleanup costs $100 and reputation drops.",
    },
    circus: {
      title: "🎪 The Circus Comes Calling",
      text: "A slick circus owner offers ${price} for your {animal}. \"It'll be a STAR,\" he promises. Your keepers look worried.",
      A: "Sell the {animal} (+${price})",
      B: "Refuse. It stays home.",
      results: {
        A: "The {animal} rolls away in a circus truck. The money's nice, but the public is not impressed.",
        B: "You show the circus owner the exit. Visitors cheer when they hear the story.",
      },
    },
    heatwave: {
      title: "☀️ Heat Wave!",
      text: "It's the hottest day of the year and the animals are panting. Misters and frozen treats would cost $120.",
      A: "Install misters (−$120)",
      B: "Tough it out",
      results: {
        A: "Cool mist drifts across the paths. Animals and visitors are thrilled.",
        B: "The animals spend the day sulking in the shade. Happiness drops.",
      },
    },
    influencer: {
      title: "📱 Famous Influencer",
      text: "A creator with 4 million followers wants to film at {zoo}. Their manager asks for a $150 \"appearance fee.\"",
      A: "Pay up (−$150): +50% visitors for 2 days",
      B: "Politely decline",
      results: {
        A: "The video goes viral. Expect a flood of visitors for the next two days!",
        B: "The influencer films at the aquarium instead. Oh well.",
      },
    },
    baby: {
      title: "🍼 Surprise Baby!",
      text: "Keepers wake you at dawn: your {animal} just had a baby! You have room for it, or a partner sanctuary would love to raise it.",
      A: "Keep the baby (free new {animal})",
      B: "Send to the sanctuary (+$150, reputation)",
      results: {
        A: "The baby {animal} is the cutest thing anyone has ever seen. Crowds gather.",
        B: "The sanctuary sends a thank-you donation and a glowing press release.",
      },
    },
    fieldtrip: {
      title: "🚌 Field Trip",
      text: "A local elementary school can't afford tickets this year. Hosting them would cost about $100 in lunches and guides.",
      A: "Host them (−$100)",
      B: "Sorry, not this year",
      results: {
        A: "Forty kids leave as lifelong {zoo} fans. The local paper runs a story.",
        B: "The school goes elsewhere, and a few parents grumble online.",
      },
    },
    inspector: {
      title: "📋 Surprise Inspection",
      text: "A city inspector arrives unannounced. A quick $100 deep clean would guarantee a pass. Or you could wing it.",
      A: "Deep clean (−$100)",
      B: "Wing it (50/50)",
      results: {
        A: "Spotless! The inspector awards you a gold sticker.",
        B_pass: "The inspector shrugs, \"Looks fine,\" and signs off. Lucky!",
        B_fail: "The inspector finds a moldy hay pile. The violation makes the news.",
      },
    },
  },

  endings: {
    legendary: { emoji: "🏆", title: "Legendary Zoo", text: "{zoo} is the talk of the state. Lines wrap around the block, the animals are thriving, and a documentary crew has booked next month. You're a tycoon." },
    collector: { emoji: "🌍", title: "The Complete Collection", text: "Every species, one zoo. {zoo} hit its visitor goal with a full house of animals, and families come from hours away to see them all." },
    success: { emoji: "🎉", title: "A Thriving Zoo", text: "{zoo} met its visitor goal! A few headlines were bumpy, but the gates stay open and the future looks bright." },
    struggling: { emoji: "🌧️", title: "Still Growing", text: "{zoo} survived, but the crowds never quite showed up. The animals are still waiting for their big moment. Next season?" },
    bankrupt: { emoji: "💸", title: "Closed by the Bank", text: "Two days in the red was too many. The bank padlocks the gates of {zoo}, and the animals move to a neighboring park. Watch that upkeep!" },
    empty: { emoji: "🕸️", title: "The Empty Zoo", text: "Eight days, zero animals. Visitors toured the empty habitats, bought one pretzel, and left. Maybe try snapping an animal photo next time?" },
  },
};
