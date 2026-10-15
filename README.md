# Can I Run Today? · Singapore

A clear Yes / Maybe / Nope on whether it's a good time to run outdoors in Singapore, based on live NEA data.

**Live:** https://can-i-run-sg.vercel.app

<img src="docs/screenshot.png" alt="Can I Run? showing a Nope verdict for Central Singapore during haze" width="320" />

## What it checks

- **Haze:** 24-hour PSI and 1-hour PM2.5 for NEA's five regions
- **Heat stress:** WBGT from the nearest NEA station
- **Weather:** 2-hour nowcast, thundery showers and lightning within 10 km
- **UV index**

The verdict takes the worst signal: any red flag means Nope, smaller warnings mean Maybe. It's guidance for healthy adults, not medical advice. Follow [haze.gov.sg](https://www.haze.gov.sg) advisories.

## Features

- English, 中文, Bahasa Melayu and தமிழ்
- Add to home screen (PWA), works offline with the last saved data
- Run streak, calendar and badges, stored only on your device
- Share card with the day's verdict and key numbers
- Links can preset language and region, e.g. `?lang=zh&region=east`

## Project structure

| Path | Purpose |
|---|---|
| `index.html` | Page structure |
| `styles.css` | Styles, light and dark themes |
| `app.js` | Verdict logic, rendering, streaks, sharing |
| `i18n.js` | All text in four languages |
| `api/conditions.js` | Vercel function: combines the NEA real-time APIs into one response, cached at the edge for 5 minutes |
| `sw.js`, `manifest.json` | Offline support and home-screen install |
| `tools/` | Icon source, link-preview source, translation check, local preview builder |

No build step and no dependencies. Data comes from [data.gov.sg](https://data.gov.sg) real-time APIs.

## Running and deploying

```
npx vercel dev       # local, with the API function
npx vercel --prod    # deploy
node tools/check-i18n.mjs   # check every language has every string
```

Set `DATA_GOV_SG_API_KEY` as a Vercel environment variable for higher rate limits. The app also works without one.

## Credits

Built with the help of [Claude](https://claude.ai). Data © NEA, via data.gov.sg.
