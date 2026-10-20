import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StageGallery } from "../src/components/StageGallery";
import { STAGES } from "../shared/content";

for (const selected of STAGES) {
  test(`${selected.id}: stage gallery omits titles, descriptions and platform information`, () => {
    for (const disabled of [false, true]) {
      const html = renderToStaticMarkup(
        createElement(StageGallery, {
          selectedStage: selected.id,
          disabled,
          onSelect() {},
        }),
      );
      assert.doesNotMatch(html, /<h[1-6]\b|<p\b|<a\b|<details\b/i);
      for (const stage of STAGES) {
        assert.ok(!html.includes(stage.description), stage.id);
        assert.ok(
          html.includes(`aria-label="Seleccionar escenario ${stage.location}"`),
        );
        assert.ok(html.includes(`/assets/${stage.id}.webp`));
      }
      assert.equal((html.match(/<button\b/g) ?? []).length, STAGES.length);
      assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
      assert.equal(
        (html.match(/disabled=""/g) ?? []).length,
        disabled ? STAGES.length : 0,
      );
      assert.ok(html.includes("Elegido"));
      assert.doesNotMatch(html, /plataformas?|A ras del suelo/i);
    }
  });
}
