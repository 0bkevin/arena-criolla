import {
  ARENA_FINALES,
  ARENA_FINALE_CUES,
  isArenaFinalist,
} from "./arena-finales";
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
  mode: "capture" | "transformation" | "projectile" | "field";
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
  /** Optional finishing throw; zero releases in place, ordinary captures keep force12. */
  release?: { force: number; knockoutDelay?: number };
  damageBeats: readonly number[];
  /** Sound and gesture timing for spatial attacks. Damage still requires contact. */
  cueBeats?: readonly number[];
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
    "dorangel",
    "Olla al fuego",
    "theater",
    "Invoca una olla delante de él y remueve con un cucharón. El rival solo recibe daño si permanece a su alcance: puede bloquear, saltar para salir o interrumpir a Dorángel. La olla y ambos luchadores permanecen en el escenario.",
    "Olla, cucharón y vapor",
    "Definitiva",
    "show",
  ],
  [
    "zavarce",
    "Pelotón Yummy",
    "transport",
    "Siete motos Yummy atraviesan la arena en una formación escalonada. Cada moto tiene su propio contacto, se puede bloquear o esquivar y sigue rodando después del impacto.",
    "Pelotón Yummy",
    "¡Pedido en camino!",
    "engine",
  ],
  [
    "vallenilla",
    "Cobro en equipo",
    "technology",
    "Pedro convoca dos mascotas blancas de Cashea. Caminan hasta el rival y alternan seis puñetazos de alcance local; el rival puede alejarse, saltar o bloquear cada golpe.",
    "Dos mascotas Cashea",
    "Cuota atrasada",
    "hack",
  ],
  [
    "javier",
    "Regaño de campeonato",
    "theater",
    "Javier se pone una camiseta sobre la cabeza y regaña con tres ondas cortas que salen de sus gestos. Cada onda debe alcanzar al rival y se puede bloquear o esquivar.",
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
    "Renny se sienta en su escalera y presenta a dos bailarinas. Se acercan, alternan patadas y empujan al rival solo cuando está a su alcance, mientras continúa la pelea.",
    "Escalera y bailarinas del comercial",
    "¡Y ahora, el comercial!",
    "show",
  ],
  [
    "gomez",
    "Carga del escuadrón",
    "transport",
    "Gómez avanza a caballo y dos escoltas lo siguen por la arena. Cada montura puede conectar una embestida, bloquearse o fallar; Gómez desmonta donde termina su carga.",
    "Caballo y escolta de caballería",
    "¡Escuadrón, adelante!",
    "show",
  ],
  [
    "simon",
    "Caballo de la sabana",
    "music",
    "Toca el cuatro y envía tres caballitos de madera que cruzan las superficies de la arena. Cada juguete tiene su propio contacto y puede saltarse o bloquearse.",
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
    "Toca el contrabajo y lanza tres notas musicales reales. Viajan por la arena y pueden golpear, fallar, bloquearse o devolverse con una habilidad de reflejo.",
    "Contrabajo salsero",
    "¡Que suene el bajo!",
    "music",
  ],
  [
    "puma",
    "¡Agárrense de las manos!",
    "music",
    "Invoca una cadena de bailarines que avanza por la arena. Si alcanza al rival, lo retiene brevemente y puede catapultarlo con un segundo contacto; saltar permite escapar.",
    "Cadena de bailarines",
    "¡Agárrense de las manos!",
    "music",
  ],
  [
    "chataing",
    "¡Vamos a comerciales!",
    "broadcast",
    "Coloca una pantalla delante de él. Si el rival entra, lo retiene brevemente y remata con el micrófono; el rival puede bloquear, salir o saltar. El combate continúa.",
    "Pantalla de televisión y micrófono con cable",
    "¡Vamos a comerciales!",
    "show",
  ],
  [
    "george",
    "Se acabó el show",
    "theater",
    "Hace una reverencia y deja caer un telón delante de él. La caída golpea una sola vez al tocar al rival y se puede bloquear o evitar saliendo de su recorrido.",
    "Telón de terciopelo y barra suspendida",
    "Se acabó el show",
    "show",
  ],
  [
    "mcm",
    "Caravana hasta el final",
    "transport",
    "Sube a la pickup con bandera venezolana y avanza con pasajeros y acompañantes. El vehículo cruza al rival con una embestida física que se puede bloquear o esquivar.",
    "Pickup, bandera venezolana y acompañantes",
    "Hasta el final",
    "engine",
  ],
  [
    "ali",
    "Canto que hace eco",
    "music",
    "Rasguea su cuatro acompañado por seis adultos del coro. Emite tres ondas crecientes que recorren la arena; solo dañan al alcanzar al rival y se pueden bloquear, saltar o reflejar.",
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
    "Voy a aceptar que soy",
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
    "Abre un portal local al inframundo, revela su rostro aterrador y encadena un abrazo espectral de corto alcance. El rival puede bloquear, saltar para escapar o interrumpirla con un golpe.",
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
    "kevin",
    "Red sin fronteras",
    "technology",
    "Kevin activa Coco en su teléfono y envía cinco remesas verdes en dos alturas. Cada ficha o comprobante cruza la arena y solo daña al conectar; se puede bloquear, saltar o interrumpir el envío mientras la pelea continúa.",
    "Teléfono, fichas Coco y comprobantes",
    "¡Envío confirmado!",
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
    "Lorenzo avanza en el estribo de un camión Polar y otros dos camiones lo siguen. Los tres cruzan la arena, cada uno con una embestida física que puede bloquearse o fallar.",
    "Tres camiones Polar",
    "El trabajo nos une",
    "engine",
  ],
  [
    "carolina",
    "Colección de cierre",
    "theater",
    "Presenta una pasarela con cuatro modelos que desfilan y dañan al rival por contacto. Cada modelo puede bloquearse o esquivarse mientras la pelea continúa.",
    "Pasarela y cuatro modelos",
    "La última puntada",
    "show",
  ],
  [
    "dayana",
    "Pasarela universal",
    "theater",
    "Hace aparecer una pasarela, avanza con su vestido amarillo y posa tres veces; cada pose daña al rival cercano. La pelea continúa y el recorrido se puede interrumpir.",
    "Pasarela iluminada y vestido amarillo",
    "Una reina en la arena",
    "show",
  ],
  [
    "deyna",
    "Pelotón vinotinto",
    "sport",
    "Deyna convoca cinco compañeras en pelotón que disparan cinco balones reales mientras ambos luchadores conservan el control. Los balones se pueden esquivar, bloquear o reflejar.",
    "Cinco compañeras y cinco balones",
    "La arena se viste de vinotinto",
    "show",
  ],
  [
    "bolivar",
    "Marcha de la libertad",
    "theater",
    "Bolívar carga a caballo con seis llaneros distintos que lo siguen. Cada montura puede golpear una vez al cruzar al rival; se pueden bloquear o esquivar. Bolívar desmonta donde termina su recorrido.",
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
    "Graba con su teléfono, lanza un flash de corto alcance y remata con el mismo teléfono. Ambos contactos son locales; se pueden bloquear o evitar, y golpear a Melanio interrumpe la actuación.",
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
        ...(isArenaFinalist(id) ? { cueBeats: ARENA_FINALE_CUES[id] } : {}),
        mode:
          id === "dayana" || id === "deyna" || isArenaFinalist(id)
            ? "field"
            : id === "conde" || id === "emilio"
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
        duration: isArenaFinalist(id)
          ? ARENA_FINALES[id].duration
          : id === "deyna"
            ? 96
            : id === "conde" || id === "emilio"
              ? 360
              : id === "maite"
                ? 84
                : id === "nacho"
                  ? perroMujeriego.durationTicks
                  : FINALE_DURATION,
        ...(id === "nacho" ? { release: { force: 0 } } : {}),
        damageBeats:
          isArenaFinalist(id) ||
          id === "conde" ||
          id === "emilio" ||
          id === "maite" ||
          id === "deyna" ||
          id === "dayana"
            ? []
            : id === "nacho"
              ? FINALE_DAMAGE_BEATS.map(
                  (tick) =>
                    tick * (perroMujeriego.durationTicks / FINALE_DURATION),
                )
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
  "deyna",
  "bolivar",
  "edgar",
  "melanio",
] as const satisfies readonly BuiltInFighterId[];

export function finaleAsset(id: FighterId) {
  // Capriles uses the cafe atlases. The other fighters in the first two batches
  // now use field, transformation or projectile finales with their own artwork.
  if (id === "capriles" || finaleById(id)?.mode !== "capture") return undefined;
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
