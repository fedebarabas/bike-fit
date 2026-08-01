// Rangos de referencia tomados de convenciones habituales de bike fitting
// (estilo Retül/BikeFit). Son puntos de partida generales, no reemplazan un
// estudio biomecánico profesional — así se aclara siempre al usuario.
//
// Todos los ángulos son valores directos (sin transformar), igual que en un
// reporte de bike fit profesional: una rodilla en el punto muerto inferior
// ronda 140-155° (no "25-40° de flexión").

export const ESTILOS = {
  agresivo: { label: "Agresivo / carrera", torso: [15, 35] },
  deportivo: { label: "Deportivo / fondo", torso: [35, 50] },
  urbano: { label: "Urbano / paseo", torso: [50, 60] },
};

// Ángulo de rodilla (cadera-rodilla-tobillo) en el punto muerto inferior (PMI).
// Valor bajo = pierna más flexionada (sillín bajo); valor alto = pierna más
// estirada (sillín alto).
const RODILLA_RANGO = [140, 155]; // "tabla media"
const RODILLA_MARGEN = 5; // dentro de este margen del límite: "cercano al límite"

// Ángulo Hombro-Muñeca (hombro-codo-muñeca): flexión del brazo. Valor bajo =
// codo muy flexionado (alcance corto); valor alto = brazo casi estirado
// (codo trabado, alcance largo).
const HOMBRO_MUNECA_RANGO = [145, 165]; // "tabla media" (brazo ligeramente flexionado)
const HOMBRO_MUNECA_MARGEN = 5;

const VARIABILIDAD_RODILLA_AVISO = 4; // grados; por encima, el pedaleo es inconsistente

// Ángulo de Cadera en el punto muerto superior: piso de referencia contra
// pinzamiento de cadera (no hay un techo relevante en este contexto).
const CADERA_PMS_PISO = 45;

function ubicar(valor, [lo, hi], margen) {
  if (valor < lo) return { zona: "bajo", distancia: +(lo - valor).toFixed(1) };
  if (valor > hi) return { zona: "alto", distancia: +(valor - hi).toFixed(1) };
  if (valor - lo <= margen) return { zona: "cerca-bajo", distancia: +(valor - lo).toFixed(1) };
  if (hi - valor <= margen) return { zona: "cerca-alto", distancia: +(valor - hi).toFixed(1) };
  return { zona: "media", distancia: 0 };
}

function estadoDeZona(zona) {
  if (zona === "media") return "ok";
  if (zona === "cerca-bajo" || zona === "cerca-alto") return "info";
  return "alerta";
}

function fmt(stat) {
  return stat ? `${stat.mean.toFixed(1)}°` : "—";
}

const SIN_ACCION = "Ninguna — está en la tabla";

function infoRodilla(rodilla, u) {
  const base = "Ángulo entre cadera-rodilla-tobillo en el punto muerto inferior (pedal abajo). Indica la altura del sillín: valor bajo (más flexionada) → sillín bajo; valor alto (más estirada) → sillín alto.";
  if (!rodilla) return base;
  let detalle;
  if (u.zona === "bajo") {
    detalle = `El ángulo medido es de ${rodilla.mean.toFixed(1)}°, ${u.distancia}° por debajo del rango habitual (${RODILLA_RANGO[0]}–${RODILLA_RANGO[1]}°). Una rodilla muy flexionada puede restar potencia y sobrecargar la parte delantera de la rodilla. → Probar subir el sillín unos ${Math.round(u.distancia * 2.5)}mm y volver a medir.`;
  } else if (u.zona === "alto") {
    detalle = `El ángulo medido es de ${rodilla.mean.toFixed(1)}°, ${u.distancia}° por encima del rango habitual (${RODILLA_RANGO[0]}–${RODILLA_RANGO[1]}°). Una pierna casi estirada del todo suele generar balanceo de cadera y sobrecarga en isquiotibiales. → Probar bajar el sillín unos ${Math.round(u.distancia * 2.5)}mm y volver a medir.`;
  } else if (u.zona === "cerca-bajo") {
    detalle = `El ángulo está en ${rodilla.mean.toFixed(1)}°, cerca del límite inferior de la tabla (${RODILLA_RANGO[0]}°).`;
  } else if (u.zona === "cerca-alto") {
    detalle = `El ángulo está en ${rodilla.mean.toFixed(1)}°, cerca del límite superior de la tabla (${RODILLA_RANGO[1]}°).`;
  } else {
    detalle = `El ángulo está en la tabla media (${rodilla.mean.toFixed(1)}°), dentro del rango habitual de ${RODILLA_RANGO[0]}–${RODILLA_RANGO[1]}°.`;
  }
  if (rodilla.std > VARIABILIDAD_RODILLA_AVISO) {
    detalle += ` Además, varía ±${rodilla.std.toFixed(1)}° entre ${rodilla.n} ciclos, más de lo esperable (~${VARIABILIDAD_RODILLA_AVISO}°) en un pedaleo estable — puede deberse a balanceo de cadera, un sillín inestable, o ruido de la cámara.`;
  }
  return `${base} ${detalle}`;
}

function infoCadera(caderaPms, alerta) {
  const base = "Ángulo hombro-cadera-rodilla en el punto muerto superior (pedal arriba). Muy cerrado favorece el pinzamiento de cadera.";
  if (!caderaPms) return base;
  const detalle = alerta
    ? `La cadera promedia ${caderaPms.mean.toFixed(1)}°, por debajo del piso de referencia de ${CADERA_PMS_PISO}°. Esto suele asociarse a pinzamiento de cadera o a la zona lumbar redondeándose. → Si hay molestias en esa zona, revisar el retroceso del sillín o el largo del cuadro.`
    : `La cadera promedia ${caderaPms.mean.toFixed(1)}°, por encima del piso de referencia de ${CADERA_PMS_PISO}°.`;
  return `${base} ${detalle}`;
}

function infoTorso(torso, u, est) {
  const base = "Inclinación del torso respecto a la horizontal. El objetivo depende del estilo de manejo elegido.";
  if (!torso) return base;
  let detalle;
  if (u.zona !== "media") {
    const sugerencia = u.zona === "bajo"
      ? "Postura más agresiva que el objetivo — subir el manillar o acortar el alcance para sentarse más erguido."
      : "Postura más erguida que el objetivo — bajar y/o alargar el vástago para una posición más aerodinámica.";
    detalle = `La espalda promedia ${torso.mean.toFixed(1)}° respecto a la horizontal; la tabla para "${est.label}" es de ${est.torso[0]}–${est.torso[1]}°. → ${sugerencia}`;
  } else {
    const cercaLimite = torso.mean - est.torso[0] <= 5 || est.torso[1] - torso.mean <= 5;
    detalle = `La espalda está ${cercaLimite ? "cercana al límite" : "en la tabla"} para "${est.label}" (${torso.mean.toFixed(1)}°, tabla ${est.torso[0]}–${est.torso[1]}°).`;
  }
  return `${base} ${detalle}`;
}

function infoHombroMuneca(hombroMuneca, u) {
  const base = "Ángulo hombro-codo-muñeca. Bajo (codo muy flexionado) puede indicar alcance corto; alto (brazo casi estirado) puede trabar el codo.";
  if (!hombroMuneca) return base;
  let detalle;
  if (u.zona === "bajo") {
    detalle = `El brazo está bastante flexionado (${hombroMuneca.mean.toFixed(1)}°, límite corto ${HOMBRO_MUNECA_RANGO[0]}°), lo que puede indicar un alcance corto o un puesto de manejo apretado. → Si se siente cargado sobre los brazos o el cuello, considerar un vástago más largo o subir el manillar.`;
  } else if (u.zona === "alto") {
    detalle = `El brazo está casi estirado del todo (${hombroMuneca.mean.toFixed(1)}°, límite largo ${HOMBRO_MUNECA_RANGO[1]}°). Los codos trabados transmiten las vibraciones del camino a hombros y cuello, y restan control de la dirección. → Puede que el alcance sea muy largo, o sea un hábito postural — relajar conscientemente los codos; si persiste, considerar un vástago más corto.`;
  } else {
    detalle = `El brazo promedia ${hombroMuneca.mean.toFixed(1)}°, dentro del rango relajado de ${HOMBRO_MUNECA_RANGO[0]}–${HOMBRO_MUNECA_RANGO[1]}°.`;
  }
  return `${base} ${detalle}`;
}

// Tabla compacta de valores medidos vs. referencia, con una explicación breve
// por fila (usada como tooltip en pantalla) y la acción correctiva sugerida
// para llevar ese ángulo a la tabla.
export function tablaBiomecanica(stats, estilo) {
  const est = ESTILOS[estilo] ?? ESTILOS.deportivo;
  const filas = [];

  const rodilla = stats.rodillaPmi;
  const rodillaU = rodilla ? ubicar(rodilla.mean, RODILLA_RANGO, RODILLA_MARGEN) : null;
  filas.push({
    angulo: "Ángulo de Rodilla (PMI)",
    medido: fmt(rodilla),
    objetivo: `${RODILLA_RANGO[0]}–${RODILLA_RANGO[1]}°`,
    estado: rodillaU ? estadoDeZona(rodillaU.zona) : "info",
    accion: !rodillaU ? "—"
      : rodillaU.zona === "bajo" ? `Subir el sillín ~${Math.round(rodillaU.distancia * 2.5)}mm`
      : rodillaU.zona === "alto" ? `Bajar el sillín ~${Math.round(rodillaU.distancia * 2.5)}mm`
      : rodillaU.zona === "cerca-bajo" ? "Ninguna — cerca del límite de sillín bajo"
      : rodillaU.zona === "cerca-alto" ? "Ninguna — cerca del límite de sillín alto"
      : SIN_ACCION,
    info: infoRodilla(rodilla, rodillaU),
  });

  const caderaPms = stats.caderaPms;
  const caderaAlerta = caderaPms ? caderaPms.mean < CADERA_PMS_PISO : null;
  filas.push({
    angulo: "Ángulo de Cadera (PMS)",
    medido: fmt(caderaPms),
    objetivo: `> ${CADERA_PMS_PISO}°`,
    estado: caderaPms ? (caderaAlerta ? "alerta" : "ok") : "info",
    accion: caderaPms === null ? "—" : caderaAlerta ? "Aumentar retroceso de sillín o revisar largo de cuadro" : SIN_ACCION,
    info: infoCadera(caderaPms, caderaAlerta),
  });

  const torso = stats.torso;
  const torsoU = torso ? ubicar(torso.mean, est.torso, 5) : null;
  filas.push({
    angulo: "Ángulo de Espalda (Torso)",
    medido: fmt(torso),
    objetivo: `${est.torso[0]}–${est.torso[1]}° (${est.label})`,
    estado: torsoU ? estadoDeZona(torsoU.zona) : "info",
    accion: !torsoU ? "—"
      : torsoU.zona === "bajo" ? "Subir manillar o acortar alcance"
      : torsoU.zona === "alto" ? "Bajar y/o alargar vástago"
      : SIN_ACCION,
    info: infoTorso(torso, torsoU, est),
  });

  const hombroMuneca = stats.hombroMuneca;
  const brazoU = hombroMuneca ? ubicar(hombroMuneca.mean, HOMBRO_MUNECA_RANGO, HOMBRO_MUNECA_MARGEN) : null;
  filas.push({
    angulo: "Ángulo Hombro-Muñeca",
    medido: fmt(hombroMuneca),
    objetivo: `${HOMBRO_MUNECA_RANGO[0]}–${HOMBRO_MUNECA_RANGO[1]}°`,
    estado: brazoU ? estadoDeZona(brazoU.zona) : "info",
    accion: !brazoU ? "—"
      : brazoU.zona === "bajo" ? "Relajar los codos; si persiste, vástago más largo o subir manillar"
      : brazoU.zona === "alto" ? "Relajar los codos; si persiste, vástago más corto"
      : SIN_ACCION,
    info: infoHombroMuneca(hombroMuneca, brazoU),
  });

  const pie = stats.pie;
  filas.push({
    angulo: "Ángulo de Pie",
    medido: fmt(pie),
    objetivo: "informativo",
    estado: "info",
    accion: "Sin acción — solo referencia",
    info: "Inclinación del pie respecto a la horizontal en el punto muerto inferior. Sin rango de referencia fijo — útil para comparar contra vos mismo con el tiempo.",
  });

  filas.push({
    angulo: "Rodilla / eje del pedal",
    medido: "—",
    objetivo: "—",
    estado: "info",
    accion: "Requiere cámara frontal",
    info: "No se puede evaluar con una sola cámara de perfil — requiere una vista frontal para ver si la rodilla se mueve hacia adentro o hacia afuera del eje del pedal.",
  });

  return filas;
}

// Cuánta desviación lateral de rodilla (respecto a la línea cadera-tobillo)
// se considera normal, en grados hacia adentro o hacia afuera.
const RODILLA_TRACKING_LIMITE = 3;

function filaRodillaFrontal(nombre, stat) {
  if (!stat || stat.n === 0) {
    return {
      angulo: `Rodilla ${nombre} (eje del pedal)`,
      medido: "—",
      objetivo: `< ${RODILLA_TRACKING_LIMITE}°`,
      estado: "info",
      accion: "—",
      info: "Desviación lateral de la rodilla respecto a la línea cadera-tobillo, vista de frente.",
    };
  }
  const deg = Math.abs(stat.mean);
  const direccion = stat.mean >= 0 ? "adentro" : "afuera";
  const dentroDeRango = deg < RODILLA_TRACKING_LIMITE;
  return {
    angulo: `Rodilla ${nombre} (eje del pedal)`,
    medido: `${deg.toFixed(1)}° ${direccion}`,
    objetivo: `< ${RODILLA_TRACKING_LIMITE}°`,
    estado: dentroDeRango ? "ok" : "alerta",
    accion: dentroDeRango
      ? "Ninguna — la rodilla trackea derecho"
      : `Revisar calas, ancho de eje/pedales, o trabajo de control neuromuscular de la rodilla (cae hacia ${direccion})`,
    info: "Desviación de la rodilla respecto a la línea cadera-tobillo, vista de frente. 'Adentro' (valgo) o 'afuera' (varo) por encima de unos pocos grados puede indicar un problema de alineación, calas mal orientadas, o debilidad/control de cadera.",
  };
}

// Tabla equivalente a tablaBiomecanica pero para cámara frontal: en esa vista
// los ángulos de perfil (torso, cadera, rodilla-flexión, pie, brazo) no
// significan nada — lo único medible de forma confiable es el seguimiento
// lateral de la rodilla respecto al eje del pedal, en cada pierna.
// stats: { left, right }, cada uno { mean, std, min, max, n } o null.
export function tablaFrontal(stats) {
  return [
    filaRodillaFrontal("Izquierda", stats.left),
    filaRodillaFrontal("Derecha", stats.right),
  ];
}
