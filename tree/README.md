# tree/ — Goodness Tree Canvas

Interactive canvas tree rendered on the community page (`<canvas id="treeCanvas">`).
Orchestrated by `TreeView.js`; all modules are plain ES modules (no build step).

| File | Responsibility |
|---|---|
| `TreeView.js` | Entry point: frame loop, Retina DPI scaling, layers (mist/vignette), branch-coordinate cache |
| `TreeState.js` | Tree growth state |
| `TreePhysics.js` | Branch growth physics |
| `LeafSystem.js` | Leaves particles |
| `GlowEffects.js` | Glow / light effects |
| `TreeAnimations.js` | Animation sequences |
| `RealtimeEngine.js` | Realtime updates wiring |

## Contributing notes

- Keep the frame loop allocation-free where possible; test on mid-range mobile.
- Canvas is decorative: all essential content must remain available without it.
- Cache-busting uses `?v=` query strings on imports — bump them together when changing the modules.
