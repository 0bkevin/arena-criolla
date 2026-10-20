import { fighterById, type BuiltInFighterId, type FighterId } from "./content";
import perroMujeriego from "./perro-mujeriego-choreography.json";

export type FinaleFamily =
  | "transport"
  | "sport"
  | "conversation"
  | "broadcast"
  | "music"
  | "dance"
  | "theater"
  | "technology"
  | "folklore";

export interface FinaleDefinition {
  id: BuiltInFighterId;
  title: string;
  description: string;
  family: FinaleFamily;
  prop: string;
  caption: string;
  accent: string;
  mode: "capture" | "transformation" | "projectile";
  empowerment?: { id: string; duration: number; damageMultiplier: number };
  /** A normal combat projectile: no capture, homing or scheduled remote damage. */
  projectile?: {
    kind: "sonic";
    speed: number;
    life: number;
    radius: number;
    growth: number;
    maxRadius: number;
    offsetX: number;
    offsetY: number;
    force: number;
  };
  duration: number;
  /** Optional physical finishing throw; ordinary captures keep force12. */
  release?: { force: number; knockoutDelay?: number };
  damageBeats: readonly number[];
  sound: "coffee" | "dance" | "hack" | "music" | "show" | "engine" | "mystic";
}

export interface FinaleState {
  owner: 0 | 1;
  target: 0 | 1;
  fighter: FighterId;
  startedTick: number;
  tick: number;
  duration: number;
  x: number;
  y: number;
  direction: number;
  damage: number;
  initialHp: number;
}

type Entry = readonly [
  BuiltInFighterId,
  string,
  FinaleFamily,
  string,
  string,
  string,
  FinaleDefinition["sound"],
];

const entries: readonly Entry[] = [
  [
    "zavarce",
    "Pelotón Yummy",
    "transport",
    "Siete motos Yummy cargan contra el rival en una formación escalonada, con un impacto por repartidor.",
    "Pelotón Yummy",
    "¡Pedido en camino!",
    "engine",
  ],
  [
    "vallenilla",
    "Cobro en equipo",
    "technology",
    "Pedro convoca dos mascotas blancas de Cashea, que rodean al rival y alternan seis puñetazos.",
    "Dos mascotas Cashea",
    "Cuota atrasada",
    "hack",
  ],
  [
    "javier",
    "Regaño de campeonato",
    "theater",
    "Javier se pone una camiseta negra sobre la cabeza como cabello y regaña al rival con tres gestos cada vez más enfáticos.",
    "Camiseta sobre la cabeza",
    "¡Y punto!",
    "show",
  ],
  [
    "capriles",
    "Cafecito interminable",
    "conversation",
    "Sienta al rival a su lado en una mesa con dos sillas. Entre sorbos dice «¡Qué manguangua!» y habla de la leche acaparada mientras le quita vida con cada pausa.",
    "Mesa, dos sillas y café",
    "¡Qué manguangua!",
    "coffee",
  ],
  [
    "renny",
    "El comercial del número uno",
    "broadcast",
    "Sentado en su escalera, Renny presenta un comercial: dos bailarinas con plumas golpean al rival con patadas alternadas y un empuje final.",
    "Escalera y bailarinas del comercial",
    "¡Y ahora, el comercial!",
    "show",
  ],
  [
    "gomez",
    "Carga del escuadrón",
    "transport",
    "Gómez carga a caballo contra el rival y lo sigue su escolta montada. Tras tres embestidas, vuelve, desmonta y retoma el combate.",
    "Caballo y escolta de caballería",
    "¡Escuadrón, adelante!",
    "show",
  ],
  [
    "simon",
    "Caballo de la sabana",
    "music",
    "Toca el cuatro y hace aparecer una estampida de caballitos de madera al ritmo de una tonada original.",
    "Cuatro y caballo de madera",
    "La sabana tiene su son",
    "music",
  ],
  [
    "conde",
    "Conde Bond",
    "theater",
    "Se transforma en Conde Bond durante seis segundos de combate y sus ataques hacen un 20 % más de daño.",
    "Sombrero blanco, gafas y traje oscuro",
    "Conde Bond en acción",
    "show",
  ],
  [
    "emilio",
    "El Chunior",
    "theater",
    "Se transforma en El Chunior durante seis segundos de combate y sus ataques hacen un 20 % más de daño.",
    "Peluca gris, gafas de aviador, bigote, audífonos y chaqueta beige",
    "El Chunior en acción",
    "show",
  ],
  [
    "maite",
    "¡Buenas noches, Poliedro!",
    "broadcast",
    "Proyecta su saludo al Poliedro con una potente onda sonora que viaja por la arena y daña al rival al alcanzarlo. Se puede bloquear o esquivar.",
    "Micrófono y onda sonora",
    "¡BUENAS NOOOCHES, POLIEDRO DE CARACAS!",
    "show",
  ],
  [
    "oscar",
    "Contrabajo del sonero",
    "music",
    "Toca el contrabajo y lanza tres notas musicales que golpean al rival al llegar a su cuerpo.",
    "Contrabajo salsero",
    "¡Que suene el bajo!",
    "music",
  ],
  [
    "puma",
    "¡Agárrense de las manos!",
    "music",
    "Invoca una cadena de bailarines que gira de la mano alrededor del rival, lo atrapa y lo catapulta fuera de la arena.",
    "Cadena de bailarines",
    "¡Agárrense de las manos!",
    "music",
  ],
  [
    "chataing",
    "¡Vamos a comerciales!",
    "broadcast",
    "Congela al rival dentro de una pantalla y la revienta de un único microfonazo con cable antes de devolverlo a la arena.",
    "Pantalla de televisión y micrófono con cable",
    "¡Vamos a comerciales!",
    "show",
  ],
  [
    "george",
    "Se acabó el show",
    "theater",
    "Hace una reverencia mientras un telón gigante cae sobre el rival, asesta un único golpe y vuelve a levantarse en la misma arena.",
    "Telón de terciopelo y barra suspendida",
    "Se acabó el show",
    "show",
  ],
  [
    "mcm",
    "Caravana hasta el final",
    "transport",
    "Sube a la caja trasera de una pickup con bandera venezolana; pasajeros y acompañantes avanzan con ella y el frente golpea una vez al rival.",
    "Pickup, bandera venezolana y acompañantes",
    "Hasta el final",
    "engine",
  ],
  [
    "ali",
    "Canto que hace eco",
    "music",
    "Rasguea un cuatro de cuatro cuerdas: la onda eleva al rival, seis adultos se unen al coro y la hacen crecer hasta el tercer impacto.",
    "Cuatro venezolano y coro de seis adultos",
    "La canción sigue viva",
    "music",
  ],
  [
    "gualberto",
    "Galerón de madrugada",
    "music",
    "Toca un tremolo oriental; el rival queda rodeado por cuerdas, notas y el resplandor de una serenata.",
    "Mandolina oriental",
    "Que suene el galerón",
    "music",
  ],
  [
    "reynaldo",
    "Caballo de oro",
    "transport",
    "Un caballo dorado de leyenda galopa alrededor del rival y cierra con un lazo de luz sabanera.",
    "Caballo dorado y lazo",
    "¡Arre, sabana!",
    "engine",
  ],
  [
    "dudamel",
    "Orquesta a toda fuerza",
    "music",
    "Dudamel dirige delante de una orquesta completa; tres ondas musicales crecientes viajan hasta el rival y dañan al llegar.",
    "Batuta y orquesta completa",
    "Todos juntos, fortissimo",
    "music",
  ],
  [
    "danny",
    "Marea de neón",
    "music",
    "Una ola con forma de corazón envuelve a ambos personajes y estalla con el pulso de un concierto de neón.",
    "Corazón y ola de neón",
    "Que suba la marea",
    "dance",
  ],
  [
    "nacho",
    "Baile del perro mujeriego",
    "dance",
    "Nacho y su rival hacen pasos laterales, giro de hombros y un remate sincronizado sobre una pista de luces.",
    "Pista de baile y micrófono",
    "Los dos a bailar",
    "dance",
  ],
  [
    "sarcos",
    "El premio es tuyo",
    "broadcast",
    "Sube al rival a un podio de concurso y abre tres cajas sorpresa entre luces, confeti y fanfarrias.",
    "Podio y cajas de premios",
    "¡Te llevaste el premio!",
    "show",
  ],
  [
    "yordano",
    "Manantial de acordes",
    "music",
    "Un piano y un manantial iluminado arrastran al rival a una balada de tres oleadas.",
    "Piano y manantial",
    "El agua trae su canción",
    "music",
  ],
  [
    "lila",
    "El gran cocotero",
    "dance",
    "Hace bailar al rival frente a una palmera de espectáculo; cocos de utilería marcan el remate zuliano.",
    "Palmera y maracas",
    "A mover el cocotero",
    "dance",
  ],
  [
    "rummy",
    "Joropo de la flor sabanera",
    "dance",
    "Invita al rival a zapatear frente al arpa y dibuja flores de sabana con cada paso.",
    "Arpa y botas de joropo",
    "¡Que repique la sabana!",
    "music",
  ],
  [
    "chiqui",
    "Pasarela de relámpagos",
    "theater",
    "Obliga al rival a caminar a su lado por una pasarela mientras las cámaras disparan tres ráfagas de flashes suaves.",
    "Pasarela y cámaras",
    "Mira a la cámara",
    "show",
  ],
  [
    "norkys",
    "Cambio de escena",
    "theater",
    "Lleva al rival a una audición, cambia el foco con un giro y le entrega un libreto con tres sorpresas.",
    "Foco y libreto",
    "Tu escena empieza ahora",
    "show",
  ],
  [
    "gabriela",
    "La doble toma",
    "theater",
    "Dos espejos enmarcan al rival y duplican la figura de Gabriela para un desenlace de telenovela.",
    "Espejos y rosa",
    "¿Cuál de las dos soy?",
    "show",
  ],
  [
    "amanda",
    "Último acto",
    "theater",
    "Abre un telón rojo ante el rival, pronuncia un monólogo gestual y cierra con una reverencia y golpe de luz.",
    "Telón de teatro",
    "Silencio, empieza la función",
    "show",
  ],
  [
    "lele",
    "Broma en directo",
    "technology",
    "Encuadra al rival con un teléfono gigante y activa una cadena de trampas de comedia entre corazones y confeti.",
    "Teléfono y cáscara",
    "¡Sonríe, estás en cámara!",
    "hack",
  ],
  [
    "giuseppe",
    "Acceso a tu barra",
    "technology",
    "Teclea frente al portátil, conecta un cable de datos ficticio a la barra rival y descarga su vida en tres pulsos.",
    "Portátil y terminal",
    "Acceso concedido",
    "hack",
  ],
  [
    "silbon",
    "El saco del silbido",
    "folklore",
    "Abre su saco de huesos de utilería y rodea al rival con una espiral de silbidos y sombras llaneras.",
    "Saco y huesos",
    "Lo oyes lejos…",
    "mystic",
  ],
  [
    "llorona",
    "Abrazo del inframundo",
    "folklore",
    "Atrae al rival con su lamento, revela un rostro aterrador y lo agarra para descender juntos por un portal al inframundo. Ambos regresan antes de retomar el combate.",
    "Portal y abrazo espectral",
    "El río no deja escapar",
    "mystic",
  ],
  [
    "sayona",
    "El velo de medianoche",
    "folklore",
    "Aparece a ambos lados del rival entre velos blancos y velas, y cierra su círculo de sombras.",
    "Velo y velas",
    "No mires atrás",
    "mystic",
  ],
  [
    "lionza",
    "Sorte despierta",
    "folklore",
    "Una danta de jade cruza una selva de hojas y lleva al rival ante la corona luminosa de Sorte.",
    "Danta de jade",
    "La montaña despierta",
    "mystic",
  ],
  [
    "florentino",
    "Contrapunteo al amanecer",
    "music",
    "Sienta al rival en un contrapunteo ilustrado; el arpa y el cuatro convierten tres respuestas en cintas de coplas.",
    "Arpa, cuatro y copla",
    "Te respondo con un verso",
    "music",
  ],
  [
    "diablo",
    "Coplas de fuego",
    "folklore",
    "Toca un arpa de brasas alrededor del rival y dibuja un círculo de fuego teatral que se apaga con el amanecer.",
    "Arpa de fuego",
    "Hasta que salga el sol",
    "mystic",
  ],
  [
    "knoche",
    "La fórmula de Galipán",
    "folklore",
    "Invita al rival a su laboratorio de ficción y mezcla tres frascos cuya niebla dibuja una calavera de vapor.",
    "Gabinete y frascos",
    "Una dosis de misterio",
    "mystic",
  ],
  [
    "momoy",
    "La laguna encantada",
    "folklore",
    "Brota una laguna andina entre hongos y raíces; el rival queda atrapado en una ronda de duendes de agua.",
    "Laguna y hongos",
    "El páramo tiene guardián",
    "mystic",
  ],
  [
    "tiotigre",
    "El rey del monte",
    "folklore",
    "Tres zarpazos cruzan un peñasco de selva mientras el rival retrocede ante un rugido de cuento.",
    "Peñasco y zarpas",
    "¡Aquí mando yo!",
    "mystic",
  ],
  [
    "tioconejo",
    "La picardía del camino",
    "folklore",
    "Ofrece una zanahoria al rival, tira de una cuerda y lo hace caer en una trampa de cuento entre hojas.",
    "Zanahoria y trampa",
    "Una ayudita, compadre…",
    "show",
  ],
  [
    "enrique",
    "Cierre de caja",
    "technology",
    "Sienta al rival frente a un libro contable y hace caer tres sellos de balance que descuentan vida.",
    "Libro contable y calculadora",
    "La cuenta está clara",
    "hack",
  ],
  [
    "jesus",
    "Transferencia instantánea",
    "technology",
    "Conecta dos carteras de neón y envía tres remesas ficticias de energía desde la barra del rival.",
    "Carteras y monedas",
    "Transferencia completada",
    "hack",
  ],
  [
    "carlos",
    "Prueba de manejo",
    "transport",
    "Invita al rival a una prueba en un carrito de exhibición y encadena tres acelerones sobre una pista de luz.",
    "Auto y banderín",
    "Siguiente cambio",
    "engine",
  ],
  [
    "victor",
    "Corte de neón",
    "technology",
    "Abre una tarjeta luminosa y traza tres diagonales Slash que cortan una interfaz ficticia alrededor del rival.",
    "Tarjeta y diagonales",
    "Cierre autorizado",
    "hack",
  ],
  [
    "juan",
    "La ciudad se mueve",
    "transport",
    "Una Wawa ilustrada recoge al rival y recorre tres nodos de una ciudad luminosa hasta la parada final.",
    "Autobús y mapa urbano",
    "Próxima parada: la arena",
    "engine",
  ],
  [
    "lorenzo",
    "Caravana Polar",
    "transport",
    "Lorenzo se agarra al estribo de un camión Polar y carga junto a otros dos camiones; el frente del principal golpea al rival.",
    "Tres camiones Polar",
    "El trabajo nos une",
    "engine",
  ],
  [
    "carolina",
    "Colección de cierre",
    "theater",
    "Traza tres arcos de seda alrededor del rival y cierra la colección con un destello de alta costura.",
    "Cintas de seda",
    "La última puntada",
    "show",
  ],
  [
    "dayana",
    "Volea vinotinto",
    "sport",
    "Dayana y dos compañeras adultas detrás de ella patean tres balones simultáneamente; la volea golpea al rival al llegar.",
    "Tres futbolistas y tres balones",
    "La arena se viste de vinotinto",
    "show",
  ],
  [
    "bolivar",
    "Marcha de la libertad",
    "theater",
    "Bolívar monta su caballo y carga con seis llaneros distintos detrás. El caballo conecta un impacto, la tropa retrocede y Bolívar desmonta.",
    "Caballo y seis llaneros",
    "Adelante, la arena es libre",
    "show",
  ],
  [
    "edgar",
    "Última toma",
    "theater",
    "Encuadra al rival con una claqueta luminosa y encadena tres tomas antes del corte final.",
    "Claqueta y encuadre",
    "Tres, dos, uno… acción",
    "show",
  ],
  [
    "melanio",
    "Quedó grabado",
    "broadcast",
    "Graba al rival con un teléfono, lo deslumbra con un flash local y remata con un único golpe del mismo teléfono.",
    "Un teléfono y flash local",
    "Todo quedó grabado",
    "hack",
  ],
];

export const FINALE_DURATION = 180;
export const FINALE_CAPTURE_TICK = 9;
export const FINALE_DAMAGE_BEATS = [42, 90, 138] as const;
export const FINALE_RANGE = 245;

export const FINALES = Object.fromEntries(
  entries.map(
    ([id, title, family, description, prop, caption, sound]): [
      BuiltInFighterId,
      FinaleDefinition,
    ] => [
      id,
      {
        id,
        title,
        description,
        family,
        prop,
        caption,
        accent: fighterById(id).color,
        ...(id === "puma" ? { release: { force: 34, knockoutDelay: 90 } } : {}),
        mode:
          id === "conde" || id === "emilio"
            ? "transformation"
            : id === "maite"
              ? "projectile"
              : "capture",
        ...(id === "maite"
          ? {
              projectile: {
                kind: "sonic" as const,
                speed: 12,
                life: 55,
                radius: 20,
                growth: 0.7,
                maxRadius: 52,
                offsetX: 38,
                offsetY: 154,
                force: 12,
              },
            }
          : {}),
        ...(id === "conde" || id === "emilio"
          ? {
              empowerment: {
                id: id === "conde" ? "conde-bond" : "el-chunior",
                duration: 360,
                damageMultiplier: 1.2,
              },
            }
          : {}),
        duration:
          id === "conde" || id === "emilio"
            ? 360
            : id === "maite"
              ? 84
              : id === "nacho"
                ? perroMujeriego.durationTicks
                : FINALE_DURATION,
        damageBeats:
          id === "conde" || id === "emilio" || id === "maite"
            ? []
            : id === "nacho"
              ? FINALE_DAMAGE_BEATS.map(
                  (tick) =>
                    tick * (perroMujeriego.durationTicks / FINALE_DURATION),
                )
              : id === "zavarce"
                ? [42, 58, 74, 90, 106, 122, 138]
                : id === "vallenilla"
                  ? [44, 62, 80, 98, 116, 134]
                  : id === "gomez"
                    ? [48, 70, 92]
                    : id === "chataing" || id === "melanio"
                      ? [114]
                      : id === "dayana"
                        ? [100]
                        : id === "george" ||
                            id === "mcm" ||
                            id === "lorenzo" ||
                            id === "bolivar"
                          ? [96]
                          : FINALE_DAMAGE_BEATS,
        sound,
      },
    ],
  ),
) as Record<BuiltInFighterId, FinaleDefinition>;

export function finaleById(id: FighterId): FinaleDefinition | undefined {
  return FINALES[id as BuiltInFighterId];
}

export const FINALE_ASSET_GROUPS = [
  [
    "zavarce",
    "vallenilla",
    "javier",
    "capriles",
    "renny",
    "gomez",
    "simon",
    "conde",
  ],
  ["emilio", "maite", "oscar", "puma", "chataing", "george", "mcm", "ali"],
  [
    "gualberto",
    "reynaldo",
    "dudamel",
    "danny",
    "nacho",
    "sarcos",
    "yordano",
    "lila",
  ],
  [
    "rummy",
    "chiqui",
    "norkys",
    "gabriela",
    "amanda",
    "lele",
    "giuseppe",
    "silbon",
  ],
  [
    "llorona",
    "sayona",
    "lionza",
    "florentino",
    "diablo",
    "knoche",
    "momoy",
    "tiotigre",
  ],
  ["tioconejo", "enrique", "jesus", "carlos", "victor", "juan"],
] as const satisfies readonly (readonly BuiltInFighterId[])[];

// The original authored batch is immutable. Later roster additions use their
// canonical combat sprites with arena props drawn by the renderer.
export const CANONICAL_FINALE_FIGHTERS = [
  "lorenzo",
  "carolina",
  "dayana",
  "bolivar",
  "edgar",
  "melanio",
] as const satisfies readonly BuiltInFighterId[];

export function finaleAsset(id: FighterId) {
  for (const [group, ids] of FINALE_ASSET_GROUPS.entries()) {
    const index = (ids as readonly string[]).indexOf(id);
    if (index !== -1)
      return {
        file: `finales-v1-${group + 1}`,
        column: index % 4,
        row: Math.floor(index / 4),
      };
  }
  return undefined;
}
