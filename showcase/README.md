# Showcase

Every location in the game, shot in the engine at 1600×1000.

The hour is frozen per shot rather than left to the wall clock, because half of
what these places are is the light on them: the same yard is a different yard at
noon, at dusk and at half eleven at night. Where a location appears twice, that
is why.

| | Location | Hour |
|---|---|---|
| [01](01-the-flat.png) | The flat — Gross asleep on his rug, the stenka, the balcony door | 17:24 |
| [02](02-the-flat-night.png) | The flat after dark, one lamp on | 23:24 |
| [03](03-the-study.png) | The study | 10:24 |
| [04](04-the-bathroom.png) | The bathroom | 08:24 |
| [05](05-the-balcony.png) | The balcony at dusk | 19:24 |
| [06](06-the-landing.png) | The landing — Pani Natalia washing the floor | 07:24 |
| [07](07-the-lift.png) | The lift | 22:24 |
| [08](08-the-yard.png) | The yard and the Żabka on the corner | 17:24 |
| [09](09-the-yard-bench.png) | The bench by block 14 — Babcia Krysia and the pigeons | 12:24 |
| [10](10-the-yard-night.png) | The bus stop at night — Pan Heniek still waiting | 23:24 |
| [11](11-zabka.png) | Żabka, open 24 h | 17:24 |
| [12](12-parking.png) | Parking level −1 — Pan Marek under the bonnet | 21:24 |
| [13](13-the-gym.png) | Siłownia, reception | 18:24 |
| [14](14-the-gym-floor.png) | Siłownia, the weights floor | 18:24 |
| [15](15-the-square.png) | Osiedle — the roastery on the square | 16:24 |
| [16](16-the-square-dusk.png) | Osiedle at dusk | 19:24 |
| [17](17-the-square-night.png) | Osiedle after eleven | 23:24 |

## Reproducing these

The dev server must be running. The capture script drives headless Chromium
over CDP, freezes `Date` to the hour named in the table, loads
`?scene=<id>&x=<position>` and screenshots the viewport. Scene ids are the keys
of `APARTMENT_SCENES` and `OUTSIDE_SCENES`; the `x` chooses where the camera
sits, since these scenes are up to 1760 px wide and the camera follows the
player.
