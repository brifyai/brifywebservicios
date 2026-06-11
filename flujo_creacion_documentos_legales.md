# 📄 FLUJO: CREACIÓN DE DOCUMENTOS LEGALES
**Versión:** 1.0  
**Módulo:** Asesor Legal / Detección Casual  
**Última actualización:** Junio 2026

---

## Descripción General

Proceso guiado para que el usuario pueda generar documentos legales de forma asistida.
Puede iniciarse desde el **Asesor Legal** o detectarse de forma **casual** en la conversación general.

El flujo garantiza trazabilidad de estado en cada etapa para evitar errores de selección, subidas colgadas, pérdida de datos o confusión al usuario.

---

## 🗺️ MAPA GENERAL DEL FLUJO

```
[DETECCIÓN]
     ↓
[SELECCIÓN DE DOCUMENTO]
     ↓
[RECOLECCIÓN DE DATOS]
   ↙        ↘
[Datos 1 a 1]  [Lista completa → IA extracción]
     ↓
[CONFIRMACIÓN DEL RESUMEN]
     ↓
[GENERACIÓN DEL DOCUMENTO]
     ↓
[DESTINO EN DRIVE]
     ↓
[SUBIDA A DRIVE]
     ↓
[MOVIDA A CARPETA] (si aplica)
     ↓
[GUARDADO EN SUPABASE]
     ↓
[ENTREGA FINAL AL USUARIO]
```

---

## 🔍 ETAPA 0 — DETECCIÓN DE INTENCIÓN

### Trigger Words

Detectar conjugaciones y variantes de:
`crear`, `hacer`, `generar`, `necesito`, `quiero`, `preparar`, `redactar`, `armar`, `elaborar` + contexto legal/documental.

### Casos de Derivación

| Origen | Acción |
|--------|--------|
| Usuario ya está en Asesor Legal | Continuar en contexto, iniciar Etapa 1 directamente |
| Conversación casual con intención clara | Derivar amablemente: *"Puedo ayudarte a crear ese documento, ¿te guío en el proceso?"* |
| Intención ambigua o parcial | Hacer máximo 1 pregunta aclaratoria antes de derivar |

### Estado Resultante

```
ESTADO: INTENT_DETECTED
```

---

## 📋 ETAPA 1 — SELECCIÓN DE DOCUMENTO

### 1.1 Si el documento NO está claro → Preguntar al usuario

```
¿Qué tipo de documento necesitas? 📄✨

1. 📑 Contrato de Arriendo
2. 🤝 Contrato de Trabajo
3. 💼 Poder Notarial Simple
4. 🏠 Promesa de Compraventa
5. 📜 Declaración Jurada
6. 🔏 Finiquito Laboral
7. 📃 Mandato Civil
8. ❓ Otro (descríbelo brevemente)
```

### 1.2 Confirmación de Selección

Antes de avanzar, confirmar explícitamente con el usuario:

```
Perfecto, vamos a preparar un [NOMBRE DEL DOCUMENTO]. ✅
¿Es correcto o necesitas cambiar el tipo de documento?
```

### 1.3 Estado Resultante

```
ESTADO: DOCUMENT_SELECTED
DATOS: { document_type: "<tipo>" }
```

### ⚠️ Reglas Críticas — Etapa 1

- **NO avanzar** sin confirmación explícita del documento seleccionado.
- Si el usuario describe algo ambiguo → hacer **máximo 1 pregunta aclaratoria**.
- Guardar `document_type` en estado **antes** de continuar a Etapa 2.
- Nunca asumir el tipo de documento por contexto sin validación del usuario.

---

## 📝 ETAPA 2 — RECOLECCIÓN DE DATOS

### 2.1 Envío de Lista de Campos Requeridos

Presentar los campos necesarios para que el usuario los **copie y rellene**:

```
Para generar tu [NOMBRE_DOCUMENTO] necesito algunos datos.
Puedes copiar esta lista, completarla y enviármela toda junta,
o responderme de a uno y te voy guiando 😊

━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 DATOS REQUERIDOS — [NOMBRE_DOCUMENTO]

• Nombre completo Parte 1:
• RUT Parte 1:
• Nombre completo Parte 2:
• RUT Parte 2:
• [Campo específico según documento]:
• Fecha de inicio:
• [Campos adicionales según tipo...]
━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Estado Resultante

```
ESTADO: DATA_COLLECTION_STARTED
DATOS: { campos_requeridos: [...], campos_recibidos: {}, campos_pendientes: [...] }
```

---

### 2.2 Escenario A — Usuario envía datos de a uno

Para cada dato recibido:

1. Confirmar el dato recibido visualmente.
2. Actualizar lista de pendientes.
3. Mostrar recordatorio de lo que falta.

**Ejemplo de respuesta:**

```
✅ Recibido: Nombre Parte 1 → "Juan Pérez González"

Aún me faltan:
• RUT Parte 1
• Nombre completo Parte 2
• RUT Parte 2
• Fecha de inicio
```

**Estado durante proceso:**

```
ESTADO: DATA_PARTIAL
DATOS: {
  campos_recibidos: { nombre_parte1: "Juan Pérez González", ... },
  campos_pendientes: ["rut_parte1", "nombre_parte2", ...]
}
```

---

### 2.3 Escenario B — Usuario envía lista completa

Activar modelo IA de extracción para parsear y mapear cada campo.

**Prompt interno de extracción:**

```
Eres un extractor preciso de datos para documentos legales.
Del siguiente texto del usuario, extrae EXACTAMENTE los valores para estos campos: [lista_campos].
Devuelve SOLO un objeto JSON con los campos solicitados.
Reglas:
- Si un campo no está presente o no es claro, marcarlo como null.
- NO inventar datos.
- NO asumir valores.
- NO completar datos parciales.
Texto del usuario: [texto]
```

**Post-extracción:**

- Verificar que todos los campos estén cubiertos (sin `null`).
- Si hay campos `null` → solicitar **solo los faltantes** al usuario (Escenario A).
- Si todos completos → avanzar a Etapa 3.

**Estado Resultante:**

```
ESTADO: DATA_EXTRACTED
DATOS: { campos: { nombre_parte1: "...", rut_parte1: "...", ... } }
```

---

## ✅ ETAPA 3 — CONFIRMACIÓN DE DATOS

### 3.1 Mostrar Resumen al Usuario

```
¡Perfecto! 🎉 Antes de generar tu documento, confirma que los datos son correctos:

━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 Documento: [NOMBRE_DOCUMENTO]

• Nombre Parte 1: [valor]
• RUT Parte 1: [valor]
• Nombre Parte 2: [valor]
• RUT Parte 2: [valor]
• [Campo]: [valor]
• Fecha: [valor]
━━━━━━━━━━━━━━━━━━━━━━━━━━

¿Todo está correcto? ✅
¿O deseas cambiar algo? ✏️
```

### 3.2 Ramas de Respuesta

**Si el usuario confirma →** Avanzar a Etapa 4.

**Si el usuario corrige →**
1. Identificar campo(s) a corregir.
2. Actualizar solo ese campo en el estado.
3. Volver a mostrar el resumen completo actualizado.
4. Solicitar nueva confirmación.

**Estado Resultante:**

```
ESTADO: DATA_CONFIRMED
DATOS: { campos_finales: { ... } }
```

---

## ⚙️ ETAPA 4 — GENERACIÓN DEL DOCUMENTO

### 4.1 Generar Documento `.docx`

1. Seleccionar plantilla correspondiente a `document_type`.
2. Inyectar campos desde `DATA_CONFIRMED.campos_finales`.
3. Validar documento generado antes de continuar.
4. Si la validación falla → notificar al usuario y reintentar (máx. 1 vez).

**Estado Resultante:**

```
ESTADO: DOCUMENT_GENERATED
DATOS: { file_path: "...", file_name: "[nombre].docx" }
```

---

## 📁 ETAPA 5 — DESTINO EN GOOGLE DRIVE

### 5.1 Preguntar destino al usuario

```
¿Dónde quieres guardar tu documento en Google Drive? 📁

1. 📂 En la raíz (carpeta principal)
2. 📁 En una carpeta o grupo específico (dime el nombre)
```

### 5.2 Estado Resultante

```
ESTADO: DRIVE_DESTINATION_SET
DATOS: {
  destino_tipo: "root" | "folder",
  destino_nombre: null | "<nombre de carpeta>"
}
```

---

## ☁️ ETAPA 6 — SUBIDA A GOOGLE DRIVE

### ⚠️ Regla Fundamental
**La subida y la movida son operaciones SEPARADAS e INDEPENDIENTES.**
Nunca ejecutar la movida sin tener confirmado el `file_id` de la subida.

### 6.1 PASO 1 — Subir archivo a raíz de Drive

```
→ Ejecutar subida a Drive raíz
→ Capturar file_id del archivo subido
→ Si error: notificar al usuario, NO continuar con movida
```

**Estados posibles:**

```
ESTADO: DRIVE_UPLOAD_OK   → { file_id: "...", drive_url: "..." }
ESTADO: DRIVE_UPLOAD_FAILED → { error: "...", accion: "notificar_usuario" }
```

### 6.2 PASO 2 — Mover a carpeta específica (si aplica)

Solo ejecutar si:
- `destino_tipo == "folder"` **Y**
- `DRIVE_UPLOAD_OK` fue confirmado y `file_id` está disponible.

```
→ Buscar folder_id por nombre de carpeta
→ Si carpeta no existe: preguntar al usuario si desea crearla o usar raíz
→ Ejecutar movida usando file_id capturado en Paso 1
→ Confirmar resultado de la movida
```

**Estados posibles:**

```
ESTADO: DRIVE_MOVE_OK     → { file_id: "...", ubicacion_final: "<carpeta>" }
ESTADO: DRIVE_MOVE_FAILED → { file_id: "...", ubicacion_final: "raíz", error: "..." }
```

**Mensaje al usuario si la movida falla:**

```
⚠️ No pude mover el documento a la carpeta "[nombre]",
pero quedó guardado correctamente en tu raíz de Drive.
Puedes moverlo manualmente cuando quieras. 📁
```

---

## 💾 ETAPA 7 — GUARDADO EN SUPABASE

### 7.1 Registrar metadata del documento

Campos a guardar:

```json
{
  "document_type": "<tipo>",
  "user_id": "<id>",
  "drive_file_id": "<file_id>",
  "drive_path": "<raíz o nombre_carpeta>",
  "drive_url": "<url>",
  "campos_usados": { ... },
  "created_at": "<timestamp>",
  "estado_subida": "ok | fallida",
  "estado_movida": "ok | fallida | no_aplica"
}
```

### 7.2 Manejo de errores

- Si falla el guardado en Supabase → registrar error en log interno.
- **NO bloquear** la entrega al usuario por este fallo.
- Notificar silenciosamente al equipo técnico si corresponde.

**Estados posibles:**

```
ESTADO: SUPABASE_SAVED
ESTADO: SUPABASE_FAILED → { error: "...", accion: "log_interno" }
```

---

## 🎁 ETAPA 8 — ENTREGA FINAL AL USUARIO

```
✅ ¡Tu documento está listo!

📄 [Nombre del documento]
📁 Guardado en Drive: [raíz / nombre de carpeta]
🔗 Ver en Drive: [link]

¿Necesitas algo más con este documento o quieres generar otro? 😊
```

**Estado Final:**

```
ESTADO: PROCESS_COMPLETE
```

---

## 🧠 TABLA MAESTRA DE ESTADOS

| # | Estado | Descripción | Datos Clave |
|---|--------|-------------|-------------|
| 0 | `INTENT_DETECTED` | Se detectó intención de crear documento | — |
| 1 | `DOCUMENT_SELECTED` | Tipo de documento confirmado por usuario | `document_type` |
| 2 | `DATA_COLLECTION_STARTED` | Lista de campos enviada al usuario | `campos_requeridos`, `campos_pendientes` |
| 3 | `DATA_PARTIAL` | Datos recibidos parcialmente (Escenario A) | `campos_recibidos`, `campos_pendientes` |
| 4 | `DATA_EXTRACTED` | Datos extraídos de lista completa (Escenario B) | `campos` |
| 5 | `DATA_CONFIRMED` | Usuario aprobó el resumen de datos | `campos_finales` |
| 6 | `DOCUMENT_GENERATED` | Documento `.docx` creado y validado | `file_path`, `file_name` |
| 7 | `DRIVE_DESTINATION_SET` | Destino en Drive definido por usuario | `destino_tipo`, `destino_nombre` |
| 8 | `DRIVE_UPLOAD_OK` | Archivo subido exitosamente a Drive raíz | `file_id`, `drive_url` |
| 8E | `DRIVE_UPLOAD_FAILED` | Error en subida — no continuar con movida | `error` |
| 9 | `DRIVE_MOVE_OK` | Archivo movido correctamente a carpeta | `ubicacion_final` |
| 9E | `DRIVE_MOVE_FAILED` | Error en movida — archivo queda en raíz | `error`, `ubicacion_final: raíz` |
| 10 | `SUPABASE_SAVED` | Metadata guardada en base de datos | — |
| 10E | `SUPABASE_FAILED` | Error en Supabase — no bloquear entrega | `error` |
| 11 | `PROCESS_COMPLETE` | Proceso finalizado exitosamente | — |

---

## ⚠️ REGLAS DE ORO

1. **Nunca avanzar de etapa sin estado confirmado** de la etapa anterior.

2. **La selección del documento requiere confirmación explícita** — nunca asumir por contexto.

3. **Subida y movida a Drive son operaciones separadas e independientes** — cada una debe confirmarse antes de continuar.

4. **Nunca perder el `file_id`** obtenido tras la subida; es indispensable para mover y para Supabase.

5. **Si la movida falla**, el archivo ya está en raíz — comunicarlo claramente al usuario sin bloquear el proceso.

6. **En extracción IA de datos**, nunca asumir ni inventar valores — solo campos explícitamente provistos por el usuario.

7. **Siempre mostrar resumen** antes de generar el documento, sin excepciones.

8. **Ante cualquier fallo**, mantener al usuario informado con mensaje claro y estado actual del proceso.

9. **Supabase no bloquea la entrega** — si falla, el usuario igual recibe su documento.

10. **Un error en una etapa no destruye el estado de etapas anteriores** — siempre conservar lo ya completado.

---

*Documento generado como instructivo interno para el sistema Asesor Legal.*
