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
        const shapes = Array.from({ length: 8 }, (_, i) => {
          const x = (i % 4) * 384 + 192;
          const y = Math.floor(i / 4) * 512;
          return `<g fill="#6084b8"><circle cx="${x}" cy="${y + 92}" r="35"/><rect x="${x - 36}" y="${y + 115}" width="72" height="220"/><rect x="${x - 55}" y="${y + 145}" width="110" height="30"/><rect x="${x - 36}" y="${y + 325}" width="26" height="100"/><rect x="${x + 10}" y="${y + 325}" width="26" height="100"/></g>`;
        }).join("");
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
