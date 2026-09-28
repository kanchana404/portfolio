# Project covers

Each project card can carry a 16:9 cover (`image` in `src/data/resume.tsx`).
The card lays glass chips over it: the year and category bottom-left, and
`FEATURED` top-right on featured projects. So every cover follows the same
rules:

- Wide 16:9 (1920 × 1080). ChatGPT sometimes returns 3:2 (1536 × 1024); that
  works too, because the card crops the edges and the prompt keeps everything
  inside the central 80%.
- Top-right and bottom-left corners stay calm and empty.
- Colourful but simple: one frosted-glass hero panel, at most three small
  objects around it, one word of large text.
- Big enough to read at card size (about 300 px wide): the word spans about
  40% of the image width and the hero panel about 45%. Never shrink the group
  to clear the corners; move it instead.
- Every small object sits on its own little frosted-glass card, so the whole
  scene is glass. The word is the exception: it sits straight on the
  gradient, never on a glass sheet.
- The site draws the chips itself (year and category bottom-left, `FEATURED`
  top-right). Never put them in the image.
- Keep ChatGPT's PNG outside the repo (../portfolio-originals) and commit a
  WebP: `cwebp -q 88 -m 6 -metadata none in.png -o public/projects/<slug>.webp`
  (about 50 kB instead of 1.3 MB). next/image then serves AVIF or WebP at the
  card's width.

## Backgrounds

The first Kaidenz render used a gradient mesh with blurred colour glows and a
dot grid. The owner rejected it as chunky and bubbly. Every cover background
follows these rules instead:

- One smooth straight gradient (two or three soft brand tones, given as hex values), never a gradient mesh or colour clouds.
- Get the glass look from at most two flat, straight-edged frosted sheets with thin white edges, not from blurred glows. Never put one behind the lettering.
- Nothing round in the background: no bokeh, orbs, blobs, bubbles, circles, glowing spots or dot grids.
- Back glass is always more matte and quieter than the hero glass object, so the hero stays the focus.
- Top-right and bottom-left corners show plain mid-tone gradient only (no edges, lines or shadows), so the white 55% chips with near-black text stay readable.
- Corners stay mid-tone, never near-white, so the light frosted chips do not wash out.
- Keep all content inside the central 80%, and ask for plain gradient padding in case the canvas comes out 3:2.
- In edits, say that the new background must also show through any frosted objects.
- Keep the negative list to one short line; do not describe the unwanted glows in detail.

## Kaidenz Clothing

File: `public/projects/kaidenz-clothing.webp`

The palette comes from the live store (kaidenz-clothing.vercel.app): charcoal
`#111111`, off-white `#F6F6F6` and a warm amber `#FFCB74`.

### Edit 1: background (history, do not reuse)

Pasted into the same ChatGPT chat as the first render. It kept the items and
replaced the background, which the owner liked. Its last foreground line (shrink
the group by 10%) was a mistake: the word and the glass cards came out too small
to read at card size. Edit 2 undoes it.

```text
Keep the items in this image as they are and replace the background.

Foreground: keep the word "KAIDENZ" with the same spelling (K-A-I-D-E-N-Z), font and colour, on the left. Keep the tilted frosted-glass product panel with the charcoal hoodie on the light wooden hanger, the S, M and L size buttons with M in amber, and the charcoal "Add to bag" button. Keep the folded off-white T-shirt at the top centre, the small frosted-glass payment card with the padlock and green tick at the bottom centre, and the amber paper shopping bag with rope handles at the bottom right. Every object keeps the same arrangement and angle, the same soft light from the top-left and the same soft shadows. Keep the same aspect ratio. The only foreground change: make the whole group of objects and the word about 10% smaller, still centred, so the top-right and bottom-left corners have clear empty space. Do not add, remove, redraw or restyle anything in the foreground.

New background:
1. Base: one smooth, even, straight diagonal gradient. Warm amber (#FFCB74) in the top-left, soft peach (#F8D8C4) in the middle, and pale lilac-pink (#E8D9EE) in the bottom-right. Soft, fairly light and seamless, like a sheet of tinted matte paper. The colour changes slowly from corner to corner, with no brighter or darker patches anywhere.
2. Glass: exactly two large, flat, thin sheets of frosted glass stand upright behind the objects. They are plain rounded rectangles with small, neat corners, and nothing is drawn on them.
   - Sheet one is wide and sits behind the word KAIDENZ, tilted about 4 degrees.
   - Sheet two is taller and sits behind the product panel, a little up and to the left of it, tilted about 6 degrees the opposite way.
   - The two sheets overlap slightly in the middle of the image.
3. Each sheet is evenly frosted and milky, so the gradient behind it looks softer and lighter. Each has one thin, crisp, bright white edge line and casts a very faint, soft shadow onto the backdrop.
4. The two back sheets are more matte, more see-through and quieter than the product panel. The product panel stays the brightest and clearest piece of glass, with the strongest edge highlight and shadow, so it is still the main focus.
5. Where the background shows through the frosted product panel and the payment card, show the new smooth gradient and sheets.
6. Both sheets stay in the central area. The top-right corner and the bottom-left corner show only the plain gradient, with no sheet edges, lines or shadows.

The background has only flat planes and straight lines. Leave out bokeh, orbs, bubbles, blobs, circles, glowing spots, lens flares, sparkles, dots, the dot grid, grain, waves and light streaks.

The result should feel clean, calm and minimal: the same items, now in front of a smooth gradient and two simple sheets of frosted glass.
```

### Edit 2: sizes (history, do not reuse)

Pasted into the same chat after edit 1. It kept the sheet behind the word,
which edit 3 removed.

```text
Keep the background exactly as it is: the same smooth gradient and the same two flat frosted-glass sheets behind the objects. Keep the same items, colours, soft light from the top-left, shadows and aspect ratio. Make only these changes:

1. Make the word "KAIDENZ" about 1.5 times bigger, so it spans about 40% of the image width. Same bold, wide, charcoal uppercase lettering with generous letter spacing, spelled exactly K-A-I-D-E-N-Z.
2. Put the folded off-white T-shirt on its own small frosted-glass card, in the same style as the padlock card: translucent white glass, rounded corners, a thin bright white edge and a soft shadow. The T-shirt sits fully inside that card.
3. Make the frosted-glass product panel about 1.25 times bigger, so it spans about 45% of the image width, and the hoodie, the S, M and L buttons and the "Add to bag" button are bigger and easy to read. Make the padlock card and the new T-shirt card about 1.25 times bigger too, and the shopping bag by the same amount.
4. Let the two back glass sheets grow or shift to stay behind the bigger objects.
5. After resizing, nothing touches the edges of the image. Move the group a little down or sideways if needed, rather than making anything smaller. Keep objects and text out of the top-right corner and the bottom-left corner, because the website puts small labels there.

Do not add any other objects or text, and no blobs, bokeh, glows or dots.
```

### Edit 3: no glass behind the word

Edit 2 put the word on the wide back sheet. The owner wants the lettering
straight on the gradient.

```text
Keep this image exactly as it is, with one change: remove the large frosted-glass sheet behind the word "KAIDENZ". The word sits directly on the smooth gradient background, with no glass panel, box, frame, edge line or shadow behind it. Keep the word at the same size, position, font and colour, spelled exactly K-A-I-D-E-N-Z. Keep the glass sheet behind the product panel, the product panel, the T-shirt card, the padlock card, the shopping bag and the background gradient exactly the same. Do not add anything.
```

If blobs or bokeh come back, send:

```text
Keep everything exactly the same, but remove every round shape, blob, glow, bokeh circle and dot from the background, including what shows through the glass panel, so only the smooth gradient and the one flat, straight-edged frosted sheet behind the product panel remain. The word stays solid and straight on the gradient.
```

### Full prompt

For a new chat, or for the next project as a template:

```text
Create a wide 16:9 landscape image (1920 x 1080) for the cover of a project card on a developer portfolio. The project is KAIDENZ, a full-stack online clothing store. The image will be shown small, about 300 px wide, so it must stay clear and simple.

Style: a clean, minimal, modern 3D product illustration with glassmorphism. Soft, matte, clean 3D objects, like a premium app promo. Colourful but calm, with plenty of empty space. No people, no hands, no photographs. Brand colours: charcoal #111111, off-white #F6F6F6, warm amber #FFCB74.

Background:
1. One smooth, even, straight diagonal gradient. Warm amber (#FFCB74) in the top-left, soft peach (#F8D8C4) in the middle, and pale lilac-pink (#E8D9EE) in the bottom-right. Soft, fairly light and seamless, like a sheet of tinted matte paper. The colour changes slowly from corner to corner, with no brighter or darker patches anywhere.
2. Exactly one large, flat, thin sheet of frosted glass stands upright behind the product panel, a little up and to the left of it, tilted about 6 degrees. It is a plain rounded rectangle with small, neat corners, and nothing is drawn on it. There is no glass behind the word KAIDENZ.
3. The sheet is evenly frosted and milky, so the gradient behind it looks softer and lighter. It has one thin, crisp, bright white edge line and casts a very faint, soft shadow onto the backdrop.
4. The back sheet is more matte, more see-through and quieter than the product panel described below, so the product panel stays the main piece of glass.
5. The background has only flat planes and straight lines.

Left half: the word "KAIDENZ" in a bold, wide, clean sans-serif, uppercase, charcoal (#111111), with generous letter spacing, vertically centred, sitting directly on the gradient with no glass, box or frame behind it. It is big: about 40% of the image width. Spell it exactly K-A-I-D-E-N-Z. This is the only large text in the image. The letters themselves are flat, solid and opaque, printed straight onto the gradient: not glass, not transparent, with no reflections, bevel or 3D depth.

Right half, the hero: one large floating frosted-glass panel, about 45% of the image width, shaped like a product page from an online clothing shop, slightly tilted towards the viewer. It is clearer and brighter than the back sheets, with translucent white glass, rounded corners, a crisp bright white edge highlight and a soft shadow underneath. Inside the panel:
- a charcoal oversized hoodie on a light wooden hanger, as the product,
- a row of three small rounded size buttons, S, M and L, with M filled in amber (#FFCB74) and S and L in off-white,
- one charcoal pill-shaped button with the words "Add to bag" in off-white.

Around the panel, simple and floating at different depths:
- a neatly folded off-white T-shirt on its own small frosted-glass card (translucent white glass, rounded corners, a thin bright white edge, a soft shadow), near the top centre, between the word and the panel,
- a small frosted-glass payment card with a charcoal padlock and a small green tick, meaning secure checkout (no numbers, no bank or card logos), near the bottom centre,
- an amber paper shopping bag with rope handles, near the bottom right but still inside the central area.

Lighting: soft studio light from the top-left, gentle soft shadows, subtle reflections on the glass.

Composition:
1. Keep all objects and the lettering inside the central 85% of the frame. Nothing touches the edges.
2. Keep objects and text out of the top-right corner and the bottom-left corner, because the website places small labels there.
3. If the canvas comes out taller than 16:9, fill the extra height above and below with plain gradient, so the image can be cropped to 16:9 without cutting anything.

Leave out of the background: bokeh, orbs, bubbles, blobs, circles, glowing spots, lens flares, sparkles, dots, a dot grid, grain, waves and light streaks.

Also avoid: any other text or letters, real brand logos, watermarks, people, busy patterns, neon, dark or muddy colours, and any objects beyond the ones listed.

Overall feel: clean, calm and minimal, a few simple items in front of a smooth gradient and one sheet of frosted glass.
```

If the lettering comes out misspelt, ask for it again with one change: "Keep
everything the same, but spell the word exactly K-A-I-D-E-N-Z".

## The other seven projects

Drafted 2026-09-28 from the approved Kaidenz prompt: one drafter per project
(each read the project's repo where there is one), then one pass to make the
seven a distinct, consistent set, then one pass for image-model failure modes.

### GSAP Animation Project

File: `public/projects/gsap-animation.webp`. Chip: `2024 · Animation`. Word: VELVET POUR.
Gradient #BEE2A0 to #DDEDC9 to #B3D99E, accent #E7D393, ink #141414.

```text
Create a wide 16:9 landscape image (1920 x 1080) for the cover of a project card on a developer portfolio. The project is VELVET POUR, an animated one-page website for a cocktail bar, with smooth scroll-driven animations. The image will be shown small, about 300 px wide, so it must stay clear and simple.

Style: a clean, minimal, modern 3D product illustration with frosted glass (glassmorphism), like a premium app promo. Soft, matte, clean 3D objects. Colourful but calm, with plenty of empty space. The glass look comes only from the frosted panels and cards described below; there are no blurred colour shapes behind the glass. No people, no hands, no photographs. Brand colours: near-black #141414, pale gold #E7D393 and off-white #EFEFEF, with fresh mint green as a supporting colour.

Background:
1. One smooth, even, straight diagonal gradient. Soft lime (#BEE2A0) in the top-left corner, pale green (#DDEDC9) in the middle, and soft leaf green (#B3D99E) in the bottom-right corner. Soft, fairly light and seamless, like a sheet of tinted matte paper. The colour changes slowly from corner to corner, with no brighter or darker patches anywhere, and every corner stays a soft mid-tone, never close to white.
2. Exactly one large, flat, thin sheet of frosted glass stands upright behind the website panel, slightly larger than it and shifted a little up and to the left, so only a narrow strip of the sheet shows above and to the left of the website panel. The sheet is turned about 6 degrees flat in the picture plane, like a card placed slightly crooked; it is not tilted in 3D. It is a plain rounded rectangle with small, neat corners, and nothing is drawn on it. Its left edge stays in the gap between the words and the panel, so there is no glass behind the words VELVET POUR.
3. The sheet is evenly frosted and milky, so the gradient behind it looks softer and lighter. It has one thin, crisp white edge line that does not glow, and it casts a very faint, soft shadow onto the backdrop.
4. The back sheet is more matte, more see-through and quieter than the website panel described below, so the website panel stays the main piece of glass.
5. The background has only flat planes and straight lines.

Left half: the words "VELVET POUR" in a bold, wide, clean sans-serif, uppercase, near-black (#141414), with generous letter spacing, set on two left-aligned lines in the same letter size: VELVET on the first line and POUR on the second line. The lettering starts about 8% in from the left edge, is vertically centred as one block, and sits directly on the gradient with no glass, card, box or frame behind it and nothing overlapping it. It is big: the longer line, VELVET, is about 40% of the image width, and the capital letters on each line are about 10% of the image height tall. Spell it exactly VELVET, letter by letter V, E, L, V, E, T, on the first line and POUR, letter by letter P, O, U, R, on the second line, with no hyphens, dots or other marks between the letters. This is the only large text in the image. The letters themselves are flat, solid and opaque, printed straight onto the gradient: not glass, not transparent, with no reflections, bevel or 3D depth.

Right half, the hero: one large floating frosted-glass panel, about 45% of the image width and about 55% of the image height, shaped like the landing page of a cocktail bar website. It begins just right of the words and ends about 8% in from the right edge, and its top edge sits about a quarter of the way down from the top of the image. It stands upright and is turned a few degrees in 3D so it faces slightly towards the words; it is not lying flat. It is clearer and brighter than the back sheet, with translucent white glass, rounded corners, a thin crisp white edge line that does not glow and a soft shadow underneath. Inside the panel:
- a tall clear highball glass of mojito in the centre, the largest item in the panel, with a few clear ice cubes, a pale lime-green drink, a lime wheel on the rim and a small sprig of fresh mint; the drink is still, with no bubbles and no drops on the glass,
- one near-black pill-shaped button below the glass with the words "View cocktails" in off-white,
- a thin horizontal timeline bar along the bottom edge of the panel: a near-black track with its left two-thirds filled with pale gold (#E7D393) and a small off-white handle where the gold ends, like a scroll progress bar for the animation.

Around the panel, three small items float at different depths. Each sits on its own small frosted-glass card: a rounded tile about 11% of the image width, with translucent white glass, rounded corners, a thin crisp white edge and a soft shadow. The cards may overlap the edges of the panel a little, but they never cover the words, the panel's button or the gold part of the timeline:
- near the top centre, above the point where the words and the panel meet and higher than the top of the words: a fresh sprig of three deep green mint leaves lying on its card,
- near the bottom centre, below the right end of the words: a card showing one smooth, thick near-black curve that rises steeply from the lower left and levels off towards the upper right, like an animation easing curve, between two thin grey axis lines, with no numbers, no text and no grid,
- near the bottom right, in front of the lower-right corner of the panel and still inside the central area: a small plain matte brass cocktail shaker in soft gold, with no label or engraving, standing upright on its card.

Lighting: soft studio light from the top-left, gentle soft shadows, and one soft, even sheen on each glass surface, with no light streaks.

Composition:
1. Keep all objects and the lettering inside the central 85% of the frame. Nothing touches the edges.
2. Leave the top-right corner and the bottom-left corner as plain, empty gradient, about the outer quarter of the width and the outer fifth of the height at each of those two corners, because the website places small labels there. Do not draw any labels or chips in them.
3. If the canvas comes out taller than 16:9, keep the whole layout in a centred 16:9 band and fill the extra height above and below with plain gradient, so the image can be cropped to 16:9 without cutting anything.

Background exclusions: no bokeh, orbs, blobs, bubbles, circles, glowing spots, dots or dot grids.

Also avoid: any text other than the words VELVET POUR and the button label "View cocktails", real brand logos, bottle labels, watermarks, people, lens flares, light streaks, floating sparkles, grain, waves, busy patterns, neon, dark or muddy background colours, and any objects beyond the ones listed.

Overall feel: clean, calm and minimal, a few simple items in front of a smooth gradient and one sheet of frosted glass.
```

### Google Business API Integration

File: `public/projects/google-business-reviews.webp`. Chip: `2024 · Integration`. Word: REVIEWS.
Gradient #D7B5EA to #EAD3EF to #D4B0E3, accent #FBBF24, ink #14213D.

```text
Create a wide 16:9 landscape image (1920 x 1080) for the cover of a project card on a developer portfolio. The project is a web dashboard that connects to a business profile, fetches customer reviews for each business location and lets the owner reply to them in one click. The cover word is REVIEWS. The image will be shown small, about 300 px wide, so it must stay clear and simple.

Style: a clean, minimal, modern 3D product illustration with frosted glass (glassmorphism), like a premium app promo. Soft, matte, clean 3D objects. Colourful but calm, with plenty of empty space. The glass look comes only from the frosted panels and cards described below; there are no blurred colour shapes behind the glass. No people, no hands, no photographs. Colours: deep navy #14213D, white #FFFFFF, star yellow #FBBF24.

Background:
1. One smooth, even, straight diagonal gradient. Soft orchid (#D7B5EA) in the top-left corner, pale pink-lilac (#EAD3EF) in the middle, and soft mauve-orchid (#D4B0E3) in the bottom-right corner. Soft, fairly light and seamless, like a sheet of tinted matte paper. The colour changes slowly from corner to corner, with no brighter or darker patches anywhere, and every corner stays a soft mid-tone, never close to white.
2. Exactly one large, flat, thin sheet of frosted glass stands upright behind the review panel, slightly larger than it and shifted a little up and to the left, so only a narrow strip of the sheet shows above and to the left of the review panel. The sheet is turned about 6 degrees flat in the picture plane, like a card placed slightly crooked; it is not tilted in 3D. It is a plain rounded rectangle with small, neat corners, and nothing is drawn on it. Its left edge stays in the gap between the word and the panel, so there is no glass behind the word REVIEWS.
3. The sheet is evenly frosted and milky, so the gradient behind it looks softer and lighter. It has one thin, crisp white edge line that does not glow, and it casts a very faint, soft shadow onto the backdrop.
4. The back sheet is more matte, more see-through and quieter than the review panel described below, so the review panel stays the main piece of glass.
5. The background has only flat planes and straight lines.

Left half: the word "REVIEWS" in a bold, wide, clean sans-serif, uppercase, deep navy (#14213D), with generous letter spacing. It starts about 8% in from the left edge, is vertically centred, and sits directly on the gradient with no glass, card, box or frame behind it and nothing overlapping it. It is big: about 40% of the image width, with capital letters about 9% of the image height tall. Spell it exactly REVIEWS, letter by letter R, E, V, I, E, W, S, with no hyphens, dots or other marks between the letters. This is the only large text in the image. The letters themselves are flat, solid and opaque, printed straight onto the gradient: not glass, not transparent, with no reflections, bevel or 3D depth.

Right half, the hero: one large floating frosted-glass panel, about 45% of the image width and about 55% of the image height, shaped like a single customer review card from a business reviews dashboard. It begins just right of the word and ends about 8% in from the right edge, and its top edge sits about a quarter of the way down from the top of the image. It stands upright and is turned a few degrees in 3D so it faces slightly towards the word; it is not lying flat. It is clearer and brighter than the back sheet, with translucent white glass, rounded corners, a thin crisp white edge line that does not glow and a soft shadow underneath. Inside the panel:
- at the top, a plain soft-grey circle as the reviewer's avatar, with no face and no initials, next to two short grey placeholder bars for the reviewer's name and date, with no letters,
- a row of five large, filled, flat matte star-yellow (#FBBF24) five-point stars across the card, not glowing, the most eye-catching part of the panel,
- two grey placeholder lines for the review text, with no letters,
- one deep navy (#14213D) pill-shaped button at the bottom right of the card with the word "Reply" in white.

Around the panel, three small items float at different depths. Each sits on its own small frosted-glass card: a rounded tile about 11% of the image width, with translucent white glass, rounded corners, a thin crisp white edge and a soft shadow. The cards may overlap the edges of the panel a little, but they never cover the word, the stars or the panel's button:
- near the top centre, above the point where the word and the panel meet and higher than the top of the word: two small soft 3D teardrop map pins, one deep navy and one star yellow, each with a plain white centre, standing side by side on their card, meaning several business locations,
- near the bottom centre, below the right end of the word: a deep navy key with a small green tick badge beside it on its card, meaning secure sign-in (no text, no logos),
- near the bottom right, in front of the lower-right corner of the panel and still inside the central area: a small deep navy rounded-rectangle speech bubble with a short tail and a curved white reply arrow inside, on its card, meaning a reply sent.

Lighting: soft studio light from the top-left, gentle soft shadows, and one soft, even sheen on each glass surface, with no light streaks.

Composition:
1. Keep all objects and the lettering inside the central 85% of the frame. Nothing touches the edges.
2. Leave the top-right corner and the bottom-left corner as plain, empty gradient, about the outer quarter of the width and the outer fifth of the height at each of those two corners, because the website places small labels there. Do not draw any labels or chips in them.
3. If the canvas comes out taller than 16:9, keep the whole layout in a centred 16:9 band and fill the extra height above and below with plain gradient, so the image can be cropped to 16:9 without cutting anything.

Background exclusions: no bokeh, orbs, blobs, bubbles, circles, glowing spots, dots or dot grids.

Also avoid: any text other than the word REVIEWS and the button label "Reply", real brand logos (no search engine logo, no letter G mark, no map app icons), watermarks, people or faces, lens flares, light streaks, floating sparkles, grain, waves, busy patterns, neon, dark or muddy background colours, and any objects beyond the ones listed.

Overall feel: clean, calm and minimal, a few simple items in front of a smooth gradient and one sheet of frosted glass.
```

### Fit For Hire - AI-Powered HR Platform

File: `public/projects/fit-for-hire.webp`. Chip: `2024 · HR Tech`. Word: FIT FOR HIRE.
Gradient #9EDDC6 to #CDEEE2 to #9CD8C6, accent #EC4899, ink #18181B.

```text
Create a wide 16:9 landscape image (1920 x 1080) for the cover of a project card on a developer portfolio. The project is FIT FOR HIRE, an AI-powered hiring web app that analyses resumes and matches candidates with the best job openings. The image will be shown small, about 300 px wide, so it must stay clear and simple.

Style: a clean, minimal, modern 3D product illustration with frosted glass (glassmorphism), like a premium app promo. Soft, matte, clean 3D objects. Colourful but calm, with plenty of empty space. The glass look comes only from the frosted panels and cards described below; there are no blurred colour shapes behind the glass. No people, no hands, no photographs. Brand colours: hot pink #EC4899, golden yellow #EAB308, charcoal #18181B.

Background:
1. One smooth, even, straight diagonal gradient. Soft mint (#9EDDC6) in the top-left corner, pale mint (#CDEEE2) in the middle, and soft seafoam (#9CD8C6) in the bottom-right corner. Soft, fairly light and seamless, like a sheet of tinted matte paper. The colour changes slowly from corner to corner, with no brighter or darker patches anywhere, and every corner stays a soft mid-tone, never close to white.
2. Exactly one large, flat, thin sheet of frosted glass stands upright behind the app panel, slightly larger than it and shifted a little up and to the left, so only a narrow strip of the sheet shows above and to the left of the app panel. The sheet is turned about 6 degrees flat in the picture plane, like a card placed slightly crooked; it is not tilted in 3D. It is a plain rounded rectangle with small, neat corners, and nothing is drawn on it. Its left edge stays in the gap between the words and the panel, so there is no glass behind the words FIT FOR HIRE.
3. The sheet is evenly frosted and milky, so the gradient behind it looks softer and lighter. It has one thin, crisp white edge line that does not glow, and it casts a very faint, soft shadow onto the backdrop.
4. The back sheet is more matte, more see-through and quieter than the app panel described below, so the app panel stays the main piece of glass.
5. The background has only flat planes and straight lines.

Left half: the words "FIT FOR HIRE" in a bold, wide, clean sans-serif, uppercase, charcoal (#18181B), with generous letter spacing, set on two left-aligned lines in the same letter size: FIT FOR on the first line and HIRE on the second line. The lettering starts about 8% in from the left edge, is vertically centred as one block, and sits directly on the gradient with no glass, card, box or frame behind it and nothing overlapping it. It is big: the first line is about 40% of the image width, and the capital letters on each line are about 9% of the image height tall. Spell it exactly: first line F, I, T, then a space, then F, O, R; second line H, I, R, E; with no hyphens, commas, dots or other marks between the letters. This is the only large text in the image. The letters themselves are flat, solid and opaque, printed straight onto the gradient: not glass, not transparent, with no reflections, bevel or 3D depth.

Right half, the hero: one large floating frosted-glass panel, about 45% of the image width and about 55% of the image height, shaped like the analysis results screen of an AI resume-screening web app. It begins just right of the words and ends about 8% in from the right edge, and its top edge sits about a quarter of the way down from the top of the image. It stands upright and is turned a few degrees in 3D so it faces slightly towards the words; it is not lying flat. It is clearer and brighter than the back sheet, with translucent white glass, rounded corners, a thin crisp white edge line that does not glow and a soft shadow underneath. Inside the panel:
- on the left, a white resume page with a short charcoal title bar and grey placeholder bars instead of text, crossed across its middle by one thin, solid, flat horizontal band in a pink-to-yellow gradient (#EC4899 to #EAB308), not a glowing beam, as the resume being scanned,
- on the right, two small stacked job cards, each with a small charcoal briefcase icon, two grey placeholder bars and two small blank hot pink skill pills with no text,
- one pill-shaped button under the job cards, filled with the same pink-to-yellow gradient, with the words "Apply Now" in white.

Around the panel, three small items float at different depths. Each sits on its own small frosted-glass card: a rounded tile about 11% of the image width, with translucent white glass, rounded corners, a thin crisp white edge and a soft shadow. The cards may overlap the edges of the panel a little, but they never cover the words or the panel's button:
- near the top centre, above the point where the words and the panel meet and higher than the top of the words: a small off-white resume document with a folded corner and a hot pink (#EC4899) upward arrow on it, meaning resume upload,
- near the bottom centre, below the right end of the words: a small charcoal briefcase with a golden yellow (#EAB308) clasp, meaning job openings posted by employers,
- near the bottom right, in front of the lower-right corner of the panel and still inside the central area: a small magnifying glass with a hot pink (#EC4899) rim and handle and a flat, clear lens with a small green tick inside it and no glare, meaning AI resume screening.

Lighting: soft studio light from the top-left, gentle soft shadows, and one soft, even sheen on each glass surface, with no light streaks.

Composition:
1. Keep all objects and the lettering inside the central 85% of the frame. Nothing touches the edges.
2. Leave the top-right corner and the bottom-left corner as plain, empty gradient, about the outer quarter of the width and the outer fifth of the height at each of those two corners, because the website places small labels there. Do not draw any labels or chips in them.
3. If the canvas comes out taller than 16:9, keep the whole layout in a centred 16:9 band and fill the extra height above and below with plain gradient, so the image can be cropped to 16:9 without cutting anything.

Background exclusions: no bokeh, orbs, blobs, bubbles, circles, glowing spots, dots or dot grids.

Also avoid: any text other than the words FIT FOR HIRE and the button label "Apply Now", real brand logos, watermarks, people, faces or avatars, lens flares, light streaks, laser or scanning glows, floating sparkles, grain, waves, busy patterns, neon, dark or muddy background colours, and any objects beyond the ones listed.

Overall feel: clean, calm and minimal, a few simple items in front of a smooth gradient and one sheet of frosted glass.
```

### AI-Powered Document Summarizer

File: `public/projects/document-summarizer.webp`. Chip: `2024 · AI Web App`. Word: SUMMARY.
Gradient #F4B7A6 to #F5D4CF to #ECB6C6, accent #12A594, ink #1A2238.

```text
Create a wide 16:9 landscape image (1920 x 1080) for the cover of a project card on a developer portfolio. The project is an AI document summarizer, a React web app that turns long online documents into short, easy-to-read summaries. The cover word is SUMMARY. The image will be shown small, about 300 px wide, so it must stay clear and simple.

Style: a clean, minimal, modern 3D product illustration with frosted glass (glassmorphism), like a premium app promo. Soft, matte, clean 3D objects. Colourful but calm, with plenty of empty space. The glass look comes only from the frosted panels and cards described below; there are no blurred colour shapes behind the glass. No people, no hands, no photographs. Colours: deep navy #1A2238, white #FFFFFF, teal #12A594.

Background:
1. One smooth, even, straight diagonal gradient. Soft coral (#F4B7A6) in the top-left corner, pale blush (#F5D4CF) in the middle, and soft rose (#ECB6C6) in the bottom-right corner. Soft, fairly light and seamless, like a sheet of tinted matte paper. The colour changes slowly from corner to corner, with no brighter or darker patches anywhere, and every corner stays a soft mid-tone, never close to white.
2. Exactly one large, flat, thin sheet of frosted glass stands upright behind the app panel, slightly larger than it and shifted a little up and to the left, so only a narrow strip of the sheet shows above and to the left of the app panel. The sheet is turned about 6 degrees flat in the picture plane, like a card placed slightly crooked; it is not tilted in 3D. It is a plain rounded rectangle with small, neat corners, and nothing is drawn on it. Its left edge stays in the gap between the word and the panel, so there is no glass behind the word SUMMARY.
3. The sheet is evenly frosted and milky, so the gradient behind it looks softer and lighter. It has one thin, crisp white edge line that does not glow, and it casts a very faint, soft shadow onto the backdrop.
4. The back sheet is more matte, more see-through and quieter than the app panel described below, so the app panel stays the main piece of glass.
5. The background has only flat planes and straight lines.

Left half: the word "SUMMARY" in a bold, wide, clean sans-serif, uppercase, deep navy (#1A2238), with generous letter spacing. It starts about 8% in from the left edge, is vertically centred, and sits directly on the gradient with no glass, card, box or frame behind it and nothing overlapping it. It is big: about 40% of the image width, with capital letters about 9% of the image height tall. Spell it exactly SUMMARY, letter by letter S, U, M, M, A, R, Y, with two M letters in the middle and no hyphens, dots or other marks between the letters. This is the only large text in the image. The letters themselves are flat, solid and opaque, printed straight onto the gradient: not glass, not transparent, with no reflections, bevel or 3D depth.

Right half, the hero: one large floating frosted-glass panel, about 45% of the image width and about 55% of the image height, shaped like the window of a document summarizer web app. It begins just right of the word and ends about 8% in from the right edge, and its top edge sits about a quarter of the way down from the top of the image. It stands upright and is turned a few degrees in 3D so it faces slightly towards the word; it is not lying flat. It is clearer and brighter than the back sheet, with translucent white glass, rounded corners, a thin crisp white edge line that does not glow and a soft shadow underneath. Inside the panel:
- on the left, a tall white document page with about eight thin light grey lines, as the long original text,
- in the middle, a bold teal (#12A594) arrow pointing right, from the long page to a short white summary card on the right, about half the height of the page. The summary card holds three short navy lines, each starting with a small teal square bullet, as the short summary,
- one teal (#12A594) pill-shaped button below them with the word "Summarize" in white.

Around the panel, three small items float at different depths. Each sits on its own small frosted-glass card: a rounded tile about 11% of the image width, with translucent white glass, rounded corners, a thin crisp white edge and a soft shadow. The cards may overlap the edges of the panel a little, but they never cover the word or the panel's button:
- near the top centre, above the point where the word and the panel meet and higher than the top of the word: a small stack of three white paper pages with folded top corners and thin grey lines,
- near the bottom centre, below the right end of the word: a deep navy chain-link icon made of two plain rounded links, meaning a link to an online document (no web address, no text),
- near the bottom right, in front of the lower-right corner of the panel and still inside the central area: a plain, unbranded teal (#12A594) highlighter pen with its cap on and no label, lying at a slight angle, meaning key points.

Lighting: soft studio light from the top-left, gentle soft shadows, and one soft, even sheen on each glass surface, with no light streaks.

Composition:
1. Keep all objects and the lettering inside the central 85% of the frame. Nothing touches the edges.
2. Leave the top-right corner and the bottom-left corner as plain, empty gradient, about the outer quarter of the width and the outer fifth of the height at each of those two corners, because the website places small labels there. Do not draw any labels or chips in them.
3. If the canvas comes out taller than 16:9, keep the whole layout in a centred 16:9 band and fill the extra height above and below with plain gradient, so the image can be cropped to 16:9 without cutting anything.

Background exclusions: no bokeh, orbs, blobs, bubbles, circles, glowing spots, dots or dot grids.

Also avoid: any text other than the word SUMMARY and the button label "Summarize", real brand logos (including any AI company logo), watermarks, people, lens flares, light streaks, floating sparkles, grain, waves, busy patterns, neon, dark or muddy background colours, and any objects beyond the ones listed.

Overall feel: clean, calm and minimal, a few simple items in front of a smooth gradient and one sheet of frosted glass.
```

### n8n RAG Agent with Web UI

File: `public/projects/n8n-rag-agent.webp`. Chip: `2024 · AI Agent`. Word: RAG AGENT.
Gradient #9FC8F0 to #CCDDF5 to #A8BDF0, accent #6A5AE0, ink #1A1D3A.

```text
Create a wide 16:9 landscape image (1920 x 1080) for the cover of a project card on a developer portfolio. The project is RAG AGENT, an AI assistant that answers questions from a library of documents, with its own web chat interface and automated workflows behind it. The image will be shown small, about 300 px wide, so it must stay clear and simple.

Style: a clean, minimal, modern 3D product illustration with frosted glass (glassmorphism), like a premium app promo. Soft, matte, clean 3D objects. Colourful but calm, with plenty of empty space. The glass look comes only from the frosted panels and cards described below; there are no blurred colour shapes behind the glass. No people, no hands, no photographs. Colours: deep navy #1A1D3A, off-white #F6F6F6, indigo-violet #6A5AE0.

Background:
1. One smooth, even, straight diagonal gradient. Soft sky blue (#9FC8F0) in the top-left corner, pale ice blue (#CCDDF5) in the middle, and soft cornflower blue (#A8BDF0) in the bottom-right corner. Soft, fairly light and seamless, like a sheet of tinted matte paper. The colour changes slowly from corner to corner, with no brighter or darker patches anywhere, and every corner stays a soft mid-tone, never close to white.
2. Exactly one large, flat, thin sheet of frosted glass stands upright behind the chat panel, slightly larger than it and shifted a little up and to the left, so only a narrow strip of the sheet shows above and to the left of the chat panel. The sheet is turned about 6 degrees flat in the picture plane, like a card placed slightly crooked; it is not tilted in 3D. It is a plain rounded rectangle with small, neat corners, and nothing is drawn on it. Its left edge stays in the gap between the words and the panel, so there is no glass behind the words RAG AGENT.
3. The sheet is evenly frosted and milky, so the gradient behind it looks softer and lighter. It has one thin, crisp white edge line that does not glow, and it casts a very faint, soft shadow onto the backdrop.
4. The back sheet is more matte, more see-through and quieter than the chat panel described below, so the chat panel stays the main piece of glass.
5. The background has only flat planes and straight lines.

Left half: the words "RAG AGENT" in a bold, wide, clean sans-serif, uppercase, deep navy (#1A1D3A), with generous letter spacing, set on two left-aligned lines in the same letter size: RAG on the first line and AGENT on the second line. The lettering starts about 8% in from the left edge, is vertically centred as one block, and sits directly on the gradient with no glass, card, box or frame behind it and nothing overlapping it. It is big: the longer line, AGENT, is about 40% of the image width, and the capital letters on each line are about 12% of the image height tall. Spell it exactly RAG, letter by letter R, A, G, on the first line and AGENT, letter by letter A, G, E, N, T, on the second line, with no hyphens, dots or other marks between the letters. This is the only large text in the image. The letters themselves are flat, solid and opaque, printed straight onto the gradient: not glass, not transparent, with no reflections, bevel or 3D depth.

Right half, the hero: one large floating frosted-glass panel, about 45% of the image width and about 55% of the image height, shaped like the chat window of an AI assistant web app. It begins just right of the words and ends about 8% in from the right edge, and its top edge sits about a quarter of the way down from the top of the image. It stands upright and is turned a few degrees in 3D so it faces slightly towards the words; it is not lying flat. It is clearer and brighter than the back sheet, with translucent white glass, rounded corners, a thin crisp white edge line that does not glow and a soft shadow underneath. Inside the panel:
- one small deep navy rounded-rectangle message box on the right side with two short off-white placeholder lines, as the user's question,
- one larger off-white rounded-rectangle answer box on the left side with three grey placeholder lines, and just under it two small rounded source chips, each with a tiny indigo page icon and no text, meaning the answer was found in documents,
- an input bar along the bottom with one grey placeholder line and one indigo (#6A5AE0) pill-shaped button with the word "Ask" in off-white.

Around the panel, three small items float at different depths. Each sits on its own small frosted-glass card: a rounded tile about 11% of the image width, with translucent white glass, rounded corners, a thin crisp white edge and a soft shadow. The cards may overlap the edges of the panel a little, but they never cover the words or the panel's button:
- near the top centre, above the point where the words and the panel meet and higher than the top of the words: a small stack of three off-white document pages with folded top corners and faint grey placeholder lines, meaning the document library,
- near the bottom centre, below the right end of the words: three small plain rounded-square workflow nodes in deep navy, indigo and off-white, with nothing inside them, joined left to right by thin navy connector lines, meaning an automated workflow (no logos),
- near the bottom right, in front of the lower-right corner of the panel and still inside the central area: a small indigo database cylinder made of three stacked discs with a small white page icon printed flat on its front, meaning the document memory.

Lighting: soft studio light from the top-left, gentle soft shadows, and one soft, even sheen on each glass surface, with no light streaks.

Composition:
1. Keep all objects and the lettering inside the central 85% of the frame. Nothing touches the edges.
2. Leave the top-right corner and the bottom-left corner as plain, empty gradient, about the outer quarter of the width and the outer fifth of the height at each of those two corners, because the website places small labels there. Do not draw any labels or chips in them.
3. If the canvas comes out taller than 16:9, keep the whole layout in a centred 16:9 band and fill the extra height above and below with plain gradient, so the image can be cropped to 16:9 without cutting anything.

Background exclusions: no bokeh, orbs, blobs, bubbles, circles, glowing spots, dots or dot grids.

Also avoid: any text other than the words RAG AGENT and the button label "Ask", real brand logos, watermarks, people, robots or faces, lens flares, light streaks, floating sparkles, grain, waves, busy patterns, neon, dark or muddy background colours, and any objects beyond the ones listed.

Overall feel: clean, calm and minimal, a few simple items in front of a smooth gradient and one sheet of frosted glass.
```

### Interactive Travel Web Application

File: `public/projects/travel-3d.webp`. Chip: `2024 · 3D Web`. Word: VOYAGE.
Gradient #92D4DE to #C8E9EE to #8FCFCB, accent #FF814C, ink #021639.

```text
Create a wide 16:9 landscape image (1920 x 1080) for the cover of a project card on a developer portfolio. The project is VOYAGE, an interactive travel web application with a 3D solar system you can explore in the browser. The image will be shown small, about 300 px wide, so it must stay clear and simple.

Style: a clean, minimal, modern 3D product illustration with frosted glass (glassmorphism), like a premium app promo. Soft, matte, clean 3D objects. Colourful but calm, with plenty of empty space. The glass look comes only from the frosted panels and cards described below; there are no blurred colour shapes behind the glass. No people, no hands, no photographs. Brand colours: deep navy #021639, soft white #F7F8FC, warm orange #FF814C.

Background:
1. One smooth, even, straight diagonal gradient. Soft aqua (#92D4DE) in the top-left corner, pale aqua (#C8E9EE) in the middle, and soft teal (#8FCFCB) in the bottom-right corner. Soft, fairly light and seamless, like a sheet of tinted matte paper. The colour changes slowly from corner to corner, with no brighter or darker patches anywhere, and every corner stays a soft mid-tone, never close to white.
2. Exactly one large, flat, thin sheet of frosted glass stands upright behind the app panel, slightly larger than it and shifted a little up and to the left, so only a narrow strip of the sheet shows above and to the left of the app panel. The sheet is turned about 6 degrees flat in the picture plane, like a card placed slightly crooked; it is not tilted in 3D. It is a plain rounded rectangle with small, neat corners, and nothing is drawn on it. Its left edge stays in the gap between the word and the panel, so there is no glass behind the word VOYAGE.
3. The sheet is evenly frosted and milky, so the gradient behind it looks softer and lighter. It has one thin, crisp white edge line that does not glow, and it casts a very faint, soft shadow onto the backdrop.
4. The back sheet is more matte, more see-through and quieter than the app panel described below, so the app panel stays the main piece of glass.
5. The background has only flat planes and straight lines.

Left half: the word "VOYAGE" in a bold, wide, clean sans-serif, uppercase, deep navy (#021639), with generous letter spacing. It starts about 8% in from the left edge, is vertically centred, and sits directly on the gradient with no glass, card, box or frame behind it and nothing overlapping it. It is big: about 40% of the image width, with capital letters about 10% of the image height tall. Spell it exactly VOYAGE, letter by letter V, O, Y, A, G, E, with no hyphens, dots or other marks between the letters. This is the only large text in the image. The letters themselves are flat, solid and opaque, printed straight onto the gradient: not glass, not transparent, with no reflections, bevel or 3D depth.

Right half, the hero: one large floating frosted-glass panel, about 45% of the image width and about 55% of the image height, shaped like a browser window of an interactive travel web app, with a plain slim top bar and no address text. It begins just right of the word and ends about 8% in from the right edge, and its top edge sits about a quarter of the way down from the top of the image. It stands upright and is turned a few degrees in 3D so it faces slightly towards the word; it is not lying flat. It is clearer and brighter than the back sheet, with translucent white glass, rounded corners, a thin crisp white edge line that does not glow and a soft shadow underneath. Inside the panel:
- a simple 3D solar system filling most of the panel, drawn on the same pale frosted white glass, not on a dark space scene: a warm orange (#FF814C) matte sun in the centre with a gentle sheen, not glowing and with no halo; three thin but clearly visible deep navy oval orbit lines around it; and one small matte planet sitting on each orbit: a soft teal planet, a pale blue planet and a small sand-coloured planet with a thin ring,
- one deep navy pill-shaped button in the lower left of the panel with the word "Explore" in soft white.

Around the panel, three small items float at different depths. Each sits on its own small frosted-glass card: a rounded tile about 11% of the image width, with translucent white glass, rounded corners, a thin crisp white edge and a soft shadow. The cards may overlap the edges of the panel a little, but they never cover the word, the sun or the panel's button:
- near the top centre, above the point where the word and the panel meet and higher than the top of the word: a small white and warm orange rocket pointing up and to the right, with no flame, no smoke and no exhaust trail,
- near the bottom centre, below the right end of the word: a small off-white travel ticket with one notched edge, a tiny deep navy ringed-planet icon and two soft grey placeholder bars, meaning a trip (no words, numbers, barcode or logos),
- near the bottom right, in front of the lower-right corner of the panel and still inside the central area: a warm orange teardrop map pin with a plain white centre.

Lighting: soft studio light from the top-left, gentle soft shadows, and one soft, even sheen on each glass surface, with no light streaks.

Composition:
1. Keep all objects and the lettering inside the central 85% of the frame. Nothing touches the edges.
2. Leave the top-right corner and the bottom-left corner as plain, empty gradient, about the outer quarter of the width and the outer fifth of the height at each of those two corners, because the website places small labels there. Do not draw any labels or chips in them.
3. If the canvas comes out taller than 16:9, keep the whole layout in a centred 16:9 band and fill the extra height above and below with plain gradient, so the image can be cropped to 16:9 without cutting anything.

Background exclusions: no bokeh, orbs, blobs, bubbles, circles, glowing spots, dots or dot grids.

Also avoid: any text other than the word VOYAGE and the button label "Explore", real brand logos, watermarks, people, stars, a night sky or galaxy anywhere (including inside the panel), rocket flames, lens flares, light streaks, floating sparkles, grain, waves, busy patterns, neon, dark or muddy background colours, and any objects beyond the ones listed.

Overall feel: clean, calm and minimal, a few simple items in front of a smooth gradient and one sheet of frosted glass.
```

### AI-Enabled SaaS Image Editing Application

File: `public/projects/ai-image-editor.webp`. Chip: `2024 · AI SaaS`. Word: IMAGINIFY.
Gradient #BCB6FF to #D8D3FA to #C7B8F2, accent #7857FF, ink #2B3674.

```text
Create a wide 16:9 landscape image (1920 x 1080) for the cover of a project card on a developer portfolio. The project is IMAGINIFY, a SaaS web app that edits and restores images with AI and runs on a credit system. The image will be shown small, about 300 px wide, so it must stay clear and simple.

Style: a clean, minimal, modern 3D product illustration with frosted glass (glassmorphism), like a premium app promo. Soft, matte, clean 3D objects. Colourful but calm, with plenty of empty space. The glass look comes only from the frosted panels and cards described below; there are no blurred colour shapes behind the glass. No people, no hands, no photographs. Brand colours: violet #7857FF, deep navy #2B3674, soft lavender #BCB6FF, off-white #F4F7FE.

Background:
1. One smooth, even, straight diagonal gradient. Soft lavender (#BCB6FF) in the top-left corner, pale lilac (#D8D3FA) in the middle, and soft lilac-violet (#C7B8F2) in the bottom-right corner. Soft, fairly light and seamless, like a sheet of tinted matte paper. The colour changes slowly from corner to corner, with no brighter or darker patches anywhere, and every corner stays a soft mid-tone, never close to white.
2. Exactly one large, flat, thin sheet of frosted glass stands upright behind the editor panel, slightly larger than it and shifted a little up and to the left, so only a narrow strip of the sheet shows above and to the left of the editor panel. The sheet is turned about 6 degrees flat in the picture plane, like a card placed slightly crooked; it is not tilted in 3D. It is a plain rounded rectangle with small, neat corners, and nothing is drawn on it. Its left edge stays in the gap between the word and the panel, so there is no glass behind the word IMAGINIFY.
3. The sheet is evenly frosted and milky, so the gradient behind it looks softer and lighter. It has one thin, crisp white edge line that does not glow, and it casts a very faint, soft shadow onto the backdrop.
4. The back sheet is more matte, more see-through and quieter than the editor panel described below, so the editor panel stays the main piece of glass.
5. The background has only flat planes and straight lines.

Left half: the word "IMAGINIFY" in a bold, wide, clean sans-serif, uppercase, deep navy (#2B3674), with generous letter spacing. It starts about 8% in from the left edge, is vertically centred, and sits directly on the gradient with no glass, card, box or frame behind it and nothing overlapping it. It is big: about 40% of the image width, with capital letters about 8% of the image height tall. Spell it exactly IMAGINIFY, letter by letter I, M, A, G, I, N, I, F, Y, with three letter I's and no hyphens, dots or other marks between the letters. This is the only large text in the image. The letters themselves are flat, solid and opaque, printed straight onto the gradient: not glass, not transparent, with no reflections, bevel or 3D depth.

Right half, the hero: one large floating frosted-glass panel, about 45% of the image width and about 55% of the image height, shaped like the editing screen of an AI image editor app. It begins just right of the word and ends about 8% in from the right edge, and its top edge sits about a quarter of the way down from the top of the image. It stands upright and is turned a few degrees in 3D so it faces slightly towards the word; it is not lying flat. It is clearer and brighter than the back sheet, with translucent white glass, rounded corners, a thin crisp white edge line that does not glow and a soft shadow underneath. Inside the panel:
- a slim column of three small rounded-square tool buttons down the left edge, in off-white with simple deep navy icons: a small paintbrush, a dashed square selection frame and a small eraser, with the paintbrush button filled in violet (#7857FF) as the active tool,
- one large picture filling most of the panel: a simple stylised illustrated landscape, not a photo, of soft lilac mountains above a calm blue lake under a clear pale sky with no sun, shown as a before and after view. A thin white vertical slider line with a small white handle splits the picture down the middle. The left half is dull, greyish and faded with a few faint scratch lines, and the right half is bright, clean and colourful,
- one violet (#7857FF) pill-shaped button below the picture with the word "Transform" in off-white.

Around the panel, three small items float at different depths. Each sits on its own small frosted-glass card: a rounded tile about 11% of the image width, with translucent white glass, rounded corners, a thin crisp white edge and a soft shadow. The cards may overlap the edges of the panel a little, but they never cover the word, the slider or the panel's button:
- near the top centre, above the point where the word and the panel meet and higher than the top of the word: a small stack of three satin violet (#7857FF) credit coins, each stamped with a simple raised five-point star and no numbers,
- near the bottom centre, below the right end of the word: an off-white magic wand topped by a small solid violet five-point star attached to its tip, with no sparkles, glitter or glow around it, meaning AI editing,
- near the bottom right, in front of the lower-right corner of the panel and still inside the central area: a small fan of three rounded colour swatches in violet, soft lavender and deep navy, meaning recolouring an object (no text or numbers).

Lighting: soft studio light from the top-left, gentle soft shadows, and one soft, even sheen on each glass surface, with no light streaks.

Composition:
1. Keep all objects and the lettering inside the central 85% of the frame. Nothing touches the edges.
2. Leave the top-right corner and the bottom-left corner as plain, empty gradient, about the outer quarter of the width and the outer fifth of the height at each of those two corners, because the website places small labels there. Do not draw any labels or chips in them.
3. If the canvas comes out taller than 16:9, keep the whole layout in a centred 16:9 band and fill the extra height above and below with plain gradient, so the image can be cropped to 16:9 without cutting anything.

Background exclusions: no bokeh, orbs, blobs, bubbles, circles, glowing spots, dots or dot grids.

Also avoid: any text, letters or numbers other than the word IMAGINIFY and the button label "Transform", real brand logos, camera icons, watermarks, people, lens flares, light streaks, floating sparkles, grain, waves, busy patterns, neon, dark or muddy background colours, and any objects beyond the ones listed.

Overall feel: clean, calm and minimal, a few simple items in front of a smooth gradient and one sheet of frosted glass.
```
