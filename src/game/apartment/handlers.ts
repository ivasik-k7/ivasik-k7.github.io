import type { DialogueTree, InteractionHandler } from "@/engine";
import { playSfx } from "@/engine";
import i18n from "@/i18n";
import { dayPhase, studioState, TV_CYCLE, type TvChannel, type WorldState } from "@/lib/worldState";
import { openDialogueFor } from "./dialogue";
import { addToInventory, countOf } from "./dialogue/commerce";

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

  sport: ({ obj, world, showToast, startAction, queueToast, shakeCamera }) => {
    if (!obj.action) return;
    // a bench, with a beer in the pocket, is a bench with a beer
    const withBeer = obj.action === "sit" && world.inventory.some((i) => i.itemId === "beer");
    startAction(withBeer ? "sitBeer" : obj.action);
    if (obj.action === "smoke") playSfx("match");
    if (obj.action.startsWith("sit")) playSfx("doorshut");
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

  /**
   * Breakfast is a minigame now.
   *
   * It used to be one of the chore handlers: press E, the flag flips, a heart
   * pops over the dog, done. Which is a fair way to model taking the bin out —
   * but feeding an animal is not a chore you perform on a flat, it is something
   * you do *with* somebody, and the somebody has opinions. So the bowls open a
   * scene: you pour, he creeps, you tell him to wait, and how well it goes is
   * between the two of you.
   *
   * The chore flag is still set, by the overlay's verdict rather than here —
   * however badly it went, he has been fed.
   */
  bowls: ({ world, showToast, openOverlay }) => {
    if (studioState(world).bowlsFilled) {
      showToast(t("flavor.dogbowls"));
      return;
    }
    playSfx("click");
    openOverlay({ type: "bowls" });
  },

  // the guitar comes off the wall for one quiet loop of Am–F–C–G.
  // Strums are timed to the animation (320ms frames): first stroke as the
  // hand first crosses the strings, half-time while the head nods, the
  // last chord rung out with the chin up and left to decay.
  /** The guitar is a minigame now — the strum timeline became its pattern. */
  guitar: ({ openOverlay, updateWorld }) => {
    // once it has been played it stays on the stand, even after dark
    updateWorld((w) => ({ ...w, studio: { ...studioState(w), guitarOut: true } }));
    openOverlay({ type: "guitar" });
  },

  panel: ({ obj, openOverlay }) => {
    playSfx("click");
    if (obj.data) openOverlay({ type: "panel", id: obj.data });
  },

  // the sleep panel rides the animation: it opens once he is lying down, and
  // walking away before that cancels it along with the lie
  bed: ({ obj, startAction, showToast, openOverlay, shakeCamera }) => {
    const timers: number[] = [];
    startAction("lay", {
      onInterrupt: () => {
        for (const timer of timers) window.clearTimeout(timer);
      },
    });
    playSfx("doorshut");
    timers.push(window.setTimeout(() => shakeCamera(1.5, 200), 1200));
    showToast(t("toast.bedLie"));
    timers.push(
      window.setTimeout(() => {
        if (obj.data) openOverlay({ type: "panel", id: obj.data });
      }, 5400),
    );
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

  cashier: (ctx) => openDialogueFor(ctx, "cashier"),

  konduktor: (ctx) => openDialogueFor(ctx, "konduktor"),

  jeanne: (ctx) => openDialogueFor(ctx, "jeanne"),

  liftpanel: (ctx) => {
    playSfx("click");
    openDialogueFor(ctx, "lift-panel");
  },

  car: ({ obj, showToast }) => {
    playSfx("cardoor");
    showToast(t(`flavor.${obj.id}`));
  },

  mycar: (ctx) => {
    void import("./dialogue/parking").then((m) => {
      ctx.startDialogue(m.buildGolfTree(ctx.world.golfLocked) as DialogueTree<never>);
    });
  },

  /**
   * Every conversation lives in ./dialogue — per-scene modules on their own
   * chunks, one registry keyed by object id, Pan Marek as the traditional
   * fallback for talking to somebody unexpected.
   */
  npc: (ctx) => openDialogueFor(ctx, ctx.obj.id),

  // --- Ulica Słoneczna: street furniture that answers back ------------------------

  /**
   * The festoon breaker on the pole. auto → off → on → auto, and the whole
   * street's bulbs answer — a light switch with forty lamps on it is the most
   * theatrical interaction three world-bytes can buy.
   */
  festoon: ({ world, updateWorld, showToast, startAction }) => {
    startAction("use");
    playSfx("click");
    const bag = ((world as unknown as { elektrykow?: Record<string, unknown> }).elektrykow ??
      {}) as Record<string, unknown>;
    const cur = typeof bag.festoon === "string" ? bag.festoon : "auto";
    const next = cur === "auto" ? "off" : cur === "off" ? "on" : "auto";
    updateWorld(
      (w) =>
        ({
          ...w,
          elektrykow: {
            ...((w as unknown as { elektrykow?: object }).elektrykow ?? {}),
            festoon: next,
          },
        }) as typeof w,
    );
    showToast(
      t(
        next === "off"
          ? "toast.festoonOff"
          : next === "on"
            ? "toast.festoonOn"
            : "toast.festoonAuto",
      ),
    );
  },
  /** The cash machine on block 16 — a whole minigame of municipal patience. */
  bankomat: ({ openOverlay, startAction }) => {
    startAction("use");
    playSfx("click");
    openOverlay({ type: "bankomat" });
  },

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
    openDialogueFor(ctx, "barmanka");
  },

  /** The frytki trailer. The economy of small joys, fried. */
  frytki: (ctx) => {
    const ph = dayPhase(new Date().getHours());
    if (ph === "morning" || ph === "day") {
      ctx.showToast(t("toast.frytkiShut"));
      return;
    }
    openDialogueFor(ctx, "frytkarz");
  },

  /** The club's own bar. Water is free, which is the law and also kindness. */
  clubbar: (ctx) => {
    openDialogueFor(ctx, "klubowy");
  },

  /** The portaloo, and the club WC: both are a door, a wait, and a lesson. */
  portaloo: ({ blackout }) => {
    playSfx("doorshut");
    blackout(1600, t("toast.portaloo"));
  },

  /**
   * The dance floor is a minigame now: follow the crowd's lean at 126 bpm.
   * The sambo drill stays as the walk-up — he approaches the floor the way
   * he trains, footwork first, and then the floor takes over.
   */
  dance: ({ startAction, shakeCamera, openOverlay }) => {
    startAction("sambo");
    shakeCamera(1.5, 600);
    openOverlay({ type: "dance" });
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
