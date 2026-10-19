# Melanio Escobar — independent visual review

Review date: 2026-10-19. Scope: **identity master, generated eight-pose combat sheet, packed combat atlas, and runtime WebP encoding**. This is an independent visual/artifact inspection, not an interactive gameplay test or proof of animation timing.

## Inspected evidence

The reviewer opened the generated `assets/source/melanio-v44/identity-master.png`, the three primary photographs below, and the existing `assets/source/edgar-v39.png` atlas for illustration finish and adult proportions. The identity conclusions use Melanio's own photographs; Édgar's face was not an identity reference.

- [Concordia portrait](https://uploads.concordia.net/2022/05/24113447/melanio.jpeg): backward black cap, broad black glasses, black polo with light piping, throat rose and arm tattoos.
- [Chiste Interno producer photograph](https://kajabi-storefronts-production.kajabi-cdn.com/kajabi-storefronts-production/file-uploads/podcasts/thumbnails/2147641988/episodes/520b58-12a4-da80-aded-1676b7e46f4_episodio.32_humor.politico.venezolano_thumbnail_1x1.jpeg): three-quarter face, nose hoop, moustache, short jaw/chin beard, glasses and tattoos.
- [VENtv interview thumbnail](https://i.ytimg.com/vi/YEch5BPGQSE/maxresdefault.jpg): frontal facial shape and glasses, relaxed slightly asymmetric smile, short facial hair and throat rose.

The source context and limits are recorded in [the identity research](../research/escobar-identity-v44.md). A video thumbnail was inspected as a still; this review makes no claim to have observed actual motion in the interview.

## Identity master verdict: acceptable

The master preserves the combination that makes this subject recognisable: a long oval face, very large thick black rectangular glasses, rounded nose with a small hoop, separate dark moustache and short chin/jaw beard, backward black cap, visible throat rose, and extensively tattooed forearms and hands. The beard remains short and broken around the cheeks rather than becoming a dense sculpted action-hero beard.

The chosen black polo with white piping has a direct photographic reference. Dark trousers and black low-top shoes are game wardrobe choices; the source photographs do not establish those exact garments. The stance has ordinary adult head/body proportions and avoids the enlarged-head problem previously reported elsewhere in the roster. Ink outlines, restrained textured shading and painted clothing fit the existing cel-illustrated fighters.

Minor, non-blocking likeness limitation: the generated toothy smile is slightly wider and more regular than the photographic smiles. The face is also somewhat idealised, as expected from this illustration style. This does not obscure the key features, and no master regeneration is recommended on that basis alone.

The image preview displays coloured RGB beneath transparent pixels. Direct RGBA sampling found alpha **0** at all four corners and at inspected side/bottom glow locations. Those invisible RGB values are not a visible background defect.

## Combat atlas verdict: acceptable

The reviewer opened `assets/source/melanio-v44/combat-generated.png` and the final `assets/source/melanio-v44.png`, then inspected enlarged running and hurt crops. All eight poses retain the backward cap, thick glasses, short facial hair, light-edged black polo, tattoos, dark trousers and black shoes. The head/body proportions and inked clothing finish remain consistent with the existing Édgar atlas.

| Frame | Visual inspection |
| --- | --- |
| 0 — guard | Face and gaze right; clear open guard, recognisable glasses and face. |
| 1 — block | Both fists protect the face; glasses remain visible; source faces right. |
| 2 — run A | Front contact foot planted, rear foot lifted; near arm swings back and far arm forward. |
| 3 — run B | Rear contact foot planted, front foot lifted; opposite arm lead and visible torso twist distinguish it from run A. |
| 4 — jump | Both legs tucked, intact hands and feet, source faces right. |
| 5 — punch | Straight rightward extension, rear hand protecting chin; no detached fist or broken elbow. |
| 6 — kick | Rightward raised kick with intact shoe, supporting leg and defensive arms. |
| 7 — hurt | Face remains right while the head/shoulders lean left of the hips, visibly recoiling away from a right-side opponent. |

All source poses therefore support `frameFacing: [1, 1, 1, 1, 1, 1, 1, 1]`. In particular, hurt frame 7 should **not** be labelled left-facing merely because its body leans left. That would reverse the intended recoil when rendered.

The final PNG is **2048 × 1024**, arranged as eight **512 × 512** cells. Independent alpha-threshold bounds found **31–32 px minimum visible padding** on every frame, with visible bottoms at y=479–480 within each cell. No figure touches its cell boundary. These checks cover packed-image clipping; the in-game renderer still requires its own validation at actual combat and cinematic scales.

The generated sheet's apparent brown/grey background is transparent: sampled background pixels, including a bright central glow, have alpha **0**. Comparison of decoded final PNG and WebP found **zero alpha mismatches and zero RGB mismatches for any nontransparent pixel**. The 124,628 RGB differences all occur beneath alpha 0 and cannot alter the visible fighter. No visible halo or encoding damage was found.

No asset-level blocker was found. Animation timing, stage collisions, selection reachability, combat balance and multiplayer remain outside this review's scope.
