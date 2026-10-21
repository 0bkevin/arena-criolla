import test from "node:test";
import assert from "node:assert/strict";
import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FIGHTERS, stageById } from "../shared/content";
import type { RoomView } from "../shared/protocol";
import { ArcadeLobby } from "../src/components/ArcadeLobby";
import type { GameMode } from "../src/components/Game";

const room: RoomView = {
  code: "0123456789ABCDEF0123456789ABCDEF",
  name: "Sala 012345",
  stage: "caracas",
  status: "waiting",
  host: "host",
  players: [
    {
      id: "host",
      name: "Jugador 1",
      fighter: "zavarce",
      ready: false,
      wins: 0,
    },
    {
      id: "guest",
      name: "Jugador 2",
      fighter: "vallenilla",
      ready: false,
      wins: 0,
    },
  ],
};

function renderLobby(
  mode: GameMode,
  currentRoom: RoomView | null,
  id = "guest",
) {
  return renderToStaticMarkup(
    createElement(ArcadeLobby, {
      mode,
      fighter:
        currentRoom?.players.find((player) => player.id === id)?.fighter ??
        "vallenilla",
      rival: "zavarce",
      stage: stageById("caracas"),
      difficulty: "normal",
      query: "",
      fighters: FIGHTERS,
      network: {
        communityVersion: 0,
        connected: true,
        id,
        rooms: [],
        room: currentRoom,
        online: 2,
        error: "",
        setError() {},
        match: null,
        state: { current: null },
        opponentLeft: false,
        setOpponentLeft() {},
        send: () => true,
      },
      searchInput: createRef<HTMLInputElement>(),
      setupPanel: createRef<HTMLElement>(),
      onQuery() {},
      onClearQuery() {},
      onFighter() {},
      onRival() {},
      onStage() {},
      onMode() {},
      onDifficulty() {},
      onModeKeys() {},
      onRosterKeys() {},
      onDetail() {},
      onModal() {},
      onStart() {},
      onReady() {},
      onInvite() {},
    }),
  );
}

test("the online guest selects and announces their own fighter as P2", () => {
  const html = renderLobby("online", room);
  assert.match(html, /aria-label="Elegir luchador al azar para P2"/);
  assert.match(html, /Luchador seleccionado para P2: Pedro Vallenilla\./);
  const buttons = [...html.matchAll(/<button\b([^>]*)>/g)].map(
    (match) => match[1],
  );
  assert.equal(
    buttons.filter(
      (attrs) =>
        attrs.includes('aria-label="Elegir luchador para P2"') &&
        !attrs.includes("disabled"),
    ).length,
    2,
  );
  assert.equal(
    buttons.filter(
      (attrs) =>
        attrs.includes('aria-label="Elegir luchador para P1"') &&
        attrs.includes("disabled"),
    ).length,
    1,
  );
});

test("online host promotion updates the surviving player's selection labels", () => {
  const promoted: RoomView = {
    ...room,
    host: "guest",
    players: [{ ...room.players[1], name: "Jugador 1" }],
  };
  const html = renderLobby("online", promoted);
  assert.match(html, /aria-label="Elegir luchador al azar para P1"/);
  assert.match(html, /Luchador seleccionado para P1: Pedro Vallenilla\./);
});

test("local and CPU modes keep their own player labels without name inputs", () => {
  for (const mode of ["practice", "local"] as const) {
    const html = renderLobby(mode, null);
    assert.match(html, /aria-label="Elegir luchador al azar para P1"/);
    assert.ok(
      html.includes(
        `aria-label="Elegir luchador para ${mode === "practice" ? "CPU" : "P2"}"`,
      ),
    );
    assert.doesNotMatch(html, /<input\b/);
  }
});
