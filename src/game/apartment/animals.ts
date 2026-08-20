import { type AnimalConfig, createAnimal } from "@/engine";
import { lazyRegistry } from "@/engine/sprite/lazyRegistry";

/**
 * The animals — everybody on the osiedle who is not on two legs.
 *
 * Same bargain as the cast in `npcs.ts`: the rig owns the anatomy, so an
 * animal is a dozen lines about what it is rather than a sprite sheet. The
 * difference is that there are far fewer of them and one of them is family.
 */

const ANIMALS_FACTORIES: Record<string, () => AnimalConfig> = {
  /**
   * Gross. A shiba, eleven years old, and the reason the flat has a rug in
   * that corner rather than anywhere sensible.
   *
   * Everything here is doing a specific job. The curled tail and the prick
   * ears are what a shiba is from across a room; the red-fawn coat with cream
   * over the muzzle, the throat, the belly and the four feet is urajiro, which
   * is the marking that separates a shiba from a small fox; the medium coat
   * gives him the double-coat fringe along the back without turning him into
   * a pom. `sleeping` is not a mood, it is what unlocks his own frame set —
   * the ribs, the twitch, the one eye, the thump, the sigh, the long unfold —
   * because he is the one animal in the game who is on screen every single
   * day and a loop of one curl would be found out in a week.
   *
   * He is deliberately not `fluffy` and not `large`. He is a small old dog who
   * has decided about most things already.
   */
  gross: () =>
    createAnimal({
      id: "gross",
      name: "Gross",
      species: "dog",
      size: "small",
      doing: "sleeping",
      look: {
        ears: "prick",
        tail: "curled",
        muzzle: "medium",
        coat: "medium",
        fur: "redFawn",
        pattern: "mask",
        belly: "cream",
        nose: "jet",
        eye: "hazel",
      },
      reactions: {
        // he does not get up for you, and both of you know it
        onNotice: "notice",
        onPet: "pet",
        onCall: "unfold",
      },
    }),

  /**
   * The one that lives under the bin sheds and owes nobody anything. Grey
   * tabby, whip tail, and the loaf as a default position.
   */
  kot: () =>
    createAnimal({
      id: "kot-osiedlowy",
      name: "Kot",
      species: "cat",
      size: "small",
      doing: "loafing",
      look: {
        ears: "prick",
        tail: "whip",
        muzzle: "short",
        coat: "short",
        fur: "slate",
        pattern: "tabby",
        belly: "smoke",
        nose: "rose",
        eye: "olive",
      },
    }),

  /**
   * Somebody's, on a lead, on the way back from the park. Large, black and
   * tan, and pleased about the whole arrangement.
   */
  owczarek: () =>
    createAnimal({
      id: "owczarek",
      name: "Owczarek",
      species: "dog",
      size: "large",
      doing: "standing",
      look: {
        ears: "prick",
        tail: "bushy",
        muzzle: "long",
        coat: "medium",
        fur: "sand",
        pattern: "saddle",
        patch: "ink",
        belly: "sand",
        nose: "jet",
        eye: "hazel",
        collar: "oxblood",
      },
    }),

  /**
   * The ginger from the fourth floor who gets out onto the balconies. Fluffy,
   * tufted, and entirely aware of how he looks.
   */
  rudy: () =>
    createAnimal({
      id: "rudy",
      name: "Rudy",
      species: "cat",
      size: "medium",
      doing: "sitting",
      look: {
        ears: "tufted",
        tail: "plume",
        muzzle: "short",
        coat: "fluffy",
        fur: "ginger",
        pattern: "socks",
        belly: "cream",
        nose: "rose",
        eye: "amber",
      },
    }),

  /**
   * The old spaniel from the ground floor, out on the grass twice a day
   * whatever the weather.
   */
  spaniel: () =>
    createAnimal({
      id: "spaniel",
      name: "Spaniel",
      species: "dog",
      size: "small",
      doing: "lying",
      look: {
        ears: "drop",
        tail: "stub",
        muzzle: "medium",
        coat: "fluffy",
        fur: "chestnut",
        pattern: "patched",
        patch: "cream",
        belly: "cream",
        nose: "liver",
        eye: "hazel",
        collar: "navy",
      },
    }),
};

/**
 * Built on first access, not on import. Gross alone is 287 ms of frame
 * assembly and four of the five animals are not in the flat.
 */
export const ANIMALS: Record<string, AnimalConfig> = lazyRegistry(ANIMALS_FACTORIES);

/** Every animal id, without building any of them. */
export const ANIMAL_IDS = Object.keys(ANIMALS_FACTORIES);
