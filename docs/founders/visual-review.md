# Founder sprite visual review

The v2 selection below is superseded by the [18 October v3 consistency review](style-v3/review.md). The game now uses freshly drawn v3 sheets, compact individual ready stances, updated photo-based faces, padded cells and lossless runtime assets. The previous review remains as historical context.

Reviewed 17 October 2026. These are the selected five founder sprite sheets; Mafe Vera is not included as a playable character. Juan José Pocaterra represents both Vikua and La Wawa.

Each sheet has eight complete poses. I checked the source sheets against the collected founder photos and the existing `zavarce-v5` / `capriles-v3` style. I also rendered every character through the actual `drawVictory` renderer at 1280×720 at the 1.4-second accent and 3.5-second finish, paired with Zavarce as the losing fighter. Winners and loser stayed in frame, facing correctly, with no missing limbs or gameplay-scale mesh artifacts. Tiny colored edge specks remain visible at source-image zoom on some sheets, but are not a material distraction at game scale and are comparable to fringe on existing sheets.

| Character | Selected sheet | Visual result |
| --- | --- | --- |
| Carlos García Ottati | `assets/source/carlos-v2.png` | The corrected short, swept-back brown hair now matches the current Kavak corporate portrait. Clean-shaven face, black workshop-style zip jacket with blue trim, white shirt, dark jeans, and white shoes read consistently across all eight poses. No clipping or visibility issue. |
| Víctor Cárdenas Codriansky | `assets/source/victor-v2.png` | Short dark hair, light stubble, smiling face, black tee, and small orange Slash mark align with the company/video references and chosen outfit. All eight poses remain coherent; no clipping or visibility issue. |
| Enrique | `assets/source/enrique-v2.png` | Short dark hair and clean-shaven smiling face match the Fina portrait and group reference. Dark zip jacket, black shirt, and purple Fina accent stay clear and consistent. All eight poses are complete and unclipped. |
| Jesús | `assets/source/jesus-v2.png` | The face, orange cap, dark polo, dark trousers, and white/orange shoes match the Kontigo portrait and interview look. All eight poses are complete and unclipped. Rechecked after the victory-frame update: he uses the jump pose for the accent, then returns to frame 0 for the held finish. At 3.5 seconds he is grounded, with both shoes visibly planted; the held-jump concern is resolved. |
| Juan José Pocaterra Mendoza | `assets/source/juan-v2.png` | Short wavy dark hair, close beard, and friendly face align with the current profile and Vikua references. Pale blue Vikua shirt, navy trousers, and brown shoes follow the first-party company-photo cue. No cap or glasses; those were specific to an older event photo. Consistent and unclipped across all eight poses. |

The selected sheets follow the established hand-painted fighting-atlas style. At the tested game scale, brand marks, cap, outfits, and faces remain legible; the defeated fighter is still visible on the opposite side. The initial Jesús finish-pose concern was resolved by returning him to the grounded frame at the end of the celebration.
