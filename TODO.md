# Pixel Apartment Resume — status & TBD

_Last updated: 2026-08-15_

## Where the project stands (DONE)

**Stack** — the agreed modern setup is fully wired and green:
React 19 + TypeScript strict, Vite 8, TanStack Router (file-based, generated route tree committed),
TanStack Query, Tailwind v4, biome (lint+format, husky pre-commit), vitest (10 passing tests),
i18next, motion. `npm ci`-ready lockfile, GitHub Pages CI, SPA 404 fallback.

**Game** — a side-view post-Soviet apartment in the Ringo Ishikawa mood:

- 5 rooms: прихожая, кухня, зал, спальня, балкон — ~35 interactable objects.
- Resume delivery: rotary phone → links, стенка → skills, bed → about,
  CRT computer → full resume terminal, TAB → Ringo-style status screen with stat bars.
- Character: 26 sprite frames on one aligned body grid; idle life (breathing, blinks,
  spontaneous overhead stretch on tip-toes, glance over the shoulder); bobbing walk;
  action animations — reach (all appliances), giria swings with squat pickup,
  barbell clean/dip/split-jerk, sambo stretch→grips→entry→throw, dog petting scratch,
  sofa sitting (interruptible), tea drinking, balcony smoking leaning on the railing.
- Already stateful: lights, TV, radio, kettle (boiled → drink tea), Gross pet counter.
- Mobile/tablet: touch buttons, hold-screen-edges to walk, tap-center to interact,
  safe-area insets, pinch-zoom disabled. Keyboard uses physical key codes → Cyrillic layouts work.
- Natural-tone English flavor text throughout; dog is Gross; Christ painting in the bedroom.
- Verified end-to-end in headless Chrome (screenshots of every room + animations, no console errors).

## AGREED — next up (from Ivan, 2026-08-15)

### 0. New room: САНУЗЕЛ (bathroom, off the hallway)
- [x] Combined bathroom behind its own hallway door: tiled walls, tub with a curtain,
      toilet with an overhead cistern and pull chain, sink with a mirror cabinet,
      old Vyatka-style washing machine, stack of newspapers, frosted window pane.
- [x] Interactions: wash at the sink, take a bath (screen fades, long soak),
      toilet = fade-to-black gag ("Some things stay off-screen."),
      washing machine on ⇄ off with rumble shake animation.
- [ ] Bathroom extras: dedicated wash-face/brush-teeth animations, mirror cabinet
      opens (razor, cologne, one line), dripping tap you can tighten,
      the running washer slowly walks a pixel across the floor.
- [ ] Gross occasionally drinks from the toilet if the lid is up (lid = state).

### 1. Stateful object system (open/close, multi-state)
- [x] Engine: replace boolean flags with a per-object state store
      (`Record<objectId, state>`), rooms read it for art variants; persisted (see §6).
- [x] **Lights are per room, not per apartment**: each room has its own switch and its
      own dark/lit state (hallway switch → hallway only; add switches to kitchen and
      bedroom; balcony has none — it's outside). Walking into a dark room stays dark
      until you find the switch by the door.
- [x] Windows (kitchen, bedroom) open ⇄ close: sash visibly opens, tulle sways in the draft.
- [ ] Fortochka (the small vent pane) as its own quick toggle on each window.
- [x] Smoking at an **open** window (indoor lean variant), not only on the balcony;
      closed window → "Not through the glass." nudge to open it first.
- [ ] Balcony door in the зал: open/closed state, visible gap + tulle movement when open.
- [x] Fridge door open ⇄ close with visible interior (pot of soup, jars, butter, sausage).
- [x] Wardrobe creaks open ⇄ closed, clothes visible inside (see outfits, §2).
- [x] TV: cycle states off → quiet film → football match → static → off
      (screen art per channel).
- [ ] TV extras: test-card channel; antenna nudge fixes the static.
- [ ] Radio: cycle stations — weather → old songs → silence/static → off.
- [ ] Kitchen tap on ⇄ off: running water pixels; kolonka flame lights while water runs.
- [ ] Stove burners on/off independently of the kettle; soup pot steams on a lit burner.
- [ ] Oven door and breadbox open ⇄ close (bread inside, one line each).
- [ ] Front door extras: look through the peephole (stairwell vignette),
      chain on ⇄ off, three-lock unlocking sequence line.
- [ ] Antresol opens: a box of old photographs falls out (one-time event, panel of lines).
- [ ] Bed made ⇄ unmade; lying down for a minute dims the screen (see rest, §2).
- [ ] Desk lamp its own toggle, independent of ceiling light (matters at night, §5).
- [ ] Crystal cabinet glass door opens — alarm line about asking mother first.
- [ ] Balcony clothesline: hang ⇄ take down laundry (sheet appears/disappears).
- [ ] Electric meter disc spins faster the more appliances are on (systemic detail).
- [ ] Wall clock in the зал showing real time, pendulum swing, chime on the hour.

### 2. Player animations — backlog (all on the shared body grid)
- [x] **Character redesign to match Ivan** — do this FIRST, every frame inherits it:
      185 cm ≈ 70 gp tall (grid 20×35 cells) next to the 76 gp doors; strong athletic
      build at 98 kg — broad shoulders, thick chest and arms, tapered waist, not bulky-fat;
      **black sport t-shirt with short sleeves** (bare muscular forearms visible),
      **navy blue sport trousers**, sneakers; brown hair (current shade is right),
      **green eyes** (2-px eye so the green reads). All ~26 existing frames re-authored
      on the new grid; STATUS portrait updates automatically.
- [ ] Carry state: one-item hands (sausage / cup / newspaper / laundry) —
      dedicated walk + stand frames with the item visible.
- [ ] Lie on bed: full horizontal sprite, blanket over legs, Z pixels; getting-up frame.
- [ ] Push-ups and bodyweight squats set on the living-room rug (exercise variety).
- [ ] Jump rope on the balcony — synchronized arm circles + hop cycle.
- [ ] Shadow-boxing combo (jab–cross–slip) as a second sambo drill.
- [ ] Hamstring fold + neck roll as part of the warm-up chain.
- [ ] Sit on the kitchen stool: tea at the table variant of drinking.
- [ ] Wash the cup at the sink (standing profile, arm scrub motion, tap running).
- [ ] Eat a bite standing at the open fridge (classic pose, fridge light on face).
- [ ] Climb onto the stool to reach the antresol / top jars.
- [ ] Wave at himself in the hallway mirror; longer look → reflection lines.
- [ ] Yawn and wristwatch-check as extra idle flourishes; hands-in-pockets idle stance.
- [ ] Kneel to fix a shoelace (rare idle, hallway only).
- [ ] Smoking exhale variant: head tilted up, longer smoke puff.
- [ ] Shiver briefly when standing by an open window (cold draft).
- [ ] Door-push animation on room transitions instead of instant fade.

### 3. Gross — his own animation set
- [ ] Wake-up chain: stand, big play-bow stretch, circle twice, flop down again.
- [ ] Feed Gross: open fridge → carry sausage → he wakes, eats, tail-wag loop,
      licks chops, sleeps. (flagship multi-step chain)
- [ ] After 5+ pets in a row he rolls onto his back for belly rubs (new pose).
- [ ] Follows you between rooms for a while after being fed (dog walk frames).
- [ ] Water bowl in the kitchen: he pads over and drinks occasionally.
- [ ] One quiet "wuf" reaction when the phone rings; ear twitch at the kettle whistle.
- [ ] Dream layer: paw-running (exists) + occasional muffled dream-whimper pixels.
- [ ] On the balcony he peers between the parapet slats at the pigeons.

### 4. Ambient life (world animates without the player)
- [ ] A fly circling the kitchen lamp; it relocates when swatted at (never dies).
- [ ] Far windows across the courtyard light up and go dark over time; one flickers blue (their TV).
- [ ] A tram's lit windows sliding past in the far distance every few minutes.
- [ ] Poplar fluff / falling leaves drifting past the windows; rain mode with drops on glass.
- [ ] Pigeon lands on the balcony railing: pecks, struts; shoo it or leave it be.
- [ ] Laundry on the line sways; more in the wind, barely when calm.
- [ ] Dust motes drifting in the desk-lamp beam at night.
- [ ] Chandelier sways for a few seconds after barbell jerks; neighbor knocks on the
      radiator (toast: someone downstairs taps the pipes).
- [ ] Neighbor's muffled music through the зал wall at random; faint note pixels.
- [ ] Soup pot steam, kettle steam scaling with boil time, radiator heat shimmer.
- [ ] A cat crossing a distant roof, visible from the balcony, once in a while.

### 5. Time, weather, mood, HUD
- [x] **Minimal styled game HUD** (Ringo-quiet, not gamey): small mono panel in a corner —
      real clock (HH:MM), day of week, current room name; later: condition marks
      (tea ☕ / trained / smoked) as tiny pixel icons. Thin border, translucent dark,
      hidden during overlays.
- [x] **Full day cycle driven by the real clock**: morning (pale warm light) → day
      (neutral) → dusk (current art) → night (dark, lamps required). Window/balcony
      skies and the interior light tint all follow the phase; per-room lamps (§1)
      only matter when the phase is dark.
- [ ] Weather per visit: clear / rain (drops on glass, wet balcony, rain sound hook).
- [ ] Seasonal touch by real date: snow on the balcony parapet in winter months.

### 6. Systems & meta
- [ ] Kettle actually boils: ~20 s later it whistles + steam grows until taken off.
- [ ] Watch TV from the sofa: sitting while TV is on → longer watching scene;
      lights off = movie-night glow on the walls.
- [ ] Wardrobe outfit change: tracksuit ⇄ gakuran-style jacket ⇄ shirt (palette swap,
      persists; STATUS portrait matches).
- [ ] Phone rings occasionally; answering gives one short line (rotary dial animation).
- [ ] Water the plant; it droops or perks up over visits (persisted).
- [ ] Inventory-lite: hands hold exactly one item; HUD shows nothing — the sprite is the UI.
- [ ] Persistence via localStorage: object states, outfit, pets, achievements survive reload.
- [ ] Actions feed the STATUS screen Ringo-style: trained today (+IRON flavor),
      tea (+condition), smoked (condition note), Gross pets counter (exists).
- [ ] Achievements in the status menu ("first smoke", "50 pets", "fed Gross",
      "full evening routine": feed, tea, train, smoke, read the computer).
- [ ] Ambient sound toggle: rain / kettle / TV hum / vinyl radio, off by default. — biggest lift

### 3. Content (only Ivan can do)
- [ ] Replace placeholder resume data in `src/lib/resume.ts` (real dates, employers, skills, projects).
- [ ] Decide on Ukrainian translation (i18next is ready; `src/i18n.ts` holds all strings).
- [ ] New `public/social-preview.png` screenshot of the apartment for link embeds.

### 4. Small known polish
- [ ] Unused i18n key `flavor.balcony` (balcony became a door) — remove or repurpose.
- [ ] Kitchen window obj x (280) vs drawn center (276) — cosmetic 4 px nudge.
- [ ] Consider footer-less root: SEO description mentions the game (done in index.html).
