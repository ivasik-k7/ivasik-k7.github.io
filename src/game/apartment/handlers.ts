import type { DialogueTree, InteractionCtx, InteractionHandler } from "@/engine";
import { playSfx } from "@/engine";
import i18n from "@/i18n";
import { dayPhase, studioState, TV_CYCLE, type TvChannel, type WorldState } from "@/lib/worldState";

/**
 * Interaction handlers — the apartment's verbs, ported 1:1 from the
 * original game onto the engine's handler table.
 */

const t = (key: string) => i18n.t(key);

const TV_TOAST: Record<TvChannel, string> = {
  off: "toast.tvOff",
  film: "toast.tvFilm",
  football: "toast.tvFootball",
  static: "toast.tvStatic",
};

/** Scene id → lights key (they match by construction). */
type LightRoom = keyof WorldState["lights"];

export const APARTMENT_HANDLERS: Record<string, InteractionHandler<WorldState>> = {
  lamp: ({ scene, world, updateWorld, showToast, startAction }) => {
    startAction("use");
    playSfx("click");
    const room = scene as LightRoom;
    const nextOn = !world.lights[room];
    updateWorld((w) => ({ ...w, lights: { ...w.lights, [room]: nextOn } }));
    showToast(t(nextOn ? "toast.lightsOn" : "toast.lightsOff"));
  },

  tv: ({ world, updateWorld, showToast, startAction }) => {
    startAction("use");
    const next = TV_CYCLE[(TV_CYCLE.indexOf(world.tv) + 1) % TV_CYCLE.length];
    playSfx(next === "off" ? "tvOff" : "tvOn");
    updateWorld({ tv: next });
    showToast(t(TV_TOAST[next]));
  },

  radio: ({ world, updateWorld, showToast, startAction }) => {
    startAction("use");
    playSfx("radio");
    const nextOn = !world.radioOn;
    updateWorld({ radioOn: nextOn });
    showToast(t(nextOn ? "toast.radioOn" : "toast.radioOff"));
  },

  cooker: ({ world, updateWorld, showToast, startAction }) => {
    startAction("use");
    const next = world.cookerState === "off" ? "open" : world.cookerState === "open" ? "on" : "off";
    playSfx(next === "open" ? "creak" : next === "on" ? "kettle" : "click");
    updateWorld({ cookerState: next });
    showToast(
      t(next === "open" ? "toast.ovenOpen" : next === "on" ? "toast.cookerOn" : "toast.cookerOff"),
    );
  },

  kettle: ({ world, updateWorld, showToast, startAction }) => {
    if (world.kettleOn) {
      startAction("drink");
      playSfx("pour");
      showToast(t("toast.drink"));
    } else {
      startAction("use");
      playSfx("kettle");
      updateWorld({ kettleOn: true });
      showToast(t("toast.kettle"));
    }
  },

  window: ({ obj, world, updateWorld, showToast, startAction }) => {
    const id = obj.id as keyof WorldState["windows"];
    const win = world.windows[id];
    if (!win.open) {
      startAction("use");
      playSfx("creak");
      updateWorld((w) => ({
        ...w,
        windows: { ...w.windows, [id]: { open: true, smoked: false } },
      }));
      showToast(t("toast.windowOpen"));
    } else if (!win.smoked) {
      startAction("smoke");
      playSfx("match");
      updateWorld((w) => ({
        ...w,
        windows: { ...w.windows, [id]: { open: true, smoked: true } },
      }));
      showToast(t("toast.windowSmoke"));
    } else {
      startAction("use");
      playSfx("doorshut");
      updateWorld((w) => ({
        ...w,
        windows: { ...w.windows, [id]: { open: false, smoked: false } },
      }));
      showToast(t("toast.windowClose"));
    }
  },

  // both play out in back projection — he faces the porcelain, not the camera.
  // Sounds ride the animation clock; interrupting cancels what hasn't played.
  toilet: ({ startAction, queueToast }) => {
    const timers: number[] = [];
    startAction("pee", {
      onInterrupt: () => {
        for (const timer of timers) window.clearTimeout(timer);
      },
    });
    timers.push(window.setTimeout(() => playSfx("trickle"), 900));
    timers.push(window.setTimeout(() => playSfx("trickle"), 2700));
    timers.push(window.setTimeout(() => playSfx("flush"), 4200));
    queueToast(t("toast.pee"), 6100);
  },
  bath: ({ startAction, queueToast }) => {
    const timers: number[] = [];
    startAction("shower", {
      onInterrupt: () => {
        for (const timer of timers) window.clearTimeout(timer);
      },
    });
    // tap turns at the end of frame 4 (380ms each); spray carries to frame 16
    for (const at of [1900, 3700, 5500]) {
      timers.push(window.setTimeout(() => playSfx("water"), at));
    }
    queueToast(t("toast.shower"), 8200);
  },

  washer: ({ world, updateWorld, showToast, startAction }) => {
    startAction("use");
    playSfx(world.washerOn ? "click" : "washer");
    const nextOn = !world.washerOn;
    updateWorld({ washerOn: nextOn });
    showToast(t(nextOn ? "toast.washerOn" : "toast.washerOff"));
  },

  openable: ({ obj, world, updateWorld, showToast, startAction, openOverlay }) => {
    startAction("use");
    if (obj.id === "wardrobe" || obj.id === "wardrobe-hall") {
      playSfx("creak");
      if (obj.id === "wardrobe") updateWorld({ wardrobeOpen: true });
      openOverlay({ type: "wardrobe" });
      return;
    }
    playSfx("fridge");
    const nextOpen = !world.fridgeOpen;
    updateWorld({ fridgeOpen: nextOpen });
    showToast(t(`toast.${obj.id}${nextOpen ? "Open" : "Close"}`));
  },

  sport: ({ obj, showToast, startAction, queueToast, shakeCamera }) => {
    if (!obj.action) return;
    startAction(obj.action);
    if (obj.action === "smoke") playSfx("match");
    if (obj.action === "sit") playSfx("doorshut");
    if (obj.action === "press" || obj.action === "swing") shakeCamera(2, 300);
    showToast(t(`toast.${obj.id}`));
    if (obj.action === "call") {
      queueToast(t("toast.call2"), 3200);
      queueToast(t("toast.call3"), 6600);
    }
    if (obj.action === "pray") {
      queueToast(t("toast.pray2"), 2400);
    }
  },

  dog: ({ obj, world, updateWorld, showToast, startAction, spawnFx }) => {
    startAction("pet");
    playSfx("chime");
    const pets = world.dogPets + 1;
    updateWorld({ dogPets: pets });
    showToast(t(`dog.${pets % 4}`));
    spawnFx("heart", obj.x + (pets % 3) * 6 - 6, 1100);
  },

  flavor: ({ obj, showToast }) => showToast(t(`flavor.${obj.id}`)),

  // The studio chores. Each one is done once and stays done — the art keeps
  // falling back to what the clock says until the flag is actually set.
  dishes: ({ world, updateWorld, showToast, startAction }) => {
    if (studioState(world).dishesDone) {
      showToast(t("flavor.sink-kitchen"));
      return;
    }
    const timers: number[] = [];
    startAction("use", {
      onInterrupt: () => {
        for (const timer of timers) window.clearTimeout(timer);
      },
    });
    playSfx("water");
    timers.push(window.setTimeout(() => playSfx("water"), 1500));
    updateWorld((w) => ({ ...w, studio: { ...studioState(w), dishesDone: true } }));
    showToast(t("toast.dishes"));
  },

  binbag: ({ world, updateWorld, showToast, startAction }) => {
    if (studioState(world).binEmptied) {
      showToast(t("flavor.bin"));
      return;
    }
    startAction("use");
    playSfx("thud");
    updateWorld((w) => ({ ...w, studio: { ...studioState(w), binEmptied: true } }));
    showToast(t("toast.binOut"));
  },

  bowls: ({ obj, world, updateWorld, showToast, startAction, spawnFx }) => {
    if (studioState(world).bowlsFilled) {
      showToast(t("flavor.dogbowls"));
      return;
    }
    startAction("use");
    playSfx("pour");
    updateWorld((w) => ({ ...w, studio: { ...studioState(w), bowlsFilled: true } }));
    spawnFx("heart", obj.x + 46, 1300);
    showToast(t("toast.bowls"));
  },

  // the guitar comes off the wall for one quiet loop of Am–F–C–G.
  // Strums are timed to the animation (320ms frames): first stroke as the
  // hand first crosses the strings, half-time while the head nods, the
  // last chord rung out with the chin up and left to decay.
  guitar: ({ obj, startAction, spawnFx, queueToast, shakeCamera, updateWorld }) => {
    const timers: number[] = [];
    startAction("strum", {
      onInterrupt: () => {
        for (const timer of timers) window.clearTimeout(timer);
      },
    });
    // once it has been played it stays on the stand, even after dark
    updateWorld((w) => ({ ...w, studio: { ...studioState(w), guitarOut: true } }));
    const strums = [
      1280,
      1600,
      1920,
      2240, // first bar, eyes on the hand
      2560,
      3200, // half-time under the nod
      3840,
      4160,
      4480,
      4800, // chord change, second bar
      5120,
      5440,
      5760,
      6080, // weight on the back foot
    ];
    strums.forEach((at, i) => {
      timers.push(
        window.setTimeout(() => {
          playSfx("guitar");
          if (i % 2 === 0) spawnFx("note", obj.x - 8 + (i % 3) * 7, 1600);
        }, at),
      );
    });
    timers.push(
      window.setTimeout(() => {
        playSfx("guitarEnd");
        shakeCamera(0.8, 220);
        spawnFx("note", obj.x, 2100);
      }, 6400),
    );
    queueToast(t("toast.guitar"), 7000);
  },

  panel: ({ obj, openOverlay }) => {
    playSfx("click");
    if (obj.data) openOverlay({ type: "panel", id: obj.data });
  },

  bed: ({ obj, startAction, showToast, openOverlay, shakeCamera }) => {
    startAction("lay");
    playSfx("doorshut");
    window.setTimeout(() => shakeCamera(1.5, 200), 1200);
    showToast(t("toast.bedLie"));
    window.setTimeout(() => {
      if (obj.data) openOverlay({ type: "panel", id: obj.data });
    }, 5400);
  },

  computer: ({ openOverlay }) => {
    playSfx("click");
    openOverlay({ type: "terminal" });
  },

  // --- the world beyond the front door ---------------------------------------

  flatdoor: (ctx) => {
    if (!ctx.obj.to || ctx.world.doorOpening) return;
    const { to, id } = ctx.obj;
    playSfx("creak");
    ctx.updateWorld({ doorOpening: id });
    window.setTimeout(() => {
      ctx.travel(to.scene, to.spawnX);
      window.setTimeout(() => ctx.updateWorld({ doorOpening: null }), 700);
    }, 380);
  },

  creakdoor: ({ obj, travel }) => {
    if (!obj.to) return;
    playSfx("creak");
    travel(obj.to.scene, obj.to.spawnX);
  },

  /**
   * Boarding a train.
   *
   * §12 asks that this not be an abrupt scene replacement, and the engine's
   * `travel` already gives a fade out and a fade in — what was missing is the
   * half second in which the player physically steps into the doorway. So the
   * hiss of the doors plays, the character runs its `use` reach, and the scene
   * change is held back until that has read on screen. The player sees
   * themselves get on.
   *
   * The door objects only exist while the doors are open (their `when` is the
   * timetable), so there is no state to check here: if this handler is running,
   * there is a train at the platform with its doors apart.
   */
  trainDoor: ({ startAction, travel, queueToast }) => {
    playSfx("cardoor");
    startAction("use");
    queueToast(t("toast.boarding"), 260);
    window.setTimeout(() => travel("train", 300), 620);
  },

  /**
   * The kasownik. The machine two steps away sells the ticket and the
   * conductor on the train asks to see it; this is the third corner of that
   * triangle — the punch that makes the ticket a journey rather than a
   * souvenir. There is nothing to punch if you have not bought one, and the
   * machine says so the way they all do: with a red light and no sympathy.
   */
  kasownik: ({ world, showToast, startAction }) => {
    startAction("use");
    if (countOf(world, "ticket") < 1) {
      playSfx("denied");
      showToast(t("toast.punchNoTicket"));
      return;
    }
    playSfx("click");
    showToast(t("toast.ticketPunched"));
  },

  /**
   * The ticket machine on the platform.
   *
   * Four złoty, and the only reason to bother is that there is a conductor on
   * the train who will ask. That is the entire loop and it is the whole point of
   * both objects: neither the machine nor the conductor is interesting on its
   * own, and together they are the reason you look at the machine at all.
   */
  biletomat: ({ world, updateWorld, showToast, startAction }) => {
    startAction("use");
    if (world.money < 4) {
      playSfx("denied");
      showToast(t("toast.ticketBroke"));
      return;
    }
    playSfx("register");
    updateWorld((w) => ({
      ...w,
      money: w.money - 4,
      inventory: addToInventory(w, "ticket"),
    }));
    showToast(t("toast.ticketBought"));
  },

  /** Getting off is the same gesture as getting on, in reverse. */
  trainExit: ({ obj, startAction, travel }) => {
    if (!obj.to) return;
    playSfx("cardoor");
    startAction("use");
    window.setTimeout(() => travel(obj.to?.scene ?? "station", obj.to?.spawnX ?? 520), 620);
  },

  /**
   * The route map. Opens the same diagram that is painted on the bulkhead,
   * larger — an overlay rather than a menu, so the player is still looking at
   * the thing on the wall of the carriage they are standing in.
   */
  routemap: ({ openOverlay }) => {
    playSfx("click");
    openOverlay({ type: "routemap" });
  },

  stairs: ({ obj, travel, shakeCamera }) => {
    if (!obj.to) return;
    playSfx("thud");
    shakeCamera(3, 220);
    travel(obj.to.scene, obj.to.spawnX);
  },

  liftbutton: ({ obj, travel }) => {
    if (!obj.to) return;
    playSfx("click");
    travel(obj.to.scene, obj.to.spawnX);
  },

  cashier: (ctx) => {
    ctx.startDialogue(buildCashierTree(ctx.world) as DialogueTree<never>);
  },

  konduktor: (ctx) => {
    ctx.startDialogue(buildConductorTree(ctx.world) as DialogueTree<never>);
  },

  jeanne: (ctx) => {
    ctx.startDialogue(JEANNE_TREE as DialogueTree<never>);
  },

  liftpanel: (ctx) => {
    playSfx("click");
    ctx.startDialogue(LIFT_PANEL_TREE as DialogueTree<never>);
  },

  car: ({ obj, showToast }) => {
    playSfx("cardoor");
    showToast(t(`flavor.${obj.id}`));
  },

  mycar: (ctx) => {
    ctx.startDialogue(buildGolfTree(ctx.world.golfLocked) as DialogueTree<never>);
  },

  npc: (ctx) => {
    const NPC_TREES: Record<string, DialogueTree<Ctx>> = {
      "pani-natalia": NATALIA_TREE,
      smoker: SMOKER_TREE,
      babcia: BABCIA_TREE,
      zbyszek: ZBYSZEK_TREE,
      courier: COURIER_TREE,
      trener: TRENER_TREE,
      golebiarka: GOLEBIARKA_TREE,
      student: STUDENT_TREE,
      "waiting-man": WAITING_TREE,
      /* on the 17:40 */
      "train-spawacz": SPAWACZ_TREE,
      "train-pielegniarka": PIELEGNIARKA_TREE,
      /* on the platform */
      "station-reader": STUDENT_TREE,
      "station-bench-sitter": BABCIA_TREE,
      "station-phone": WAITING_TREE,
      "station-looker": WAITING_TREE,
      "station-smoker": SMOKER_TREE,
      "station-golebiarka": GOLEBIARKA_TREE,
      /* Ulica Elektryków */
      bramkarz: BRAMKARZ_TREE,
      "queue-girl": QUEUE_GIRL_TREE,
      filozof: FILOZOF_TREE,
      starer: STARER_TREE,
      /* inside Turbina */
      "dj-booth": DJ_TREE,
      "tired-girl": TIRED_TREE,
      "club-cleaner": CLEANER_TREE,
    };
    const tree = NPC_TREES[ctx.obj.id] ?? MAREK_TREE;
    ctx.startDialogue(tree as DialogueTree<never>);
  },

  // --- Ulica Słoneczna: street furniture that answers back ------------------------

  paczkomat: ({ world, updateWorld, showToast, startAction }) => {
    startAction("use");
    if (world.street.paczkomatUsed) {
      playSfx("denied");
      showToast(t("toast.paczkomatEmpty"));
      return;
    }
    playSfx("chime");
    updateWorld((w) => ({
      ...w,
      street: { ...w.street, paczkomatUsed: true },
    }));
    showToast(t("toast.paczkomatOpen"));
  },

  zfridge: ({ world, updateWorld, showToast, startAction }) => {
    startAction("use");
    playSfx("fridge");
    const open = !world.zabka.fridgeOpen;
    updateWorld((w) => ({ ...w, zabka: { ...w.zabka, fridgeOpen: open } }));
    showToast(t(open ? "toast.zfridgeOpen" : "toast.zfridgeClose"));
  },

  zfreezer: ({ world, updateWorld, showToast, startAction }) => {
    startAction("use");
    playSfx(world.zabka.freezerOpen ? "doorshut" : "fridge");
    const open = !world.zabka.freezerOpen;
    updateWorld((w) => ({ ...w, zabka: { ...w.zabka, freezerOpen: open } }));
    showToast(t(open ? "toast.freezerOpen" : "toast.freezerClose"));
  },

  coffee: ({ showToast, startAction, queueToast }) => {
    startAction("use");
    playSfx("kettle");
    showToast(t("toast.coffeeBrewing"));
    window.setTimeout(() => playSfx("pour"), 900);
    queueToast(t("toast.coffeeDone"), 2600);
  },

  bins: ({ world, updateWorld, showToast, startAction }) => {
    startAction("use");
    playSfx(world.street.binOpen ? "doorshut" : "thud");
    const open = !world.street.binOpen;
    updateWorld((w) => ({ ...w, street: { ...w.street, binOpen: open } }));
    showToast(t(open ? "toast.binOpen" : "toast.binClose"));
  },

  // --- the modern corridor: things that remember being touched ------------------

  parcel: ({ world, updateWorld, showToast, startAction }) => {
    if (world.corridor.parcelTaken) return;
    startAction("use");
    playSfx("chime");
    updateWorld((w) => ({
      ...w,
      corridor: { ...w.corridor, parcelTaken: true },
      inventory: [...w.inventory, { itemId: "parcel", quantity: 1 }],
    }));
    showToast(t("toast.parcelTaken"));
  },

  plant: ({ scene, world, updateWorld, showToast, startAction }) => {
    startAction("use");
    if (scene === "studio") {
      const watered = !studioState(world).plantWatered;
      if (watered) playSfx("pour");
      updateWorld((w) => ({ ...w, studio: { ...studioState(w), plantWatered: watered } }));
      showToast(t(watered ? "toast.plantWatered" : "toast.plantAdmired"));
      return;
    }
    const watered = !world.corridor.plantWatered;
    if (watered) playSfx("pour");
    updateWorld((w) => ({
      ...w,
      corridor: { ...w.corridor, plantWatered: watered },
    }));
    showToast(t(watered ? "toast.plantWatered" : "toast.plantAdmired"));
  },

  extcabinet: ({ world, updateWorld, showToast, startAction }) => {
    startAction("use");
    playSfx(world.corridor.extOpen ? "doorshut" : "click");
    const open = !world.corridor.extOpen;
    updateWorld((w) => ({ ...w, corridor: { ...w.corridor, extOpen: open } }));
    showToast(t(open ? "toast.extOpen" : "toast.extClose"));
  },

  // --- Ulica Elektryków: the night economy ---------------------------------

  /**
   * The club door. The same door all day; what answers it is the hour. Closed
   * it is a locked steel leaf and a toast; at soundcheck the bouncer turns you
   * back politely; from dusk's end it swallows you with a half-second of the
   * player actually stepping in, the way boarding a train already works.
   */
  clubdoor: ({ startAction, travel, showToast, queueToast }) => {
    const ph = dayPhase(new Date().getHours());
    if (ph === "morning" || ph === "day") {
      playSfx("denied");
      showToast(t("toast.clubClosed"));
      return;
    }
    if (ph === "dusk") {
      playSfx("doorshut");
      showToast(t("toast.clubPrep"));
      return;
    }
    playSfx("thud");
    startAction("use");
    queueToast(t("toast.clubIn"), 260);
    window.setTimeout(() => travel("raveclub", 90), 620);
  },

  /** The container bar's hatch: a person, so it talks. */
  barman: (ctx) => {
    const ph = dayPhase(new Date().getHours());
    if (ph === "morning" || ph === "day") {
      ctx.showToast(t("toast.barShut"));
      return;
    }
    ctx.startDialogue(buildBarmankaTree(ctx.world) as DialogueTree<never>);
  },

  /** The frytki trailer. The economy of small joys, fried. */
  frytki: (ctx) => {
    const ph = dayPhase(new Date().getHours());
    if (ph === "morning" || ph === "day") {
      ctx.showToast(t("toast.frytkiShut"));
      return;
    }
    ctx.startDialogue(buildFrytkarzTree(ctx.world) as DialogueTree<never>);
  },

  /** The club's own bar. Water is free, which is the law and also kindness. */
  clubbar: (ctx) => {
    ctx.startDialogue(buildKlubowyTree(ctx.world) as DialogueTree<never>);
  },

  /** The portaloo, and the club WC: both are a door, a wait, and a lesson. */
  portaloo: ({ blackout }) => {
    playSfx("doorshut");
    blackout(1600, t("toast.portaloo"));
  },

  /**
   * The dance floor. There is no dance animation in the rig and there does not
   * need to be: he dances the way he trains, which is footwork first, and the
   * sambo drill at 126 bpm reads as exactly what a man who lifts does at a
   * rave. The camera agrees with the bass.
   */
  dance: ({ startAction, showToast, queueToast, shakeCamera }) => {
    startAction("sambo");
    shakeCamera(1.5, 600);
    showToast(t("toast.dance"));
    queueToast(t("toast.dance2"), 4200);
  },

  /** Standing at the stack. You do not hear it so much as get leaned on. */
  speaker: ({ showToast, shakeCamera }) => {
    shakeCamera(2.5, 500);
    showToast(t("toast.speaker"));
  },

  /** The earplug dispenser. Take them once; after that it only judges you. */
  earplugs: ({ world, updateWorld, showToast, startAction }) => {
    const taken = world.inventory.some((i) => i.itemId === "earplugs");
    startAction("use");
    if (taken) {
      playSfx("denied");
      showToast(t("toast.earplugsAgain"));
      return;
    }
    playSfx("click");
    updateWorld((w) => ({ ...w, inventory: addToInventory(w, "earplugs") }));
    showToast(t("toast.earplugs"));
  },

  /** The fuse cabinet. Look, but the whole room hangs off what's in there. */
  clubfuse: ({ obj, showToast, spawnFx }) => {
    playSfx("click");
    showToast(t("toast.clubFuse"));
    spawnFx("spark", obj.x, 900);
  },

  liftdoors: (ctx) => {
    if (!ctx.obj.to || ctx.world.corridor.liftOpen) return;
    const { to } = ctx.obj;
    playSfx("liftding");
    ctx.shakeCamera(1.5, 260);
    ctx.updateWorld((w) => ({
      ...w,
      corridor: { ...w.corridor, liftOpen: true },
    }));
    window.setTimeout(() => {
      ctx.travel(to.scene, to.spawnX);
      window.setTimeout(() => {
        ctx.updateWorld((w) => ({
          ...w,
          corridor: { ...w.corridor, liftOpen: false },
        }));
      }, 800);
    }, 750);
  },
};

// --- the Golf, and its keys ---------------------------------------------------------

function buildGolfTree(locked: boolean): DialogueTree<Ctx> {
  if (locked) {
    return {
      start: "start",
      nodes: {
        start: {
          lines: [
            {
              text: "Your Golf sleeps under the dying tube. Snow White holds its color even in this light.",
            },
          ],
          choices: [
            {
              label: "Unlock it. (key fob)",
              effect: (ctx: Ctx) => {
                playSfx("carunlock");
                ctx.spawnFx("golf-blink", 0, 1400);
                ctx.updateWorld({ golfLocked: false });
              },
              next: "unlocked",
            },
            { label: "Walk around it once.", next: "walk" },
            { label: "Leave it be." },
          ],
        },
        unlocked: {
          lines: [
            {
              text: "The indicators blink twice. The mirrors unfold like it's glad to see you.",
            },
          ],
        },
        walk: {
          lines: [
            {
              text: "You walk the length of it. 310 horses, asleep. A speck of dust loses its nerve under your sleeve.",
            },
          ],
        },
      },
    };
  }
  return {
    start: "start",
    nodes: {
      start: {
        lines: [
          {
            text: "The Golf sits unlocked, puddle light warm on the concrete.",
          },
        ],
        choices: [
          {
            label: "Sit inside for a minute.",
            effect: (ctx: Ctx) => {
              playSfx("cardoor");
              ctx.blackout(
                1800,
                "Leather, cold coffee, a faint ghost of tyre smoke. You hold the wheel at nine and three and go exactly nowhere.",
              );
            },
          },
          {
            label: "Start it, just to hear it.",
            effect: (ctx: Ctx) => {
              playSfx("engine");
              ctx.spawnFx("golf-rev", 0, 2600);
              ctx.shakeCamera(2.5, 900);
            },
            next: "started",
          },
          {
            label: "Lock it up.",
            effect: (ctx: Ctx) => {
              playSfx("carlock");
              ctx.spawnFx("golf-blink", 0, 1400);
              ctx.updateWorld({ golfLocked: true });
            },
            next: "locked",
          },
          { label: "Leave it." },
        ],
      },
      started: {
        lines: [
          {
            text: "310 horses clear their throat once. The concrete approves in echo. You switch it off before the neighbors learn your schedule.",
          },
        ],
      },
      locked: {
        lines: [
          {
            text: "One low blink. The mirrors fold in. Alarm set, level −1 goes quiet again.",
          },
        ],
      },
    },
  };
}

// --- Pan Marek, keeper of the Octavia --------------------------------------------------

const MAREK_TREE: DialogueTree<Ctx> = {
  start: "start",
  nodes: {
    start: {
      lines: [
        {
          speaker: "Pan Marek",
          text: "You wax it — it rains. You don't wax it — it also rains.",
        },
      ],
      choices: [
        { label: "How's the Octavia holding up?", next: "octavia" },
        { label: "Quiet down here tonight.", next: "quiet" },
        { label: "Take care, Panie Marku.", next: "bye" },
      ],
    },
    octavia: {
      lines: [
        {
          speaker: "Pan Marek",
          text: "Two hundred and forty thousand and she burns nothing. Well. Almost nothing.",
        },
        {
          speaker: "Pan Marek",
          text: "Your German is pretty. But pretty costs. Mine only costs wax.",
        },
      ],
      next: "start",
    },
    quiet: {
      lines: [
        {
          speaker: "Pan Marek",
          text: "Quiet, quiet. Only the pipes drip. In '09 someone kept a goat down here. Different times.",
        },
      ],
      next: "start",
    },
    bye: {
      lines: [
        {
          speaker: "Pan Marek",
          text: "Trzymaj się. And check your tyre pressures. Front left.",
        },
      ],
    },
  },
};

// --- lift button panel -------------------------------------------------------------

type Ctx = InteractionCtx<WorldState>;

function pressFloor(scene: string, spawnX: number) {
  return (ctx: Ctx) => {
    playSfx("click");
    ctx.travel(scene, spawnX);
  };
}

const LIFT_PANEL_TREE: DialogueTree<Ctx> = {
  start: "start",
  nodes: {
    start: {
      lines: [{ text: "Worn buttons. The 4 shines from decades of thumbs." }],
      choices: [
        { label: "4 — your floor", effect: pressFloor("corridor", 454) },
        { label: "1 — ground, the yard", effect: pressFloor("outside", 110) },
        { label: "P — parking, level −1", effect: pressFloor("parking", 90) },
        { label: "Ride nowhere." },
      ],
    },
  },
};

// --- Pani Natalia, who keeps this building clean and her thoughts at home -------------

const NATALIA_TREE: DialogueTree<Ctx> = {
  start: "start",
  nodes: {
    start: {
      lines: [
        {
          speaker: "Pani Natalia",
          text: "Ой, добрий день... Ви з чотирнадцятої? Обережно, я тут щойно помила.",
        },
      ],
      choices: [
        { label: "Як вам тут працюється?", next: "work" },
        { label: "Звідки ви, пані Наталю?", next: "home" },
        { label: "Тримайтеся. Гарного дня.", next: "bye" },
      ],
    },
    work: {
      lines: [
        {
          speaker: "Pani Natalia",
          text: "Та як... Три під'їзди зранку, офіс увечері. Руки вже не мої, а швабрині.",
        },
        {
          speaker: "Pani Natalia",
          text: "Люди тут чемні, «dziękuję» кажуть. Але сходи від того чистішими самі не стають.",
        },
      ],
      next: "start",
    },
    home: {
      lines: [
        {
          speaker: "Pani Natalia",
          text: "З-під Полтави я. Там зараз яблука, повний сад — а зривати нікому.",
        },
        {
          speaker: "Pani Natalia",
          text: "Син там, з бабусею. Дзвонить: «мамо, коли приїдеш?» А я що скажу...",
        },
        {
          speaker: "Pani Natalia",
          text: "Казала собі — на пів року. Четвертий рік доліки. Ну нічого. Нічого.",
        },
      ],
      next: "start",
    },
    bye: {
      lines: [
        {
          speaker: "Pani Natalia",
          text: "І вам. Йдіть попід стінкою, там сухо. І светр вдягніть, холодає!",
        },
      ],
    },
  },
};

// --- the street's regulars ------------------------------------------------------------

const GOLEBIARKA_TREE: DialogueTree<Ctx> = {
  start: "start",
  nodes: {
    start: {
      lines: [
        {
          speaker: "Pani Gołębiarka",
          text: "Ostrożnie, młody. Zbyszek je. Jak je, to nie lubi publiczności.",
        },
      ],
      choices: [
        { label: "Który to Zbyszek?", next: "zbyszek" },
        { label: "Fontanna kiedyś działała?", next: "fountain" },
        { label: "Miłego dnia.", next: "bye" },
      ],
    },
    zbyszek: {
      lines: [
        {
          speaker: "Pani Gołębiarka",
          text: "Ten siwy z charakterem. Nazwałam po prezesie spółdzielni. Obaj gruchają, żaden nie słucha.",
        },
      ],
      next: "start",
    },
    fountain: {
      lines: [
        {
          speaker: "Pani Gołębiarka",
          text: "Na Dzień Dziecka w dziewięćdziesiątym szóstym. Woda leciała do drugiej po południu.",
        },
        {
          speaker: "Pani Gołębiarka",
          text: "Pamiętam, bo Zbyszek pierwszy się kąpał. Znaczy — tamten Zbyszek. Prezes.",
        },
      ],
      next: "start",
    },
    bye: { lines: [{ speaker: "Pani Gołębiarka", text: "Kaszę bierz, nie chleb. Zapamiętaj." }] },
  },
};

const TRENER_TREE: DialogueTree<Ctx> = {
  start: "start",
  nodes: {
    start: {
      lines: [{ speaker: "Trener", text: "O, sambista. Biodra dzisiaj, czy znowu tylko ramiona?" }],
      choices: [
        { label: "Biodra, trenerze.", next: "hips" },
        { label: "Co z tą girą przy oknie?", next: "gira" },
        { label: "Do roboty.", next: "bye" },
      ],
    },
    hips: {
      lines: [
        { speaker: "Trener", text: "Dobrze. Rwanie zaczyna się od ziemi, nie od lustra." },
        {
          speaker: "Trener",
          text: "Lustro jest dla formy. Forma jest dla stawów. Stawy są na całe życie.",
        },
      ],
      next: "start",
    },
    gira: {
      lines: [
        {
          speaker: "Trener",
          text: "Ta? Trzydzieści dwa kilo, rocznik osiemdziesiąty. Ze starej kotłowni.",
        },
        {
          speaker: "Trener",
          text: "Przeżyła trzy remonty i dwóch prezesów spółdzielni. Szanuj ją.",
        },
      ],
      next: "start",
    },
    bye: { lines: [{ speaker: "Trener", text: "Plecy proste. Nie każ mi tego powtarzać." }] },
  },
};

const COURIER_TREE: DialogueTree<Ctx> = {
  start: "start",
  nodes: {
    start: {
      lines: [
        {
          speaker: "Kurier",
          text: "Kovtun? Nie? To nie podpisujesz. Sekunda, szukam czternastki.",
        },
      ],
      choices: [
        { label: "To ja, z czternastki.", next: "parcel" },
        { label: "Ciężki dzień?", next: "day" },
        { label: "Powodzenia.", next: "bye" },
      ],
    },
    parcel: {
      lines: [
        { speaker: "Kurier", text: "Serio? To i tak wrzuciłem do paczkomatu. Nawyk. Przepraszam." },
      ],
      next: "start",
    },
    day: {
      lines: [
        {
          speaker: "Kurier",
          text: "Sto dwadzieścia paczek, cztery godziny. Apka mówi, że dam radę.",
        },
        { speaker: "Kurier", text: "Apka nigdy nie nosiła lodówki na trzecie piętro." },
      ],
      next: "start",
    },
    bye: { lines: [{ speaker: "Kurier", text: "Dzięki. Miłego." }] },
  },
};

const STUDENT_TREE: DialogueTree<Ctx> = {
  start: "start",
  nodes: {
    start: {
      lines: [
        {
          speaker: "Student",
          text: "Panie, ta lodówka z energetykami to najlepsza półka w mieście.",
        },
      ],
      choices: [
        { label: "Sesja?", next: "exam" },
        { label: "Śpij więcej, młody.", next: "sleep" },
        { label: "Trzymaj się.", next: "bye" },
      ],
    },
    exam: {
      lines: [
        {
          speaker: "Student",
          text: "Kolokwium z analizy o ósmej. Plan jest taki: nie spać, to się nie zaśpię.",
        },
      ],
      next: "start",
    },
    sleep: {
      lines: [{ speaker: "Student", text: "Spanie jest dla ludzi po sesji. Czyli teoretycznych." }],
      next: "start",
    },
    bye: {
      lines: [{ speaker: "Student", text: "Powodzenia na siłce, widzę kettlebell w oczach." }],
    },
  },
};

const WAITING_TREE: DialogueTree<Ctx> = {
  start: "start",
  nodes: {
    start: {
      lines: [
        { speaker: "Czekający", text: "Czekam na żonę. Powiedziała: dwie minuty, tylko chleb." },
      ],
      choices: [
        { label: "Dawno tak stoisz?", next: "time" },
        { label: "Znam ten ból.", next: "pain" },
        { label: "Powodzenia.", next: "bye" },
      ],
    },
    time: {
      lines: [
        {
          speaker: "Czekający",
          text: "Czterdzieści minut. Ale w Żabce czas płynie inaczej. Jak w kosmosie.",
        },
      ],
      next: "start",
    },
    pain: {
      lines: [
        {
          speaker: "Czekający",
          text: "Najgorsze, że wyjdzie z chlebem. I z pięcioma rzeczami, których nie ma na liście.",
        },
        { speaker: "Czekający", text: "Lista jest we mnie. Ja jestem listą." },
      ],
      next: "start",
    },
    bye: { lines: [{ speaker: "Czekający", text: "No. Stoję dalej. Taki sport." }] },
  },
};

const SMOKER_TREE: DialogueTree<Ctx> = {
  start: "start",
  nodes: {
    start: {
      lines: [
        {
          speaker: "Smoker",
          text: "Ej. Sąsiad z czternastki, nie? Ognia nie trzeba, mam.",
        },
      ],
      choices: [
        { label: "Ciężki dzień?", next: "day" },
        { label: "Szkodzi zdrowiu, wiesz.", next: "health" },
        { label: "Trzymaj się.", next: "bye" },
      ],
    },
    day: {
      lines: [
        {
          speaker: "Smoker",
          text: "Normalny. Osiem godzin magazynu, godzina w korku. Ta jedna tutaj to moja własna.",
        },
      ],
      next: "start",
    },
    health: {
      lines: [
        { speaker: "Smoker", text: "Wiem. Rzucam od poniedziałku." },
        { speaker: "Smoker", text: "...Nie pytaj od którego." },
      ],
      next: "start",
    },
    bye: {
      lines: [{ speaker: "Smoker", text: "No. Pozdrów windę, jak działa." }],
    },
  },
};

const BABCIA_TREE: DialogueTree<Ctx> = {
  start: "start",
  nodes: {
    start: {
      lines: [
        {
          speaker: "Babcia Krysia",
          text: "Siadaj, siadaj. Ławka duża, a plotki jeszcze większe.",
        },
      ],
      choices: [
        { label: "Co słychać na osiedlu?", next: "gossip" },
        { label: "Ciężka ta torba?", next: "bag" },
        { label: "Miłego dnia, pani Krysiu.", next: "bye" },
      ],
    },
    gossip: {
      lines: [
        {
          speaker: "Babcia Krysia",
          text: "Z trzynastki bliźniaki nie śpią. Z piętnastki cisza — podejrzane.",
        },
        {
          speaker: "Babcia Krysia",
          text: "A ten z kapturem? Dobry chłopak. Śmieci mi wynosi. Tylko pali jak komin.",
        },
      ],
      next: "start",
    },
    bag: {
      lines: [
        {
          speaker: "Babcia Krysia",
          text: "Kartofle, kefir i chleb. Pół życia w jednej siatce, panie.",
        },
      ],
      next: "start",
    },
    bye: {
      lines: [{ speaker: "Babcia Krysia", text: "Idź, idź. I czapkę noś, bo wieje." }],
    },
  },
};

const ZBYSZEK_TREE: DialogueTree<Ctx> = {
  start: "start",
  nodes: {
    start: {
      lines: [
        {
          speaker: "Pan Zbyszek",
          text: "Idź przodem, ja jeszcze myślę. Nad życiem i nad piwem.",
        },
      ],
      choices: [
        { label: "Długa kolejka?", next: "queue" },
        { label: "Co pan poleca?", next: "reco" },
        { label: "Na zdrowie, panie Zbyszku.", next: "bye" },
      ],
    },
    queue: {
      lines: [
        {
          speaker: "Pan Zbyszek",
          text: "Jedna osoba, a stoję dziesięć minut. Bo ta jedna osoba to ja. Zdecydować nie mogę.",
        },
      ],
      next: "start",
    },
    reco: {
      lines: [
        {
          speaker: "Pan Zbyszek",
          text: "Hot dog bierz. Ale z tej bliższej rolki. Tamta się kręci od wtorku.",
        },
      ],
      next: "start",
    },
    bye: {
      lines: [
        {
          speaker: "Pan Zbyszek",
          text: "No. I paragon bierz, bo potem nie ma człowieka.",
        },
      ],
    },
  },
};

// --- Żabka cashier ---------------------------------------------------------------

function addToInventory(world: WorldState, itemId: string) {
  const existing = world.inventory.find((i) => i.itemId === itemId);
  return existing
    ? world.inventory.map((i) => (i.itemId === itemId ? { ...i, quantity: i.quantity + 1 } : i))
    : [...world.inventory, { itemId, quantity: 1 }];
}

/** How many of something is in the player's pocket. */
function countOf(world: WorldState, itemId: string): number {
  return world.inventory.find((i) => i.itemId === itemId)?.quantity ?? 0;
}

function buy(ctx: Ctx, itemId: string, price: number) {
  if (ctx.world.money < price) {
    playSfx("denied");
    return;
  }
  playSfx("register");
  ctx.updateWorld((w) => ({
    ...w,
    money: w.money - price,
    inventory: addToInventory(w, itemId),
  }));
}

const canAfford = (price: number) => (ctx: Ctx) =>
  ctx.world.money >= price ? `sold-${price}` : "short";

/**
 * The conductor.
 *
 * The first conversation in the game that has real stakes, and it is built out
 * of the dialogue system's own gates rather than out of prose: `when` decides
 * which replies you are even offered, and `locked` shows the one you cannot
 * afford with the reason on it. Before this the tree format had `when`, `locked`
 * and `once` implemented and nothing in the game using any of them.
 *
 * Four ways it can go, and the branch is chosen by what is in your pocket:
 *
 *  – you have a ticket: he punches it, says something about the weather, moves
 *    on. Which is what happens 95% of the time and should be the dullest branch.
 *  – no ticket, enough for the fine: you pay 80 zł and he is almost apologetic.
 *  – no ticket, enough for a ticket on board: 6 zł with the surcharge, and he
 *    lets you off because it is a Wednesday and you look tired.
 *  – no ticket, no money at all: he takes your details, sighs, and gets off at
 *    Zaspa. There is no punishment beyond the sigh, because a game that fines
 *    you into a dead end for looking at the wrong object is not being honest
 *    about what it is.
 */
function buildConductorTree(world: WorldState): DialogueTree<Ctx> {
  const hasTicket = countOf(world, "ticket") > 0;
  return {
    start: () => (hasTicket ? "valid" : "none"),
    nodes: {
      /* --- the ordinary branch --- */
      valid: {
        lines: [
          { speaker: "Konduktor", text: "Dobry wieczór. Bilecik proszę.", mood: "neutral" },
          { text: "You hand it over. He turns it the right way up without looking." },
          {
            speaker: "Konduktor",
            text: "Dziękuję. Zaspa następna.",
            mood: "warm",
          },
        ],
        choices: [
          {
            id: "weather",
            label: "Long shift?",
            next: "weather",
          },
          { label: "Thanks.", next: "off" },
        ],
      },
      weather: {
        lines: [
          {
            speaker: "Konduktor",
            text: "Od szóstej. Do dziesiątej. W czwartek wolne.",
            mood: "warm",
          },
          {
            speaker: "Konduktor",
            text: "Ale w czwartek zawsze coś jest.",
            mood: "sad",
          },
        ],
        next: "off",
      },

      /* --- no ticket --- */
      none: {
        lines: [
          { speaker: "Konduktor", text: "Bilecik proszę.", mood: "neutral" },
          { text: "You do not have one. He can see that you do not have one." },
        ],
        choices: [
          {
            id: "onboard",
            label: "Can I buy one from you? (6 zł)",
            when: (ctx) => ctx.world.money >= 6,
            next: "bought",
            effect: (ctx) => {
              playSfx("register");
              ctx.updateWorld((w) => ({
                ...w,
                money: w.money - 6,
                inventory: addToInventory(w, "ticket"),
              }));
            },
          },
          {
            id: "fine",
            label: "I'll pay the fine.",
            locked: (ctx) => (ctx.world.money >= 80 ? null : "80 zł"),
            next: "fined",
            effect: (ctx) => {
              playSfx("coins");
              ctx.updateWorld((w) => ({ ...w, money: w.money - 80 }));
            },
          },
          { label: "I haven't got anything.", next: "broke" },
        ],
      },
      bought: {
        lines: [
          {
            speaker: "Konduktor",
            text: "Sześć. Z dopłatą. Następny raz w automacie na peronie.",
            mood: "neutral",
          },
          { text: "He writes it out by hand, tears it off, and hands it over." },
        ],
        next: "off",
      },
      fined: {
        lines: [
          {
            speaker: "Konduktor",
            text: "Osiemdziesiąt. Przykro mi, taka taryfa.",
            mood: "tense",
          },
          { text: "He does look sorry about it, which somehow makes it worse." },
        ],
        next: "off",
      },
      broke: {
        lines: [
          { speaker: "Konduktor", text: "Dowód poproszę.", mood: "tense" },
          {
            text: "He copies your name into a little book, very slowly, and does not look up.",
          },
          {
            speaker: "Konduktor",
            text: "Wysiadam w Zaspie. Kup bilet.",
            mood: "sad",
          },
        ],
        next: "off",
      },

      off: {
        lines: [{ text: "He moves down the carriage. Bilety do kontroli." }],
      },
    },
  };
}

/**
 * Jeanne.
 *
 * A comedy of two people with no language in common, and the rule the whole
 * tree is written to is that neither of them is the joke. They are both trying
 * extremely hard, they are both being very polite about total failure, and over
 * about ninety seconds they successfully establish one fact — that this train
 * goes to Gdynia — and acquire one shared word.
 *
 * Three things make it work rather than just being a gag:
 *
 *  – she is never mocked for not speaking Polish and he is never mocked for not
 *    speaking French. The obstacle is the situation, not either person.
 *  – the French is real French and it is not translated. The player is in
 *    exactly the position the character is in, which is the joke: you also do
 *    not know what she said, and you also have to guess.
 *  – it pays off. `tak` becomes a running gag she adopts and starts bolting on
 *    to French sentences, and by the end that one syllable is doing the work of
 *    an entire language, which is roughly how this actually goes.
 */
const JEANNE_TREE: DialogueTree<Ctx> = {
  start: "open",
  nodes: {
    open: {
      lines: [
        {
          speaker: "Jeanne",
          text: "Pardon — excusez-moi. C'est bien le train pour Gdynia ?",
          mood: "warm",
        },
        {
          text: "She has a map on her phone and the expression of someone on their fourth attempt.",
        },
      ],
      choices: [
        { id: "tak", label: "Tak. Gdynia.", next: "tak" },
        { id: "en", label: "Sorry — I don't speak French.", next: "english" },
        { id: "point", label: "Point at the route map on the wall.", next: "map" },
      ],
    },

    /* --- he answers in Polish, which she does not have either --- */
    tak: {
      lines: [
        { speaker: "Jeanne", text: "…Tak ?", mood: "amused" },
        { text: "She repeats it back with the rising tone of somebody filing a new word away." },
        {
          speaker: "Jeanne",
          text: "Tak. Tak, tak. D'accord. Et Gdynia, c'est… loin ?",
          mood: "warm",
        },
        { text: "You have no idea what the second half of that was." },
      ],
      choices: [
        { id: "tak2", label: "Tak.", next: "tak-wrong" },
        { id: "fingers", label: "Hold up four fingers.", next: "fingers" },
        { id: "map2", label: "Point at the route map.", next: "map" },
      ],
    },
    "tak-wrong": {
      lines: [
        { text: "It was not a yes-or-no question. You can see her deciding to let it go." },
        { speaker: "Jeanne", text: "Tak. Bien sûr. Tak.", mood: "amused" },
        { text: 'She says it the way you would say "right" to a man explaining something wrong.' },
      ],
      next: "settle",
    },
    fingers: {
      lines: [
        { speaker: "Jeanne", text: "Quatre ? Quatre arrêts ? Ah — quatre. Merci !", mood: "warm" },
        { text: "It was four. You are as surprised as she is." },
      ],
      next: "settle",
    },

    /* --- he tries English, which nearly works, which is worse --- */
    english: {
      lines: [
        { speaker: "Jeanne", text: "Ah — non, non. Français. Seulement français.", mood: "amused" },
        { speaker: "Jeanne", text: "Mais… Gdynia ? Oui ? Non ?", mood: "warm" },
        {
          text: "She holds the two words out like a fork and a spoon, hoping one of them is right.",
        },
      ],
      choices: [
        { id: "oui", label: "Oui. Gdynia.", next: "oui" },
        { id: "tak3", label: "Tak. — the only word you can offer her.", next: "tak" },
      ],
    },
    oui: {
      lines: [
        { speaker: "Jeanne", text: "Oui ! Vous parlez français !", mood: "warm" },
        { text: "You do not. That was the whole of it, and she is about to find that out." },
        { speaker: "Jeanne", text: "C'est formidable. Alors, je cherche la rue…", mood: "warm" },
        { text: "She is still going. You are nodding. This is the situation now." },
      ],
      next: "settle",
    },

    /* --- the thing that actually works, because it is not language --- */
    map: {
      lines: [
        {
          text: "You point at the diagram by the door. She stands, reads it, and finds Gdynia at the end of the line.",
        },
        { speaker: "Jeanne", text: "Ah ! Là. Gdynia Główna. Le dernier.", mood: "warm" },
        { speaker: "Jeanne", text: "Merci. Vraiment.", mood: "warm" },
      ],
      choices: [
        { id: "prosze", label: "Proszę.", next: "prosze" },
        { id: "nod", label: "Nod, and go back to the window.", next: "settle" },
      ],
    },
    prosze: {
      lines: [
        { speaker: "Jeanne", text: "Prosze.", mood: "amused" },
        { text: "She says it back carefully, with the wrong s, and looks pleased with herself." },
        {
          speaker: "Jeanne",
          text: "Prosze. Tak. Gdynia. Voilà — je parle polonais.",
          mood: "amused",
        },
      ],
      next: "settle",
    },

    settle: {
      lines: [
        { text: "She sits back. Outside, the sheds go past and then the cranes." },
        {
          speaker: "Jeanne",
          text: "…Tak ?",
          mood: "amused",
        },
        { text: "She is checking the word still works. It does." },
      ],
      choices: [
        { id: "yes", label: "Tak.", next: "end" },
        { id: "smile", label: "Say nothing, and look out of the window with her.", next: "end" },
      ],
    },
    end: {
      lines: [
        {
          text: "Four stops is not very long, and neither of you tries again. It is a comfortable sort of quiet.",
        },
      ],
    },
  },
};

/**
 * The welder, twelve hours into a day that started at five.
 *
 * Short, because he is tired. Two exchanges and he is done talking, which is
 * the characterisation — a man being polite to a stranger while wanting very
 * much to be left alone, and the player being allowed to notice that and stop.
 */
const SPAWACZ_TREE: DialogueTree<Ctx> = {
  start: "open",
  nodes: {
    open: {
      lines: [
        { text: "He has a canvas bag between his boots and a hard hat on his knee." },
        { speaker: "Spawacz", text: "Dobry.", mood: "neutral" },
      ],
      choices: [
        { id: "shift", label: "Long one?", next: "shift" },
        { id: "yard", label: "You're off the yard?", next: "yard" },
        { label: "Nod, and leave him alone.", next: "quiet" },
      ],
    },
    shift: {
      lines: [
        { speaker: "Spawacz", text: "Dwanaście. Od piątej.", mood: "sad" },
        { speaker: "Spawacz", text: "W piątek to samo. W sobotę to samo.", mood: "sad" },
      ],
      next: "quiet",
    },
    yard: {
      lines: [
        { speaker: "Spawacz", text: "Stocznia. Co z niej zostało.", mood: "sad" },
        {
          text: "He tips his head at the window. The cranes are going past, four of them, still standing.",
        },
        { speaker: "Spawacz", text: "Dziadek tam robił. Ojciec robił. No i ja.", mood: "neutral" },
      ],
      next: "quiet",
    },
    quiet: {
      lines: [
        {
          text: "He shuts his eyes. He is not asleep — he is just not here for the next four stops.",
        },
      ],
    },
  },
};

/**
 * The nurse, off a night shift and going home to sleep through the afternoon.
 * Friendlier than the welder and just as finished.
 */
const PIELEGNIARKA_TREE: DialogueTree<Ctx> = {
  start: "open",
  nodes: {
    open: {
      lines: [
        {
          speaker: "Pielęgniarka",
          text: "Dzień dobry. Albo dobry wieczór. Nie wiem już.",
          mood: "warm",
        },
      ],
      choices: [
        { id: "shift", label: "Nights?", next: "nights" },
        { id: "far", label: "Far to go?", next: "far" },
        { label: "Let her be.", next: "quiet" },
      ],
    },
    nights: {
      lines: [
        { speaker: "Pielęgniarka", text: "Trzy pod rząd. Dziś ostatnia.", mood: "neutral" },
        {
          speaker: "Pielęgniarka",
          text: "Idę spać o dziesiątej rano i budzę się, kiedy jest ciemno. Człowiek się przyzwyczaja.",
          mood: "sad",
        },
      ],
      next: "quiet",
    },
    far: {
      lines: [
        { speaker: "Pielęgniarka", text: "Zaspa. Dwa przystanki.", mood: "warm" },
        {
          speaker: "Pielęgniarka",
          text: "Wystarczy, żeby zasnąć i się nie obudzić na czas.",
          mood: "amused",
        },
      ],
      next: "quiet",
    },
    quiet: {
      lines: [
        {
          text: "She goes back to her phone, holding it the way you hold something you are not reading.",
        },
      ],
    },
  },
};

// --- Ulica Elektryków: the people of the night shift ---------------------------

/**
 * The bouncer. The joke every real bouncer is in on: total, unhurried calm.
 * Nothing the player says raises his pulse, and the one thing that gets a full
 * sentence out of him is the cranes, because his grandfather painted them.
 */
const BRAMKARZ_TREE: DialogueTree<Ctx> = {
  start: "start",
  nodes: {
    start: {
      lines: [{ speaker: "Bramkarz", text: "Dobry. Spokojnie, wszyscy wejdą.", mood: "neutral" }],
      choices: [
        { label: "Duża kolejka dzisiaj?", next: "queue" },
        { label: "Co to za miejsce w ogóle?", next: "place" },
        { label: "To ja wchodzę.", next: "bye" },
      ],
    },
    queue: {
      lines: [
        { speaker: "Bramkarz", text: "Normalna. W sobotę stoi do rogu.", mood: "neutral" },
        {
          speaker: "Bramkarz",
          text: "Ludzie myślą, że selekcja. A ja po prostu liczę do stu dwudziestu. Przepisy przeciwpożarowe.",
          mood: "amused",
        },
      ],
      next: "start",
    },
    place: {
      lines: [
        {
          speaker: "Bramkarz",
          text: "Hala numer dwa. Dziadek malował te dźwigi, co tam stoją. Minię, przeciw rdzy.",
          mood: "warm",
        },
        {
          speaker: "Bramkarz",
          text: "Teraz ja pilnuję drzwi do jego hali. Jakby wiedział, to by się śmiał. Albo nie.",
          mood: "sad",
        },
      ],
      next: "start",
    },
    bye: {
      lines: [{ speaker: "Bramkarz", text: "Butelka zostaje. Miłej nocy.", mood: "neutral" }],
    },
  },
};

/** Front of the queue, an authority on rooms she has not entered yet. */
const QUEUE_GIRL_TREE: DialogueTree<Ctx> = {
  start: "start",
  nodes: {
    start: {
      lines: [
        {
          speaker: "Dziewczyna z kolejki",
          text: "Słyszysz? Jak barierka drga, to znaczy że gra dobry. Fizyka.",
          mood: "warm",
        },
      ],
      choices: [
        { label: "Długo stoicie?", next: "long" },
        { label: "Kto dzisiaj gra?", next: "who" },
        { label: "Powodzenia na bramce.", next: "bye" },
      ],
    },
    long: {
      lines: [
        {
          speaker: "Dziewczyna z kolejki",
          text: "Dwadzieścia minut. Ale w kolejce na Elektryków czas liczy się inaczej. Jak w saunie.",
          mood: "amused",
        },
      ],
      next: "start",
    },
    who: {
      lines: [
        {
          speaker: "Dziewczyna z kolejki",
          text: "Ktoś z Berlina. Albo z Gdyni. Na plakacie było małymi literami, a duże to była data.",
          mood: "amused",
        },
      ],
      next: "start",
    },
    bye: {
      lines: [
        { speaker: "Dziewczyna z kolejki", text: "Do zobaczenia w środku. Albo na frytkach." },
      ],
    },
  },
};

/** Holding up hall A. Two beers into the philosophy of post-industry. */
const FILOZOF_TREE: DialogueTree<Ctx> = {
  start: "start",
  nodes: {
    start: {
      lines: [
        {
          speaker: "Filozof",
          text: "Patrz. Sto lat temu tu się spawało kadłuby. A teraz co? Teraz się spawamy my.",
          mood: "neutral",
        },
      ],
      choices: [
        { label: "Głębokie.", next: "deep" },
        { label: "Pracowałeś tu?", next: "work" },
        { label: "Trzymaj się ściany.", next: "bye" },
      ],
    },
    deep: {
      lines: [
        { speaker: "Filozof", text: "Nie moje. Z muralu. Ale mural mówi prawdę.", mood: "amused" },
        {
          speaker: "Filozof",
          text: "Wszystko tu mówi prawdę po drugim piwie. Po czwartym zaczyna kłamać.",
          mood: "warm",
        },
      ],
      next: "start",
    },
    work: {
      lines: [
        {
          speaker: "Filozof",
          text: "Ojciec. Wydział elektryczny, W-cztery. Tam, gdzie napis.",
          mood: "sad",
        },
        {
          speaker: "Filozof",
          text: "Mówił: synu, prąd jest jak rzeka. Ja robię w IT. Też rzeka, tylko zimniejsza.",
          mood: "neutral",
        },
      ],
      next: "start",
    },
    bye: {
      lines: [{ speaker: "Filozof", text: "Ściana i ja mamy umowę. Idź, idź." }],
    },
  },
};

/**
 * The man studying the brickwork from six centimetres. The rule of this tree:
 * he is never explained. He is having a completely coherent experience that
 * the player is simply not equipped to share, and both of them are fine.
 */
const STARER_TREE: DialogueTree<Ctx> = {
  start: "start",
  nodes: {
    start: {
      lines: [
        { text: "He is very close to the wall. He does not turn around." },
        { speaker: "Ten Gość", text: "Widzisz to?", mood: "neutral" },
      ],
      choices: [
        { label: "Widzę... cegłę.", next: "brick" },
        { label: "Wszystko w porządku?", next: "ok" },
        { label: "Back away slowly.", next: "bye" },
      ],
    },
    brick: {
      lines: [
        { speaker: "Ten Gość", text: "Nie tę. Tę obok.", mood: "neutral" },
        {
          text: "You look at the one beside it. It is, in every measurable way, an identical brick.",
        },
        { speaker: "Ten Gość", text: "No właśnie.", mood: "warm" },
      ],
      next: "bye2",
    },
    ok: {
      lines: [
        { speaker: "Ten Gość", text: "W najlepszym. Wszystko się zgadza.", mood: "warm" },
        { text: "He says it with the deep peace of a man whose accounts have finally balanced." },
      ],
      next: "bye2",
    },
    bye: {
      lines: [{ text: "You back away. He does not notice. The brick has him now." }],
    },
    bye2: {
      lines: [{ text: "You leave him to it. Somewhere in there is a very good night out." }],
    },
  },
};

// --- inside Turbina ---------------------------------------------------------------

/** The DJ. Two answers and a wall. The wall is part of the set. */
const DJ_TREE: DialogueTree<Ctx> = {
  start: "start",
  nodes: {
    start: {
      lines: [
        { text: "He lifts one headphone cup a centimetre. This is your entire audience window." },
        { speaker: "DJ", text: "No?", mood: "neutral" },
      ],
      choices: [
        { label: "Zagrasz coś...", next: "request" },
        { label: "Dobre to. Co to jest?", next: "what" },
        { label: "Nic, nic. Graj.", next: "bye" },
      ],
    },
    request: {
      lines: [
        { speaker: "DJ", text: "Nie.", mood: "neutral" },
        { text: "The headphone cup goes back down. The negotiation is complete." },
      ],
    },
    what: {
      lines: [
        {
          speaker: "DJ",
          text: "Białe winylowe, bez nalepki. Kupione w Oliwie za pięć złotych.",
          mood: "warm",
        },
        { speaker: "DJ", text: "Jak powiem ci tytuł, przestanie działać.", mood: "amused" },
      ],
      next: "bye",
    },
    bye: {
      lines: [{ text: "He nods once, at you or at the kick drum. Hard to say." }],
    },
  },
};

/** On the sofa, heels in hand. The night's most honest person. */
const TIRED_TREE: DialogueTree<Ctx> = {
  start: "start",
  nodes: {
    start: {
      lines: [
        {
          speaker: "Zmęczona",
          text: "Nie, nie trzeba mi wody. Siedzę. Strategicznie.",
          mood: "amused",
        },
      ],
      choices: [
        { label: "Dobra impreza?", next: "party" },
        { label: "Która godzina, wiesz?", next: "time" },
        { label: "Strategia to podstawa.", next: "bye" },
      ],
    },
    party: {
      lines: [
        {
          speaker: "Zmęczona",
          text: "Najlepsza od miesiąca. Dlatego siedzę. Trzeba umieć dawkować.",
          mood: "warm",
        },
        {
          speaker: "Zmęczona",
          text: "Jeszcze dwa kawałki i wracam. Może trzy. Może zaraz.",
          mood: "amused",
        },
      ],
      next: "start",
    },
    time: {
      lines: [
        {
          speaker: "Zmęczona",
          text: "Nie mów mi. Serio. W tym budynku nie ma godzin, jest tylko bas.",
          mood: "warm",
        },
      ],
      next: "start",
    },
    bye: {
      lines: [{ speaker: "Zmęczona", text: "No. Idź tańczyć. Ktoś musi, ja pilnuję sofy." }],
    },
  },
};

/** The morning after. She has cleaned worse and says so. */
const CLEANER_TREE: DialogueTree<Ctx> = {
  start: "start",
  nodes: {
    start: {
      lines: [
        {
          speaker: "Pani Sprzątająca",
          text: "Ostrożnie, tu mokre. I brokat. Brokat jest wszędzie.",
          mood: "neutral",
        },
      ],
      choices: [
        { label: "Ciężka noc była?", next: "night" },
        { label: "Co ludzie zostawiają?", next: "lost" },
        { label: "Powodzenia z brokatem.", next: "bye" },
      ],
    },
    night: {
      lines: [
        {
          speaker: "Pani Sprzątająca",
          text: "Dla nich? Chyba dobra. Dla podłogi — średnia.",
          mood: "amused",
        },
      ],
      next: "start",
    },
    lost: {
      lines: [
        {
          speaker: "Pani Sprzątająca",
          text: "Jedna kurtka, cztery telefony, jeden but. Jeden!",
          mood: "amused",
        },
        {
          speaker: "Pani Sprzątająca",
          text: "Jak ktoś wyszedł w jednym bucie i nie wrócił, to znaczy, że noc była naprawdę dobra.",
          mood: "warm",
        },
      ],
      next: "start",
    },
    bye: {
      lines: [{ speaker: "Pani Sprzątająca", text: "Brokat wygra. Ale ja mam etat." }],
    },
  },
};

/** The container bar: mulled wine in a returnable cup, and the deposit saga. */
function buildBarmankaTree(world: WorldState): DialogueTree<Ctx> {
  const buys = [
    {
      label: "Grzaniec. (15 zł)",
      next: canAfford(15),
      effect: (ctx: Ctx) => buy(ctx, "grzaniec", 15),
    },
    {
      label: "Piwo z kranu. (12 zł)",
      next: canAfford(12),
      effect: (ctx: Ctx) => buy(ctx, "beer", 12),
    },
    {
      label: "Woda. (6 zł)",
      next: canAfford(6),
      effect: (ctx: Ctx) => buy(ctx, "water", 6),
    },
    { label: "Nic, tylko się grzeję.", next: "bye" },
  ];
  return {
    start: "start",
    nodes: {
      start: {
        lines: [
          { text: `You have ${world.money} zł on you.` },
          { speaker: "Barmanka", text: "No? Grzaniec się kończy, mówię od razu.", mood: "neutral" },
        ],
        choices: buys,
      },
      "sold-15": {
        lines: [
          {
            speaker: "Barmanka",
            text: "Kubek zwrotny. Oddasz — dostaniesz piątaka. Nie oddasz — masz pamiątkę.",
            mood: "amused",
          },
        ],
        next: "more",
      },
      "sold-12": {
        lines: [{ speaker: "Barmanka", text: "Z pianą, bo umiem. Na zdrowie.", mood: "warm" }],
        next: "more",
      },
      "sold-6": {
        lines: [
          {
            speaker: "Barmanka",
            text: "Woda. Szanuję. Ktoś tu jeszcze planuje jutro.",
            mood: "amused",
          },
        ],
        next: "more",
      },
      short: {
        lines: [
          {
            speaker: "Barmanka",
            text: "Brakuje ci. Bankomat jest... nigdzie. Nie ma bankomatu. Witaj na stoczni.",
            mood: "amused",
          },
        ],
        next: "more",
      },
      more: {
        lines: [{ speaker: "Barmanka", text: "Coś jeszcze?" }],
        choices: buys,
      },
      bye: {
        lines: [{ speaker: "Barmanka", text: "Grzej się, grzej. Od tego jest kontener." }],
      },
    },
  };
}

/** The frytki window. There is one menu item and a doctrine around it. */
function buildFrytkarzTree(world: WorldState): DialogueTree<Ctx> {
  return {
    start: "start",
    nodes: {
      start: {
        lines: [
          { text: `You have ${world.money} zł on you.` },
          {
            speaker: "Frytkarz",
            text: "Frytki. Duże. Innych nie ma, małe to porażka.",
            mood: "neutral",
          },
        ],
        choices: [
          {
            label: "Duże frytki. (14 zł)",
            next: (ctx: Ctx) => (ctx.world.money >= 14 ? "sold" : "short"),
            effect: (ctx: Ctx) => {
              if (ctx.world.money < 14) return;
              playSfx("register");
              ctx.updateWorld((w) => ({ ...w, money: w.money - 14 }));
              ctx.startAction("hotdog");
            },
          },
          { label: "Majonez czy ketchup?", next: "sauce" },
          { label: "Może później.", next: "bye" },
        ],
      },
      sold: {
        lines: [
          {
            speaker: "Frytkarz",
            text: "Sól już jest. Sól jest zawsze. Pytanie było retoryczne.",
            mood: "amused",
          },
          {
            text: "They are too hot to eat and you eat them anyway, which is the whole point of frytki at night.",
          },
        ],
      },
      sauce: {
        lines: [
          { speaker: "Frytkarz", text: "Tak.", mood: "neutral" },
          {
            text: "You wait for more. There is no more. There is clearly a right answer and he is watching you find it.",
          },
        ],
        next: "start",
      },
      short: {
        lines: [
          {
            speaker: "Frytkarz",
            text: "Czternaście. Masz mniej. Wróć bogatszy albo głodniejszy, jedno z dwóch pomaga.",
            mood: "amused",
          },
        ],
      },
      bye: {
        lines: [{ speaker: "Frytkarz", text: "Będziesz. O drugiej wszyscy są." }],
      },
    },
  };
}

/** The club bar: free tap water, priced everything else, closed cards at 3. */
function buildKlubowyTree(world: WorldState): DialogueTree<Ctx> {
  const buys = [
    {
      label: "Woda. (0 zł)",
      next: "water",
      effect: () => playSfx("pour"),
    },
    {
      label: "Izotonik. (10 zł)",
      next: canAfford(10),
      effect: (ctx: Ctx) => buy(ctx, "izotonik", 10),
    },
    {
      label: "Piwo. (15 zł)",
      next: canAfford(15),
      effect: (ctx: Ctx) => buy(ctx, "beer", 15),
    },
    { label: "Nic. Odpoczywam od basu.", next: "bye" },
  ];
  return {
    start: "start",
    nodes: {
      start: {
        lines: [
          { text: `You have ${world.money} zł on you. He reads lips; everyone here does.` },
          { speaker: "Barman", text: "NO? CO PODAĆ?", mood: "neutral" },
        ],
        choices: buys,
      },
      water: {
        lines: [
          { speaker: "Barman", text: "KRANÓWA. DARMOWA. PIJ.", mood: "warm" },
          {
            text: "It is the best water you have ever drunk. Every water at 1 a.m. on a dance floor is.",
          },
        ],
        next: "more",
      },
      "sold-10": {
        lines: [{ speaker: "Barman", text: "MĄDRY WYBÓR. ELEKTROLITY.", mood: "warm" }],
        next: "more",
      },
      "sold-15": {
        lines: [{ speaker: "Barman", text: "PIĘTNAŚCIE. KUBEK NA BAR WRACA.", mood: "neutral" }],
        next: "more",
      },
      short: {
        lines: [{ speaker: "Barman", text: "MAŁO. WODA JEST DARMOWA.", mood: "amused" }],
        next: "more",
      },
      more: {
        lines: [{ speaker: "Barman", text: "COŚ JESZCZE?" }],
        choices: buys,
      },
      bye: {
        lines: [{ text: "He is already three orders ahead. The bar swallows you back out." }],
      },
    },
  };
}

function buildCashierTree(world: WorldState): DialogueTree<Ctx> {
  const buys = [
    {
      label: "A pack of reds. (12 zł)",
      next: canAfford(12),
      effect: (ctx: Ctx) => buy(ctx, "cigarettes", 12),
    },
    {
      label: "A lighter. (5 zł)",
      next: canAfford(5),
      effect: (ctx: Ctx) => buy(ctx, "lighter", 5),
    },
    { label: "That's all, thanks.", next: "bye" },
  ];
  return {
    start: "start",
    nodes: {
      start: {
        lines: [
          { text: `You have ${world.money} zł in your pocket.` },
          { speaker: "Cashier", text: "Dzień dobry. What'll it be?" },
        ],
        choices: buys,
      },
      "sold-12": {
        lines: [
          {
            speaker: "Cashier",
            text: "Twelve even. The matches are a gift, they don't scan.",
          },
        ],
        next: "more",
      },
      "sold-5": {
        lines: [{ speaker: "Cashier", text: "Five. Don't lose this one too." }],
        next: "more",
      },
      short: {
        lines: [
          {
            speaker: "Cashier",
            text: "You're short. Happens to everyone. Shelf's not going anywhere.",
          },
        ],
        next: "more",
      },
      more: {
        lines: [{ speaker: "Cashier", text: "Anything else?" }],
        choices: buys,
      },
      bye: {
        lines: [{ speaker: "Cashier", text: "Trzymaj się. Mind the step." }],
      },
    },
  };
}
