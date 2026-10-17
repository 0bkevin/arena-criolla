import json,hashlib,datetime
from pathlib import Path
root=Path('/home/ubuntu/.t3/projects/vepol')
fighters=json.loads((root/'shared/fighters.json').read_text())
previous_review=json.loads((root/'docs/entrances-v23/final-visual-review.json').read_text())
previous_records={f['id']:f for f in previous_review['fighters']}
postfix_ids=json.loads((root/'docs/entrances-v23/final-postfix-ids.json').read_text())
browser_verified={'sarcos','renny','emilio','puma','oscar'}
notes={
'zavarce':'Rostro y gafas íntegros en los cuatro momentos. Un solo teléfono de código, sin contorno doblado. Ambas manos/cuerpo son reconocibles; el teléfono es una estilización esquemática.',
'vallenilla':'Cara, barba y camisa de cuadros conservan forma. Una única tarjeta verde se mantiene rectangular en ambos lados; la palma elevada permanece dentro del panel.',
'javier':'Cruce de brazos y guardia son poses originales distinguibles. La expresión cambia entre las texturas de las poses, sin evidencia de facciones estiradas por la malla. Sin accesorios duplicados.',
'capriles':'Gorra tricolor, rostro actual capriles-v22 y camisa gris íntegros en los cuatro momentos. La mano queda a altura de guardia/mejilla; el nombre actualizado ya no promete contacto con visera.',
'renny':'Cara, gafas, corbata y traje íntegros. Tras ampliar el encuadre, la palma libre cabe en las cuatro capturas regeneradas. La retirada del micrófono sintético se comprobó tanto en ellas como en el renderer actualizado.',
'gomez':'Gorra militar, bigote y uniforme conservan contorno. Los antebrazos y puños no presentan inversiones visibles. Las cuatro imágenes fijas no permiten juzgar el ritmo de la presentación solemne.',
'simon':'Sombrero claro y rostro íntegros. Pose neutra y palmas altas legibles en ambos lados. No aparece cuatro sintético ni un segundo sombrero. No se promete contacto manual con ala.',
'conde':'Sombrero tricolor de ala ancha completo, rostro y camisa sin deformación visible. La transición entre brazos bajos/palmas se reconoce. Una parte de la palma puede coincidir con VS, conservando el gesto.',
'emilio':'Rostro/chaqueta y normalización de la orientación conservados. Palma de presentación visible junto a VS en las capturas regeneradas. No aparece micrófono sintético en ellas ni en la comprobación posterior del renderer.',
'maite':'Rostro, pelo, vestido y plumas conservan su forma. Un único micrófono pintado en la pose de presentación, sin réplica sintética visible en estas muestras. Todas estas muestras usan la presentación; no se infiere cobertura visual del frame 1 solo de ellas.',
'oscar':'Rostro, bigote y camisa de escenario íntegros. Se distinguen postura abierta y apoyo de marcha. El micrófono sintético que parecía una pegatina fue retirado: ausencia comprobada en las cuatro capturas regeneradas y en el renderer actualizado.',
'puma':'Cara/cabellera y palma ofrecida íntegros en los cuatro momentos regenerados. Palma visible junto a VS. La retirada del micrófono sintético de chaqueta se comprobó en esas capturas y en el renderer actualizado.',
'chataing':'Cara y gafas conservadas. Un único micrófono original pintado unido a la mano; no doble micrófono. Palma libre legible, sin atravesar ni estirar el rostro.',
'george':'Rostro, pelo y mano libre conservan silueta. El frame de palma de stop se lee con orientación correcta en P1/P2. Un micrófono original unido a mano, sin réplica sintética.',
'mcm':'Rostro, pelo y camisa blanca íntegros. Los antebrazos cruzados y palmas altas se distinguen de la guardia de puños. Sin contornos plegados ni accesorios añadidos.',
'ali':'Caja, mástil y clavijero de guitarra naranja rectos en P1/P2. El zigzag visto en implementación intermedia no aparece en estas cuatro muestras. Mano de rasgueo y mano de mástil mantienen relación con instrumento.',
'gualberto':'Cuatro completo, mástil y correa conservan forma; sombrero de paja y rostro protegidos. No aparece instrumento duplicado. Se ve la mano sobre caja y la mano del mástil sin pliegues graves.',
'reynaldo':'Un micrófono original pintado en mano, con cuerpo/cara íntegros. El encuadre ampliado de las capturas regeneradas conserva tanto la palma ofrecida como la palma elevada; sin micrófonos añadidos.',
'dudamel':'Batuta recta de mango a punta en las cuatro muestras; zigzag/L anterior corregido. Cara/rizos y frac íntegros. La palma libre se acerca a VS y puede quedar parcialmente tapada, mientras batuta y brazo conductor son legibles.',
'danny':'Rostro/cabello, cortaviento y brazo del cuello conservan forma. P1 muestra postura de cuello; P2 incluye apoyo de marcha claramente distinto. No hay props ni mics añadidos.',
'nacho':'Rostro, barba, cadena y bomber conservados. Los apoyos de marcha se distinguen de la presentación. El brazo posterior puede salir del recorte durante el paso, sin perder cabeza o brazo protagonista.',
'sarcos':'Rostro, traje y micrófono original íntegros, sin duplicación. El recorte anterior de la palma fue corregido con encuadre específico. La palma completa se ve en P1/P2 en las cuatro capturas regeneradas y en muestras del renderer actualizado (ticks 45 y 238).',
'yordano':'Cara, gafas y chaqueta íntegros. Ambas manos abiertas se reconocen, aunque la palma delantera se acerca al VS. No se añade guitarra ni micrófono ajenos al atlas.',
'lila':'Cara, flequillo, cabellera y detalles dorados conservan forma. Mano en cadera y brazo libre íntegros, sin facciones estiradas. Las muestras no prueban por sí mismas amplitud temporal del saludo.',
'rummy':'Sombrero azul completo, cara y cabello sin deformación visible. Palma libre completamente legible al lado exterior del panel; mano de cadera conservada. Sin segundo sombrero.',
'chiqui':'Rostro/pelo, blusa y mano en cadera íntegros. No se aprecia tarjeta extra en estas muestras. Se conserva el encuadre alto y el cuerpo no aparece plegado.',
'norkys':'Cara, pelo negro, aros y blazer coral conservados. Muestra de apoyo y muestras de presentación son legibles. Sin deformación de cuello/facciones ni accesorios duplicados.',
'gabriela':'Rostro, gargantilla y blazer íntegros. Se distinguen mano en cadera y palmas de presentación en un solo cuerpo; no doble cara ni clon superpuesto.',
'amanda':'Rostro y bob íntegros. Mano junto al mentón y palma abierta se distinguen. Libreto de código es contorno esquemático único junto a cintura; no debe confundirse con objeto pintado duplicado.',
'lele':'Rostro/cabello y teléfono rosa original conservan forma en ambas orientaciones. Una sola pieza de teléfono pintada; rectángulo grande de código corresponde al efecto de encuadre, sin otro móvil físico.',
'giuseppe':'Rostro y lentes conservados. Una tarjeta de datos rectangular única, ligada al contexto ficticio; las manos abiertas no se plegaron. La tarjeta esquemática permanece visible también en pose baja.',
'silbon':'Sombrero, cráneo/cara y saco completos sin réplica. Saco mantiene volumen y costuras legibles, sin doblarse por campo de brazos. Las manos de marcha/presentación conservan contorno.',
'llorona':'Cara pálida, cabello y manos cerca del rostro conservados. Las palmas no deforman mejillas. Tela/cabello tienen extensión coherente con el atlas, sin pliegue grave ni props duplicados.',
'sayona':'Rostro, cabellera y mantón rojo conservan forma. Posturas de marcha/advertencia se distinguen. Mano delantera puede acercarse al corte de VS, sin perder la figura ni el cambio de pose.',
'lionza':'Rostro, corona floral y ropa verde conservados. Palmas abiertas visibles en P1/P2 sin atravesar cabeza. Hojas son efectos secundarios; no accesorios físicos duplicados.',
'florentino':'Cuatro sigue a la espalda, con caja/mástil/correa completos en las muestras y sin rasgueo frontal ficticio. Sombrero/rostro/pañuelo íntegros. Palmas del desafío legibles en P2.',
'diablo':'Cuernos, rostro, cola y ropa mantienen contorno. Las palmas del retador se reconocen. No se ve deformación de cabeza por campo de muñeca ni props repetidos.',
'knoche':'Lentes/cabeza/barba conservados. Un solo frasco verde en cinturón/bolso, sin vial flotante repetido. Manos de inspección/guardia mantienen contorno; la mano frontal se aproxima al VS.',
'momoy':'Bastón completo y curvatura original de empuñadura conservados, sin zigzag nuevo. Cara/sombrero/ruana íntegros. La palma libre de P2 .35 queda parcialmente recortada por división/VS, con gesto aún reconocible por antebrazo.',
' tiotigre':'',
 'tiotigre':'Rostro animal, orejas, chaleco y cola conservados. Antebrazos/patas siguen siluetas claras; el apoyo de marcha se distingue del alarde. Sin inversiones de contorno visibles.',
 'tioconejo':'Cara, orejas largas, chaleco y pañuelo íntegros. Orejas caben en las muestras; se acercan a banda alta en P1 pero las puntas siguen legibles. Poses de brinco P2 claras, sin deformación de cara.'
}
notes.pop(' tiotigre')
assert set(notes)=={f['id'] for f in fighters}
synthetic={'renny','emilio','puma','oscar'}
records=[]
for index,f in enumerate(fighters):
 id=f['id'];capture=Path('/tmp/arena-v23-captures')/(id+'.webp');sheet=f'docs/entrances-v23/final-captures-{index//5*5+1:02d}-{min((index//5+1)*5,41):02d}.png'
 row=index%5
 if id in postfix_ids:
  pi=postfix_ids.index(id);sheet=f'docs/entrances-v23/final-postfix-captures-{pi//5*5+1:02d}-{min((pi//5+1)*5,len(postfix_ids)):02d}.png';row=pi%5
 records.append({
  'id':id,'name':f['name'],'sprite':f['sprite'],
  'reviewed':{'allFourSuppliedCapturesViewed':True,'moments':[{'side':'P1','progress':.27},{'side':'P1','progress':.60},{'side':'P2','progress':.35},{'side':'P2','progress':.72}],'source':str(capture),'captureSha256':hashlib.sha256(capture.read_bytes()).hexdigest(),'preservedContactSheet':sheet,'row':row,'captureCellSizePx':[200,238]},
  'initialCaptureReview':previous_records[id].get('initialCaptureReview',previous_records[id]['reviewed']),
  'faceAndHead':{'visibleSevereDeformation':False,'likenessPreservedInSamples':True},
  'paintedProps':{'visibleSevereDeformation':False,'visibleDuplication':False},
  'framing':{'headVisible':True,'primaryGestureMostlyVisible':True,'observation':'Palma completa visible en las cuatro muestras regeneradas y comprobada en P1/P2 en el renderer; el recorte anterior está resuelto.' if id=='sarcos' else 'Cabeza y gesto legibles en las muestras; el close-up puede recortar apoyos de piernas o extremos secundarios cerca de VS.'},
  'syntheticMicrophone':{'presentInInitialSuppliedCaptures':id in synthetic,'presentInFinalSuppliedCaptures':False,'parentReportedRemoval':id in synthetic,'removalVisuallyVerifiedByThisAgent':id in synthetic,'status':'Retirada comprobada en las capturas regeneradas y en muestras del renderer actualizado.' if id in synthetic else 'No se observó réplica sintética de micrófono en estas muestras.'},
  'assessment':'pass-after-postfix-visual-recheck' if id in postfix_ids else 'pass-in-supplied-stills',
  'postFixVerification':{'fourRegeneratedCapturesViewed':id in postfix_ids,'updatedBrowserRendererSampled':id in browser_verified,'browserActiveSampleTicks':[45,238] if id=='sarcos' else [45] if id in {'renny','puma'} else [238] if id in {'emilio','oscar'} else [],'sarcosP2Evidence':'docs/entrances-v23/final-sarcos-framing.png' if id=='sarcos' else None,'continuousAnimationViewed':False},
  'observation':notes[id],
  'continuousAnimationReview':{'reviewedByThisAgent':False,'reason':'Cuatro momentos fijos por personaje permiten juzgar silueta/props/encuadre en ellos, pero no continuidad, suavidad o comportamiento entre momentos.'}
 })
review={
 'version':23,'reviewedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'scope':{'fightersReviewedIndividually':41,'suppliedFinalCaptureMomentsViewed':164,'initialCaptureMomentsViewed':164,'additionalPostFixCaptureMomentsViewed':36,'postFixCharactersReviewed':postfix_ids,'updatedBrowserSampledScenesViewed':6,'updatedBrowserCharactersReviewed':sorted(browser_verified),'atlasReferenceReviewCompletedPreviously':328,'runtimeFilesModified':False,'continuousAnimationReviewCompletedByThisAgent':False,'method':'Inspección individual de los cuatro momentos finales de los 41 personajes, preservando 200x238 por celda. Se revisaron de nuevo los nueve strips regenerados (36 muestras adicionales) y seis escenas fijas del renderer actualizado. Cinco personajes clave también abiertos como imágenes individuales. Capturas fijas y escenas detenidas no constituyen visionado temporal continuo.'},
 'conclusion':'En las cuatro muestras finales de cada uno de los 41 personajes no se observan deformaciones graves nuevas de cara o accesorios pintados, ni duplicaciones de accesorios pintados. El recorte de la palma de Sarcos y los cuatro micrófonos sintéticos que parecían pegatinas se resolvieron y se comprobaron visualmente en capturas regeneradas y en muestras del renderer actualizado. No quedan hallazgos concretos pendientes dentro de esta revisión de imágenes fijas; la continuidad completa de las animaciones no se ha visionado aquí.',
 'resolvedVisualFindingsFromIntermediateImplementation':[
  {'id':'dudamel','finding':'Batuta zigzag/L','resolution':'Recta en las cuatro capturas finales suministradas.','visuallyVerified':True},
  {'id':'ali','finding':'Mástil de guitarra doblado en codo','resolution':'Recto y ligado a caja en las cuatro capturas finales suministradas.','visuallyVerified':True},
  {'id':'gualberto','finding':'Riesgo de deformación del cuatro','resolution':'Caja/mástil/correa conservados en las cuatro capturas suministradas.','visuallyVerified':True},
  {'id':'momoy','finding':'Riesgo de deformación del bastón','resolution':'Palo y empuñadura conservados en las cuatro capturas suministradas.','visuallyVerified':True},
  {'id':'capriles','finding':'Riesgo de alterar rostro/gorra tricolor al acercar mano','resolution':'Cara/cap intactos en cuatro muestras; nombre ajustado por el agente principal sin prometer toque a visera.','visuallyVerified':True},
  {'id':'sarcos','finding':'Palma libre protagonista fuera del panel en las primeras capturas P1 .27/.60 y casi fuera en P2 .35.','resolution':'Cámara específica ampliada y desplazada; palma completa en cuatro capturas regeneradas y escenas detenidas P1 tick45 / P2 tick238 del renderer actualizado.','visuallyVerified':True},
  {'ids':['renny','emilio','puma','oscar'],'finding':'Micrófonos sintéticos de primeras capturas leídos como pegatinas de solapa.','resolution':'Retirada completa; ausencia comprobada en cuatro capturas regeneradas por actor y en muestras del renderer actualizado. Props originales conservados.','visuallyVerified':True}
 ],
 'remainingOrPendingFindings':[],
 'notIndependentlyVerifiedHere':{'automatedChecksReportedByParent':{'tests':71,'build':'passed','renders':1476,'finiteCameras':1312,'finalGuardAndReducedPixelIdenticalToAtlas':True},'scope':'Datos comunicados por el agente principal. Esta revisión no los ejecuta de nuevo ni los trata como visionado continuo.'},
 'fighters':records
}
(root/'docs/entrances-v23/final-visual-review.json').write_text(json.dumps(review,ensure_ascii=False,indent=2)+'\n')
print('41/41 final records; 164 final stills, 36 post-fix stills and 6 stopped browser scenes reviewed; no pending still-image findings; continuous animation explicitly separate.')
