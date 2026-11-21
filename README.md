# Nestwell

A static site that looks like an ordinary smart-home marketing page and gets steadily worse the further you scroll.

## Run

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

## The descent

| Section | What changes |
|---|---|
| Hero, logos, features, stats | Normal SaaS page. Copy is slightly off ("0 successful uninstalls"). |
| Testimonials | Color starts draining. One review cuts off mid-sentence. |
| Pricing | The "Forever" plan: cancellation not available. |
| How it works | Page goes dark, the headings switch to a serif font, the last step shakes. |
| FAQ | The last question opens by itself and won't close. |
| Profile | A terminal types out your local time, device, screen size, battery, how often you scrolled back up, and how often you hovered over "Forever". |
| Camera | A fake CCTV feed of "your hallway". A figure walks toward the camera as you scroll, and moves closer when you switch tabs. |
| Finale | Red eyes follow your cursor, then a single jump scare at the bottom. |

Across the whole page: scroll depth drives the background, text and accent colors, desaturation, vignette, film grain, scanlines, random flicker, words briefly replaced with "help" / "behind you", a lagging ghost cursor, the nav brand and CTA text, the tab title (changes when you switch tabs), and the favicon. Once you've reached the end, the top of the page stays slightly stained, and the hero changes to "Welcome back" with a figure in the attic window (for the rest of the browser session).

Sound is opt-in through the "Play calming ambience" button. A major-chord pad slowly turns dissonant, a low drone and a heartbeat come in, and the jump scare plays a sting.

## Notes

- No build step and no dependencies apart from Google Fonts.
- All "profile" data is read locally in the browser. Nothing is sent anywhere.
- `prefers-reduced-motion` turns off the shaking, flicker and word glitches, and makes the jump scare a still image. The scare is one 0.7 s frame, not a repeated flash.
