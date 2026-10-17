import {
  fighterById,
  platformsAtTick,
  type FighterId,
  type StageId,
} from "./content";
import { TECHNIQUES, type Technique } from "./techniques";
import { INTRO_COUNTDOWN_START, INTRO_TOTAL_TICKS } from "./presentation";

export const WORLD = {
  width: 1080,
  height: 640,
  floor: 554,
  left: 70,
  right: 1010,
};
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
  vy: number;
  facing: number;
  hp: number;
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
  returnAfter?: number;
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
}

function makePlayer(config: PlayerConfig, index: number): PlayerState {
  return {
    config,
    x: index === 0 ? 330 : 750,
    y: WORLD.floor,
    vx: 0,
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
    remaining: 90 * 60,
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
  const target = s.players[1 - attacker];
  const source = s.players[attacker];
  if (target.invincible > 0 || target.stocks <= 0) return false;
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
        counter.damage * fighterById(target.config.fighter).damage,
        counter.force,
        target.facing,
        source.x,
        source.y - 80,
        "special",
      );
    return true;
  }
  if (target.blocking && target.facing === -direction && target.energy > 3) {
    target.energy = Math.max(0, target.energy - 9);
    target.vx += direction * 1.5;
    effect(s, x, y, "block", "#c7e8ff", {
      owner: attacker,
      impact,
      direction,
      strength: 0.8,
    });
    s.hitstop = Math.max(s.hitstop, 2);
    return true;
  }
  const def = fighterById(target.config.fighter);
  target.hp = Math.max(0, target.hp - damage * def.armor);
  target.vx = direction * force * (1 + (100 - target.hp) / 90);
  target.vy = -force * 0.65;
  target.grounded = false;
  target.supportPlatform = null;
  target.stun = Math.round(force * 2.6 + 5);
  target.attack = null;
  target.cooldown = Math.max(target.cooldown, target.stun);
  target.invincible = hitInvincibility;
  target.energy = Math.min(100, target.energy + 9);
  source.energy = Math.min(100, source.energy + 13);
  source.hits++;
  source.streak = s.tick - source.lastHitTick < 100 ? source.streak + 1 : 1;
  source.lastHitTick = s.tick;
  source.peakCombo = Math.max(source.peakCombo, source.streak);
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
  p.stocks--;
  p.slowTicks = 0;
  p.rootTicks = 0;
  effect(
    s,
    Math.max(30, Math.min(WORLD.width - 30, p.x)),
    Math.min(590, p.y - 60),
    "ringout",
    fighterById(p.config.fighter).color,
    { owner: i, strength: 1.8, direction: p.x < WORLD.width / 2 ? -1 : 1 },
  );
  if (p.stocks <= 0) {
    p.hp = 0;
    s.phase = "finished";
    s.winner = 1 - i;
    return;
  }
  p.x = i === 0 ? 330 : 750;
  p.y = 260;
  p.vx = 0;
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

function beginAttack(s: MatchState, i: number, attack: NonNullable<Attack>) {
  const p = s.players[i];
  if (
    attack === "special" &&
    TECHNIQUES[fighterById(p.config.fighter).ability].requiresGround &&
    !p.grounded
  )
    return;
  const def = fighterById(p.config.fighter);
  if (attack === "special" && p.energy < 25) return;
  if (attack === "super" && (p.config.wins < 3 || p.energy < 75)) return;
  if (attack === "special") p.energy -= 25;
  if (attack === "super") p.energy -= 75;
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
          : 42;
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
  if (attack === "special" || attack === "super")
    effect(s, p.x, p.y - 75, "special", def.color, {
      owner: i,
      impact: attack,
      direction: p.facing,
    });
}

function updateAttack(s: MatchState, i: number) {
  const p = s.players[i];
  if (!p.attack) return;
  const attack = p.attack;
  const def = fighterById(p.config.fighter);
  const other = s.players[1 - i];
  const technique = TECHNIQUES[def.ability];
  if (
    attack === "special" &&
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
  const activeAt =
    attack === "light"
      ? 6
      : attack === "heavy"
        ? 11
        : attack === "special"
          ? technique.startup
          : 9;
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
          x: p.x + p.facing * 48,
          y: p.y - (projectile.groundOnly ? 42 : 75),
          originY: p.y - 75,
          vx: p.facing * projectile.speed,
          vy:
            (projectile.initialVy ?? 0) +
            (note - (count - 1) / 2) * (projectile.spread || 0),
          age: 0,
          returnAfter: projectile.returnAfter,
          life: projectile.life,
          kind: def.ability,
          damage: technique.damage * def.damage,
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
      if (attack === "super") range = 245;
      if (attack === "special") {
        range =
          technique.range +
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
          damage,
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
          other.vx = 0;
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

export function stepMatch(s: MatchState, inputs: [Input, Input]): void {
  if (s.phase === "finished") return;
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
        p.x += current.x - prior.x;
        p.y += current.y - prior.y;
        carriedPlatform = index;
      }
    }
    p.cooldown = Math.max(0, p.cooldown - 1);
    p.stun = Math.max(0, p.stun - 1);
    p.slowTicks = Math.max(0, p.slowTicks - 1);
    p.rootTicks = Math.max(0, p.rootTicks - 1);
    p.invincible = Math.max(0, p.invincible - 1);
    p.dash = Math.max(0, p.dash - 1);
    const brake = TECHNIQUES[def.ability].dash?.brake;
    if (p.attack === "special" && !p.dash && brake) p.vx *= brake;
    const pressed = (key: Action) => input.actions[key] !== p.lastActions[key];
    p.blocking =
      input.block && p.stun === 0 && !p.attack && p.grounded && p.energy > 0;
    if (p.blocking) p.energy = Math.max(0, p.energy - 0.12);
    else p.energy = Math.min(100, p.energy + 0.035);
    if (p.stun === 0) {
      const move = Number(input.right) - Number(input.left);
      if (!p.attack && !p.dash) {
        p.vx +=
          (move * def.speed * (p.blocking ? 0.3 : 1) * (p.slowTicks ? 0.6 : 1) -
            p.vx) *
          (p.grounded ? 0.35 : 0.08);
        if (move) p.facing = move;
        else if (p.grounded) p.facing = s.players[1 - i].x >= p.x ? 1 : -1;
      }
      if (pressed("jump") && p.jumps < 2 && !p.blocking) {
        p.rootTicks = 0;
        p.vy = p.jumps === 0 ? -12.8 : -11;
        p.jumps++;
        p.grounded = false;
        p.supportPlatform = null;
      }
      if (pressed("dash") && p.cooldown === 0 && !p.blocking && !p.rootTicks) {
        p.vx = p.facing * 14 * (p.slowTicks ? 0.6 : 1);
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
  for (let i = 0; i < 2; i++) updateAttack(s, i);
  for (let i = 0; i < 2; i++) {
    const p = s.players[i];
    const input = inputs[i];
    const carriedPlatform = carriedPlatforms[i];
    if (p.rootTicks > 0 && p.grounded) p.vx = 0;
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
    if (p.grounded && p.stun > 0) p.vx *= 0.89;
    if (
      p.hp <= 0 ||
      p.x < -120 ||
      p.x > WORLD.width + 120 ||
      p.y > WORLD.height + 140
    )
      loseStock(s, i);
    if (s.winner !== null) return;
  }
  const [a, b] = s.players;
  if (
    Math.abs(a.x - b.x) < 43 &&
    Math.abs(a.y - b.y) < 80 &&
    !a.dash &&
    !b.dash
  ) {
    const sign = b.x >= a.x ? 1 : -1;
    const push = (43 - Math.abs(a.x - b.x)) / 2;
    a.x -= sign * push;
    b.x += sign * push;
  }
  s.projectiles = s.projectiles.filter((projectile) => {
    projectile.age = (projectile.age || 0) + 1;
    const target = s.players[1 - projectile.owner];
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
    if (projectile.returnAfter && projectile.age === projectile.returnAfter)
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
            "special",
          );
      }
      return false;
    }
    if (
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
          "special",
        )
      ) {
        if (target.hp < healthBefore) {
          if (projectile.pulls) {
            const source = s.players[projectile.owner];
            target.vx = (source.x >= target.x ? 1 : -1) * Math.abs(target.vx);
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
        return false;
      }
    }
    return (
      projectile.life > 0 &&
      projectile.x > -50 &&
      projectile.x < WORLD.width + 50
    );
  });
  resolveTimeout(s);
}

function resolveTimeout(s: MatchState) {
  if (s.remaining <= 0 && s.phase === "playing") {
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
  next.block =
    difficulty !== "easy" &&
    (other.attack === "heavy" || other.attack === "special") &&
    Math.abs(dx) < 220 &&
    s.tick % 90 < 45;
  const cadence =
    difficulty === "easy" ? 68 : difficulty === "normal" ? 38 : 24;
  if (s.tick % cadence === 0 && p.cooldown === 0 && Math.abs(dx) < 165)
    next.actions[s.tick % 3 === 0 ? "heavy" : "light"]++;
  const technique = TECHNIQUES[fighterById(p.config.fighter).ability];
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
    p.energy >= 25
  ) {
    if (defensiveOpportunity) next.block = false;
    next.actions.special++;
  }
  if (
    (other.y < p.y - 70 || p.x < 100 || p.x > 980) &&
    p.jumps < 2 &&
    s.tick % 34 === 0
  )
    next.actions.jump++;
  if (
    difficulty === "hard" &&
    p.config.wins >= 3 &&
    p.energy >= 75 &&
    Math.abs(dx) < 210 &&
    s.tick % 90 === 0
  )
    next.actions.super++;
  return next;
}
