/**
 * Inventory — pure helpers over a plain item list.
 * Games keep `items: InventoryItem[]` (and usually `money: number`)
 * inside their world state; these helpers never mutate.
 */

export interface InventoryItem {
  id: string;
  qty: number;
}

export function addItem(items: InventoryItem[], id: string, qty = 1): InventoryItem[] {
  const existing = items.find((i) => i.id === id);
  if (!existing) return [...items, { id, qty }];
  return items.map((i) => (i.id === id ? { ...i, qty: i.qty + qty } : i));
}

export function removeItem(items: InventoryItem[], id: string, qty = 1): InventoryItem[] {
  return items.map((i) => (i.id === id ? { ...i, qty: i.qty - qty } : i)).filter((i) => i.qty > 0);
}

export function countItem(items: InventoryItem[], id: string): number {
  return items.find((i) => i.id === id)?.qty ?? 0;
}

export function hasItem(items: InventoryItem[], id: string, qty = 1): boolean {
  return countItem(items, id) >= qty;
}

/** Spend money if affordable; returns the new amount or null when short. */
export function spend(money: number, price: number): number | null {
  return money >= price ? money - price : null;
}
