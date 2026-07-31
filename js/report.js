// Assembles the on-screen data (live angle summary, manual measurements,
// snapshot) into a printable report laid out like a professional bike-fit
// PDF, then hands off to window.print() so the user can save it as a PDF
// from the browser's print dialog.

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function field(label, value) {
  return `<p><strong>${label}:</strong> ${value || "-"}</p>`;
}

export function collectMedidas() {
  return {
    alturaSillin: val("f-altura-sillin"),
    setback: val("f-setback"),
    reach: val("f-reach"),
    anguloSillin: val("f-angulo-sillin"),
    espaciadores: val("f-espaciadores"),
  };
}

function tablaHtml(filas) {
  if (!filas.length) return "<p>-</p>";
  const rows = filas.map((f) => `
    <tr>
      <td>${f.angulo}</td>
      <td>${f.medido}</td>
      <td>${f.objetivo}</td>
      <td>${f.accion}</td>
      <td>${f.info}</td>
    </tr>
  `).join("");
  return `
    <table class="print-tabla">
      <thead><tr><th>Ángulo</th><th>Medido</th><th>Objetivo</th><th>Acción</th><th>Explicación</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function buildReportHtml({ filas, recs, snapshotDataUrl }) {
  const medidas = collectMedidas();
  const notas = val("f-notas");

  const recsHtml = recs.length
    ? recs.map((r) => `<div class="print-rec"><strong>${r.titulo}</strong><p>${r.detalle}</p>${r.sugerencia ? `<p><em>→ ${r.sugerencia}</em></p>` : ""}</div>`).join("")
    : "<p>-</p>";

  const snapshotHtml = snapshotDataUrl
    ? `<img src="${snapshotDataUrl}" alt="Resultado visual" class="print-snapshot" />`
    : "<p>-</p>";

  return `
    <h1>Bike Fit</h1>

    <h2>Resumen Biomecánico</h2>
    ${tablaHtml(filas)}

    <h2>Resumen</h2>
    ${field("Altura del sillín", medidas.alturaSillin && `${medidas.alturaSillin} mm`)}
    ${field("Punta del sillín con respecto a caja pedalera", medidas.setback && `${medidas.setback} mm`)}
    ${field("Punta del sillín al manillar", medidas.reach && `${medidas.reach} mm`)}
    ${field("Ángulo del sillín", medidas.anguloSillin && `${medidas.anguloSillin}°`)}
    ${field("Espaciadores", medidas.espaciadores && `${medidas.espaciadores} mm`)}

    <h2>Consideraciones</h2>
    ${recsHtml}
    ${notas ? `<p><strong>Notas adicionales:</strong> ${notas}</p>` : ""}

    <h2>Resultado Visual</h2>
    ${snapshotHtml}
  `;
}

export function generateReport(data) {
  const container = document.getElementById("printReport");
  container.innerHTML = buildReportHtml(data);
  window.print();
}
