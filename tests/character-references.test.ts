import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FighterDetail } from "../src/components/FighterDetail";
import { BUILT_IN_FIGHTERS } from "../shared/content";
import { finaleById } from "../shared/finales";

for (const fighter of BUILT_IN_FIGHTERS) {
  test(`${fighter.id}: detail omits the entire overview and references, retaining moves and progression`, () => {
    const finale = finaleById(fighter.id);
    // Saved progression can contain a negative count; baseline moves stay available.
    const winCounts = new Set([-1, 0, 1, 2, 3, fighter.specialUnlockWins ?? 0]);
    for (const wins of winCounts) {
      const html = renderToStaticMarkup(
        createElement(FighterDetail, {
          fighter: fighter.id,
          wins,
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
      assert.ok(
        !text.includes(fighter.description),
        "No character description",
      );
      assert.ok(!text.includes(fighter.title), "No character subtitle");
      assert.ok(
        html.includes(fighter.name),
        "The dialog still names the fighter",
      );
      assert.ok(html.includes(fighter.special));
      assert.ok(html.includes("Tu libro de combos"));
      fighter.combos.forEach((combo, index) =>
        assert.ok(html.includes(index === 2 && finale ? finale.title : combo)),
      );
      assert.equal(
        (html.match(/class="unlocked"/g) ?? []).length,
        wins >= 1 ? 3 : 2,
      );
      assert.ok(html.includes("Disponible · 90 de energía"));
      if (finale) {
        assert.ok(html.includes(finale.description));
      }
      if (fighter.specialUnlockWins !== undefined) {
        assert.ok(
          text.includes(
            wins < fighter.specialUnlockWins
              ? `Gana ${fighter.specialUnlockWins} peleas con ${fighter.shortName}`
              : "Especial desbloqueado",
          ),
        );
      }
    }
  });
}
