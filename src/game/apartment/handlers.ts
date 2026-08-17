import type { DialogueTree, InteractionCtx, InteractionHandler } from "@/engine";
import { playSfx } from "@/engine";
import i18n from "@/i18n";
import { TV_CYCLE, type TvChannel, type WorldState } from "@/lib/worldState";

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

  // the guitar comes off the wall for one quiet loop of Am–F–C–G.
  // Strums are timed to the animation (320ms frames): first stroke as the
  // hand first crosses the strings, half-time while the head nods, the
  // last chord rung out with the chin up and left to decay.
  guitar: ({ obj, startAction, spawnFx, queueToast, shakeCamera }) => {
    const timers: number[] = [];
    startAction("strum", {
      onInterrupt: () => {
        for (const timer of timers) window.clearTimeout(timer);
      },
    });
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

  plant: ({ world, updateWorld, showToast, startAction }) => {
    startAction("use");
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
