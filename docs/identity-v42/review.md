# Facial likeness review — v42

The user rejected v40 because the facial geometry did not resemble Nacho or Javier. Two independent reviewers assessed each person against the existing primary references. The first atlas drafts were rejected: supplying the old atlas as a layout/style reference copied its generic face despite accurate new portrait anchors. The selected production atlases were regenerated from only the accepted identity guide and the actual portrait. The old face was excluded from generation inputs.

## Nacho

Primary identity: the user's supplied, undated close-up (buzz cut, short full beard, hoop earrings). This reference takes precedence over the cap in the May 2026 interviews. The interviews remain wardrobe/background evidence in [the research dossier](../identity-v40/nacho-research.md); the bomber outfit is a game adaptation. The new asset exposes the forehead and buzz cut, with fuller cheeks, a broader rounded nose base, compact mouth and rounded beard/chin boundary.

Independent decision: accept as a material improvement. All eight combat poses and entrance poses retain one identity, with natural adult proportions. Entrance frame 5 keeps both arms crossed. Limit: combat eyebrows are more aggressive and the nose profile slightly sharper than the photo. This is an illustrated interpretation, not an exact reproduction.

## Javier Hala Madrid

Primary identity: his clean three-quarter [own-channel video](https://www.youtube.com/shorts/cPuQ2pDEHFo), plus the uncapped gray-shirt man in [his October 2026 post](https://t.me/Javierhalamadridd/6423). The unrelated people composited behind him are not identity references. See [the research dossier](../identity-v40/javier-research.md).

The new face has open eyes with upper lids, a broader rounded nose, full lower lip, softer oval cheek-to-chin contour and sparse-cheek/dense-chin facial hair. The gray tee and natural adult body proportions are retained.

Independent decision: accept as a material improvement, including normalized runtime files. All eight poses retain one identity and complete silhouettes. Entrance frame 5 holds crossed arms. Limit: some side views narrow the nose and reduce the lower lip; hair is slightly tidier than the real reference.

## Production

Generated with the built-in image tool. The four final raw atlases and two identity guides are retained under `assets/source/identity-v42/`; normalized source PNGs are under `assets/source/`; runtime WebPs are lossless. Exact prompts and provenance are recorded beside this review. Each selected atlas passed eight-silhouette, alpha, cell isolation and complete-figure preflight before integration. Packing preserves whole figures and does not reconstruct or repaint faces.

## Runtime validation

- 51/51 active source/runtime atlas pairs pass asset validation.
- All 747 automated tests pass; TypeScript and production build pass. The existing Vite chunk-size advisory remains.
- Browser renderers: 32/32 combat samples and 44/44 entrance samples complete without clipping in both directions; 20 cinematic and 20 victory renders complete without errors.
- Actual local UI matchup: Javier vs Nacho in Altamira, both new combat/entrance atlases fetched. Ordinary keyboard events exercised running, jumping, guarding, light/heavy attacks and special with an actively resisting opponent. The sampled state stayed finite, attacks hit, and inputs were received. See `ui-match.json`, `fight.png` and `cinematic.png`.
- The temporary browser tabs, room connections and port 5193 test server were closed after validation.
