import { createContext, type ReactNode, useContext, useMemo, useSyncExternalStore } from "react";
import { type Band, type BandStore, OPEN_BAND } from "./runtime-perf";

/**
 * runtime-cull.tsx — opt-in occlusion culling for scene artwork.
 *
 * A wide scene draws far more than one screen's worth of geometry. The runtime
 * publishes the visible world slice every frame (quantized, so a settled camera
 * is silent); art wraps expensive regions in <CullBox> and those regions
 * unmount entirely once the camera leaves them.
 *
 * Outside a runtime the band is infinite, so <CullBox> is a transparent
 * wrapper in tests and storybooks.
 */

const BandContext = createContext<BandStore | null>(null);

export function BandProvider({ store, children }: { store: BandStore; children: ReactNode }) {
  return <BandContext.Provider value={store}>{children}</BandContext.Provider>;
}

const openSubscribe = () => () => {};
const getOpenBand = () => OPEN_BAND;

/** The visible world slice in logical scene units. Re-renders only on change. */
export function useVisibleBand(): Band {
  const store = useContext(BandContext);
  const subscribe = store ? store.subscribe : openSubscribe;
  const snapshot = store ? store.get : getOpenBand;
  return useSyncExternalStore(subscribe, snapshot, getOpenBand);
}

/** True when [x, x+width] overlaps the camera, padded to hide pop-in. */
export function useIsVisible(x: number, width: number, pad = 96): boolean {
  const band = useVisibleBand();
  return x + width >= band.x0 - pad && x <= band.x1 + pad;
}

/**
 * Unmounts its children while off camera.
 *
 * <CullBox x={1200} width={400}>
 *   <MarketStalls />
 * </CullBox>
 */
export function CullBox({
  x,
  width,
  pad = 96,
  fallback = null,
  children,
}: {
  x: number;
  width: number;
  pad?: number;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const visible = useIsVisible(x, width, pad);
  return <>{visible ? children : fallback}</>;
}

/**
 * Splits a strip of content into fixed-width chunks and mounts only the ones on
 * camera. `render` is called per chunk index and should draw that slice only.
 */
export function CullStrip({
  width,
  chunkWidth = 320,
  pad = 96,
  render,
}: {
  width: number;
  chunkWidth?: number;
  pad?: number;
  render: (chunk: { index: number; x: number; width: number }) => ReactNode;
}) {
  const band = useVisibleBand();
  const count = Math.max(1, Math.ceil(width / chunkWidth));
  const first = Number.isFinite(band.x0)
    ? Math.max(0, Math.floor((band.x0 - pad) / chunkWidth))
    : 0;
  const last = Number.isFinite(band.x1)
    ? Math.min(count - 1, Math.floor((band.x1 + pad) / chunkWidth))
    : count - 1;
  const chunks = useMemo(() => {
    const out: ReactNode[] = [];
    for (let i = first; i <= last; i++) {
      out.push(
        <g key={i} data-chunk={i}>
          {render({ index: i, x: i * chunkWidth, width: chunkWidth })}
        </g>,
      );
    }
    return out;
  }, [first, last, chunkWidth, render]);
  return <>{chunks}</>;
}
