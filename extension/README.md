# Cielo browser extension

Manifest V3. Right-click anything → it lands in your Cielo library.

## Build

```bash
npm run build:extension
```

This bundles `src/content-script.js` (and its imports) to `extension/content-script.js`,
which the manifest loads. The file is gitignored — **the extension will load but
silently never scrape if you skip this step.** `background.js` and `popup.js` are
loaded as ES modules directly and need no build.

## Load it in Chrome

1. `npm run build:extension`
2. Open `chrome://extensions`
3. Turn on **Developer mode** (top right)
4. **Load unpacked** → select the `extension/` directory
5. Run the web app (`npm run dev`) and log in at http://localhost:3000/login

The extension talks to whatever `src/lib/config.js` points at — `http://localhost:3000`
for now. Change that constant before shipping.

## What it does

| Right-click on | Menu item           | What gets saved                                               |
| -------------- | ------------------- | ------------------------------------------------------------- |
| page           | Save page to Cielo  | og/twitter metadata scraped from the page                     |
| a link         | Save link to Cielo  | the link target; the server scrapes its title and image       |
| an image       | Save image to Cielo | the image itself, as its own thumbnail (`contentType: IMAGE`) |

Saves go to the section chosen in the popup's **Save to** picker; the default is
General, which is the computed all-items view rather than a real section.

The toolbar badge reports the result, because the popup is normally closed when
you save: `…` in flight, `✓` saved, `!` needs login or failed. Opening the popup
clears it.

## Firefox

Not tested. Firefox supports MV3 but uses `browser.*` with promises and treats
`background.service_worker` differently (it wants `background.scripts`), so this
needs a shim and a manifest variant before it will load. Chrome first.

## Auth

There is no separate extension login. The extension reads the Supabase session
cookie already set by the web app (`src/lib/has-session-cookie.js`) and sends it
with `credentials: "include"`. Log in once in the browser and the extension follows.
