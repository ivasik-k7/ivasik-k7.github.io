/**
 * A registry whose entries are built the first time somebody asks for one.
 *
 * Sprite rigs are expensive to assemble — every frame of every pose is laid
 * out cell by cell at construction — and a registry written as a plain object
 * literal builds all of them the moment the module is imported. Measured on a
 * production build, that was 1.4 s for five animals and 0.4 s for eighteen
 * people, inside a 2.0 s module-evaluation block that ran before the first
 * frame the player ever sees. Opening the game needs one dog and one person.
 *
 * The proxy keeps the ergonomics — `NPCS.natalia` still reads like a field —
 * while turning the cost into something paid per character, on demand, and
 * once. Enumerating the registry still builds everything, which is correct:
 * the casting studio genuinely does want the whole cast.
 */
export function lazyRegistry<T>(factories: Record<string, () => T>): Record<string, T> {
  const built = new Map<string, T>();
  const make = (key: string): T | undefined => {
    if (built.has(key)) return built.get(key);
    const factory = factories[key];
    if (!factory) return undefined;
    const value = factory();
    built.set(key, value);
    return value;
  };
  return new Proxy({} as Record<string, T>, {
    get: (_t, key) => (typeof key === "string" ? make(key) : undefined),
    has: (_t, key) => typeof key === "string" && key in factories,
    ownKeys: () => Reflect.ownKeys(factories),
    getOwnPropertyDescriptor: (_t, key) =>
      typeof key === "string" && key in factories
        ? { configurable: true, enumerable: true, value: make(key) }
        : undefined,
  });
}
