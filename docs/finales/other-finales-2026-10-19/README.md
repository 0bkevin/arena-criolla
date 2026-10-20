# Other44 final attacks

The user dropped the request to add the song. The game retains its original score and has no YouTube player.

[Interactive movement review](review.html) covers every character except Nacho and Capriles. Each selectable preview shows three seconds of the existing finale, in Caracas, cropped closer so the characters and props remain readable. These are previews from the actual game renderer and assets, with a staged finale state advanced by the actual engine. They are silent previews, rather than recordings of human-controlled fights.

Giuseppe has an eight-pose typing sequence. Most other own finales use existing character poses, seated artwork, and animated props or procedural effects. Their individual eight-pose dance sheets belong to Nacho's attack; they do not imply equally detailed body animation for their own finales. The [catalog](catalog.json) describes the actual motion of all44 without claiming planned movements are implemented.

The final previews use direct canvas exports because the native screen recorder skipped frames in part of the first take. The [native capture trace](capture-events.json) remains diagnostic history. It is not the source of the published animations.

## Reproduce

Run the existing Vite review server on5184 and the loopback-only [frame receiver](frame-receiver.mjs) on5190. Open5190 in the native collaborative browser; evaluate [export-frames.js](export-frames.js) and call `frameExport.start()`. The script draws36 frames per character at simulation ticks0,5,…175, using `renderMatch` and `stepMatch`, and writes a batch per character. Each frame crops x170/y230/740×370 from the unchanged1080×640 arena render. The full source frames stay local under the ignored `frames/` directory.

[encode-frames.py](encode-frames.py) encodes the36 frames as a three-second,12fps animated WebP and a representative still. The final images are560×280 so all44 animations and stills fit the inline artifact's image budget. [previews.json](previews.json) records dimensions, times, file sizes and hashes; [frame-export-events.json](frame-export-events.json) records the direct export. No game graphics or attack logic was changed for these previews.
