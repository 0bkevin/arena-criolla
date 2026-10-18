# Nacho — identity and recent wardrobe references, v40

Inspected on 18 October 2026. Requested reference window: **18 October 2024–18 October 2026**. The selected reference set below was published in May 2026; older videos outside that window are excluded from the recommended sprite brief.

## Existing game character and identity check

`shared/fighters.json` identifies **`nacho`**, combat sprite **`nacho-v15`**, ability `syncopate`, special `Paso sincopado`, title `Síncopa de escenario`. The existing authored entrance uses `nacho-defiant-entrance` in `shared/entrance-assets.json`. I inspected the current combat atlas: close-cropped hair with shaved lines, angular face, floral-patterned black bomber, blue-gray jeans and black high-top trainers. Those exact clothes and haircut should not be presented as verified by the new May 2026 references.

The intended person is **Miguel Ignacio Mendoza Donatti**, the Venezuelan singer **Nacho** from Chyno/Chino y Nacho. His [official artist YouTube channel](https://www.youtube.com/@Nacho/videos) identifies itself as Nacho, channel ID `UCEdqRdgcnZWLYn5mT38aXeg`; official release credits include the name Miguel Ignacio Mendoza Donatti. [Official release credits](https://www.youtube.com/watch?v=sUfBr7l-JBs). Do not confuse him with **Chyno Miranda**, his taller-looking, usually clean-shaven partner with high styled black hair and sunglasses in the selected interviews. The two appear together, so the reference-position notes below matter. [Telemundo's interview with both singers](https://www.telemundo.com/shows/la-mesa-caliente/famosos/video/chyno-y-nacho-nos-visitan-con-nuevos-brios-para-presentar-radio-venezuela-tmvo13179860).

## Primary references actually downloaded and viewed

The new files live in ignored `assets/references/identity-v40/nacho/`. They are research media, not distributable game assets.

| Primary source | Date evidence and inspected content | Local reference paths |
|---|---|---|
| [Telemundo / La Mesa Caliente: Chyno y Nacho present Radio Venezuela](https://www.telemundo.com/shows/la-mesa-caliente/famosos/video/chyno-y-nacho-nos-visitan-con-nuevos-brios-para-presentar-radio-venezuela-tmvo13179860) | The page's `VideoObject.uploadDate` is **2026-05-07T20:02:55.000Z**; duration 7m18s. Publisher's public SMIL resolves to its actual 720p video. Downloaded the OG image and extracted/visually inspected frames at 30, 100, 180, 250, 330 and 400 seconds, plus a sequence spanning the final interview section. This proves publication inside the requested window; the studio filming day is not independently established. | **`telemundo-2026.jpg`**: smiling frontal face and upper body; **Nacho is on the LEFT**. **`telemundo-330s.jpg`**: right-facing profile and bomber; **Nacho is on the LEFT**. **`telemundo-400s.jpg`**: seated body, black trousers and white/black trainers; **Nacho is on the RIGHT**. |
| Same Telemundo interview, live studio segment | The studio clothes stay consistent across the inspected views: forward black cap, black satin bomber with a large asymmetric silver/gray graphic, black trousers and white trainers with substantial black panels. At 340–360s he visibly laughs, leans and lifts one arm while the other hand crosses his upper torso; later he listens and gestures while seated. These are sampled video observations, not a claim to have watched every second. | `telemundo-30s.jpg`, `telemundo-late-01.jpg` through `telemundo-late-09.jpg`, `telemundo-late-contact.jpg`. The sequence starts at media time 340s with one sampled frame per 10s. Use only images where Nacho is identifiable; some cuts show Chyno or the hosts instead. |
| [LOS40 Urban's own studio interview and photograph](https://los40.com/video/2026/05/15/exclusiva-chyno-y-nacho-visitan-el-morning-de-los40-urban-con-ramses-lopez/) | Published **2026-05-15 11:31 CEST**, with the article identifying the duo's studio visit that day. The photograph was downloaded and inspected. Embedded interview is [YouTube `Ao49oDv4SZg`](https://www.youtube.com/watch?v=Ao49oDv4SZg); page metadata lists video upload `2026-05-14T15:31:21+00:00`. Preserve that distinction rather than treating every date as the filming date. | **`los40-2026.jpg`**: **Nacho is on the RIGHT**, wearing a pale lavender/gray forward cap, short full beard, black outer layer and graphic black T-shirt. Chyno is on the left; the presenter is in the middle. This independently cross-checks Nacho's face and recurring cap style. |
| [Nacho's own current video listing](https://www.youtube.com/@Nacho/videos) | Primary channel metadata and thumbnails were retrieved. Three latest thumbnails were downloaded and viewed. The listing labels `MOSCA` as about two weeks old and `D' LEJITOS` as about two months old at inspection; those relative ages are not exact recording dates. Their stylized thumbnail treatments are weaker likeness references than the clear studio footage. | `youtube-00-aHpqK_fv2tg.jpg`: Nacho upper RIGHT in white cowboy hat. `youtube-01-uhCQojCBc7k.jpg`: Nacho on the RIGHT with glasses and braids. `youtube-02-ZjohuLe4Xh8.jpg`: beach scene, rejected as an identity reference. Do not blend these video-specific looks into the selected studio outfit. |

For reproducibility, the Telemundo page preserves a public playback URL `https://link.theplatform.com/s/0L7ZPC/media/QrlrUYzUKwjI?format=SMIL`. The resolved 720p source is `https://prodamdnbcmobile.akamaized.net/NBCU_Telemundo/609/622/1778183723749_45775492655-720pnbcstations.mp4`. The saved `telemundo-video.smil`, `telemundo-2026.html`, `los40-2026.html`, `youtube-videos.html` and `youtube-video-index.json` record source metadata. Frames were extracted directly through HTTP seeking; a large incomplete full-video download was removed to conserve disk space.

## Recommended coherent appearance

Use the **Telemundo May 2026 studio look** as one consistent design:

- Black baseball cap worn **forward**, curved brim and small muted gold crest. Closely cropped hair at the exposed sides; do not add the current atlas's conspicuous shaved hair lines without a new verified reference.
- Short, dense, carefully edged **full dark beard and moustache**, rounded chin silhouette, warm medium/tan skin, small dark eyes, thick brows, broad genuine smile. The face is rounder/softer and the cheeks fuller than the angular, heavily muscled generic hero in the current atlas. These are visual art-direction observations, not measured biometrics.
- Black satin bomber, ribbed black collar/cuffs and gold-colored central zipper. A large **asymmetric silver/gray flowing geometric panel** crosses one side of the chest, with darker charcoal panels toward the lower body and sleeves. Do not substitute a busy all-over floral print or copy Chyno's patterned short-sleeved shirt.
- A small sliver of light undershirt at the neck; black trousers; white trainers with black overlays. These are visible in the studio frames. Body proportions should follow the game's adult, natural-head-size convention; no measured height is established by seated footage.
- No sunglasses for this selected look: Nacho's eyes are visible. The dark aviator sunglasses and tall quiff in the same two-shot belong to **Chyno**, not Nacho.
- The selected jacket covers his arms, so tattoo detail is not reliably observable. Do not invent a sleeve tattoo or claim a particular tattoo is verified by this set.

The game entrance and combat atlas must use this same cap, beard and jacket. Keep the existing rhythm-based combat identity and natural fighting guard; the user requested better identity assets, not an unrelated change to balance. A single microphone/hand-to-chest greeting or energetic arm accent is a plausible adaptation of the observed performer mannerisms, but any exact martial movement remains fictional. No new real voice recording is proposed.

## Three strongest files for generation

1. **`assets/references/identity-v40/nacho/telemundo-2026.jpg`** — best frontal smile and clear face. Explicitly reference the **bearded man in the black cap on the left**; ignore Chyno on the right.
2. **`assets/references/identity-v40/nacho/telemundo-330s.jpg`** — profile, cap shape and real silver-panel bomber. Again Nacho is the man **on the left**.
3. **`assets/references/identity-v40/nacho/telemundo-400s.jpg`** — wardrobe through the shoes and opposite-facing profile. Nacho is **on the right** in this shot.

`los40-2026.jpg` is a useful face/cap cross-check, but its lavender cap and different black jacket should not overwrite the selected Telemundo outfit. Use the established roster atlas only as an illustration-style reference, never as a substitute for the real person's face.

## Limits and exclusions

- The 100-second Telemundo frame contains an **inserted promotional photograph**, with uncapped Nacho on the right in a white jacket, slicked-back short hair and close beard. Its original image date is not independently established, so it is **not** the current haircut anchor just because it appears in a 2026 broadcast.
- The 250-second frame is another inserted appearance in different clothes. It supports identity recognition but should not be silently mixed with the live studio wardrobe.
- `Alabaré`'s official video was published **2024-06-21**, outside the requested two-year window; exclude it even though it is an official video.
- The April 2026 LOS40 written interview was discoverable but its HTML/photo fetch failed in this environment, so no downloaded portrait from that article is claimed.
- The full LOS40 YouTube video could not be fetched by the web reader. Actual video-frame evidence here comes from the openly accessible Telemundo publisher video; no claim of successful LOS40 video playback is made.
- Exact filming dates, an unrestricted full-body standing photograph and fine tattoo placement were not verified. The selected May 2026 studio publication and same-outfit video views give a concrete, recent and internally consistent basis for the redraw.
