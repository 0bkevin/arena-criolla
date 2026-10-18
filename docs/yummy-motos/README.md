# Moticos Yummy: referencias y dirección visual

La corrección sustituye las motos geométricas por sprites ilustrados y agrupa
las siete motos en una formación compacta y alargada que aparece al mismo tiempo.

Referencias consultadas el 18 de octubre de 2026:

- Foto oficial de conductor: https://cdn.prod.website-files.com/627eccaab96d0621ae273f80/66b404fbb7e26055e5c1b158_DriverMotto.png
  Chaqueta morada y gris, casco oscuro y moto de calle. La página histórica
  https://www.yummysuperapp.com/conductores devolvió 404; la imagen oficial sí
  estaba disponible.
- Flota de repartidores en Caracas, cortesía de Yummy, publicada por Rest of World:
  https://restofworld.org/2020/the-man-behind-venezuelas-only-delivery-app/
  Foto: https://fastly.restofworld.org/uploads/2020/12/Copy-of-WhatsApp-Image-2020-10-29-at-11.43.19-AM-1.jpeg
  Mochilas térmicas verdes y agrupación de motos.
- Estilo del juego: public/assets/zavarce-v5.webp y public/assets/vallenilla-v5.webp.
  Ilustración editorial 2D con sombreado cel, anatomía adulta, contornos finos y
  pliegues de ropa detallados.

Las fotos descargadas son referencias locales excluidas por .gitignore.
El arte de juego se genera de nuevo con image_gen.imagegen; las fotos no se
redistribuyen como assets. La combinación de uniforme y mochila es una
interpretación ilustrada para el juego.

## Combat verification

`matchup-qa.json` records 4,350 simulation scenarios across all 46 fighters and
nine stages, including both player slots, guards, double jumps, simultaneous
specials, elevated and moving platforms, reflections, counters, interrupted
summons, final-stock knockouts, ringouts and JSON replay determinism. Fifteen
additional scenarios verify formation, impact and reflection synchronization
between two real WebSocket clients. `browser-qa.json` contains ten scripted
renderer checks using the shipped sprites and stage assets; the reusable probe
is `scripts/courier-browser-qa.js`.

The checks exposed and fixed a close-range reflection order bug: both fighters
now finish spawning projectiles before either reflector checks the current tick.
The regression covers both player slots at gaps of 80, 120 and 180 world units.

Reproduce the simulation report with:

```bash
COURIER_QA_REPORT=/tmp/courier-matchup-qa.json npx tsx --test tests/courier-matchups.test.ts
```
