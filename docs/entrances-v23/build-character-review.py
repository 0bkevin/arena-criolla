import json,hashlib,datetime
from pathlib import Path
root=Path('/home/ubuntu/.t3/projects/vepol')
ptext=(root/'shared/presentations.json').read_text(); profiles=json.loads(ptext)
fighters=json.loads((root/'shared/fighters.json').read_text())
research={x['id']:x for x in json.loads((root/'docs/entrances-v19/research.json').read_text())['fighters']}
manifest=json.loads((root/'docs/character-manifest.json').read_text())['characters']
# All directions below are screen-relative after frameFacing normalization, for P1.
# P2 mirrors the complete rig, including props; no anatomical handedness is asserted.
specs={
'zavarce': {
 'name':'Confirmación y salida de reparto', 'family':'phone-check-and-ready', 'frames':[0,0,1,1,2,3,0,0],
 'actions':['Se prepara sin balanceo continuo.','Acerca el teléfono ficticio al pecho y baja la mirada.','La mano delantera marca un toque de confirmación, con codo que avanza.','Abre la palma delantera y la gira hacia el rival: pedido confirmado.','Da un paso corto con hombro de salida, sin atravesar el panel.','Segundo apoyo de marcha, chaqueta queda retrasada.','Recoge los dos brazos y fija la mirada en el rival.','Mantiene guardia estable.'],
 'rig':['Mano delantera abierta del frame 1: barrido diagonal pecho→cara→frente, no solo mover el teléfono.','Cabeza: baja 6° al teléfono y recupera el plano del rival una sola vez.','Torso: arranque inclinado y frenada con dos apoyos; chaqueta sigue 70 ms después.'],
 'prop':'Teléfono no pintado en atlas: una sola instancia anclada a mano/codo; no mantenerlo flotando cuando llegan frames 2/3.',
 'limits':['Frame 0 tiene puños; el toque no debe fingir dedos articulados. Frame 1 sí ofrece palma.','Marcha 2/3 es reutilización ficticia del repertorio de combate, no una carrera real documentada.'],
 'problem':'El movimiento actual consiste en pequeños asentimientos y la palma del frame 1; la consulta de pantalla no tiene acción de brazo legible.'},
'vallenilla': {
 'name':'Tres confirmaciones y apertura de palma', 'family':'three-count-card', 'frames':[0,1,1,1,1,1,0,0],
 'actions':['Presenta tarjeta ficticia a altura del pecho.','Sube la mano abierta y coloca el primer acento sobre la tarjeta.','Segundo acento con separación visible de muñeca y codo.','Tercer acento más alto y pausa de confirmación.','Barre la palma hacia el rival como ofrecimiento, sin lanzar proyectiles.','Retira la tarjeta y recoge el codo.','Vuelve a los puños de su guardia.','Queda atento al rival.'],
 'rig':['Palma delantera del frame 1: tres excursiones 0.04/0.055/0.07 de altura corporal, no tres cabeceos.','Torso: permanece erguido mientras cada acento activa un codo diferente del desplazamiento global.','Cabeza: sigue la tarjeta primero y mira al rival después del tercer acento.'],
 'prop':'Una tarjeta anclada a la mano de soporte; las tres cuotas son motivo inventado, no hábito de Pedro.',
 'limits':['La textura no permite contar con dedos: representar tres pulsos completos del brazo, sin dibujar tres dedos nuevos.','No convertir la tarjeta de crédito ficticia en un objeto documentado en sus retratos.'],
 'problem':'El triple ritmo actual es casi exclusivamente dy del sprite; los brazos no cuentan visualmente y la cámara lo atenúa.'},
'javier': {
 'name':'La mirada, el cruce y el remate visual', 'family':'comic-double-take', 'frames':[0,0,1,1,0,0,0,0],
 'actions':['Mira al rival con la expresión original.','Cabeza retrocede y se inclina como reacción de incredulidad.','Cruza brazos mediante la pose 1 y retrae un hombro.','Sostiene la pausa cómica; un codo se eleva, no la cara.','Deshace el cruce, da un rápido medio encogimiento de hombros.','Adelanta mentón y torso en una réplica muda.','Recoge puños hacia el pecho.','Guardia mirando al oponente.'],
 'rig':['Cabeza como pieza rígida: doble tiempo lento→rápido, máximo 7° de giro en el plano.','Hombros: un encogimiento asimétrico con apertura de codos y regreso, no un ciclo sinusoidal.','Frame 1: mantener el cruce real, que sirve de reacción; no describirlo como palma de saludo.'],
 'prop':'Sin accesorios; la ceja, el copete y el rostro existentes aportan identidad. El remate se expresa con pausa y cuerpo.',
 'limits':['La foto y fotograma respaldan mirada lateral/cejas expresivas, no la secuencia exacta.','No usar frame 7 para risa: es reacción de daño. No modificar ojos o boca para fabricar expresiones.'],
 'problem':'El perfil actual usa exclusivamente frame 0: cambiar apenas inclinación del sprite deja estáticos brazos y hombros.'},
'capriles': {
 'name':'Encuentro casual y paso decidido', 'family':'cap-adjust-and-approach', 'frames':[0,0,1,1,2,3,0,0],
 'actions':['Sonríe con el rostro capriles-v22.','Lleva la mano delantera hacia el borde de la visera, sin quitarse la gorra.','Hace un ajuste breve de gorra y un asentimiento único.','Baja el codo mientras mira al rival.','Primer apoyo corto de marcha, con torso decidido.','Segundo apoyo y frenada dentro del panel.','Recoge los brazos en la pose base.','Guardia enfrentada.'],
 'rig':['Mano delantera del frame 0/1: trayectoria al borde de visera y retorno, con codo que sube a altura de hombro.','Gorra y cabeza: bloque rígido; la visera no se estira ni se cambia la textura del rostro.','Torso: entrada de dos apoyos, ropa acompaña la frenada; asentimiento distinto del paso.'],
 'prop':'Conservar exactamente capriles-v22, gorra tricolor, camisa gris y rostro actual; ajuste de gorra es adaptación ficticia, no hábito comprobado.',
 'limits':['Ambas poses 0/1 conservan puños: no prometer saludo con palma abierta ni dedos agarrando la visera. Se sugiere contacto con nudillos/lado de mano.','Los clips documentados muestran gorra gris/otra ropa; la gorra tricolor y camisa gris corresponden a la referencia aprobada del usuario.'],
 'problem':'El saludo vigente apenas desplaza el cuerpo y cambia entre dos guardias de puños: no hay brazo que alcance la gorra ni avance legible.'},
'renny': {
 'name':'Abre el programa con un barrido', 'family':'host-open-show', 'frames':[1,0,0,0,0,0,1,1],
 'actions':['Suelta la postura cerrada para presentar.','La palma abierta delantera asciende desde el pecho.','Barre ampliamente hacia el espectador como apertura del programa.','Inclina torso en una reverencia corta y conserva contacto visual.','Recupera altura y recoge la palma hacia la solapa.','Pausa de presentador, hombros cuadrados.','Sube ambas manos a guardia.','Guardia firme ante el rival.'],
 'rig':['Palma delantera derecha después de normalizar: arco de codo/hombro pecho→exterior, con muñeca independiente.','Cabeza queda rígida y compensa ligeramente la reverencia del torso.','Solapa y corbata reaccionan al levantarse, con una sola recuperación amortiguada.'],
 'prop':'Micrófono esquemático opcional unido a la mano cerrada de soporte; el gesto corporal debe funcionar si se oculta.',
 'limits':['La foto del estudio respalda mano extendida y gesto al pecho; el barrido temporal es composición ficticia.','No usar frame 4 de puño arriba como saludo televisivo.'],
 'problem':'La palma del frame 0 existe pero se mantiene casi inmóvil; el pequeño barrido global no mueve el brazo.'},
'gomez': {
 'name':'Ajusta el uniforme y se planta', 'family':'uniform-square-stance', 'frames':[0,0,1,1,2,0,0,0],
 'actions':['Permanece rígido un instante.','Acerca ambos puños a las solapas/correaje.','Cruza brevemente los antebrazos con la pose 1, tensando el uniforme.','Deshace el ajuste y ensancha los hombros.','Da un apoyo pesado corto; mentón sigue alto.','Frena con un descenso único de hombros.','Recoge puños en la pose 0.','Guardia seria.'],
 'rig':['Ambos antebrazos: tirón corto hacia las solapas, codos afuera y vuelta.','Hombros: elevar→cuadrar→descender, tres estados concretos, sin respiración genérica protagonista.','Gorra/bigote/cara rígidos; inclinar solo el bloque de cabeza 3°.'],
 'prop':'Uniforme, correaje y gorra ya pintados; enfatizar el ajuste corporal, sin armas ni insignias nuevas.',
 'limits':['Retratos estáticos documentan porte formal, no ajuste de uniforme ni saludo militar. Todo el movimiento es ficción.','Frame 1 son brazos cruzados defensivos; no es saludo de mando. El paso pesado no se lee si solo anima pies.'],
 'problem':'Una sola pose (0) con xSpan 0.003: es de las entradas más quietas; la seriedad se confundió con ausencia de movimiento.'},
'simon': {
 'name':'Sombrero, bienvenida y cuatro cercano', 'family':'warm-hat-and-cuatro', 'frames':[1,0,1,1,0,0,1,1],
 'actions':['Baja la guardia hacia la presentación.','Sonríe y lleva la mano delantera hacia el ala del sombrero.','Con la palma del frame 1, hace una inclinación breve de sombrero/cabeza.','Extiende la palma en bienvenida cálida.','Acerca ambos brazos al cuatro ficticio junto al pecho.','Marca un único rasgueo sugerido de antebrazo, sin copiar música.','Retira el cuatro y adopta guardia abierta.','Guardia enfrentada.'],
 'rig':['Mano delantera en frame 1: alcanza el ala y luego describe arco hacia el público.','Frame 0 manos bajas: si se usa cuatro, elevar antebrazos de forma explícita y mantener el cuerpo del instrumento rígido.','Torso: reverencia de 5° seguida de recuperación, cuello mantiene cara legible.'],
 'prop':'El atlas está vacío de instrumento; un solo cuatro de código puede aparecer abrazado al pecho y retirarse antes de guardia. Alternativa robusta: solo sombrero/bienvenida.',
 'limits':['No hay dedos ni pose literal de rasgueo; la mano de soporte debe llegar al instrumento antes de que aparezca.','No hacer flotar el cuatro independiente del cuerpo. La fotografía respalda abrazo de cuatro; saludo al sombrero es ficción.'],
 'problem':'Las notas y el cuatro cambian más que sus brazos; el cuerpo solo oscila. La bienvenida necesita mano a sombrero y palma que realmente se desplace.'},
'conde': {
 'name':'Inclinación de sombrero con pausa de chiste', 'family':'comic-hat-bow', 'frames':[1,0,1,0,0,1,1,1],
 'actions':['Se prepara para presentarse.','Baja un hombro e inicia una reverencia amplia.','Palma delantera toca el borde del sombrero.','Detiene la reverencia en una pausa cómica con mirada al rival.','Levanta cabeza antes que torso; sombrero acompaña.','Abre la palma al espectador como remate visual.','Recoge las manos en guardia.','Guardia sonriente.'],
 'rig':['Palma delantera del frame 1: subir al ala tricolor, mantener contacto y alejarse con arco.','Torso: bow de 8° mientras la cabeza se recupera 100 ms antes; ritmo de pausa y remate.','Sombrero: pieza rígida ligada a cabeza, mínimo rebote amortiguado al enderezarse.'],
 'prop':'Usar el sombrero tricolor existente, nunca otro sombrero superpuesto.',
 'limits':['La fuente de escenario muestra dedo extendido, micrófono y sombrero; no verifica una rutina de inclinación de sombrero.','Frame 7 parece encorvado pero es reacción de combate: no emplearlo como carcajada.'],
 'problem':'El sombrero solo recibe destellos y un arco; ninguna mano llega a él y la pose neutra no desarrolla el gesto.'},
'emilio': {
 'name':'Una mano pregunta, la otra contesta', 'family':'mime-two-answers', 'frames':[1,0,0,1,0,1,1,1],
 'actions':['Prepara la escena.','Ofrece la palma de presentación en pregunta muda.','Cabeza ladea y un hombro sube mientras sostiene la palma.','Cambia a la otra palma, elevada cerca del rostro, como una respuesta distinta.','Vuelve a la primera pose con reverencia corta y mirada al rival.','Cierra ambos codos con un acento rápido.','Guardia abierta, cuerpo se detiene.','Mantiene guardia.'],
 'rig':['Alternar palma del frame 0 y palma del frame 1: cada brazo tiene arco y una pausa diferentes.','Frame 0 bruto mira a la izquierda: aplicar frameFacing=-1 antes de localizar mano/cara.','Cabeza gira en el plano 6° y hombros cambian asimétricamente; no fabricar nuevas caras deformando facciones.'],
 'prop':'Micrófono si hace falta, anclado a mano de soporte y subordinado al intercambio de palmas.',
 'limits':['La fotografía respalda mano abierta y mirada expresiva; dos personajes corporales son adaptación de su trabajo de intérprete.','Frame 4 mira al otro lado y es salto; frame 7 expresa daño. Excluir ambos de la bienvenida.'],
 'problem':'Las dos pausas actuales solo cambian altura mínima del sprite; hace falta que una mano ofrezca y otra responda.'},
'maite': {
 'name':'El brazo abre la gala', 'family':'gala-free-arm-arc', 'frames':[1,0,0,0,0,1,1,1],
 'actions':['Abandona la guardia para conducir.','Acomoda el micrófono pintado cerca de la boca.','La mano libre sale de cadera y abre un semicírculo hacia el público.','Hace una reverencia breve con el brazo extendido.','Regresa erguida, hombro y plumas terminan el movimiento.','Recoge la mano libre y deja micrófono junto al pecho.','Guardia de manos altas.','Guardia ante el rival.'],
 'rig':['Brazo libre que nace en la cadera del frame 0: arco lateral visible, codo sigue a hombro.','Brazo con micrófono: desplazamiento rígido mano+micrófono hacia boca, no una segunda instancia.','Plumas/falda: retardar movimiento respecto del torso, sin usar la ropa como único gesto.'],
 'prop':'El micrófono del frame 0 ya está pintado. Conservar vestido rojo/plumas y evitar mic adicional sobre el atlas.',
 'limits':['El fotograma oficial respalda porte y micrófono; no documenta este barrido específico.','Frame 4 muestra salto y puño elevado: no es su saludo de Miss Venezuela.'],
 'problem':'El foco y brillo sugieren gala, pero brazo libre en cadera permanece estático y la pequeña reverencia del sprite apenas se ve.'},
'oscar': {
 'name':'Dos pasos de sonero y palmas abiertas', 'family':'salsa-side-break', 'frames':[1,0,2,3,0,0,1,1],
 'actions':['Se abre hacia el público.','Palmas del frame 0 se separan y hombros bajan.','Primer paso lateral, hombro delantero entra y el otro responde.','Segundo apoyo en contratiempo, vuelve la dirección del torso.','Ambas palmas se acercan una vez al pecho y se abren como acento final.','Sostiene la sonrisa, termina el rebote de chaqueta.','Recoge en guardia.','Guardia enfrentada.'],
 'rig':['Hombros: dos acentos alternados con dirección y velocidad distintas, nunca oscilación infinita.','Palmas de frame 0: recogida al esternón y apertura amplia; si no se puede aproximar manos sin estirar, omitir el contacto.','Marcha 2/3: reutilizar como apoyos de paso, conservar avance/retroceso dentro del panel.'],
 'prop':'Micrófono opcional en mano de soporte; las dos palmas y el gesto de salsa se entienden sin notas ni ondas.',
 'limits':['Las fuentes establecen desempeño salsero, no un paso preciso. El pasito y su ritmo son originales.','No exigir que los pies sean visibles para reconocer el gesto: hombros/codos deben dar el contratiempo.'],
 'problem':'Existe xSpan algo mayor, pero ambas palmas siguen congeladas y el efecto de suelo cae fuera del close-up.'},
'puma': {
 'name':'Crecimiento de escenario con palma ofrecida', 'family':'singer-crescendo-palm', 'frames':[1,0,0,0,0,1,1,1],
 'actions':['Abre la presentación.','Acerca la mano de soporte al pecho mientras alza lentamente la barbilla.','La palma delantera asciende de cintura a hombro.','Abre esa palma hacia el público con pecho extendido.','Sostiene la apertura un instante, luego inclina cabeza en agradecimiento.','Recoge el brazo con ritmo lento.','Guardia estable.','Mira al rival.'],
 'rig':['Palma delantera del frame 0: movimiento ascendente amplio de hombro+codo, con apertura hacia fuera.','Mano de soporte cerrada: elevar desde el lateral hacia el pecho, nunca convertirla en una garra.','Torso: extensión breve de pecho y descenso; el rostro/cabellera conserva forma.'],
 'prop':'Micrófono de código solamente si se ancla a mano cerrada; el arco principal corresponde a la palma libre.',
 'limits':['Los fotogramas de entrevista no prueban saludo corporal exclusivo; esta es una adaptación del escenario.','No usar frame 7 por parecer pose vocal: está reaccionando a daño. No simular canto con boca deformada.'],
 'problem':'La serenidad actual consiste en palma fija e inclinación global mínima; la palma no asciende y el torso no desarrolla la presentación.'},
'chataing': {
 'name':'Se acerca al micrófono y pide un momento', 'family':'mic-forward-stop-palm', 'frames':[1,0,0,1,1,0,1,1],
 'actions':['Prepara intervención.','Lleva el micrófono pintado desde pecho hacia la boca.','Inclina torso hacia el espectador; cabeza queda cerca del micrófono.','La mano libre aparece al frente con palma de espera.','La palma hace un pequeño barrido de repregunta hacia el rival.','Retrocede el torso y baja el micrófono al pecho.','Queda en guardia abierta.','Guardia mirando al rival.'],
 'rig':['Mano con micrófono del frame 0/1: subir mano+micrófono como bloque rígido.','Mano libre delantera frame 1: alcance al espectador y recogida de codo; evitar solo glow en las gafas.','Torso: inclinación hacia delante de 7° y vuelta en un único gesto.'],
 'prop':'El micrófono ya aparece en atlas: no dibujar otro. Conservar gafas como identidad sin atribuirle el hábito de tocarlas.',
 'limits':['Fotograma respalda acercamiento de mano a cámara, no esta secuencia completa.','La pose 4 tiene micrófono alzado y salto; reservarla para combate.'],
 'problem':'El perfil mueve el sprite y pone acentos alrededor del micrófono, pero ni micrófono ni mano libre llegan a la posición que cuenta la intervención.'},
'george': {
 'name':'Pregunta al público, pausa y palma de remate', 'family':'standup-long-pause', 'frames':[1,0,0,0,1,1,1,1],
 'actions':['Entra en presencia de escenario.','Palma libre se extiende como pregunta a la audiencia.','Torso se inclina y la cabeza sigue la palma.','Sostiene una pausa de 250–350 ms con la palma quieta.','Acerca micrófono y eleva palma libre de detención, remate visual.','Recoge el codo con un encogimiento corto de un hombro.','Guardia frente al rival.','Mantiene guardia.'],
 'rig':['Frame 0 bruto mira izquierda: normalizar primero con frameFacing=-1; la palma libre queda dirigida al frente correcto.','Palma libre: arco abierto→pausa→recogida, luego stop del frame 1.','Micrófono pintado unido a mano/antebrazo; cabeza se acerca, sin mover boca.'],
 'prop':'Micrófono ya pintado; ritmo de pausa larga distingue su entrada de las dos réplicas rápidas de Emilio.',
 'limits':['La foto de stand-up respalda micrófono y porte, no un chiste concreto ni gesto exclusivo.','No usar frame 7 como risa; excluir puño del frame 4 como saludo.'],
 'problem':'La pausa actual se parece a congelación porque no existe gesto previo grande ni remate de brazo posterior.'},
'mcm': {
 'name':'Dos apoyos firmes y palma de encuentro', 'family':'firm-approach-palm', 'frames':[1,2,3,0,1,1,1,1],
 'actions':['Se dispone a caminar hacia el encuentro.','Primer apoyo firme, brazos acompañan el paso.','Segundo apoyo corto, hombros se estabilizan.','Se detiene y hace una inclinación breve de agradecimiento.','Eleva la palma visible de la pose cruzada del frame 1 hacia el público.','La palma recorre un arco corto y vuelve a su defensa cruzada.','Fija guardia y mirada.','Mantiene guardia enfrentada.'],
 'rig':['Pose 1: palmas/cruce defensivo real; desplazar antebrazo visible sin fabricar un saludo militar.','Marcha 2/3: dos apoyos con cambio de hombro, movimiento hacia el centro dentro de su panel.','Cabeza: inclinación única; cabello responde detrás del cuello con retraso.'],
 'prop':'Sin bandera ni micrófono añadido; camisa blanca y cabello existentes aportan reconocimiento.',
 'limits':['La fuente respalda llegada al escenario y saludo público, no los dos pasos exactos del juego.','Todas las poses miran derecha; guardia final 1 es cruzada, no puños del frame 0.'],
 'problem':'xSpan actual 0.014 y dy efectivo 0.002; el saludo sereno no alcanza una mano ni una marcha visibles.'},
'ali': {
 'name':'Dos rasgueos amplios y saludo del cantor', 'family':'guitar-two-broad-strums', 'frames':[1,0,0,0,0,1,1,1],
 'actions':['Sitúa la guitarra naranja ante el pecho.','La mano de rasgueo sube por encima de las cuerdas.','Primer barrido descendente amplio del antebrazo sobre el instrumento.','Recupera y hace segundo barrido más breve.','Detiene guitarra y muñeca, mira al rival.','Eleva la mano abierta del frame 1 a modo de saludo del cantor.','Mantiene esa mano en guardia.','Guardia con guitarra.'],
 'rig':['Mano de rasgueo está a la izquierda del instrumento en P1/frame 0; pivote de codo y muñeca, no guitarra deformada.','Mano del mástil permanece ligada al cuello; guitarra completa es una pieza rígida que puede inclinarse 2–4°.','Cabeza: acompañamiento pequeño al segundo rasgueo y recuperación, sin bob de cuerpo entero.'],
 'prop':'Guitarra naranja ya pintada: no agregar otro instrumento. Arco de antebrazo sobre la boca de la guitarra y sus cuerdas.',
 'limits':['No hay dedos que ejecuten acordes ni frames intermedios de rasgueo. La animación es sugerencia de antebrazo.','Frame 1 suelta una mano del instrumento para palma abierta; no mantener dos manos sobre mástil al cambiar a esta pose.'],
 'problem':'xSpan 0.011: dos leves oscilaciones de torso y notas no animan la mano sobre la guitarra.'},
'gualberto': {
 'name':'Tres rasgueos cortos y mástil que responde', 'family':'cuatro-fast-triple-strum', 'frames':[1,0,0,0,0,0,1,1],
 'actions':['Coloca el cuatro del atlas ante el torso.','Inclina el mástil un poco hacia arriba, con mano de soporte.','Tres barridos cortos de muñeca a intervalos rápidos y desiguales.','Recupera el mástil abajo y marca un último acento de codo.','Inclina sombrero/cabeza una vez mirando al rival.','Detiene cuatro y brazo de rasgueo.','Levanta las manos de guardia del frame 1.','Guardia con instrumento sujeto por la correa.'],
 'rig':['Mano de rasgueo izquierda en pantalla: 3 microarcos locales visibles, más rápidos que los dos grandes de Alí.','Cuatro/mástil como bloque rígido: tilt de 4° y vuelta; mano sobre mástil acompaña el bloque.','Sombrero y cara rígidos en un asentimiento cálido, no continuo.'],
 'prop':'Cuatro marrón y sombrero de paja existentes; distinguirlos del cuatro añadido de Simón.',
 'limits':['Frame 1 eleva puños y deja cuatro delante: interpretar la correa, no dedos fantasma tocándolo.','El triple ritmo es inventado, no transcripción de una actuación ni música real.'],
 'problem':'Dos pulsos de torso casi idénticos a Alí/Simón; no existe mano de tremolo visible ni respuesta del mástil.'},
'reynaldo': {
 'name':'Invita con la palma y responde con el pecho', 'family':'llanero-invitation-heart', 'frames':[1,0,0,0,1,1,1,1],
 'actions':['Abre la intervención del cantor.','Extiende la mano libre del frame 0 hacia el público.','Traza un arco de invitación amplio con palma arriba.','Recoge esa palma al esternón, cabeza agradece una sola vez.','Lleva micrófono pintado hacia la boca y eleva la mano libre del frame 1.','Baja suavemente ambos codos al nivel de guardia.','Guardia ante el rival.','Mantiene guardia.'],
 'rig':['Mano libre derecha en pantalla: afuera→pecho→arriba; tres lugares distintos.','Micrófono en mano izquierda de pantalla: conservarlo unido a mano, con seguimiento al pecho/boca.','Torso: pequeña apertura seguida de un descenso al llevar la palma al pecho.'],
 'prop':'Micrófono pintado y chaqueta ocre; no introducir lazo ni caballo en presentación.',
 'limits':['La imagen confirma micrófono y vestuario; la invitación y mano al pecho son adaptación ficticia del oficio.','Frame 5 apunta con dedo pero es ataque; no se necesita para lograr invitación.'],
 'problem':'La palma ofrecida ya está en frame 0 pero no viaja; un asentimiento mínimo no diferencia al llanero de otros presentadores.'},
'dudamel': {
 'name':'Preparación, dos compases y corte', 'family':'baton-prep-two-downbeats', 'frames':[1,0,0,1,0,1,1,1],
 'actions':['Prepara la orquesta ficticia con ambas manos.','Eleva el brazo de batuta y toma aire visual con hombros.','Primer barrido descendente corto de batuta.','Recupera en alto y hace segundo barrido lateral más amplio.','Mano libre recoge el compás hacia el pecho.','Corta con palma libre en alto y batuta detenida: pausa clara.','Deja brazos en guardia.','Guardia frente al rival.'],
 'rig':['Batuta está en mano izquierda de pantalla: palo+mano son rígidos, el movimiento nace del codo/hombro.','Mano libre derecha: apertura de apoyo y cierre a una palma de corte.','Torso: impulso pequeño con cada acento; cabeza preserva rizos y facciones.'],
 'prop':'Una sola batuta ya dibujada; el arco decorativo debe seguir la punta real, nunca sustituir su movimiento.',
 'limits':['La explicación del propio Dudamel respalda dirección con manos y batuta, no esta métrica concreta.','Palo fino puede desparecer o doblarse con malla: aislar textura de mano+batuta como bloque rígido.'],
 'problem':'El renderer dibuja un arco de conducción, pero la batuta del atlas y el codo apenas se mueven: el arco cuenta un gesto que el cuerpo no ejecuta.'},
'danny': {
 'name':'Ajuste de cuello y contratiempo de hombro', 'family':'collar-tug-groove', 'frames':[1,0,0,0,0,0,1,1],
 'actions':['Pasa a su postura de cuello/cortaviento.','La mano apoyada en el cuello tira ligeramente hacia fuera.','Libera el cuello y lleva un hombro atrás.','Hace dos contratiempos de torso con hombros alternados.','Adelanta la mano libre una vez al ritmo del último acento.','Pausa, mano del cuello baja y mira al rival.','Guardia con ambos puños.','Mantiene guardia.'],
 'rig':['Mano junto al cuello a la izquierda de pantalla: separar mano/codo del torso 0.035H y volver; cuello no se estira.','Hombros: primer acento lento, segundo rápido; mano libre responde al segundo.','Cabello sigue la recuperación con retraso corto y una sola amortiguación.'],
 'prop':'Cortaviento azul existente; no añadir micrófono donde el atlas no lo trae.',
 'limits':['La foto respalda mano al cuello, no un tic de ajustar cremallera; el groove es ficción escénica.','No animar literalmente una cremallera con dientes nuevos ni suplantar la cara despeinada.'],
 'problem':'Mano del cuello permanece pegada al atlas, y los cambios de peso tienen amplitud equivalente a una respiración.'},
'nacho': {
 'name':'Paso atrás, hombro y vuelta sincopada', 'family':'urban-back-forward-shoulder', 'frames':[1,0,2,3,0,0,1,1],
 'actions':['Se abre a la presentación.','Marca el pecho con mano cercana y levanta un hombro.','Apoyo corto hacia atrás, torso queda por delante del peso.','Regresa de inmediato con apoyo corto adelante.','Dos acentos opuestos de hombro/codo, más rápidos que los apoyos.','Detiene el bomber y fija cabeza hacia el rival.','Guardia de puños.','Mantiene guardia.'],
 'rig':['Hombro delantero: golpe seco arriba/adelante; el posterior responde abajo/atrás, sin deformar rostro.','Mano cercana al pecho acompaña un acento, la otra hace contrapeso bajo.','Marcha 2/3 se usa para cambio de apoyo original; pies y rodillas no son la única evidencia del ritmo.'],
 'prop':'Bomber estampado/cadena, sin notas obligatorias ni micrófono añadido.',
 'limits':['Trayectoria de actuación sí documentada, coreografía exclusiva no. No llamar al paso una reproducción de Báilame.','No usar ataque 5/6 para remate de tarima en presentación.'],
 'problem':'Dos desplazamientos laterales y partículas no muestran síncopa de brazos; actualmente se confunde con Danny/Óscar.'},
'sarcos': {
 'name':'Gran bienvenida y pausa de sorpresa', 'family':'tv-welcome-reveal', 'frames':[1,0,0,0,0,1,1,1],
 'actions':['Presenta el show con micrófono pintado.','La mano libre se extiende al espectador.','Hace un barrido ascendente más grande para revelar la gala ficticia.','Inclina torso y cabeza al final del barrido, con sonrisa original.','Pausa breve de sorpresa, palma vuelve al pecho.','Micrófono se acerca a la boca mientras recoge el brazo.','Guardia de presentador.','Guardia frente al rival.'],
 'rig':['Mano libre derecha de pantalla: arco pecho→exterior→arriba→pecho, con aceleración de revelación.','Micrófono/mano izquierda rígidos y unidos al brazo.','Torso anticipa el arco con un impulso y termina un instante después.'],
 'prop':'Micrófono del atlas; premio o confeti pueden acompañar solo después de que el brazo haga la revelación.',
 'limits':['El retrato respalda sonrisa e índice, pero atlas tiene palma abierta: no inventar dedo articulado aislado.','No usar señalamiento frame 5 como bienvenida; es ataque.'],
 'problem':'El frame de bienvenida conserva brazo extendido estático; poca inclinación y chispas no representan el gesto de gran show.'},
'yordano': {
 'name':'Mano al pecho y agradecimiento de cantautor', 'family':'quiet-heart-open-thanks', 'frames':[1,0,0,0,0,1,1,1],
 'actions':['Abre ambas manos desde su pose de presentación.','Lleva la mano más próxima al pecho hacia el esternón.','Otra palma se ofrece a baja altura mientras inclina torso en agradecimiento.','Cabeza se recupera antes que los hombros.','Extiende suavemente la palma libre, la mano del pecho se separa.','Recoge manos altas.','Guardia ante el rival.','Mantiene guardia.'],
 'rig':['Mano izquierda de pantalla frame 0: cintura→pecho→guardia; arco concreto, sin repetir bob.','Mano delantera derecha: invitación baja y extensión hacia fuera.','Torso: reverencia de 6° con pausa, gafas/cara rigidizadas.'],
 'prop':'Sin guitarra: el sprite no trae guitarra y las palmas bastan para el agradecimiento.',
 'limits':['El retrato es sereno y sentado; el agradecimiento de escenario no está documentado como costumbre.','Mantener energía contenida mediante arco de manos, sin exagerar movimiento facial.'],
 'problem':'xSpan 0.004 y dy efectivo 0.002: otra de las entradas más inmóviles; el agradecimiento no mueve manos.'},
'lila': {
 'name':'Media vuelta de diva y brazo dorado', 'family':'diva-hip-turn-arc', 'frames':[1,0,0,0,0,1,1,1],
 'actions':['Se coloca en presentación con mano en cadera.','Gira el torso en el plano y retrae el hombro libre.','La mano libre sube desde el lateral hasta el hombro.','Abre el brazo en un arco amplio, pelo termina la media vuelta.','Pausa de diva con mano de cadera fija.','Recoge el brazo hacia las palmas altas.','Guardia elegante.','Guardia enfrentada.'],
 'rig':['Mano de cadera izquierda de pantalla debe permanecer unida a cadera; el movimiento nace del hombro derecho y brazo libre.','Cabellera: ligera estela lateral de la media vuelta, con bloque facial intacto.','Torso: giro en el plano de 6°, contrapeso de cadera; no fingir rotación 3D de 180° que el atlas no contiene.'],
 'prop':'Joyas/dorado ya pintados; los destellos siguen el movimiento del brazo y nunca lo reemplazan.',
 'limits':['La foto facial respalda imagen, no la media vuelta exacta. La referencia de El Cocotero no justifica copiar baile o música.','No usar frame 7 para dramatismo vocal; es reacción de golpe.'],
 'problem':'La mano de cadera y el brazo libre permanecen fijos; el balanceo de diva es movimiento global parecido a otros personajes.'},
'rummy': {
 'name':'Dos apoyos de joropo y sombrero', 'family':'llanera-two-stamps-hat', 'frames':[1,0,2,3,0,1,1,1],
 'actions':['Ofrece la palma de presentación.','Palma libre sube al ala del sombrero azul.','Primer apoyo de baile con descenso claro de un hombro.','Segundo apoyo en respuesta, codo libre marca el contratiempo.','Regresa al gesto de palma abierta y retira la mano del sombrero.','Reverencia pequeña y manos se recogen.','Guardia de puños.','Guardia enfrentada.'],
 'rig':['Mano libre izquierda de pantalla frame 0: ala del sombrero→apertura hacia el público.','Hombros y codos marcan cada apoyo incluso con pies fuera de cámara; evitar solo ondas de suelo.','Sombrero rígido sigue cabeza, cabello reacciona a los dos apoyos.'],
 'prop':'Sombrero azul existente; no retirarlo del atlas ni duplicarlo en código.',
 'limits':['Foto respalda brazos abiertos y sombrero; baile del juego es adaptación llanera, no zapateo personal verificado.','Frame 1 tiene puños; el saludo está en la palma del frame 0, no al revés.'],
 'problem':'La entrada actual son dos balanceos suaves y adorno de sombrero, sin apoyo corporal claro ni mano que lo alcance.'},
'chiqui': {
 'name':'Dos pasos de pasarela y giro de hombro', 'family':'runway-stop-hip', 'frames':[1,2,3,0,0,1,1,1],
 'actions':['Inicia una pasarela ficticia breve.','Primer apoyo hacia el centro del panel, hombro contrapesa.','Segundo apoyo y freno decidido.','Se planta en pose 0 con mano en cadera.','Hace un giro de hombro con cabeza mirando al rival, pelo sigue el giro.','Palma del frame 1 se alza en un saludo corto.','Guardia alta.','Mantiene guardia.'],
 'rig':['Mano de cadera izquierda de pantalla frame 0 fija a la cadera; hombro contrario rota atrás/adelante.','Marcha 2/3: dos pasos con torso alto, nunca convertirla en corredora inclinada durante toda la escena.','Cabello ondulado sigue hombro y vuelve una sola vez.'],
 'prop':'Tarjeta de gala solo si se ata a mano libre y se retira; la entrada debe leerse con mano/cadera/pelo.',
 'limits':['Univision documenta modelo y conductora, no participación como bailarina ni esta pasarela exacta.','No usar tacón/pierna del frame 6 como gesto de moda; es ataque.'],
 'problem':'El paso actual es un desplazamiento mínimo de sprite, sin pasarela seguida de parada y giro reconocibles.'},
'norkys': {
 'name':'Recoge el cabello y cambia de perfil', 'family':'hair-touch-shoulder-pivot', 'frames':[1,0,0,0,0,1,1,1],
 'actions':['Se planta con los brazos de presentación bajos.','Lleva la mano posterior/lateral hacia el cabello junto a la oreja.','Inclina cabeza hacia esa mano, hombro contrario retrocede.','Retira mano y cambia el peso al otro hombro como cambio de perfil.','Devuelve la cabeza al rival antes que el torso.','Eleva las palmas abiertas del frame 1.','Guardia.','Mantiene guardia.'],
 'rig':['Brazo lateral que nace bajo frame 0: arco hasta zona oreja/cabello y retorno; cuello conserva separación visible.','Hombros: pivote lateral único, rostro rígido con inclinación ligera de 5°.','Blazer coral y cabello negro dan retraso secundario tras el pivote.'],
 'prop':'Ninguno; gesto respaldado de mano junto al cabello basta como punto de partida.',
 'limits':['Foto muestra una mano cerca del pelo, no un tic personal.','Las manos del frame 0 son cerradas: insinuar aproximación lateral al cabello, no peinar dedos nuevos a través de él.'],
 'problem':'xSpan 0.012 y dy efectivo 0.001: la mano al cabello respaldada en foto no está animada; solo hay quietud segura.'},
'gabriela': {
 'name':'Dos papeles en dos actitudes de cuerpo', 'family':'two-role-body-switch', 'frames':[1,0,0,1,1,0,1,1],
 'actions':['Presenta una primera actitud.','Mano en cadera, hombro alto y mentón firme.','Sostiene la actitud 200 ms.','Cambia a palmas abiertas junto al pecho y hombros más bajos.','Inclina cabeza como segundo papel y sostiene otro instante.','Vuelve brevemente a postura de cadera con giro rápido de hombro.','Se recoge en guardia, sin duplicar el cuerpo.','Guardia frente al rival.'],
 'rig':['Frame 0 mano izquierda de pantalla en cadera: postura firme con hombro contrario arriba.','Frame 1 ambas palmas: acercar al pecho, bajar hombros y ladeo de cabeza; diferencia física visible.','Cambios de actitud dependen de hombros/codos/tempo, sin cambiar el rostro ni hacerlo villanesco.'],
 'prop':'Luz opcional tras cada cambio, subordinada a dos actitudes corporales reales del sprite.',
 'limits':['El doble papel pertenece a su obra como actriz; no describirlo como personalidad real.','No basta doble brillo/silueta; no se necesitan clones ni otra cara.'],
 'problem':'Dos pequeñas poses y un destello no diferencian las actitudes, porque hombros y manos permanecen rígidos.'},
'amanda': {
 'name':'Duda al mentón y decisión de escena', 'family':'chin-think-decide', 'frames':[1,0,0,0,1,1,1,1],
 'actions':['Lleva su mano de presentación al mentón.','Cabeza se inclina a la mano como pausa reflexiva.','El codo del mentón sube y la otra mano permanece en cadera.','Retira la mano del rostro y endereza cabeza con un acento de decisión.','Abre la palma alta del frame 1 hacia el público.','Recoge la palma al nivel de guardia.','Guardia atenta.','Mantiene guardia.'],
 'rig':['Mano del mentón a la derecha de pantalla frame 0: aproximar→pausa→separar, tres posiciones visibles.','La cabeza es rígida; movimiento de cuello 5°, rostro no se hunde en la mano.','Brazo abierto frame 1 prolonga la decisión, no un mero cambio de textura.'],
 'prop':'Libreto opcional y ficticio junto a mano de soporte; no necesario para el gesto documentado del mentón.',
 'limits':['El gesto está en un retrato; no es evidencia de que lo haga siempre al actuar.','xSpan no necesita ser enorme: el cambio de brazo al mentón y después abierto es el movimiento principal.'],
 'problem':'xSpan 0.006, dy efectivo 0.001: congelar la pose del mentón y hacer pequeña inclinación no desarrolla pensamiento→decisión.'},
'lele': {
 'name':'Selfie, encuadre torcido y recuperación', 'family':'selfie-frame-comic-recovery', 'frames':[1,0,0,0,2,3,1,1],
 'actions':['Pasa a la pose de móvil rosa.','Eleva el brazo del móvil hasta altura de ojos, a un lado de la cara.','Inclina cabeza para encuadrarse, mano libre en cadera.','Gira ligeramente muñeca+móvil y hace un contrapeso exagerado de hombro.','Apoyo corto atrás como casi perder el encuadre, sin pose de daño.','Recupera el apoyo, baja móvil hacia pecho.','Guardia con móvil del atlas.','Guardia mirando al rival.'],
 'rig':['Teléfono rosa ya pintado en mano derecha de pantalla: brazo+mano+móvil suben juntos y móvil conserva forma rígida.','Mano libre en cadera da contrapeso, cabeza se inclina 6° hacia cámara ficticia sin cambiar rostro.','Marcha 2/3 reutilizada para paso atrás/recuperación, en un gesto cómico original.'],
 'prop':'Mismo teléfono rosa; no una segunda pantalla de código ni un marco que atraviese su cara.',
 'limits':['Retrato facial no muestra móvil; selfie está inspirada en su actividad documentada de creadora.','No usar frame 7 como tropiezo ni importar coreografía/música de Dancing with the Stars.'],
 'problem':'El marco de selfie y brillo se mueven; su teléfono y el brazo siguen pegados al pecho sin tomar realmente la selfie.'},
'giuseppe': {
 'name':'Compara dos datos y confirma con las manos', 'family':'analyst-compare-confirm', 'frames':[1,0,1,1,1,1,1,1],
 'actions':['Pausa de revisión con manos bajas.','Inclina torso hacia la tarjeta de datos ficticia a altura del pecho.','Eleva las dos manos abiertas para enmarcar dos datos.','Separa una mano y luego la otra; cabeza sigue el contraste izquierda→derecha.','Junta parcialmente ambas palmas hacia el centro como confirmación.','Endereza torso y deja manos altas.','Guardia abierta.','Guardia frente al rival.'],
 'rig':['Ambas manos del frame 1: separar→comparar en alternancia→recoger al centro, sin necesidad de dedos de teclado.','Cabeza/lentes rígidos siguen mano A y después B con dos inclinaciones cortas diferentes.','Torso: acercamiento de inspección 6° y vuelta; manos llevan la narrativa.'],
 'prop':'Una tarjeta/placa digital ficticia entre las manos, con anclaje claro; no proyectiles ni pantalla flotante que sea toda la animación.',
 'limits':['No se halló ademán manual icónico exclusivo; actividad profesional fundamenta la metáfora, no hábitos personales.','No confundir con homónimos italianos ni convertir el gesto en una afirmación sobre posiciones políticas.'],
 'problem':'xSpan 0.008 y dy efectivo 0.001: la tarjeta de código cambia más que el analista y la pausa de revisión es prácticamente estática.'},
'silbon': {
 'name':'El saco pesa y la mano advierte', 'family':'sack-weighted-stalk', 'frames':[1,0,2,3,0,1,1,1],
 'actions':['Se encorva bajo el peso del saco.','Mano cercana al hombro/saco tira de la correa.','Primer paso largo de caminante; saco tarda en seguir.','Segundo paso más corto y frenada.','Inclina cabeza hacia el rival, libre mano se prepara.','Eleva mano delantera de advertencia, saco termina el balance.','Guardia espectral.','Guardia frente al rival.'],
 'rig':['Saco pintado atrás a la izquierda: giro rígido de 6–10° alrededor de hombro, retrasado respecto de torso.','Brazo cercano al saco hace un tirón de hombro; mano delantera frame 1 asciende después.','Cuello/cabeza inclinados, ojos/cuencas sin transformación que altere la identidad.'],
 'prop':'Saco y sombrero del atlas; peso/arrastre corporal comunica errancia sin silbido real.',
 'limits':['La tradición no dispone de filmación canónica; movimiento completo es interpretación original del espanto.','La parte de saco separada necesita máscara limpia, no estirar costuras o duplicar un segundo saco.'],
 'problem':'Ya hay un paso 2, pero saco/brazo no reaccionan y el dx aislado se parece a deslizar un recorte.'},
'llorona': {
 'name':'Manos al rostro, lamento mudo y apertura', 'family':'grief-hands-face-release', 'frames':[0,1,1,1,0,0,0,0],
 'actions':['Se prepara en figura errante.','Sube ambas manos junto al rostro con frame 1.','Cabeza baja dentro del espacio entre las manos; hombros se encogen.','Retiene el lamento mudo un instante y separa los codos.','Baja manos de frame 0 con apertura hacia el rival.','Se desplaza lateralmente mientras cabello y mangas siguen detrás.','Se detiene en su guardia sobrenatural.','Guardia frente al rival.'],
 'rig':['Ambas manos frame 1: elevar→juntar cerca de mejillas sin atravesarlas→abrir hacia fuera.','Cabeza rígida: descenso y recuperación, sin llanto animado en la boca.','Cabello/mangas: arrastre contrario al desplazamiento, con una sola recuperación.'],
 'prop':'Bruma/lagrimas opcionales; las manos y la postura encogida deben expresar el lamento sin voz.',
 'limits':['Figura de tradición multinacional; no atribuir origen exclusivamente venezolano ni río a todas sus variantes.','No confundir inclinación de dolor frame 7 con duelo: excluir reacción de combate.'],
 'problem':'La elevación dy efectiva llega a 0.01H, pero flotar no expresa manos en la cara: siguen estáticas en el recorte.'},
'sayona': {
 'name':'El mantón se recoge y aparece la advertencia', 'family':'shawl-turn-reveal', 'frames':[0,2,3,0,1,1,0,0],
 'actions':['Inicia aparición silenciosa.','Primer paso de acercamiento, mano recoge borde del mantón.','Segundo paso más corto y detención abrupta.','Gira hombro hacia el rival; cabello y mantón tardan en parar.','Eleva la mano abierta/garra delantera como advertencia.','La mano describe un arco de revelación y se recoge.','Vuelve a pose de guardia sobrenatural.','Guardia mirando al rival.'],
 'rig':['Brazo bajo cercano al mantón frame 0: acercar al borde del tejido y soltar; mantón responde a ese contacto.','Hombros: pivote corto que se detiene rápido; cabeza rígida regresa al rival antes de la tela.','Mano delantera frame 1: ascenso y arco, no solo ojos rojos o niebla.'],
 'prop':'Mantón rojo y vestido oscuro actuales son fantasía; no reproducen saya blanca de todas las versiones orales.',
 'limits':['Testimonios respaldan caminar/detenerse/volverse, no un giro 3D medido. Usar pivote en el plano, no flip repentino de toda figura.','No atribuir un gesto de amenaza concreto a una persona real.'],
 'problem':'Ya desliza y usa frame 2, pero la tela no se recoge y la aparición depende de brillo en vez de revelación corporal.'},
'lionza': {
 'name':'Palmas que reúnen y ofrecen la naturaleza', 'family':'nature-gather-and-open', 'frames':[0,1,1,1,1,1,0,0],
 'actions':['Inclina torso con respeto.','Eleva ambas manos abiertas del frame 1 cerca del pecho.','Acerca palmas como si reuniera hojas ficticias.','Abre brazos hacia arriba y lados en un ofrecimiento amplio.','Cabeza se recupera y hombros bajan con las palmas.','Retira las manos hacia su guardia.','Guardia estable.','Mira al rival.'],
 'rig':['Palmas frame 1: recogida al centro→arco hacia fuera→descenso; dos brazos independientes y visibles.','Torso: reverencia de 6° y extensión, sin deformar cara/corona.','Tela/cabello/hojas son respuesta tardía al arco de brazos.'],
 'prop':'Corona floral, ropa verde actuales; hojas son acompañamiento original. No llamarlo bendición o rito religioso exacto.',
 'limits':['La figura es símbolo espiritual y cultural, no persona con hábitos filmados.','Las manos de frame 0 son puños: usar frame 1 para el ofrecimiento y volver a 0 solo al cierre de guardia.'],
 'problem':'El halo/hojas se mueven, pero su supuesto saludo ceremonial son palmas congeladas y flotación leve.'},
'florentino': {
 'name':'El coplero reta con la palma y el hombro', 'family':'coplero-call-and-response', 'frames':[0,1,1,0,1,1,0,0],
 'actions':['Se presenta con el cuatro a la espalda.','Eleva palma del frame 1 hacia el rival como invitación al contrapunteo.','Marca un primer acento de codo/hombro hacia delante.','Recoge el gesto al pecho y ladea sombrero/cabeza en una pausa.','Segundo acento de palma, más corto y decidido.','Pañuelo y cuatro de espalda responden a la frenada.','Vuelve a guardia.','Mira al rival.'],
 'rig':['Palma delantera frame 1: pecho→rival dos veces con acentos distintos, como llamada/respuesta muda.','Hombro y pañuelo rojo: breve avance y recuperación tras cada acento.','Cuatro a la espalda como bloque rígido sujeto por correa; pequeño rebote secundario, nunca rasgueo frontal.'],
 'prop':'El cuatro está A LA ESPALDA en las ocho poses inspeccionadas; conservar ubicación. Sombrero/pañuelo acompañan el desafío literario.',
 'limits':['El contrapunteo es rasgo del personaje del poema, no gesto personal de un intérprete real.','No dibujar otro cuatro en pecho ni fingir tocar un instrumento que la mano no alcanza. Sin voz ni canción.'],
 'problem':'Estilo actual strum dibuja notas, pero el cuatro permanece a la espalda: el gesto de músico no coincide con el cuerpo.'},
'diablo': {
 'name':'El retador avanza, se inclina y abre los brazos', 'family':'challenger-bow-tail', 'frames':[0,2,3,0,1,1,0,0],
 'actions':['Se prepara para el desafío.','Primer paso de aproximación con torso adelantado.','Segundo apoyo y frenada corta.','Reverencia desafiante de cabeza/hombros, cola aún se desplaza.','Abre las palmas altas del frame 1 como alarde.','Hace un único arco de brazo y levanta barbilla.','Recoge a guardia.','Guardia ante el rival.'],
 'rig':['Antebrazos de frame 1: apertura visible desde pecho hacia arriba/lados.','Cola del atlas: curva o giro secundario desde su base, retardo 90 ms; no deformar cadera/cuernos.','Cabeza conserva rostro y cuernos en una sola pieza rígida durante la inclinación.'],
 'prop':'Cuernos, cola, traje y fuego son diseño ficticio. Las brasas se activan tras apertura real de brazos.',
 'limits':['Es el Diablo del contrapunteo de Florentino; no los Diablos Danzantes ni su ritual de Corpus Christi.','No copiar un ritual patrimonial ni una danza real.'],
 'problem':'Ya hay paso 2 y brasas, pero las manos no abren arco y la cola no reacciona; el retador se desliza.'},
'knoche': {
 'name':'Inspecciona el frasco y ajusta sus lentes', 'family':'laboratory-inspect-glasses', 'frames':[0,0,0,1,0,0,0,0],
 'actions':['Se prepara como médico de laboratorio ficticio.','Mano junto al bolso se aproxima al frasco verde del cinturón.','Inclina torso y cabeza hacia ese frasco, ojos detrás de lentes.','Eleva la otra mano cerca de la sien como ajuste breve de lentes.','Recoge el gesto y aproxima ambas manos al pecho como observación final.','Endereza torso, el abrigo termina de asentarse.','Regresa a guardia base.','Guardia mirando al rival.'],
 'rig':['Mano cercana al bolso izquierdo de pantalla: arco hacia frasco existente, luego retorno al pecho.','Lentes+cabeza rígidos; mano libre llega a la sien por codo, no lentes que cambian tamaño.','Torso inclina 8° sobre frasco, recupera con abrigo/bigote/barba separados de la distorsión.'],
 'prop':'Frasco verde ya pintado en bolso/cinturón. Para elevarlo de verdad sería necesario recorte y máscara que retiren original; propuesta base lo inspecciona in situ y no duplica.',
 'limits':['Fuentes históricas respaldan medicina y laboratorio, no el gesto de frasco/lentes. Adaptación explícita sin poderes reales.','Si frasco queda por debajo del recorte del close-up, el gesto de mano/lentes al rostro debe ser el momento visible principal.'],
 'problem':'xSpan 0.008: los destellos de vial animan el frasco más que la inspección; brazos y lentes permanecen estáticos.'},
'momoy': {
 'name':'El bastón apoya y la palma aconseja', 'family':'cane-lean-wise-palm', 'frames':[0,0,0,1,1,0,0,0],
 'actions':['Sitúa el bastón junto al cuerpo.','Inclina el torso hacia el bastón, mano de apoyo permanece unida.','Cabeza baja y hombro de apoyo recibe el peso.','Eleva la palma libre de frame 1 como consejo/advertencia suave.','Palma hace un arco breve hacia el rival, bastón permanece apoyado.','Recoge la palma y recupera el torso.','Guardia base con bastón.','Mira al rival.'],
 'rig':['Bastón en mano izquierda de pantalla: palo+mano rígidos, pivotar el cuerpo con apoyo conservado.','Palma libre derecha frame 1: ascenso desde pecho y arco afuera con pausa, no saludo genérico en bucle.','Cabeza/sombrero/barba se inclinan como bloque; ruana termina de moverse después.'],
 'prop':'Bastón y ruana del diseño actual. El punto de apoyo fuera de cámara requiere que hombro y mano comuniquen peso.',
 'limits':['El duende andino admite variantes; ni bastón ni gesto de consejo se atribuyen a todos los relatos.','No doblar bastón con malla ni desprender la mano que lo sujeta.'],
 'problem':'La actual inclinación deja el apoyo del bastón bajo el plano; se necesita un hombro que reciba peso y palma que aconseje.'},
'tiotigre': {
 'name':'Pecho de fuerza, dos hombros y alarde', 'family':'tiger-chest-elbow-boast', 'frames':[0,0,1,0,1,0,0,0],
 'actions':['Se planta como animal antropomorfo de cuento.','Expande el pecho y abre los codos, sin aumentar la cabeza.','Eleva puños cerca de la cara con pose 1, barbilla sube.','Primer descenso pesado de hombro, cola responde.','Segundo descenso del otro hombro más rápido y alarde con codos afuera.','Recoge pecho, manos vuelven a guardia.','Se detiene.','Guardia ante el rival.'],
 'rig':['Ambos codos: apertura de 0.055H y regreso, pecho sube por hombros y torso, no scaleX de cara.','Hombros: dos descensos alternados y una pausa de fuerza; mano activa se acerca al pecho una vez.','Cola es seguimiento secundario con base fijada a cadera.'],
 'prop':'Chaleco/cola del atlas; no rugido ni puño de ataque como presentación.',
 'limits':['Fuerza/arrogancia son función literaria, no conducta documentada de un animal real.','Frame 4 tiene postura de salto, frame 5/6 combate: no necesarios para alarde de entrada.'],
 'problem':'Un paso 2 y algo de escalado no ensanchan codos ni pecho; el alarde queda en una oscilación parecida al resto.'},
'tioconejo': {
 'name':'Escucha, dos brincos y una idea', 'family':'rabbit-listen-two-hops', 'frames':[0,1,4,0,4,1,0,0],
 'actions':['Mira al rival, orejas altas.','Acerca un puño a la mejilla y ladea cabeza como idea; oreja posterior se inclina.','Primer brinco corto hacia delante con frame 4.','Aterriza con torso bajo y orejas continúan 80 ms.','Segundo brinco más breve hacia atrás, sin salir del panel.','Pausa curiosa con manos cerca del rostro y orejas recuperadas.','Recoge a su guardia base.','Guardia frente al rival.'],
 'rig':['Orejas: flexión independiente de la cabeza desde la base, la cara sigue rígida.','Torso/cabeza: anticipación abajo→brinco→aterrizaje; dy sin compensación de cámara para que se vea.','Manos: una aproxima mejilla en la pausa de idea; brazos no deben quedarse estáticos mientras todo salta.'],
 'prop':'Orejas/pañuelo del atlas; las estrellas no sustituyen la pausa de idea ni el salto.',
 'limits':['El salto sí aparece en relato de Rivero Oramas, pero dos brincos exactos y boxeo son diseño del juego.','Frame 4 cambia inclinación de orejas respecto de 0/1; evitar reajuste brusco de cabeza con cámara.'],
 'problem':'Es la excepción con dos saltos reales ya usados; sin embargo el close-up reduce dy al 20% y no anima orejas ni manos. Mantener saltos y fortalecer anticipación/aterrizaje.'}
}
assert set(specs)=={x['id'] for x in fighters}, (set(specs),len(specs))
verified={
'https://www.laphil.com/posts/great-big-story-how-to-conduct-an-orchestra':'Página primaria abierta en v23: explica al propio Dudamel dirigiendo con manos y batuta; no se reconstituye vídeo ni métrica de una obra.',
'https://simondiaz.com/':'Sitio oficial abierto en v23: identidad musical/actuación y legado de tonada. La evidencia del retrato permanece en el registro v19; no se afirma haber visto una secuencia de saludo nueva.',
'https://ggangi.com/sobre-mi':'Sitio propio abierto en v23: ingeniero y creador de plataforma de auditoría; no prueba un gesto manual de comparación.',
'https://revista.svhm.org.ve/ediciones/2016/2/art-13':'Artículo histórico abierto en v23: práctica médica y crítica de atribuciones de hechicería; no aporta filmación de movimientos.',
'https://www.mincultura.gob.ve/noticias/dinorah-cruz-maria-lionza-es-un-elemento-de-cohesion-social-es-una-resignificacion-de-todos-los-elementos-culturales-que-nos-conforman/':'Fuente MPPC/IPC abierta en v23: valor simbólico y representación de mujer indígena; no respalda una bendición coreografiada.',
'https://eldienteroto.org/wp49/wp-content/uploads/2023/11/Tio-conejo.pdf':'Obra primaria abierta en v23: edición Colección Bicentenario Carabobo; la nota editorial contrasta fuerza y astucia. No reutilizar el año 2011 del título v19: el PDF abierto conmemora 200 años de 1821.',
'https://museodellibrovenezolano.libroria.com/florentino-y-el-diablo/':'La página respondió inicialmente con 81 líneas en v23; segunda lectura devolvió timeout. Se conserva respaldo literario de v19 sin atribuir observación nueva de una coreografía.',
'https://www.mincultura.gob.ve/noticias/carlos-servando-invita-a-la-proyeccion-del-videoarte-de-caminarte-transfiguracion-ecologica/':'Apertura v23 devolvió error interno. Contexto del Momoy conservado del registro v19; no se afirma haber leído contenido nuevo.'
}
records=[]
for idx,f in enumerate(fighters):
 id=f['id'];r=research[id];p=r;m=manifest[id];s=specs[id]
 dx=[b['dx'] for b in p['introBeats']];dy=[b['dy'] for b in p['introBeats']]
 contact=f'poses-{(idx//5)*5+1:02d}-{min((idx//5+1)*5,len(fighters)):02d}.jpg'
 sources=[]
 for source in r['sources']:
  source=dict(source)
  if source['url']=='https://eldienteroto.org/wp49/wp-content/uploads/2023/11/Tio-conejo.pdf':
   source['title']='Antonio Arráiz — Tío Tigre y Tío Conejo, Colección Bicentenario Carabobo, texto primario'
  source['v23Verification']=verified.get(source['url'],'Respaldo preexistente de docs/entrances-v19/research.json; esta auditoría reutiliza la observación registrada y no afirma una nueva revisión del vídeo/foto online.')
  sources.append(source)
 kind='legend-or-literary-character' if id in ['silbon','llorona','sayona','lionza','florentino','diablo','momoy','tiotigre','tioconejo'] else 'historical-person' if id in ['renny','gomez','simon','ali','knoche'] else 'real-person'
 records.append({
  'id':id,'identity':{'gameName':f['name'],'verifiedIdentity':m.get('realName',m.get('name',f['name'])),'kind':kind,'sprite':f['sprite']},
  'visualAudit':{'allEightFramesViewed':True,'contactSheet':'docs/entrances-v23/'+contact,'row':idx%5,'guardFrameVerified':p['battleFrame'],'frameFacing':p['frameFacing'],'handCoordinateConvention':'Pantalla de P1 tras normalizar frameFacing; P2 refleja rig y accesorios enteros. No se asigna lateralidad anatómica real.'},
  'supportedGesture':{'description':r['observedGesture'],'evidenceScope':'Observación heredada de investigación v19 y fuentes listadas; no se transforma una foto estática o un rol en hábito personal. Atlas actual inspeccionado por este agente.', 'newRealHabitClaimed':False},
  'baselineEntranceBeforeV23':{'name':p['introName'],'frames':[b['frame'] for b in p['introBeats']],'uniqueFrames':sorted(set(b['frame'] for b in p['introBeats'])),'durationMs':p['durationMs'],'xSpanInBodyHeights':round(max(dx)-min(dx),4),'rawYSpanInBodyHeights':round(max(dy)-min(dy),4),'effectiveYSpanUnderCurrentIntroCamera':round((max(dy)-min(dy))*0.2,4),'tooQuiet':id!='tioconejo','assessment':s['problem'],'selectionAlsoNeedsRig':True},
  'recommendation':{
   'introName':s['name'],'movementSignature':s['family'],'fictionalAdaptation':True,'adaptationScope':'Coreografía original para el juego inspirada en la evidencia; no se atribuye como rutina real ni reproducción medida de un vídeo. Sin voz real, diálogo ni canción.',
   'poseSequence':[{'at':at,'frame':frame,'action':action} for at,frame,action in zip([0,0.14,0.29,0.43,0.58,0.73,0.9,1],s['frames'],s['actions'])],
   'activeBodyRegionsAndMotion':s['rig'],
   'timing':'Anticipación 0–0.14, acción principal 0.14–0.73, recogida 0.73–0.90, guardia completamente quieta 0.90–1. Insertar acentos/pulsos internos cuando la acción lo indique; la pausa se distingue porque llega después de movimiento grande.',
   'visibilityTarget':{'primaryHandTravelInBodyHeights':[0.04,0.08],'approxPrimaryHandTravelAtHeight820Px':[33,66],'torsoTravelInBodyHeights':[0.025,0.06],'headTreatment':'Bloque rígido, inclinaciones pequeñas; conservar rostro/textura/escala.','readWithoutEffects':True,'visibleRegion':'Acción de brazo/codo/hombro en banda pecho→cara; pies/suelo pueden quedar fuera de plano.','dyMustNotBeCancelled':True},
   'propOrEmphasis':s['prop'],'visualLimitations':s['limits'],
   'safeFrameUse':{'primaryFrames':[0,1],'optionalLocomotionFrames':[x for x in [2,3,4] if x in s['frames']],'excludedFrames':[5,6,7],'exclusionReason':'Golpes/patadas (5/6) y reacción de daño (7) no aportan un saludo coherente ni se leen bien con pies fuera del plano. Se inspeccionaron las ocho poses; no se proponen ataques como presentación.'},
   'ending':{'frame':p['battleFrame'],'at':0.9,'facing':'P1 a la derecha / P2 a la izquierda, ambos hacia rival','props':'Recoger o fijar accesorios antes del cierre; los pintados en atlas permanecen.','motion':'Neutralizar rig de cabeza/torso/brazos y fijar guardia sin salto visible.'}
  },'sources':sources
 })
 for x in records[-1]['recommendation']['poseSequence'][-2:]:
  x['frame']=p['battleFrame']
review={
 'version':23,'reviewedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'authorRole':'Agente nuevo de revisión individual de entradas; ownership documental solamente.',
 'scope':{'fighterCount':41,'atlasFramesInspected':328,'sourceFilesRead':['shared/fighters.json','shared/presentations.json','shared/presentation.ts','src/game/presentation-renderer.ts','src/game/intro-renderer.ts','src/game/assets.ts','docs/entrances-v19/research.json','docs/character-manifest.json'],'profilesSha256AtWriting':hashlib.sha256(ptext.encode()).hexdigest(),'baselineSource':'docs/entrances-v19/research.json, que conserva los perfiles anteriores a la implementación v23; sus gestos/atlas siguen auditados frente a shared/presentations.json leído al inicio.','baselineCamera':'src/game/intro-renderer.ts leído al inicio: height 820–855, compensación de dy de 80%; el agente principal estaba modificando runtime en paralelo.','runtimeFilesModified':False,'preserveApprovedConcept':'Close-up en dos paneles, presentación secuencial de cada luchador y guardia final enfrentada; sin voces reales.','caprilesAssetLock':'capriles-v22: gorra tricolor, camisa gris y rostro actual intactos.'},
 'globalFindings':[
  'En la línea base anterior a v23, 36 de 41 perfiles usan solo 0/1; Javier y Gómez usan solo 0. Los otros cinco son Silbón, Sayona, Diablo, Tío Tigre y Tío Conejo.',
  'La introCamera anterior a v23 centra cabeza por frame y usa height 820–855. El parámetro feet compensa 80% de pose.dy antes de drawPresentation; desplazamiento corporal vertical visible queda aproximadamente al 20%. No confundir amplitud configurada con amplitud vista.',
  'Close-up recorta pies, apoyo de bastón y ondas de suelo. Cada coreografía requiere un gesto legible en manos/codos/torso además del paso/salto.',
  'battleFrame=0 en 14 perfiles y =1 en 27: seguir la guardia verificada, no imponer 1 a todos. Presentación/guardia son roles, no una semántica universal del índice.',
  'FrameFacing especial: Emilio frame0 y4=-1; George frame0=-1. Normalizar antes de posicionar rig/accesorios; P2 refleja el conjunto completo.',
  'El renderer anterior a v23 mueve/sesga todo el atlas y añade efectos. Para gestos de brazo, sombrero, rasgueo y batuta hace falta articulación localizada con máscaras limpias o malla, manteniendo cara y objetos rígidos.',
  'Una cámara que siga el mismo gesto cuadro a cuadro puede neutralizar la coreografía. Usar ancla de encuadre estable durante el movimiento, con guardia final bien compuesta.',
  'Guardia final 0.90–1 sin rig residual. La secuencia propone 0/1 articulados; 2/3 apoyan marchas/baile, 4 se reserva al Conejo. Las ocho poses fueron consideradas; 5/6/7 son mala reutilización semántica para estas entradas.',
  'No hay prueba de un hábito icónico exclusivo para todos los personajes. Se conserva el gesto observado donde existe y se declara el resto como adaptación ficticia de oficio o tradición.',
  'No dar por vistas filmaciones a partir de ficha/descripcion. La evidencia heredada de v19 distingue fotograma observado, retrato estático, página institucional y contexto de video.'
 ],
 'priorityFixes':['gomez','yordano','amanda','giuseppe','norkys','javier','ali','gualberto','dudamel','florentino'],
 'acceptanceForImplementer':[
  'Probar cada uno de los 41 individualmente, con un clip de su gesto principal, a izquierda y derecha.',
  'Una silueta sin partículas debe mostrar gesto característico con al menos anticipación, acción y recogida visibles.',
  'En móvil las manos protagonistas deben quedar dentro del panel y separadas del rostro durante la acción; no invadir barra VS ni ocultar cabeza.',
  'Comprobar continuidad de caras/lentes/gorras y rig rígido de guitarra/cuatro/batuta/micrófono/bastón/teléfono.',
  'Comprobar que manos viajan de verdad respecto del torso; aumentar dx/rotate global no basta.',
  'Al terminar ambos miran al rival con el battleFrame auditado y rig neutral; conservar composición close-up y dos paneles.',
  'Con movimiento reducido, conservar una presentación estática reconocible y guardia final legible sin efectos indispensables.'
 ],
 'fighters':records
}
out=root/'docs/entrances-v23/character-review.json';out.write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n')
print(str(out));print('fighters',len(records),'poses',sum(len(x['recommendation']['poseSequence']) for x in records),'all eight viewed',all(x['visualAudit']['allEightFramesViewed'] for x in records))
