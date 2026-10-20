import { MAX_FIGHTER_SEPARATION, WORLD } from "./arena";
import {
  ARENA_FINALES,
  activeArenaPerformance,
  arenaFinaleContacts,
  arenaFinaleInRange,
  cancelArenaPerformance,
  isArenaFinalist,
  mountedFinale,
  registerArenaContact,
} from "./arena-finales";
import {
  SUPER_ENERGY_COST,
  SUPER_UNLOCK_WINS,
  fighterById,
  platformsAtTick,
  type FighterId,
  type StageId,
} from "./content";
import {
  activeRunway,
  advanceFieldFinales,
  beginFieldFinale,
  runwayContacts,
  supportRunway,
  type FieldFinaleState,
} from "./field-finales";
import {
  FINALE_CAPTURE_TICK,
  FINALE_RANGE,
  finaleById,
  type FinaleState,
} from "./finales";
import { INTRO_COUNTDOWN_START, INTRO_TOTAL_TICKS } from "./presentation";
import { TECHNIQUES, type Technique } from "./techniques";
export { WORLD } from "./arena";
export const ACTIONS = [
  "jump",
  "light",
  "heavy",
  "special",
  "dash",
  "super",
] as const;
export type Action = (typeof ACTIONS)[number];
export type Attack = "light" | "heavy" | "special" | "super" | null;
export interface Input {
  left: boolean;
  right: boolean;
  block: boolean;
  down: boolean;
  actions: Record<Action, number>;
}
export const emptyInput = (): Input => ({
  left: false,
  right: false,
  block: false,
  down: false,
  actions: { jump: 0, light: 0, heavy: 0, special: 0, dash: 0, super: 0 },
});
export interface PlayerConfig {
  name: string;
  fighter: FighterId;
  wins: number;
}
export interface PlayerState {
  config: PlayerConfig;
  x: number;
  y: number;
  vx: number;
  // The part of vx caused by contact, preserved by the voluntary retreat limit.
  recoilVx?: number;
  vy: number;
  facing: number;
  hp: number;
  /** Lets a finishing throw reach the blast zone before a lethal HP loss resolves. */
  knockoutDelay?: number;
  stocks: number;
  energy: number;
  grounded: boolean;
  supportPlatform: number | null;
  dropThrough: number;
  jumps: number;
  blocking: boolean;
  attack: Attack;
  attackTick: number;
  attackHit: boolean;
  countered: boolean;
  cooldown: number;
  stun: number;
  slowTicks: number;
  rootTicks: number;
  rootKind?: "chain" | "screen" | "spectral" | "flash";
  invincible: number;
  dash: number;
  lastActions: Record<Action, number>;
  history: { action: string; tick: number }[];
  combo: string;
  comboTick: number;
  comboBonus: number;
  hits: number;
  peakCombo: number;
  streak: number;
  lastHitTick: number;
  /** Active gameplay ticks; paused with hitstop and capture finales. */
  transformation?: { id: string; ticks: number; damageMultiplier: number };
}
export interface Projectile {
  id: number;
  owner: number;
  x: number;
  y: number;
  vx: number;
  life: number;
  vy?: number;
  age?: number;
  formationIndex?: number;
  /** Preserve the original painted projectile when ownership changes on a parry. */
  finaleArt?: { fighter: FighterId; pose: string; height: number };
  hitInvincibility?: number;
  returnAfter?: number;
  tether?: { catchX: number; catchY: number; returnSpeed: number };
  returning?: boolean;
  connected?: boolean;
  kind: string;
  damage: number;
  force?: number;
  originY?: number;
  wave?: { amplitude: number; period: number };
  acceleration?: number;
  maxSpeed?: number;
  gravity?: number;
  homing?: number;
  pulls?: boolean;
  groundOnly?: boolean;
  slowTicks?: number;
  blastRadius?: number;
  bounces?: number;
  radius?: number;
  growth?: number;
  maxRadius?: number;
  plantAfter?: number;
  armAfter?: number;
  direction?: number;
  /** Defaults to special for existing projectiles; retained on reflection. */
  impact?: "special" | "super";
}
export interface Effect {
  id: number;
  x: number;
  y: number;
  life: number;
  kind: "hit" | "block" | "special" | "ringout";
  color: string;
  duration: number;
  owner?: number;
  impact?: NonNullable<Attack>;
  strength?: number;
  direction?: number;
}
export interface MatchState {
  id: string;
  stage: StageId;
  tick: number;
  remaining: number;
  phase: "intro" | "playing" | "finished";
  winner: number | "draw" | null;
  players: [PlayerState, PlayerState];
  projectiles: Projectile[];
  effects: Effect[];
  nextId: number;
  shake: number;
  hitstop: number;
  finale?: FinaleState;
  fieldFinales?: FieldFinaleState[];
}

/** Snapshot once for new attacks; reflected shots retain their original damage. */
export function outgoingDamageMultiplier(player: PlayerState): number {
  return player.transformation && player.transformation.ticks > 0
    ? player.transformation.damageMultiplier
    : 1;
}

function makePlayer(config: PlayerConfig, index: number): PlayerState {
  return {
    // Room progress can advance after a win; the match keeps its starting counts.
    config: { ...config },
    x: index === 0 ? 330 : 750,
    y: WORLD.floor,
    vx: 0,
    recoilVx: 0,
    vy: 0,
    facing: index === 0 ? 1 : -1,
    hp: 100,
    stocks: 2,
    energy: 35,
    grounded: true,
    supportPlatform: -1,
    dropThrough: 0,
    jumps: 0,
    blocking: false,
    attack: null,
    attackTick: 0,
    attackHit: false,
    countered: false,
    cooldown: 0,
    stun: 0,
    slowTicks: 0,
    rootTicks: 0,
    invincible: 90,
    dash: 0,
    lastActions: { ...emptyInput().actions },
    history: [],
    combo: "",
    comboTick: 0,
    comboBonus: 0,
    hits: 0,
    peakCombo: 0,
    streak: 0,
    lastHitTick: 0,
  };
}

export function createMatch(
  stage: StageId,
  configs: [PlayerConfig, PlayerConfig],
  id = "local",
): MatchState {
  return {
    id,
    stage,
    tick: 0,
    remaining: 120 * 60,
    phase: "intro",
    winner: null,
    players: [makePlayer(configs[0], 0), makePlayer(configs[1], 1)],
    projectiles: [],
    effects: [],
    nextId: 0,
    shake: 0,
    hitstop: 0,
  };
}

function effect(
  s: MatchState,
  x: number,
  y: number,
  kind: Effect["kind"],
  color: string,
  details: Partial<
    Pick<Effect, "owner" | "impact" | "strength" | "direction">
  > = {},
) {
  const duration = kind === "ringout" ? 40 : kind === "hit" ? 26 : 18;
  s.effects.push({
    id: s.nextId++,
    x,
    y,
    kind,
    color,
    life: duration,
    duration,
    ...details,
  });
  if (s.effects.length > 40) s.effects.shift();
}

// Guard and counter rules are shared by normal contact and cinematic capture.
// A defended hit consumes the attack without starting a scene or doing damage.
function interceptHit(
  s: MatchState,
  attacker: number,
  direction: number,
  x: number,
  y: number,
  impact: NonNullable<Attack>,
): "immune" | "defended" | undefined {
  const target = s.players[1 - attacker];
  const source = s.players[attacker];
  if (target.invincible > 0 || target.stocks <= 0 || target.hp <= 0)
    return "immune";
  const counter =
    TECHNIQUES[fighterById(target.config.fighter).ability].counter;
  if (
    target.attack === "special" &&
    counter &&
    !target.countered &&
    target.attackTick >= counter.from &&
    target.attackTick <= counter.to &&
    target.facing === -direction
  ) {
    target.countered = true;
    effect(s, target.x, target.y - 80, "block", "#e2bbff", {
      owner: 1 - attacker,
      impact: "special",
      direction: target.facing,
    });
    if (Math.abs(source.x - target.x) < counter.range)
      hurt(
        s,
        1 - attacker,
        counter.damage *
          fighterById(target.config.fighter).damage *
          outgoingDamageMultiplier(target),
        counter.force,
        target.facing,
        source.x,
        source.y - 80,
        "special",
      );
    return "defended";
  }
  if (target.blocking && target.facing === -direction && target.energy > 3) {
    target.energy = Math.max(0, target.energy - 9);
    target.vx += direction * 1.5;
    target.recoilVx = (target.recoilVx ?? 0) + direction * 1.5;
    effect(s, x, y, "block", "#c7e8ff", {
      owner: attacker,
      impact,
      direction,
      strength: 0.8,
    });
    s.hitstop = Math.max(s.hitstop, 2);
    return "defended";
  }
}

function rewardHit(s: MatchState, attacker: number) {
  const target = s.players[1 - attacker];
  const source = s.players[attacker];
  target.energy = Math.min(100, target.energy + 9);
  source.energy = Math.min(100, source.energy + 13);
  source.hits++;
  source.streak = s.tick - source.lastHitTick < 100 ? source.streak + 1 : 1;
  source.lastHitTick = s.tick;
  source.peakCombo = Math.max(source.peakCombo, source.streak);
}

function launchTarget(target: PlayerState, force: number, direction: number) {
  target.vx = direction * force * (1 + (100 - target.hp) / 90);
  target.recoilVx = target.vx;
  target.vy = -force * 0.65;
  target.grounded = false;
  target.supportPlatform = null;
  target.stun = Math.round(force * 2.6 + 5);
  target.attack = null;
  target.cooldown = Math.max(target.cooldown, target.stun);
}

function hurt(
  s: MatchState,
  attacker: number,
  damage: number,
  force: number,
  direction: number,
  x: number,
  y: number,
  impact: NonNullable<Attack>,
  hitInvincibility = 12,
): boolean {
  const interception = interceptHit(s, attacker, direction, x, y, impact);
  if (interception) return interception === "defended";
  const target = s.players[1 - attacker];
  const source = s.players[attacker];
  const def = fighterById(target.config.fighter);
  target.hp = Math.max(0, target.hp - damage * def.armor);
  launchTarget(target, force, direction);
  target.invincible = hitInvincibility;
  rewardHit(s, attacker);
  const strength =
    impact === "super"
      ? 1.8
      : impact === "heavy"
        ? 1.35
        : impact === "special"
          ? 1.2
          : 0.85;
  effect(s, x, y, "hit", fighterById(source.config.fighter).color, {
    owner: attacker,
    impact,
    strength,
    direction,
  });
  s.shake = Math.max(s.shake, Math.min(14, force * 1.15));
  s.hitstop = Math.max(
    s.hitstop,
    impact === "super" ? 7 : impact === "heavy" ? 5 : 3,
  );
  return true;
}

function loseStock(s: MatchState, i: number) {
  const p = s.players[i];
  s.projectiles = s.projectiles.filter(
    (shot) => !shot.tether || shot.owner !== i,
  );
  p.stocks--;
  delete p.knockoutDelay;
  delete p.transformation;
  s.fieldFinales = s.fieldFinales?.filter((field) => field.owner !== i);
  if (!s.fieldFinales?.length) delete s.fieldFinales;
  p.slowTicks = 0;
  p.rootTicks = 0;
  delete p.rootKind;
  effect(
    s,
    Math.max(WORLD.x + 30, Math.min(WORLD.x + WORLD.width - 30, p.x)),
    Math.min(590, p.y - 60),
    "ringout",
    fighterById(p.config.fighter).color,
    {
      owner: i,
      strength: 1.8,
      direction: p.x < WORLD.x + WORLD.width / 2 ? -1 : 1,
    },
  );
  if (p.stocks <= 0) {
    p.hp = 0;
    return;
  }
  p.x = i === 0 ? 330 : 750;
  p.y = 260;
  p.vx = 0;
  p.recoilVx = 0;
  p.vy = 0;
  p.hp = 100;
  p.grounded = false;
  p.supportPlatform = null;
  p.dropThrough = 0;
  p.jumps = 0;
  p.stun = 0;
  p.attack = null;
  p.cooldown = 30;
  p.invincible = 110;
  p.energy = Math.max(0, p.energy - 20);
  p.streak = 0;
}

function beginFinale(s: MatchState, owner: 0 | 1) {
  const source = s.players[owner];
  const target = s.players[1 - owner];
  const definition = finaleById(source.config.fighter);
  if (
    !definition ||
    definition.mode !== "capture" ||
    source.hp <= 0 ||
    target.hp <= 0
  )
    return;
  const direction = target.x >= source.x ? 1 : -1;
  if (interceptHit(s, owner, direction, target.x, target.y - 80, "super"))
    return;
  // Captured actors resume their held props. No suspended cable survives a
  // cinematic takeover or duplicates a microphone in a canonical capture pose.
  s.projectiles = s.projectiles.filter((shot) => !shot.tether);
  s.finale = {
    owner,
    target: owner === 0 ? 1 : 0,
    fighter: source.config.fighter,
    startedTick: s.tick,
    tick: 0,
    duration: definition.duration,
    x: (source.x + target.x) / 2,
    y: Math.min(source.y, target.y),
    direction,
    initialHp: target.hp,
    damage:
      (28 * fighterById(source.config.fighter).damage + source.comboBonus) *
      fighterById(target.config.fighter).armor,
  };
  if (activeRunway(s, target)) {
    s.fieldFinales = s.fieldFinales?.filter(
      (field) => s.players[field.owner] !== target,
    );
    if (!s.fieldFinales?.length) delete s.fieldFinales;
    target.cooldown = Math.min(target.cooldown, 12);
  }
  target.attack = null;
  target.blocking = false;
  target.dash = 0;
  s.hitstop = 0;
}

function advanceFinale(s: MatchState, inputs: [Input, Input]) {
  const scene = s.finale!;
  const source = s.players[scene.owner];
  const target = s.players[scene.target];
  // The combat clock also drives moving platforms. Freeze it together with
  // actors, projectiles, recovery and the round timer; the scene owns its clock.
  scene.tick++;
  s.shake *= 0.8;
  s.effects = s.effects.filter((e) => --e.life > 0);
  for (let i = 0; i < 2; i++)
    s.players[i].lastActions = { ...inputs[i].actions };
  const definition = finaleById(scene.fighter)!;
  const beat = definition.damageBeats.indexOf(scene.tick);
  if (beat !== -1) {
    target.hp = Math.max(
      0,
      scene.initialHp -
        scene.damage * ((beat + 1) / definition.damageBeats.length),
    );
    if (beat === 0) rewardHit(s, scene.owner);
    effect(s, target.x, target.y - 80, "hit", definition.accent, {
      owner: scene.owner,
      impact: "super",
      strength: beat === definition.damageBeats.length - 1 ? 1.8 : 1.2,
      direction: scene.direction,
    });
    s.shake = beat === definition.damageBeats.length - 1 ? 14 : 7;
  }
  if (scene.tick >= scene.duration) {
    source.attack = null;
    const force = definition.release?.force ?? 12;
    if (force > 0) launchTarget(target, force, scene.direction);
    else {
      target.vx = 0;
      target.recoilVx = 0;
      target.vy = 0;
      target.stun = 0;
    }
    if (definition.release?.knockoutDelay && target.hp <= 0)
      target.knockoutDelay = definition.release.knockoutDelay;
    target.invincible = 12;
    delete s.finale;
    resolveStocks(s);
    resolveTimeout(s);
  }
}

function beginAttack(s: MatchState, i: number, attack: NonNullable<Attack>) {
  const p = s.players[i];
  const def = fighterById(p.config.fighter);
  // One physical handheld object: it must be caught before another attack starts.
  if (s.projectiles.some((shot) => shot.owner === i && shot.tether)) return;
  if (
    attack === "special" &&
    (p.config.wins < (def.specialUnlockWins ?? 0) ||
      (TECHNIQUES[def.ability].requiresGround && !p.grounded))
  )
    return;
  if (
    attack === "super" &&
    (s.fieldFinales?.some((field) => field.owner === i) ||
      ((p.config.fighter === "dayana" || isArenaFinalist(p.config.fighter)) &&
        !p.grounded))
  )
    return;
  if (attack === "special" && p.energy < 25) return;
  if (
    attack === "super" &&
    (p.config.wins < SUPER_UNLOCK_WINS || p.energy < SUPER_ENERGY_COST)
  )
    return;
  if (attack === "special") p.energy -= 25;
  if (attack === "super") p.energy -= SUPER_ENERGY_COST;
  p.attack = attack;
  p.attackTick = 0;
  p.attackHit = false;
  p.countered = false;
  p.comboBonus = 0;
  p.cooldown =
    attack === "light"
      ? 21
      : attack === "heavy"
        ? 33
        : attack === "special"
          ? TECHNIQUES[def.ability].recovery + 1
          : finaleById(p.config.fighter)?.mode === "projectile"
            ? finaleById(p.config.fighter)!.duration + 1
            : 42;
  if (attack === "super" && p.config.fighter === "dayana") p.cooldown = 190;
  if (attack === "super" && isArenaFinalist(p.config.fighter))
    p.cooldown = ARENA_FINALES[p.config.fighter].recovery + FINALE_CAPTURE_TICK;
  p.history = p.history.filter((h) => s.tick - h.tick < 150);
  p.history.push({ action: attack, tick: s.tick });
  if (p.history.length > 3) p.history.shift();
  const sequence = p.history.map((h) => h.action).join(",");
  if (sequence.endsWith("light,heavy")) {
    p.combo = def.combos[0];
    p.comboTick = s.tick;
    p.comboBonus = 3;
  }
  if (p.config.wins >= 1 && sequence === "light,light,heavy") {
    p.combo = def.combos[1];
    p.comboTick = s.tick;
    p.comboBonus = 7;
  }
  if (attack === "super") {
    p.combo = def.combos[2];
    p.comboTick = s.tick;
    p.comboBonus = 12;
  }
  if (
    attack === "special" ||
    (attack === "super" && finaleById(p.config.fighter)?.mode !== "projectile")
  )
    effect(s, p.x, p.y - 75, "special", def.color, {
      owner: i,
      impact: attack,
      direction: p.facing,
    });
}

function reflectProjectiles(s: MatchState, i: number) {
  const p = s.players[i];
  if (p.attack !== "special") return;
  const def = fighterById(p.config.fighter);
  const technique = TECHNIQUES[def.ability];
  if (
    technique.reflect &&
    p.attackTick >= technique.reflect.from &&
    p.attackTick <= technique.reflect.to
  ) {
    for (const shot of s.projectiles) {
      const dx = shot.x - p.x;
      if (
        shot.owner !== i &&
        dx * p.facing >= -20 &&
        Math.abs(dx) < technique.reflect.radius &&
        Math.abs(shot.y - (p.y - 75)) < 95
      ) {
        if (shot.tether) {
          if (shot.connected) continue;
          // A cable cannot change owners. A parry bats the head back along it.
          shot.returning = true;
          shot.connected = true;
          effect(s, shot.x, shot.y, "block", def.color, {
            owner: i,
            impact: "special",
            direction: p.facing,
          });
          continue;
        }
        shot.owner = i;
        shot.direction = p.facing;
        shot.vx = p.facing * Math.max(6, Math.abs(shot.vx));
        shot.vy = -(shot.vy ?? 0);
        shot.returnAfter = undefined;
        shot.plantAfter = undefined;
        shot.armAfter = undefined;
        shot.life = Math.max(30, shot.life);
        effect(s, shot.x, shot.y, "special", def.color, {
          owner: i,
          impact: "special",
          direction: p.facing,
        });
      }
    }
  }
}

function updateAttack(s: MatchState, i: number) {
  const p = s.players[i];
  if (!p.attack) return;
  const attack = p.attack;
  const def = fighterById(p.config.fighter);
  const other = s.players[1 - i];
  const technique = TECHNIQUES[def.ability];
  const activeAt =
    attack === "light"
      ? 6
      : attack === "heavy"
        ? 11
        : attack === "special"
          ? technique.startup
          : FINALE_CAPTURE_TICK;
  const finale = attack === "super" ? finaleById(p.config.fighter) : undefined;
  if (finale?.mode === "field") {
    if (p.attackTick === activeAt && !p.attackHit) {
      p.attackHit = true;
      beginFieldFinale(
        s,
        i as 0 | 1,
        (28 * def.damage + p.comboBonus) * outgoingDamageMultiplier(p),
      );
    }
    if (p.config.fighter === "deyna" && p.attackTick >= 24) {
      p.attack = null;
      p.cooldown = 0;
    }
    return;
  }
  if (finale?.mode === "projectile") {
    const shot = finale.projectile;
    if (p.attackTick === activeAt && !p.attackHit && shot) {
      p.attackHit = true;
      s.projectiles.push({
        id: s.nextId++,
        owner: i,
        direction: p.facing,
        x: p.x + p.facing * shot.offsetX,
        y: p.y - shot.offsetY,
        vx: p.facing * shot.speed,
        life: shot.life,
        age: 0,
        kind: shot.kind,
        impact: "super",
        radius: shot.radius,
        growth: shot.growth,
        maxRadius: shot.maxRadius,
        force: shot.force,
        damage: (28 * def.damage + p.comboBonus) * outgoingDamageMultiplier(p),
      });
      effect(
        s,
        p.x + p.facing * shot.offsetX,
        p.y - shot.offsetY,
        "special",
        def.color,
        { owner: i, impact: "super", direction: p.facing, strength: 1.4 },
      );
    }
    if (p.attackTick >= finale.duration) p.attack = null;
    return;
  }
  if (finale?.mode === "transformation") {
    if (p.attackTick === activeAt && !p.attackHit && finale.empowerment) {
      p.attackHit = true;
      p.transformation = {
        id: finale.empowerment.id,
        ticks: finale.empowerment.duration,
        damageMultiplier: finale.empowerment.damageMultiplier,
      };
    }
    if (p.attackTick > 36) p.attack = null;
    return;
  }
  const movingStrike =
    attack === "special" &&
    Boolean(technique.dash) &&
    !technique.projectile &&
    !technique.pulses;
  const pulseIndex = movingStrike
    ? p.attackTick >= activeAt &&
      p.attackTick < activeAt + (technique.dash?.ticks ?? 0) &&
      !p.attackHit
      ? 0
      : -1
    : attack === "special"
      ? (technique.pulses || [0]).findIndex(
          (offset) => p.attackTick === activeAt + offset,
        )
      : p.attackTick === activeAt && !p.attackHit
        ? 0
        : -1;
  if (pulseIndex >= 0) {
    if (!movingStrike) p.attackHit = true;
    if (attack === "special" && pulseIndex === 0 && p.attackTick === activeAt)
      applySpecialMovement(s, i, technique);
    const danceStep =
      attack === "special" &&
      technique.steps?.find((step) => step.pulse === pulseIndex);
    if (danceStep && !p.rootTicks) {
      p.vx = p.facing * danceStep.speed * (p.slowTicks ? 0.6 : 1);
      p.recoilVx = 0;
      p.dash = danceStep.ticks;
      if (danceStep.lift) {
        p.vy = danceStep.lift;
        p.grounded = false;
        p.supportPlatform = null;
      }
    }
    if (attack === "special" && technique.projectile) {
      if (technique.requiresGround && !p.grounded) return;
      const projectile = technique.projectile;
      const count = projectile.count || 1;
      for (let note = 0; note < count; note++) {
        s.projectiles.push({
          id: s.nextId++,
          owner: i,
          direction: p.facing,
          x:
            p.x +
            p.facing *
              ((projectile.offsetX ?? 48) +
                (note - (count - 1) / 2) * (projectile.spacing ?? 0)),
          y: p.y - (projectile.offsetY ?? (projectile.groundOnly ? 42 : 75)),
          originY: p.y - 75,
          vx: p.facing * projectile.speed,
          vy:
            (projectile.initialVy ?? 0) +
            (note - (count - 1) / 2) * (projectile.spread || 0),
          age: 0,
          formationIndex: projectile.spacing ? note : undefined,
          hitInvincibility: projectile.hitInvincibility,
          returnAfter: projectile.returnAfter,
          tether: projectile.tether ? { ...projectile.tether } : undefined,
          life: projectile.life,
          kind: def.ability,
          damage: technique.damage * def.damage * outgoingDamageMultiplier(p),
          force: technique.force,
          wave: projectile.wave,
          acceleration: projectile.acceleration,
          maxSpeed: projectile.maxSpeed,
          gravity: projectile.gravity,
          homing: projectile.homing,
          pulls: projectile.pulls,
          groundOnly: projectile.groundOnly,
          slowTicks: projectile.slowTicks,
          blastRadius: projectile.blastRadius,
          bounces: projectile.bounces,
          radius: projectile.radius,
          growth: projectile.growth,
          maxRadius: projectile.maxRadius,
          plantAfter: projectile.plantAfter,
          armAfter: projectile.armAfter,
        });
      }
    } else {
      let range = attack === "light" ? 110 : attack === "heavy" ? 155 : 165;
      if (attack === "super") range = FINALE_RANGE;
      if (attack === "special") {
        range =
          (movingStrike
            ? (technique.contactRange ?? technique.range)
            : technique.range) +
          pulseIndex *
            (technique.pulseRangeStep ?? (def.ability === "echo" ? 70 : 90));
        const mirrored = technique.mirrorPulse === pulseIndex;
        const behindRival = mirrored && Math.abs(other.x - p.x) < range;
        effect(
          s,
          behindRival
            ? other.x + p.facing * 90
            : p.x +
                p.facing *
                  (technique.aimed
                    ? Math.min(range - 50, Math.abs(other.x - p.x))
                    : 35),
          behindRival
            ? other.y - 75
            : technique.groundOnly
              ? p.y - 5
              : p.y - 75,
          "special",
          def.color,
          {
            owner: i,
            impact: attack,
            direction: mirrored ? -p.facing : p.facing,
          },
        );
      }
      const dx = other.x - p.x;
      const inFront =
        dx * p.facing > -30 ||
        (attack === "special" &&
          (technique.radial || technique.mirrorPulse === pulseIndex));
      if (
        Math.abs(dx) < range &&
        Math.abs(p.y - other.y) <
          (attack === "special" ? technique.height : 120) &&
        !(
          attack === "special" &&
          technique.groundOnly &&
          (!p.grounded || !other.grounded)
        ) &&
        inFront
      ) {
        if (attack === "super" && finaleById(p.config.fighter)) {
          beginFinale(s, i as 0 | 1);
          return;
        }
        const damage =
          (attack === "light"
            ? 7
            : attack === "heavy"
              ? 13
              : attack === "super"
                ? 28
                : technique.damage) *
            def.damage +
          p.comboBonus;
        const healthBefore = other.hp;
        const supportBefore = other.supportPlatform;
        const connected = hurt(
          s,
          i,
          damage * outgoingDamageMultiplier(p),
          attack === "light"
            ? 4.5
            : attack === "super"
              ? 12
              : attack === "special"
                ? pulseIndex === (technique.pulses?.length ?? 1) - 1
                  ? (technique.finisherForce ?? technique.force)
                  : technique.force
                : 8,
          attack === "special" && technique.mirrorPulse === pulseIndex
            ? -p.facing
            : dx >= 0
              ? 1
              : -1,
          other.x,
          other.y - 80,
          attack,
          attack === "special" ? technique.hitInvincibility : undefined,
        );
        if (movingStrike && connected) p.attackHit = true;
        if (
          attack === "special" &&
          technique.snare &&
          other.hp < healthBefore
        ) {
          other.rootTicks = technique.snare;
          delete other.rootKind;
          other.vx = 0;
          other.recoilVx = 0;
          other.vy = 0;
          other.grounded = true;
          other.supportPlatform = supportBefore;
        }
      }
    }
  }
  if (
    p.attackTick >=
    (attack === "light"
      ? 20
      : attack === "heavy"
        ? 32
        : attack === "special"
          ? technique.recovery
          : 40)
  )
    p.attack = null;
}

function applySpecialMovement(s: MatchState, i: number, technique: Technique) {
  const p = s.players[i];
  if (p.rootTicks > 0) return;
  if (technique.blink) {
    const other = s.players[1 - i];
    const distance = Math.max(0, Math.abs(other.x - p.x) - technique.blink.gap);
    const startX = p.x;
    p.x = Math.max(
      WORLD.left,
      Math.min(
        WORLD.right,
        p.x + p.facing * Math.min(technique.blink.reach, distance),
      ),
    );
    p.invincible = Math.max(p.invincible, technique.blink.invincibility);
    effect(
      s,
      startX,
      p.y - 75,
      "special",
      fighterById(p.config.fighter).color,
      { owner: i, direction: p.facing, impact: "special" },
    );
  }
  if (technique.dash) {
    p.vx = p.facing * technique.dash.speed * (p.slowTicks ? 0.6 : 1);
    p.recoilVx = 0;
    p.dash = technique.dash.ticks;
    p.invincible = Math.max(p.invincible, technique.dash.invincibility);
  }
  const lift = technique.lift ?? technique.dash?.lift;
  if (lift) {
    p.vy = lift;
    p.grounded = false;
    p.supportPlatform = null;
  }
}

function limitRetreat(s: MatchState, origins: number[], carried: number[]) {
  if (s.players.some((p) => p.stocks <= 0 || p.hp <= 0)) return;
  const direction = Math.sign(origins[1] - origins[0]) || 1;
  const next = s.players.map((p) => p.x + p.vx);
  const excess =
    (next[1] - next[0]) * direction -
    Math.max(MAX_FIGHTER_SEPARATION, Math.abs(origins[1] - origins[0]));
  if (excess <= 0) return;
  const outward = s.players.map((p, i) =>
    p.stun > 0
      ? 0
      : Math.max(
          0,
          (next[i] - origins[i] - carried[i] - (p.recoilVx ?? 0)) *
            (i === 0 ? -direction : direction),
        ),
  );
  const total = outward[0] + outward[1];
  if (total <= 0) return;
  // Share the remaining retreat space fairly; damage and platform carry stay free.
  s.players.forEach((p, i) => {
    const away = i === 0 ? -direction : direction;
    const blocked = (Math.min(excess, total) * outward[i]) / total;
    const scripted = Math.min(
      blocked,
      Math.max(0, (p.x - origins[i] - carried[i]) * away),
    );
    p.x -= scripted * away;
    p.vx -= (blocked - scripted) * away;
  });
}

export function stepMatch(s: MatchState, inputs: [Input, Input]): void {
  if (s.phase === "finished") return;
  if (s.finale) {
    advanceFinale(s, inputs);
    return;
  }
  if (s.hitstop > 0) {
    s.hitstop--;
    s.remaining--;
    s.shake *= 0.88;
    resolveTimeout(s);
    return;
  }
  s.tick++;
  s.shake *= 0.8;
  s.effects = s.effects.filter((e) => --e.life > 0);
  if (s.phase === "intro") {
    if (
      s.tick < INTRO_COUNTDOWN_START &&
      inputs.some(
        (input, i) => input.actions.dash !== s.players[i].lastActions.dash,
      )
    )
      s.tick = INTRO_COUNTDOWN_START;
    for (let i = 0; i < 2; i++)
      s.players[i].lastActions = { ...inputs[i].actions };
    if (s.tick >= INTRO_TOTAL_TICKS) {
      s.phase = "playing";
      s.players.forEach((p, i) => {
        p.invincible = 0;
        p.facing = s.players[1 - i].x >= p.x ? 1 : -1;
      });
    }
    return;
  }
  s.remaining--;
  // Tick before attacks so activation receives the full authored duration and
  // both players see the same expiry boundary regardless of update order.
  for (const player of s.players) {
    if (player.transformation && --player.transformation.ticks <= 0)
      delete player.transformation;
  }
  const movementOrigins = s.players.map((p) => p.x);
  const platformCarry = [0, 0];
  const stagePlatforms = platformsAtTick(s.stage, s.tick);
  const priorPlatforms = platformsAtTick(s.stage, s.tick - 1);
  const carriedPlatforms: (number | null)[] = [null, null];
  for (let i = 0; i < 2; i++) {
    const p = s.players[i];
    const input = inputs[i];
    const def = fighterById(p.config.fighter);
    let carriedPlatform: number | null = null;
    p.dropThrough = Math.max(0, p.dropThrough - 1);
    if (p.grounded && p.supportPlatform !== null && p.supportPlatform >= 0) {
      const index = p.supportPlatform;
      const prior = priorPlatforms[index];
      const current = stagePlatforms[index];
      if (input.down) {
        p.dropThrough = 14;
        p.y += 3;
        p.grounded = false;
        p.supportPlatform = null;
      } else if (
        prior &&
        current &&
        Math.abs(p.y - prior.y) < 2 &&
        p.x >= prior.x - 5 &&
        p.x <= prior.x + prior.width + 5
      ) {
        platformCarry[i] = current.x - prior.x;
        p.x += platformCarry[i];
        p.y += current.y - prior.y;
        carriedPlatform = index;
      }
    }
    p.cooldown = Math.max(0, p.cooldown - 1);
    if (p.knockoutDelay) p.knockoutDelay--;
    p.stun = Math.max(0, p.stun - 1);
    p.slowTicks = Math.max(0, p.slowTicks - 1);
    p.rootTicks = Math.max(0, p.rootTicks - 1);
    if (!p.rootTicks) delete p.rootKind;
    p.invincible = Math.max(0, p.invincible - 1);
    p.dash = Math.max(0, p.dash - 1);
    const brake = TECHNIQUES[def.ability].dash?.brake;
    if (p.attack === "special" && !p.dash && brake) {
      p.vx *= brake;
      p.recoilVx = (p.recoilVx ?? 0) * brake;
    }
    const pressed = (key: Action) => input.actions[key] !== p.lastActions[key];
    p.blocking =
      input.block &&
      p.hp > 0 &&
      p.stun === 0 &&
      !p.attack &&
      p.grounded &&
      p.energy > 0;
    if (p.blocking) p.energy = Math.max(0, p.energy - 0.12);
    else p.energy = Math.min(100, p.energy + 0.035);
    if (p.stun === 0 && p.hp > 0) {
      const move = Number(input.right) - Number(input.left);
      if (!p.attack && !p.dash) {
        const acceleration = p.grounded ? 0.35 : 0.08;
        p.vx +=
          (move * def.speed * (p.blocking ? 0.3 : 1) * (p.slowTicks ? 0.6 : 1) -
            p.vx) *
          acceleration;
        p.recoilVx = (p.recoilVx ?? 0) * (1 - acceleration);
        if (move) p.facing = move;
        else if (
          p.grounded &&
          !(
            p.blocking &&
            s.fieldFinales?.some(
              (field) =>
                field.owner !== i &&
                (mountedFinale(field) ||
                  field.fighter === "zavarce" ||
                  field.fighter === "simon"),
            )
          )
        )
          p.facing = s.players[1 - i].x >= p.x ? 1 : -1;
      }
      if (pressed("jump") && p.jumps < 2 && !p.blocking) {
        cancelArenaPerformance(s, p);
        if (activeRunway(s, p)) {
          s.fieldFinales = s.fieldFinales?.filter(
            (field) => s.players[field.owner] !== p,
          );
          p.attack = null;
          p.cooldown = 12;
        }
        p.rootTicks = 0;
        delete p.rootKind;
        p.vy = p.jumps === 0 ? -12.8 : -11;
        p.jumps++;
        p.grounded = false;
        p.supportPlatform = null;
      }
      if (pressed("dash") && p.cooldown === 0 && !p.blocking && !p.rootTicks) {
        p.vx = p.facing * 14 * (p.slowTicks ? 0.6 : 1);
        p.recoilVx = 0;
        p.dash = 12;
        p.invincible = 8;
        p.cooldown = 30;
      }
      if (p.cooldown === 0 && !p.blocking) {
        if (pressed("super")) beginAttack(s, i, "super");
        else if (pressed("special")) beginAttack(s, i, "special");
        else if (pressed("heavy")) beginAttack(s, i, "heavy");
        else if (pressed("light")) beginAttack(s, i, "light");
      }
    }
    p.lastActions = { ...input.actions };
    carriedPlatforms[i] = carriedPlatform;
  }
  // Prepare both guards and inputs before contact, then move both fighters after it.
  // Otherwise a P1 hit applies knockback one frame earlier than the mirrored P2 hit.
  for (const player of s.players) if (player.attack) player.attackTick++;
  for (let i = 0; i < 2; i++) {
    updateAttack(s, i);
    if (s.finale) return;
  }
  advanceFieldFinales(s);
  // Both players must finish spawning shots before either reflector sees this tick's pack.
  for (let i = 0; i < 2; i++) reflectProjectiles(s, i);
  // Predict spacing from the movement that roots actually allow this frame.
  for (const p of s.players) {
    if (p.rootTicks > 0 && p.grounded) {
      p.vx = 0;
      p.recoilVx = 0;
    }
  }
  limitRetreat(s, movementOrigins, platformCarry);
  for (let i = 0; i < 2; i++) {
    const p = s.players[i];
    const input = inputs[i];
    const carriedPlatform = carriedPlatforms[i];
    const previousY = p.y;
    p.vy += 0.52;
    p.x += p.vx;
    p.y += p.vy;
    p.grounded = false;
    p.supportPlatform = null;
    const platforms = [
      ...stagePlatforms.map((platform, index) => ({
        ...platform,
        index,
        previousY:
          carriedPlatform === index ? platform.y : priorPlatforms[index].y,
      })),
      {
        x: WORLD.left,
        y: WORLD.floor,
        width: WORLD.right - WORLD.left,
        index: -1,
        previousY: WORLD.floor,
      },
    ].sort((a, b) => a.y - b.y);
    for (const platform of platforms) {
      if ((input.down || p.dropThrough > 0) && platform.index !== -1) continue;
      const relativeFall = p.y - previousY - (platform.y - platform.previousY);
      if (
        relativeFall >= 0 &&
        p.x >= platform.x - 5 &&
        p.x <= platform.x + platform.width + 5 &&
        previousY <= platform.previousY + 2 &&
        p.y >= platform.y
      ) {
        p.y = platform.y;
        p.vy = 0;
        p.grounded = true;
        p.supportPlatform = platform.index;
        p.jumps = 0;
        break;
      }
    }
    if (p.grounded && p.stun > 0) {
      p.vx *= 0.89;
      p.recoilVx = (p.recoilVx ?? 0) * 0.89;
    }
  }
  supportRunway(s);
  for (const hit of runwayContacts(s))
    hurt(
      s,
      hit.owner,
      hit.damage,
      hit.force,
      hit.direction,
      hit.x,
      hit.y,
      "super",
      8,
    );
  for (const contact of arenaFinaleContacts(s)) {
    const target = s.players[1 - contact.owner],
      hp = target.hp;
    if (
      hurt(
        s,
        contact.owner,
        contact.damage,
        contact.force,
        contact.direction,
        contact.x,
        contact.y,
        "super",
        5,
      )
    )
      registerArenaContact(s, contact, target.hp < hp);
  }
  const [a, b] = s.players;
  if (
    Math.abs(a.x - b.x) < 43 &&
    Math.abs(a.y - b.y) < 80 &&
    !a.dash &&
    !b.dash &&
    ![a, b].some((p) => {
      const field = activeArenaPerformance(s, p);
      return field && mountedFinale(field);
    })
  ) {
    const sign = b.x >= a.x ? 1 : -1;
    const push = (43 - Math.abs(a.x - b.x)) / 2;
    a.x -= sign * push;
    b.x += sign * push;
    // Body separation can push a fighter beyond the surface checked above.
    for (const p of s.players) {
      if (!p.grounded || activeRunway(s, p)) continue;
      const support =
        p.supportPlatform === -1
          ? { x: WORLD.left, width: WORLD.right - WORLD.left }
          : p.supportPlatform === null
            ? undefined
            : stagePlatforms[p.supportPlatform];
      if (
        !support ||
        p.x < support.x - 5 ||
        p.x > support.x + support.width + 5
      ) {
        p.grounded = false;
        p.supportPlatform = null;
      }
    }
  }
  // Snapshot interruption before any projectile lands: simultaneous wired casts
  // get the same chance to connect on either player side.
  const tetherOwners = s.players.map((p) => ({
    alive: p.hp > 0 && p.stocks > 0,
    interrupted: p.attack !== "special" || p.stun > 0,
  }));
  s.projectiles = s.projectiles.filter((projectile) => {
    projectile.age = (projectile.age || 0) + 1;
    const target = s.players[1 - projectile.owner];
    if (projectile.tether) {
      const owner = s.players[projectile.owner];
      if (!tetherOwners[projectile.owner].alive) return false;
      if (tetherOwners[projectile.owner].interrupted) {
        projectile.returning = true;
        projectile.connected = true;
      }
      if (projectile.age >= (projectile.returnAfter ?? Infinity))
        projectile.returning = true;
      if (
        projectile.x + projectile.vx < WORLD.x + 16 ||
        projectile.x + projectile.vx > WORLD.x + WORLD.width - 16
      )
        projectile.returning = true;
      if (projectile.returning) {
        const direction = projectile.direction ?? owner.facing;
        const dx =
          owner.x + direction * projectile.tether.catchX - projectile.x;
        const dy = owner.y - projectile.tether.catchY - projectile.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= projectile.tether.returnSpeed) return false;
        projectile.vx = (dx / distance) * projectile.tether.returnSpeed;
        projectile.vy = (dy / distance) * projectile.tether.returnSpeed;
      }
    }
    if (projectile.plantAfter && projectile.age >= projectile.plantAfter) {
      projectile.vx = 0;
      projectile.vy = 0;
      projectile.y = WORLD.floor - 42;
    }
    if (projectile.growth)
      projectile.radius = Math.min(
        projectile.maxRadius ?? 48,
        (projectile.radius ?? 12) + projectile.growth,
      );
    if (
      !projectile.tether &&
      projectile.returnAfter &&
      projectile.age === projectile.returnAfter
    )
      projectile.vx *= -1;
    if (projectile.acceleration)
      projectile.vx =
        Math.sign(projectile.vx) *
        Math.min(
          projectile.maxSpeed ?? 20,
          Math.abs(projectile.vx) + projectile.acceleration,
        );
    if (projectile.gravity)
      projectile.vy = (projectile.vy || 0) + projectile.gravity;
    projectile.x += projectile.vx;
    projectile.y += projectile.vy || 0;
    if (projectile.wave)
      projectile.y =
        (projectile.originY ?? projectile.y) +
        Math.sin((projectile.age * Math.PI * 2) / projectile.wave.period) *
          projectile.wave.amplitude;
    if (projectile.homing)
      projectile.y += Math.max(
        -projectile.homing,
        Math.min(projectile.homing, target.y - 75 - projectile.y),
      );
    projectile.life--;
    if (projectile.gravity && projectile.y >= WORLD.floor - 20) {
      if (projectile.bounces && projectile.bounces > 0) {
        projectile.y = WORLD.floor - 21;
        projectile.vy = -Math.abs(projectile.vy ?? 0) * 0.75;
        projectile.bounces--;
      } else projectile.life = 0;
    }
    if (projectile.life <= 0) {
      if (projectile.blastRadius) {
        effect(
          s,
          projectile.x,
          projectile.y,
          "special",
          fighterById(s.players[projectile.owner].config.fighter).color,
          { owner: projectile.owner, impact: "special", strength: 1.5 },
        );
        if (
          Math.abs(target.x - projectile.x) < projectile.blastRadius &&
          Math.abs(target.y - 60 - projectile.y) < 100
        )
          hurt(
            s,
            projectile.owner,
            projectile.damage,
            projectile.force ?? 7,
            target.x >= projectile.x ? 1 : -1,
            target.x,
            target.y - 60,
            projectile.impact ?? "special",
          );
      }
      return false;
    }
    if (
      !projectile.connected &&
      (!projectile.armAfter || projectile.age >= projectile.armAfter) &&
      Math.abs(target.x - projectile.x) <
        (projectile.radius ? 20 + projectile.radius : 42) &&
      projectile.y > target.y - 135 - (projectile.radius ?? 0) &&
      projectile.y < target.y - 10 + (projectile.radius ?? 0) &&
      (!projectile.groundOnly || target.grounded)
    ) {
      const healthBefore = target.hp;
      if (
        hurt(
          s,
          projectile.owner,
          projectile.damage,
          projectile.force ?? 7,
          Math.sign(projectile.vx) || projectile.direction || 1,
          target.x,
          projectile.y,
          projectile.impact ?? "special",
          projectile.hitInvincibility,
        )
      ) {
        if (target.hp < healthBefore) {
          if (projectile.pulls) {
            const source = s.players[projectile.owner];
            target.vx = (source.x >= target.x ? 1 : -1) * Math.abs(target.vx);
            target.recoilVx = target.vx;
          }
          if (projectile.slowTicks)
            target.slowTicks = Math.max(target.slowTicks, projectile.slowTicks);
        }
        if (projectile.blastRadius)
          effect(
            s,
            projectile.x,
            projectile.y,
            "special",
            fighterById(s.players[projectile.owner].config.fighter).color,
            { owner: projectile.owner, impact: "special", strength: 1.5 },
          );
        if (projectile.tether) {
          projectile.connected = true;
          projectile.returning = true;
          return true;
        }
        return false;
      }
    }
    return (
      projectile.life > 0 &&
      projectile.x > WORLD.x - 50 &&
      projectile.x < WORLD.x + WORLD.width + 50
    );
  });
  // Resolve the whole tick, including projectiles, before deciding the result.
  // Both players can lose a stock together; iteration order must not pick a winner.
  resolveStocks(s);
  resolveTimeout(s);
}

function resolveStocks(s: MatchState) {
  s.players.forEach((p, i) => {
    if (p.stocks <= 0) return;
    if (
      (p.hp <= 0 && !p.knockoutDelay) ||
      p.x < WORLD.x - 120 ||
      p.x > WORLD.x + WORLD.width + 120 ||
      p.y > WORLD.y + WORLD.height + 140
    )
      loseStock(s, i);
  });
  const [first, second] = s.players;
  if (s.players.some((p) => p.hp <= 0 && (p.knockoutDelay ?? 0) > 0)) return;
  if (first.stocks <= 0 || second.stocks <= 0) {
    s.phase = "finished";
    s.winner = first.stocks <= 0 ? (second.stocks <= 0 ? "draw" : 1) : 0;
  }
}

function resolveTimeout(s: MatchState) {
  // A lethal finishing throw has already decided this stock; finish its short
  // physical flight (or bounded fallback) before comparing timeout scores.
  if (s.players.some((p) => p.hp <= 0 && (p.knockoutDelay ?? 0) > 0)) return;
  if (s.remaining <= 0 && s.phase === "playing") {
    supportRunway(s);
    for (const hit of runwayContacts(s))
      hurt(
        s,
        hit.owner,
        hit.damage,
        hit.force,
        hit.direction,
        hit.x,
        hit.y,
        "super",
        8,
      );
    const [a, b] = s.players;
    const scoreA = a.stocks * 100 + a.hp;
    const scoreB = b.stocks * 100 + b.hp;
    s.winner =
      Math.abs(scoreA - scoreB) < 0.01 ? "draw" : scoreA > scoreB ? 0 : 1;
    s.phase = "finished";
  }
}

export function cpuInput(
  s: MatchState,
  previous: Input,
  difficulty: "easy" | "normal" | "hard",
): Input {
  const next: Input = { ...previous, actions: { ...previous.actions } };
  const p = s.players[1];
  const other = s.players[0];
  const dx = other.x - p.x;
  next.left = dx < -86;
  next.right = dx > 86;
  next.down =
    p.grounded &&
    p.supportPlatform !== null &&
    p.supportPlatform >= 0 &&
    other.y > p.y + 80 &&
    Math.abs(dx) < 180;
  next.block =
    difficulty !== "easy" &&
    (other.attack === "heavy" || other.attack === "special") &&
    Math.abs(dx) < 220 &&
    s.tick % 90 < 45;
  const cadence =
    difficulty === "easy" ? 68 : difficulty === "normal" ? 38 : 24;
  if (s.tick % cadence === 0 && p.cooldown === 0 && Math.abs(dx) < 165)
    next.actions[s.tick % 3 === 0 ? "heavy" : "light"]++;
  const def = fighterById(p.config.fighter);
  const technique = TECHNIQUES[def.ability];
  const defensiveOpportunity = technique.reflect
    ? s.projectiles.some(
        (shot) =>
          shot.owner !== 1 &&
          Math.abs(shot.x - p.x) < 290 &&
          Math.abs(shot.y - (p.y - 75)) < 95,
      )
    : technique.counter
      ? !!other.attack && Math.abs(dx) < technique.counter.range
      : false;
  const projectile = technique.projectile;
  // Returning shots reverse before their full lifetime; the CPU must close the gap first.
  const projectileReach = projectile?.returnAfter
    ? Math.min(
        540,
        48 +
          projectile.speed * projectile.returnAfter +
          (projectile.radius ?? 22),
      )
    : 540;
  const specialInRange = projectile
    ? Math.abs(dx) > 165 && Math.abs(dx) < projectileReach
    : Math.abs(dx) < technique.range - 15;
  if (
    ((specialInRange && s.tick % 100 === 0) ||
      (defensiveOpportunity && s.tick % 12 === 0)) &&
    p.energy >= 25 &&
    p.config.wins >= (def.specialUnlockWins ?? 0)
  ) {
    if (defensiveOpportunity) next.block = false;
    next.actions.special++;
  }
  if (
    (other.y < p.y - 70 ||
      (p.jumps === 1 && !p.grounded && other.y < p.y && p.vy > -2) ||
      p.x < WORLD.left + 30 ||
      p.x > WORLD.right - 30) &&
    p.jumps < 2 &&
    s.tick % 34 === 0
  )
    next.actions.jump++;
  if (
    difficulty === "hard" &&
    p.config.wins >= SUPER_UNLOCK_WINS &&
    p.energy >= SUPER_ENERGY_COST &&
    (finaleById(p.config.fighter)?.mode === "field"
      ? !s.fieldFinales?.some((field) => field.owner === 1) &&
        (isArenaFinalist(p.config.fighter)
          ? arenaFinaleInRange(p, other)
          : (p.config.fighter !== "dayana" || p.grounded) && Math.abs(dx) < 520)
      : finaleById(p.config.fighter)?.mode === "transformation"
        ? !p.transformation
        : finaleById(p.config.fighter)?.mode === "projectile"
          ? Math.abs(dx) <
              finaleById(p.config.fighter)!.projectile!.speed *
                (finaleById(p.config.fighter)!.projectile!.life - 1) &&
            Math.abs(other.y - p.y) < 100
          : Math.abs(dx) < 210) &&
    s.tick % 90 === 0
  )
    next.actions.super++;
  return next;
}
