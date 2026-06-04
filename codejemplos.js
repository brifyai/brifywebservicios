// Asegúrate de que el Modo de Ejecución esté en "Run Once for All Items"

// Obtener todos los items del merge
const allItems = $input.all();

// Separar rutina y dieta basándose en la estructura
const rutina = [];
const dieta = [];

allItems.forEach(item => {
  const data = item.json;
  // Si el item tiene propiedades de rutina (ID, Ejercicio, etc.)
  if (data.hasOwnProperty('ID') && data.hasOwnProperty('Ejercicio')) {
    rutina.push(data);
  }
  // Si el item tiene propiedades de dieta (Desayuno, Almuerzo, etc.)
  else if (data.hasOwnProperty('Desayuno')) {
    dieta.push(data);
  }
});

// Función para agrupar ejercicios por día
function agruparEjerciciosPorDia(rutina) {
  const ejerciciosPorDia = {};
  
  rutina.forEach(item => {
    if (!ejerciciosPorDia[item.Día]) {
      ejerciciosPorDia[item.Día] = [];
    }
    ejerciciosPorDia[item.Día].push({
      Ejercicio: item.Ejercicio,
      Repeticiones: item.Repeticiones,
      Series: item.Series,
      "Descanso (seg)": item["Descanso (seg)"]
    });
  });
  
  return ejerciciosPorDia;
}

// Agrupar ejercicios por día
const ejerciciosAgrupados = agruparEjerciciosPorDia(rutina);

// Combinar rutina y dieta en un array temporal
const planCompletoArray = dieta.map(dietaDia => {
  const dia = dietaDia.Día;
  const ejerciciosDelDia = ejerciciosAgrupados[dia] || [];
  
  const textoEjercicios = ejerciciosDelDia.length > 0 
    ? ejerciciosDelDia.map(ej => 
        `${ej.Ejercicio}: ${ej.Repeticiones} reps x ${ej.Series} series (descanso: ${ej["Descanso (seg)"]}seg)`
      ).join(' | ')
    : 'Día de descanso';
  
  const textoDieta = `Desayuno: ${dietaDia.Desayuno} | Almuerzo: ${dietaDia.Almuerzo} | Cena: ${dietaDia.Cena} | Snacks: ${dietaDia["Snacks/Meriendas"]}`;
  
  return {
    Día: dia,
    rutina: textoEjercicios,
    dieta: textoDieta,
    ejercicios_detalle: ejerciciosDelDia,
    dieta_detalle: {
      Desayuno: dietaDia.Desayuno,
      Almuerzo: dietaDia.Almuerzo,
      Cena: dietaDia.Cena,
      "Snacks/Meriendas": dietaDia["Snacks/Meriendas"]
    }
  };
});

// --- PASO FINAL: TRANSFORMACIÓN PARA SUPABASE ---
// Convierte el array de días en un único objeto donde cada día es una llave.
// Este es el cambio clave para un registro óptimo.

const planSemanalObjeto = planCompletoArray.reduce((acc, diaPlan) => {
  // La llave del objeto será el nombre del día (ej. "Lunes")
  const nombreDelDia = diaPlan.Día;
  
  // Creamos el objeto interno sin el campo "Día", ya que es redundante
  acc[nombreDelDia] = {
    rutina: diaPlan.rutina,
    dieta: diaPlan.dieta,
    ejercicios_detalle: diaPlan.ejercicios_detalle,
    dieta_detalle: diaPlan.dieta_detalle
  };
  
  return acc;
}, {}); // El {} al final es el objeto inicial sobre el que construimos.

// El nodo ahora devolverá un único objeto, listo para ser insertado en la columna JSONB.
return planSemanalObjeto;