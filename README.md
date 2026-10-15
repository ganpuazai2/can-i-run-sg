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

## Getting started

Requires Node 20 or later. There are no dependencies to install.

```
npm run dev     # http://localhost:5173, using live data from the deployed API
npm test        # verdict rules, NEA parsing, streaks, translations
npm run deploy  # needs the Vercel CLI
```

Set `DATA_GOV_SG_API_KEY` as a Vercel environment variable for higher NEA rate limits. The app also works without one.

## Project structure

```
api/conditions.js   Vercel function: combines six NEA APIs into one cached response
src/
  verdict.js        the Yes / Maybe / Nope rules (pure, tested)
  conditions.js     parses NEA data and finds readings for a region (pure, tested)
  forecast.js       best running window from the 24-hour forecast (pure, tested)
  streak.js         run log, streaks and badges (pure, tested)
  regions.js        NEA's five regions and distance helpers
  app.js            entry point: loads data and wires up controls
  render.js         draws the page from state
  onboarding.js     welcome screen and add-to-home-screen guide
  share.js          share image
  i18n.js, strings.js   translations
tests/              node:test suites
tools/serve.mjs     local dev server
```

## Decisions

**Why there's a server function in front of NEA.** My first version called NEA straight from the browser. It needed six different APIs, and data.gov.sg started rate-limiting me after a couple of page refreshes, so friends would've seen sample data instead of the real numbers. Now one small Vercel function fetches everything together and caches it for five minutes. NEA only gets a few requests however many people open the app, and my API key never reaches the browser.

**Why the worst signal wins.** If you're about to run and there's lightning nearby, it doesn't matter that the air is clean. I didn't want an average score hiding the one thing that should stop you. Air quality gets checked first, so on a bad haze day the advice talks about the haze, not the UV.

**Why PM2.5 counts for more than PSI.** PSI is the number everyone quotes, but it's a 24-hour average, so it can still look fine hours after the air has turned bad. The 1-hour PM2.5 reading is what you're actually breathing on your run, so that's what the verdict leans on.

**Why it's a website and not an app.** I wanted friends to try it from a link, with no app store, no install and no cost to me. It still saves to the home screen, works offline, and any update reaches everyone straight away.

**Why there's no framework.** It's a small app, and plain JavaScript was enough. No build step and no dependencies means it loads fast, and anyone reading the code can follow it without learning a framework first.

## Credits

Built with the help of [Claude](https://claude.ai). Data © NEA, via [data.gov.sg](https://data.gov.sg).
