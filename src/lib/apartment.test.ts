import { describe, expect, it } from "vitest";
import { nearestObject, ROOMS } from "./apartment";
import { initialWorld } from "./worldState";

const allObjects = Object.values(ROOMS).flatMap((room) =>
  room.objects.map((obj) => ({ room, obj })),
);

describe("apartment layout", () => {
  it("has globally unique object ids", () => {
    const ids = allObjects.map(({ obj }) => obj.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps every object inside its room", () => {
    for (const { room, obj } of allObjects) {
      expect(obj.x, `${obj.id} in ${room.id}`).toBeGreaterThan(0);
      expect(obj.x, `${obj.id} in ${room.id}`).toBeLessThan(room.width);
    }
  });

  it("doors lead to real rooms and valid spawn points", () => {
    for (const { obj } of allObjects.filter(({ obj }) => obj.kind === "door")) {
      expect(obj.to).toBeDefined();
      const target = obj.to ? ROOMS[obj.to.room] : undefined;
      expect(target).toBeDefined();
      if (obj.to && target) {
        expect(obj.to.spawnX).toBeGreaterThan(16);
        expect(obj.to.spawnX).toBeLessThan(target.width - 16);
      }
    }
  });

  it("panel objects declare which panel they open", () => {
    for (const { obj } of allObjects.filter(({ obj }) => obj.kind === "panel")) {
      expect(obj.panel).toBeDefined();
    }
  });

  it("finds the nearest object within range and nothing outside it", () => {
    const living = ROOMS.living;
    const dog = living.objects.find((obj) => obj.id === "dog");
    expect(dog).toBeDefined();
    if (!dog) return;
    expect(nearestObject(living, dog.x + 2)?.id).toBe("dog");
    // x=233 sits between the sofa (214, range 12) and Gross (270, range 30)
    expect(nearestObject(living, 233)).toBeNull();
  });

  it("interaction ranges do not create dead ties at doors", () => {
    for (const room of Object.values(ROOMS)) {
      for (const obj of room.objects) {
        expect(nearestObject(room, obj.x)?.id, `standing on ${obj.id}`).toBe(obj.id);
      }
    }
  });

  it("world-state contract matches the floor plan", () => {
    // every window object has a state slot, and vice versa
    const windowIds = allObjects
      .filter(({ obj }) => obj.kind === "window")
      .map(({ obj }) => obj.id);
    expect(new Set(windowIds)).toEqual(new Set(Object.keys(initialWorld.windows)));
    // every room with a lamp object has a per-room light; balcony has neither
    const lampRooms = new Set(
      allObjects.filter(({ obj }) => obj.kind === "lamp").map(({ room }) => room.id),
    );
    for (const roomId of lampRooms) {
      expect(initialWorld.lights, `lights entry for ${roomId}`).toHaveProperty(roomId);
    }
    expect(lampRooms.has("balcony")).toBe(false);
  });
});
