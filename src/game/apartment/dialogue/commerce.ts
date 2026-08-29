import { playSfx } from "@/engine";
import type { WorldState } from "@/lib/worldState";
import type { Ctx } from "./types";

/** Add one of an item to the pocket, stacking quantities. */
export function addToInventory(world: WorldState, itemId: string) {
  const existing = world.inventory.find((i) => i.itemId === itemId);
  return existing
    ? world.inventory.map((i) => (i.itemId === itemId ? { ...i, quantity: i.quantity + 1 } : i))
    : [...world.inventory, { itemId, quantity: 1 }];
}

/** How many of something is in the player's pocket. */
export function countOf(world: WorldState, itemId: string): number {
  return world.inventory.find((i) => i.itemId === itemId)?.quantity ?? 0;
}

/** Pay for a thing and pocket it; refuses politely when short. */
export function buy(ctx: Ctx, itemId: string, price: number): boolean {
  if (ctx.world.money < price) {
    playSfx("denied");
    return false;
  }
  playSfx("register");
  ctx.updateWorld((w) => ({
    ...w,
    money: w.money - price,
    inventory: addToInventory(w, itemId),
  }));
  return true;
}

/**
 * Buy a drink and drink it: the animation that goes with what was bought,
 * started the moment the money changes hands, so it plays as the dialogue
 * closes. A bar is not a shop — nothing bought at one goes home unopened.
 */
export function buyAndDrink(ctx: Ctx, itemId: string, price: number, action: string): boolean {
  const ok = buy(ctx, itemId, price);
  if (ok) ctx.startAction(action);
  return ok;
}

/** Branch helper: to the sold-<price> node, or to "short". */
export const canAfford = (price: number) => (ctx: Ctx) =>
  ctx.world.money >= price ? `sold-${price}` : "short";
