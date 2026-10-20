import test from "node:test";
import assert from "node:assert/strict";
import { BUILT_IN_FIGHTERS } from "../shared/content";
import { requireCompleteDancerRoster } from "../scripts/validate-perro-mujeriego";

test("strict final-art auditing cannot approve a partial, substituted or duplicated roster", () => {
  const all = BUILT_IN_FIGHTERS.map(({ id }) => id);
  assert.doesNotThrow(() =>
    requireCompleteDancerRoster(all, [...all].reverse()),
  );
  assert.throws(
    () => requireCompleteDancerRoster(all.slice(0, -1), all),
    new RegExp(`all ${all.length}`),
  );
  assert.throws(
    () => requireCompleteDancerRoster(all, all.slice(0, -1)),
    new RegExp(`all ${all.length}`),
  );
  assert.throws(
    () => requireCompleteDancerRoster(all, [...all.slice(0, -1), all[0]]),
    /duplicate/,
  );
  assert.throws(
    () =>
      requireCompleteDancerRoster(
        [...all.slice(0, -1), "custom_substituted"],
        all,
      ),
    /every built-in/,
  );
});
