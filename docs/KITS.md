# The kits

Three modules under `src/engine/scene/`, all exported from `@/engine`. Everything is
pure geometry precomputed at module scope into `<path>` strings; nothing allocates at
render. See them all drawn at **`/kit`** (with a phase switch).

Conventions: `Rect = [x, y, w, h]` in scene pixels (38 px ≈ 1 m, ground at y=150,
frame 180 tall). Light comes from the top-left. Shadows are the warm black `#171009`.
No `<ellipse>`, `<circle>`, `<polygon>`, strokes or gradients — every curve and
diagonal is whole-pixel rows.

## pixelKit — the grid, materials, texture, volume, type, SMIL

| helper | what for |
|---|---|
| `pxPath(rects)` | many rects of one colour → one `<path>` |
| `shift / mirrorX / mirrorY / scaleRects / clipRects / boundsOf` | rect-list transforms |
| `outline(x,y,w,h,t)` | hollow rect: frames, bezels, reveals |
| `steppedLine(x0,y0,x1,y1,thick)` | a diagonal as merged pixel runs (Bresenham) |
| `steppedEllipse / steppedRing / steppedArch` | discs, rings, arch caps as rows |
| `steppedCone / steppedQuad / steppedRoof / steppedCable` | light shafts, raking bands, pitched roofs, sagging wires |
| `glyphRects(rows)` | a `#`-drawn pictogram → rects |
| `hash(n) / noise2(x,y,seed) / pick(seed,n)` | deterministic noise — nothing ever crawls |
| `Mat`, `M.*`, `dim`, `matFrom(hex)`, `mixMat`, `shade`, `phased(mat)`, `mixHex` | five-tone materials; make one from a hex, mix, brighten, get all four phases |
| `bevelPaths / Bev` | edge-lit box (hi top, mid left, lo right, deep bottom) |
| `boxPaths / Box` | a box with a lit **top face**, a shaded **side** and its **cast** shadow |
| `cylinderPaths / Cylinder` | pipes, columns, drums — four bands that read as round |
| `streaks / chips / rustRuns / dampBloom / saltLine` | weathering: water, knocks, rust, damp, efflorescence |
| `dth(tint, density)` | ordered dither fills: tints `n w c e b`, densities `50 25 12 06` |
| `SharedDefs` | patterns `px-grain stucco agg wood weave roller satin` + `px-brick tile asphalt cobble water rust corrugated` — mount **once** |
| `tiers(build, tint, strength) / Light` | quantized light: four solid tiers at whisper alpha |
| `aoPaths / AOSet / contactPaths / Contact` | occlusion under lips, contact under feet |
| `vignettePaths / Vignette` | the frame |
| `textPath / textRects / PixelText / fontCovers` | the 3×5 font (Latin + Polish) |
| `FLICKER.*`, `Flick`, `stepTranslate` | discrete SMIL: `dying tube flame neon crt breathe data`; hop/skitter translates |

## groundKit — floors that lie down

| helper | what for |
|---|---|
| `courses(x0,x1,top,bottom,{far,near,unit,stagger,grout})` | rows that foreshorten from the wall to the frame; `unit: 0` = plain planks |
| `plates(…, {seed,dark,pale})` | a seeded minority of slabs run dark / pale |
| `planksToward(…)` | boards running at the camera, joints spreading with depth |
| `herringbone(…)`, `cobbles(…)` | parquet; jittered setts |
| `wearLane(x0,x1,y,h)` | the walked line, broken and drifting |
| `bandShade(x0,x1,top,bottom)` | lip under the wall, foot of the frame (paint ≤ 0.14) |
| `scatter / leaves / tufts / puddle / puddles / snowCaps` | what lands on a floor |
| `cracks(starts, bottom)` | stepped diagonals across concrete |
| `flight({x,y,w,steps,dir:"down"\|"left"\|"right",rise,going}) / Stairs` | a whole staircase: mass, treads, nosings, risers, wear, cheeks, landing |
| `kerbStones / grate / manhole / paintLine / zebra / tactile / tyreTracks` | street furniture that is part of the ground |
| `groundLayers(spec) / GroundPaint` | **a complete floor in one call** — kind `slabs tiles boards planks cobbles concrete asphalt`, worn lanes, pattern, litter, foot shade |

## lightKit — where light comes from, and the dark it needs

| helper | what for |
|---|---|
| `fixture(x,y,floorY,opts) / Fixture` | a tube/batten: cone + pool + diffuser/core/caps, optional flicker |
| `streetLamp(x,headY,groundY)` | pool, cone, halo for a column lamp |
| `windowSpill(opening, floorY, {reach,skew,spread}) / doorSpill / windowGlow` | light out of openings onto floors and walls |
| `glow / screenLight` | point sources; the cold upward light of a screen |
| `neon(rects) / Neon` | a tube in **any colour** with three halos and a wall wash |
| `SUNS / sunFor(ph)`, `castShadow / castShadows`, `sunShaft` | where the sun is per phase; the shadows uprights throw; raking bands |
| `underShade / UnderShade`, `rimLight`, `cornerShade` | occlusion under overhangs, rim light, wall-meets-floor |
| `PHASE_WASH / PhaseWash`, `GLASS`, `LIT_WINDOW`, `lampsOn` | the hour as one veil; what glass and lit windows look like per phase |
| `AfterDark` | wrap anything that only exists after dusk |

## Rules of thumb

- Patterns and dither over a surface: keep ≤ 0.3 opacity or it reads as speckle.
- `plates`: keep `dark`/`pale` fractions ≤ 0.2 or the floor becomes a chessboard.
- A plane that must line up with the ground (a footbridge, a doorway) runs at parallax 1.
- CSS `transform` **replaces** an SVG `transform` attribute; put placement on an outer `<g>`.
- Tests: `src/engine/scene/kits.test.ts` — bounds, determinism, shape agreement.

## propKit — street furniture, built once

Each generator returns precomputed paths; each painter takes `set` + `ph` and picks
its own materials (`GALV`, `MUNICIPAL_GREEN`, `MUNICIPAL_BLACK`, `SLAT_OAK`, `PRECAST`).

| generator / painter | what for |
|---|---|
| `bikeRack(x,g,n) / BikeRack`, `bicycle(x,g,facing) / Bicycle` | Sheffield stands; a bike with ring wheels, spokes, diamond frame, lock |
| `litterBin(x,g,"hoop"\|"box"\|"post") / LitterBin` | the three bins there are; `full` |
| `bench(x,g,w,"perforated"\|"slats"\|"shelter") / Bench` | with the shine where people sit and the one burn |
| `planter(x,g,w,h) / Planter` | precast box, soil, shrubs with highlight and shade, blooms; `bare` |
| `bollards(x0,x1,g,pitch) / Bollards` | steel posts with cap and reflective band |
| `busShelter(x,g,w) / BusShelter` | portal frame, roof with dirt, glazed back (`behind`), perch bench, timetable case |
| `kiosk(x,g) / Kiosk` | Ruch box with window full of stock, hatch; `open` false = shutter |
| `noticeBoard(x,y,w,h) / NoticeBoard` | frame, cork, pinned papers, one corner lifting |
| `signPost(x,g,w,h,postH) / SignPost` | a plate on a post, `textAt` for the 3×5 font |
| `cctv(x,y,facing) / Cctv` | camera on an arm, panning, red LED |
| `railing(x0,x1,g,h,pitch) / Railing` | galvanised posts, top and knee rail, rust at the feet |
| `lampPost(x,g,h,"cobra"\|"post-top") / LampPost` | column, plinth, door, head; pair with `streetLamp()` from lightKit at `headAt` |
| `litter(x0,x1,y0,y1,density) / Litter` | stubs, gum, paper, caps, receipts, dry leaves |
| `gulls(points)`, `pigeon(x,y,i,facing) / Pigeon` | the three-pixel gull; a pigeon that hops in discrete jumps |
| `PICTO / picto(name,x,y)` | wheelchair, bicycle, noSmoking, cctv, arrows, exit, bin, wifi |
