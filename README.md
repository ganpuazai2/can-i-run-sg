# Can I Run Today? · Singapore

A clear Yes / Maybe / Nope on whether it's a good time to run outdoors in Singapore, based on live NEA data: 24-hour PSI, 1-hour PM2.5, heat stress (WBGT), lightning, rain forecasts and UV.

**Live:** https://can-i-run-sg.vercel.app

- Five NEA regions (North, South, East, West, Central)
- English, 中文, Bahasa Melayu and தமிழ்
- Installable to the home screen (PWA), works offline with the last saved data
- Run streak, calendar and badges stored locally on your device

For guidance only. Follow [haze.gov.sg](https://www.haze.gov.sg) advisories.

## How it works

| File | Purpose |
|---|---|
| `index.html` | The whole app: markup, styles and logic |
| `i18n.js` | All text in four languages |
| `api/conditions.js` | Vercel function that combines the NEA real-time APIs into one response, cached at the edge for 5 minutes |
| `sw.js`, `manifest.json` | Offline support and home-screen install |
| `tools/` | Dev scripts (icon, map and screenshot helpers) |

Data comes from [data.gov.sg](https://data.gov.sg) real-time APIs. Set `DATA_GOV_SG_API_KEY` as an environment variable on Vercel for higher rate limits; the app also works without one.

## Deploy

```
npx vercel --prod
```
