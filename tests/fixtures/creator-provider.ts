import sharp from "sharp";
import type { CharacterProvider } from "../../server/creator/provider";

export function deterministicCreatorProvider(): CharacterProvider {
  const failed = new Set<string>();
  let atlas: Promise<Buffer> | undefined;
  return {
    async design(input) {
      if (
        input.description.includes("[qa-fail-once]") &&
        !failed.has(input.name)
      ) {
        failed.add(input.name);
        throw new Error("Intentional QA provider failure");
      }
      return {
        title: "El luchador de prueba",
        specialName: "Paso de prueba",
        outfit: "Chaqueta azul y zapatos blancos.",
        likeness: "Figura sintética con cabello corto y lentes de montura.",
        welcome: "Saludo con la mano",
        combos: ["Primer paso", "Dos tiempos", "Gran remate"],
      };
    },
    async draw() {
      atlas ??= (async () => {
        // Guard, block, two strides, jump, punch, kick and recoil. Each pose is
        // one connected silhouette, with distinct limbs and transparent margins.
        const poses = [
          "M-28 150 -65 190 -15 175 M28 150 72 170 95 135 M-22 325 -35 380 -55 435 M22 325 40 380 60 435",
          "M-28 150 -65 125 -55 75 M28 150 65 125 80 75 M-22 325 -45 380 -65 435 M22 325 30 380 45 435",
          "M-28 150 -75 180 -45 215 M28 150 65 130 105 145 M-22 325 -65 365 -95 350 M22 325 60 370 40 435",
          "M-28 150 -65 130 -100 150 M28 150 75 180 45 215 M-22 325 -70 365 -45 430 M22 325 65 340 100 380",
          "M-28 150 -65 120 -80 80 M28 150 65 110 80 65 M-22 325 -60 345 -40 380 M22 325 70 325 85 365",
          "M-28 150 -60 195 -10 190 M28 150 90 155 145 155 M-22 325 -45 380 -65 435 M22 325 50 380 80 435",
          "M-28 150 -65 180 -20 180 M28 150 65 130 95 145 M-22 325 -40 380 -60 435 M22 325 85 300 150 300",
          "M-28 150 -80 120 -110 155 M28 150 60 120 105 100 M-22 325 -65 380 -85 435 M22 325 35 365 75 400",
        ];
        const shapes = poses
          .map((limbs, i) => {
            const x = (i % 4) * 384 + 192;
            const y = Math.floor(i / 4) * 512;
            return `<g transform="translate(${x} ${y})" fill="#6084b8"><circle cx="0" cy="92" r="35"/><rect x="-36" y="115" width="72" height="220"/><path d="${limbs}" fill="none" stroke="#6084b8" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/></g>`;
          })
          .join("");
        return sharp(
          Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024">${shapes}</svg>`,
          ),
        )
          .png()
          .toBuffer();
      })();
      return atlas;
    },
  };
}

export function referencePhoto() {
  return sharp({
    create: { width: 40, height: 50, channels: 3, background: "#6084b8" },
  })
    .jpeg()
    .toBuffer();
}
