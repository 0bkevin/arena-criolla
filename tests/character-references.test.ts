import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FighterDetail } from "../src/components/FighterDetail";
import { BUILT_IN_FIGHTERS } from "../shared/content";
import { finaleById } from "../shared/finales";
import { moveDemoLabel } from "../src/game/move-demo";
for (const fighter of BUILT_IN_FIGHTERS) {
  test(
    fighter.id +
      ": detail names every attack, categorizes both combos and shares the help controls without descriptions or references",
    () => {
      const html = renderToStaticMarkup(
        createElement(FighterDetail, {
          fighter: fighter.id,
          onClose() {},
          onSelect() {},
        }),
      );
      const text = html.replace(/<[^>]*>/g, "");
      assert.doesNotMatch(
        text,
        /referencias?|fuentes?|entrevistas?|https?:\/\//i,
      );
      assert.doesNotMatch(
        html,
        /<a\b|<details\b|<blockquote\b|character-identity|class="eyebrow"|finale-detail-note/i,
      );
      assert.ok(!text.includes(fighter.description), "No character overview");
      assert.ok(!text.includes(fighter.title), "No character subtitle");
      for (const move of [
        "light",
        "heavy",
        "special",
        "final",
        "combo1",
        "combo2",
      ] as const) {
        const name = renderToStaticMarkup(
          createElement("span", null, moveDemoLabel(fighter.id, move)),
        ).replace(/<[^>]*>/g, "");
        assert.ok(text.includes(name), "Visible name for " + move);
      }
      assert.ok(text.includes("Combo corto"));
      assert.ok(text.includes("Combo largo"));
      assert.ok(text.includes("Especial"));
      assert.ok(text.includes("Definitiva"));
      const finale = finaleById(fighter.id);
      if (finale) {
        assert.ok(
          !text.includes(finale.description),
          "No definitive description",
        );
      }
      assert.ok(
        html.includes(fighter.name),
        "The dialog still names the fighter",
      );
      assert.ok(html.includes("Mis movimientos"));
      assert.doesNotMatch(text, /Vista previa|Mis movimientos/);
      assert.ok(html.includes('class="help-devices"'));
      assert.ok(html.includes('class="dialog-done help-done"'));
      assert.ok(html.includes("Combos"));
      assert.ok(html.includes('data-fighter="' + fighter.id + '"'));
      assert.equal((html.match(/class="move-shortcut"/g) ?? []).length, 6);
      assert.equal((html.match(/aria-pressed="false"/g) ?? []).length, 8);
      assert.ok(html.includes('data-device="keyboard" aria-pressed="true"'));
      for (const device of ["gamepad", "touch"])
        assert.ok(
          html.includes('data-device="' + device + '" aria-pressed="false"'),
        );
      for (const key of ["J", "K", "L", "I"]) {
        assert.ok(html.includes('aria-keyshortcuts="' + key + '"'));
        assert.ok(html.includes("<kbd>" + key + "</kbd>"));
      }
      assert.ok(html.includes('data-move="combo1"'));
      assert.ok(html.includes('data-move="combo2"'));
      assert.doesNotMatch(
        html,
        /move-preview-caption|move-preview-heading|move-preview-controls|move-preview-timeline/,
      );
    },
  );
}
