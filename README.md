# Bike Fit

Asistente de bike fit por cámara web, en vivo. Corre enteramente en el
navegador — el reconocimiento de postura (MediaPipe Pose, vía
`@mediapipe/tasks-vision` cargado desde un CDN) sucede del lado del cliente;
ningún video sale de tu máquina.

Sigue los ángulos articulares del ciclista cuadro por cuadro, los segmenta en
pedaladas, y compara los promedios de altura de sillín, cadera, espalda y
brazos contra rangos de referencia habituales en bike fitting, siguiendo la
misma nomenclatura y estructura que un reporte de estudio biomecánico
profesional (Resumen Biomecánico, Resumen de medidas, Consideraciones,
Resultado Visual).

## Cómo correrlo

El acceso a la cámara y los módulos ES requieren un origen real (no
`file://`), así que hay que servir la carpeta con cualquier servidor estático.
Desde esta carpeta:

```bash
python3 -m http.server 8080
```

Después abrí `http://localhost:8080` en el navegador y permití el acceso a la
cámara.

## Armando la toma

- Poné la bici en un rodillo/trainer, cámara en un trípode a la altura de la
  cadera.
- Elegí la **"Vista de cámara"**: "Perfil (lateral)" para el análisis
  completo de postura, o "Frontal" para el seguimiento de rodilla (ver
  [Vista frontal](#vista-frontal) más abajo). Cambiar de vista reinicia los
  datos capturados.
- En Perfil: encuadrá un perfil limpio — perpendicular a la bici, con espacio
  suficiente para ver hombro, cadera, rodilla, tobillo y pie juntos — y elegí
  el lado que mira a la cámara (izquierdo/derecho) y un estilo de manejo
  objetivo (agresivo/deportivo/urbano) para la comparación del ángulo de
  espalda.
- Una buena iluminación pareja importa más que la calidad de la cámara.
- Pedaleá a un ritmo constante y natural durante al menos 10-15 vueltas antes
  de leer el resumen — cuantos más ciclos se capturen, más confiables son los
  promedios y el chequeo de variabilidad.
- **"Iniciar cámara"** es un toggle: prende la cámara y el rastreo, y pasa a
  decir **"Detener cámara"** — apretarlo mientras está corriendo apaga todo
  (cámara, rastreo y medición). Prender la cámara solo no empieza a grabar
  pedaladas todavía.
- Subite a la bici, acomodate, y cuando estés listo apretá **"Empezar
  medición"** (el botón del medio, entre "Iniciar cámara" y "Reiniciar
  sesión"). Ahí arranca la cuenta regresiva (5s por defecto, configurable en
  "Cuenta regresiva antes de medir") antes de que empiece a registrar
  pedaladas, para que el acomodo inicial no ensucie los datos. Ese mismo
  botón pasa a decir **"Detener medición"** mientras la cuenta regresiva o la
  medición están en curso — apretarlo corta solo el registro, la cámara sigue
  prendida. "Reiniciar sesión" vuelve a dejar todo listo para apretar
  "Empezar medición" de nuevo sin apagar la cámara.
- La medición se corta sola apenas la postura se estabiliza (mínimo 8
  pedaladas, y que las últimas 5 coincidan de cerca en rodilla/cadera/torso/
  brazo) — no hace falta pedalear de más ni frenar manualmente. Si querés
  seguir sumando datos después de eso, "Empezar medición" te deja retomar sin
  perder lo ya grabado.

## Qué mide

Por cada pedalada (detectada a partir del pico de ángulo de rodilla en el
punto muerto inferior y el mínimo en el punto muerto superior). Todos los
ángulos son valores directos — sin transformar — igual que en un reporte de
bike fit profesional (una rodilla en PMI ronda 140-155°, no "25-40° de
flexión"):

- **Ángulo de rodilla en el punto muerto inferior (PMI)** — altura del
  sillín. Tabla media ~140-155°; bajo (más flexionada) → sillín bajo, alto
  (más estirada) → sillín alto.
- **Ángulo de cadera en el punto muerto superior (PMS)** — riesgo de
  pinzamiento de cadera si se cierra demasiado.
- **Ángulo de espalda (Torso)** respecto a la horizontal — comparado contra el
  estilo de manejo elegido.
- **Ángulo Hombro-Muñeca** (hombro-codo-muñeca) — marca brazos trabados o un
  puesto de manejo muy apretado.
- **Variabilidad ciclo a ciclo** del ángulo de rodilla — marca un pedaleo
  inconsistente o balanceo de cadera.

El "Resumen Biomecánico" se muestra como una tabla compacta — Ángulo | Medido
| Objetivo | Acción — con la corrección sugerida para llevar ese ángulo a la
tabla (p. ej. "Bajar el sillín ~5mm"), y un ícono ⓘ por fila que al pasar el
mouse explica qué mide ese ángulo y por qué importa. Las "Consideraciones"
debajo siguen dando el detalle en prosa.

## Pose promedio

Una vez que se capturan pedaladas (en vista Perfil), el botón **"Ver pose
promedio"** reemplaza la cámara en vivo por dos esqueletos estáticos lado a
lado, armados con la posición promedio de cada articulación a lo largo de
todos los ciclos capturados: uno en el punto muerto inferior (PMI, pedal
abajo, donde se lee la rodilla/pie) y otro en el punto muerto superior (PMS,
pedal arriba, donde se lee la cadera) — un solo esqueleto congelado no puede
representar honestamente las dos mediciones a la vez, ya que la pierna está
en una postura bien distinta en cada punto. Sirve para revisar la postura
medida sin que el video en vivo se mueva todo el tiempo. "Volver a cámara en
vivo" restaura el feed.

## Vista frontal

Con **"Vista de cámara" en "Frontal"**, la app pasa a rastrear ambas piernas
en lugar de un solo perfil. Los ángulos de perfil (torso, cadera, rodilla,
pie, brazo) no significan nada vistos de frente, así que esos controles y la
tabla habitual se reemplazan por un chequeo de **seguimiento de rodilla**:
para cada pierna, cuánto se desvía la rodilla — hacia adentro (valgo) o hacia
afuera (varo) — respecto a la línea recta cadera-tobillo, mientras pedaleás
de frente a la cámara. Es exactamente la medición que la vista de Perfil
señala como pendiente ("Requiere cámara frontal").

- Encuadrá al ciclista de frente, con cadera, rodillas y tobillos de ambas
  piernas visibles.
- "Empezar medición"/"Detener medición" funcionan igual que en Perfil, pero
  acá no hay corte automático por estabilidad — parás vos cuando quieras.
  "Ver pose promedio" no está disponible en este modo.
- La tabla muestra un valor por pierna (p. ej. "5.8° adentro"), con un umbral
  de referencia de ±3° como seguimiento "normal".

## El reporte completo

Además del análisis en vivo, la página tiene los mismos campos que un reporte
de bike fit en papel para las medidas físicas del cuadro (altura de sillín,
retroceso, alcance, ángulo de sillín, espaciadores). Esos campos son de carga
manual (la cámara no puede medir el cuadro en milímetros sin una
referencia calibrada) — se completan a mano y quedan incluidos al generar el
reporte.

Con el botón **"Capturar resultado visual"** se congela el cuadro actual (la
cámara en vivo o la pose promedio, lo que esté visible en ese momento) con la
superposición de ángulos, tal como la foto de un reporte de bike fit. El
botón **"Generar reporte"** arma todo (tabla biomecánica, medidas físicas,
consideraciones, foto) en una página imprimible — desde el diálogo de
impresión del navegador se puede guardar directamente como PDF.

## Limitaciones

- Cada vista mide solo lo que le corresponde: Perfil da ángulos 2D en el
  plano sagital (torso, cadera, rodilla, pie, brazo) pero no puede ver
  seguimiento de rodilla ni balanceo de cadera; Frontal mide el seguimiento
  de rodilla pero no los ángulos de perfil. Ninguna de las dos vistas mide
  todo a la vez — hay que grabar dos veces si querés ambos chequeos.
- La precisión del seguimiento de postura depende de la iluminación, la ropa
  (calzas ajustadas ayudan a que se vean bien los puntos de tobillo/rodilla),
  y el encuadre de la cámara.
- Los rangos de referencia son puntos de partida generales de convenciones
  habituales de fitting, no reemplazan un estudio biomecánico profesional —
  sobre todo ante antecedentes de lesiones, límites de flexibilidad, o
  anatomía particular.
