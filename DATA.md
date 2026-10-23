# Export / import format (version 1)

**Reference → App → Your data → Export** downloads `michaels-baking-YYYY-MM-DD.json`:

```json
{
  "format": "michaels-baking-export",
  "version": 1,
  "app": "2.1",
  "exportedAt": "2026-10-23T12:00:00.000Z",
  "data": { "...": "see below" }
}
```

`data` holds only settings. It never includes the running timer, the screen you were on or the storage epoch/revision:

| key | type | meaning |
|---|---|---|
| `scale` | object | `loaf {mode:"loaves"\|"weight", n 1–8, w 300–12000 g}`, `focaccia {tray, cw, cl 10–80 cm}`, `pizza {balls 1–24, bw 150–400 g}`, `sandwich {tin:"large"\|"std", n 1–6}` |
| `hyd` | object | hydration % for `loaf`, `focaccia`, `pizza`, clamped to each recipe's range |
| `temp` | number | kitchen °C, 16–40 |
| `cold` | object | fridge-stage hours per recipe; must be one of the recipe's listed options |
| `variant` | object | `sandwich: "std" \| "warm" \| "chill"` |
| `plan` | object | `mode`, `anchor`/`day` per recipe, `start`, `custom`, `target` per recipe (`oven` = out of the oven / first pizza in, `serve` = ready to slice or cut / all pizzas done), `away {on, from "HH:MM", to "HH:MM"}`, `accept` |
| `starter` | object | `fedAt` (ms timestamp or null) |
| `sound`, `wake`, `weekHot` | boolean | preferences |
| `theme` | string | `auto` \| `light` \| `dark` |
| `ddt` | object | `target` °C, `flour`/`lev` °C or null (null = kitchen temperature), `fric` °C |

## Import rules
1. The file must parse as JSON and have `format: "michaels-baking-export"` and `version: 1`. Anything else is refused and nothing changes.
2. Unknown keys are ignored. Known keys go through the same `sanitize()` as stored data: numbers are clamped, invalid enums and times are reset to defaults (e.g. `temp: 999` → 40, `away.from: "25:99"` → `23:00`).
3. A preview sheet lists what will change and any values that were repaired. Nothing is replaced until you tap **Replace**.
4. Imported data is saved as a new revision. Other open tabs pick it up through the storage event and never write their older copy back. A running timer in this tab is kept.
