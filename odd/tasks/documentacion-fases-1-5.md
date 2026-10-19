# Documentación de las primeras cinco fases

## Objetivo y alcance autorizado

Preparar en español los 24 documentos independientes del listado facilitado por el usuario para CastleWalk Tickets, junto con los recursos visuales de diseño y el prototipo navegable. La fase 6 queda fuera del alcance. No se modifica el comportamiento de la aplicación ni se publica información en servicios externos.

Ampliación autorizada y ajustada por el usuario: consolidar la entrega en **un solo documento** del proyecto de Administración Informática, basado en las guías docentes de OneDrive, con PETI y los apartados académicos faltantes. Esta instrucción sustituye la actualización individual de los 24 documentos. La entrega anterior se conserva como antecedente histórico y no se vuelve a presentar como 24 entregables actuales.

## Base y restricciones

- Fecha de referencia: 17 de octubre de 2026.
- Exploración de solo lectura completada sobre el código y la documentación del repositorio.
- Conservar los cinco archivos de aplicación que ya tenían modificaciones.
- Separar capacidades observadas, requisitos propuestos y campos pendientes de negociación o aprobación.
- No inventar entrevistas, firmas, ejecución de pruebas, cotizaciones aprobadas ni indicadores medidos.
- Registro de habilidades de proyecto y Engram no disponibles; espejo `odd/documentacion-fases-1-5/tasks` pendiente.
- RDD desactivado por preferencia global; no iniciar revisiones RDD.
- La documentación de referencia de la aplicación está en inglés; los entregables solicitados se redactan en español profesional.

## Plan y ruta

- [x] DOC-01 Elaborar y verificar los 24 documentos independientes, organizados en cinco fases, con índice, recursos de UI y paquete descargable.
  - Ruta: delegada directa con un único autor.
  - Motivo: investigación previa y autoría de múltiples documentos relacionados.
  - Aceptación: 4 documentos de fase 1, 6 de fase 2, 7 de fase 3, 3 de fase 4 y 4 de fase 5; requisitos, casos de prueba y UAT vinculados; documentos comerciales y actas pendientes de completar y firmar.
  - Verificación: integridad y lectura de cada DOCX; renderizado e inspección visual de todas las páginas; consistencia de identificadores y enlaces; ausencia de secretos; integridad del ZIP; revisión independiente y comprobación puntual del coordinador.
  - Excepción a RED/GREEN: entregables documentales sin cambios de comportamiento; no procede ejecutar pruebas funcionales del producto ni afirmar que fueron superadas.

- [x] DOC-02 Consolidar el proyecto académico y el PETI en un único Word conforme a las guías del profesor.
  - Ruta: delegada directa, un único autor y verificación independiente.
  - Motivo: integración de múltiples fuentes docentes y reorganización sustantiva del contenido técnico, estratégico y administrativo.
  - Entregable: `docs/administracion-informatica/proyecto-administracion-informatica-castlewalk-tickets.docx`.
  - Alcance: objetivos general y específicos; diagnóstico institucional y FODA; capacidades y brechas; organización y gestión de personal; políticas y controles; alternativas y adquisiciones; arquitectura y requisitos esenciales; PETI con 22 apartados docentes, seis objetivos estratégicos y seis proyectos; presupuesto, indicadores, ITIL/COBIT, calidad, continuidad, auditoría documental y matriz de correspondencia con la guía.
  - Restricciones: conservar los 24 Word anteriores, el prototipo y las fuentes docentes; no alterar la aplicación, inventar evidencia de campo, aprobar contratos ni ejecutar controles productivos. Unificar contenido sin duplicar presupuestos ni confundir contratos de personal y servicios.
  - Verificación: cobertura de las guías y fuentes con páginas o secciones; trazabilidad de objetivos, proyectos, recursos, indicadores y evidencias; presupuesto conciliado; integridad y lectura del DOCX; renderizado e inspección de todas las páginas; índice con un único entregable principal; comprobación independiente y puntual del coordinador.
  - Excepción a RED/GREEN: consolidación documental sin cambios funcionales; los procedimientos de prueba y controles pendientes se identifican como tales.
  - Fuentes rectoras: guías de proyecto y diagnóstico de `GUIAS ESTUDIANTES`; materiales SEM11 PETI, SEM9 recursos humanos, SEM10 presupuesto y SEM6 políticas/controles. La rúbrica SEM6 corresponde a esa práctica y exige evidencias de implementación; no es una rúbrica universal del PETI.
  - Supuestos por validar: institución cliente, misión/visión institucionales, inventario físico y personal reales, resultados operativos, presupuesto aprobado y firmas. Horizonte relativo de cinco años propuesto por adaptación del ejemplo de clase; no atribuirlo a una obligación general del profesor.

## Estrategia y avance

Una entrega documental local. Los archivos Word y los paquetes comprimidos son artefactos generados; no se propone una cadena de PR. El alcance no incluye publicar, enviar a terceros ni crear PR.

Entrega documental verificada y lista para revisión del cliente. Próximo paso del cliente: completar partes, importes definitivos, T0 y responsables; ejecutar las pruebas del producto y formalizar las aprobaciones cuando corresponda.

## Evidencia

Autoría completada por el ejecutor documental. Se generaron 24 DOCX independientes en `docs/fases-1-5/`, distribuidos 4 + 6 + 7 + 3 + 4, con 77 páginas finales. Incluyen arquitectura y DER renderizados, cuatro wireframes, cuatro mockups y diccionario de las ocho entidades; el prototipo HTML funciona localmente con datos ficticios.

- Índice final: `docs/fases-1-5/index.html`.
- Prototipo final: `docs/fases-1-5/prototipo/index.html`.
- Paquete final: `docs/fases-1-5/CastleWalk_Tickets_Fases_1_a_5.zip`, con 26 entradas finales y sin recursos de producción o QA.
- Trazabilidad: 18 FR, 8 NFR, 20 HU, 30 TC y 12 UAT; las 26 filas de requisitos tienen historia, prueba y UAT vinculados.
- Verificación estructural: `/Users/johan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 docs/fases-1-5/.produccion/empacar_verificar.py --check-only` devuelve 24 documentos legibles, ZIP íntegro, enlaces locales válidos y correspondencia exacta entre archivos y paquete.
- Renderizado: `render_docx.py` del runtime empaquetado produjo PNG para cada página de los 24 DOCX. Todas las 77 páginas finales se abrieron individualmente con `tools.view_image`; se corrigieron bordes heredados del título, texto huérfano, etiquetas de diagramas y anchura de RACI. Registro detallado en `.produccion/visual_record.json`.
- Prototipo: `/Users/johan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node docs/fases-1-5/.produccion/probar_prototipo.cjs` superó 15 comprobaciones de flujo, sin errores de consola ni solicitudes de red, con contexto de navegador nuevo y verificación de ancho móvil. No se ejecutaron pruebas de la aplicación.
- La descarga del ZIP desde el índice extraído requiere conservar el ZIP original junto al índice; las 24 piezas y el prototipo conservan enlaces relativos portables.
- Partes, jurisdicción, precios finales, T0, responsables identificados, resultados de ejecución y firmas permanecen pendientes; objetivos y cotización ilustrativos se distinguen de evidencia observada.

La comprobación puntual del coordinador repitió `empacar_verificar.py --check-only`: salida 0, 24 DOCX, 77 páginas, 26 entradas en ZIP y coincidencia exacta del paquete con los originales. También se abrió la primera página renderizada del SRS, con tabla y texto legibles.

La evaluación automática de riesgo no pudo clasificar los archivos nuevos sin un inventario declarado y devolvió `high / unassessable`. Se mantiene el nivel conservador y se realiza verificación independiente. RDD continúa desactivado; no se inició su ciclo ni se cambió esa preferencia.

Pendiente de revisión independiente antes de cerrar DOC-01. No se efectuaron commits por el ejecutor ni cambios en código de aplicación. El espejo de Engram permanece pendiente por falta de herramientas disponibles.

## Corrección documental acotada tras revisión independiente

- Se actualizaron únicamente F3-01 SRS, F3-02 backlog y F5-02 casos y RTM. HU-03 y TC-03 distinguen administración de áreas por ADMIN de membresías y permisos por ADMIN o líder del área, incluso sin membresía propia. HU-05, HU-07, HU-09 y HU-15 nombran los actores, relaciones y condiciones que antes tenían referencias ambiguas. FR-03 prohíbe explícitamente el padre propio y el borrado de áreas con tickets o hijas; FR-09 y TC-10 incluyen liderazgo sin membresía para estados distintos de cierre y cancelación.
- Generación selectiva: `/Users/johan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 docs/fases-1-5/.produccion/crear_documentos.py --only F3-01 F3-02 F5-02`; salida 0, exactamente tres DOCX escritos. No se volvió a ejecutar el marcador de autoría.
- Los tres documentos se renderizaron nuevamente con el `render_docx.py` y LibreOffice empaquetados. Se inspeccionaron individualmente sus 18 páginas nuevas, 5 + 5 + 8, sin defectos visuales observados. El conjunto conserva 77 páginas; `.produccion/visual_record.json` registra esta revisión.
- `/Users/johan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 docs/fases-1-5/.produccion/verificar_correccion.py` devolvió `passed`: comparación SHA-256 de 21 DOCX no corregidos y el prototipo confirma bytes idénticos. El prototipo no se modificó, por lo que se conserva su verificación anterior sin repetirla.
- Se reconstruyeron índice y ZIP; `empacar_verificar.py --check-only` terminó con salida 0: 24 DOCX, 77 páginas, 26 entradas finales, trazabilidad y coincidencia exacta del paquete con los originales. Se conservó `.gitignore` sin cambios.
- No corresponde RED/GREEN del producto para correcciones de prosa. No se ejecutaron pruebas de aplicación, accesos remotos ni commits. DOC-01 permanece abierto hasta lectura independiente de las tres correcciones y cierre del coordinador.

## Cierre verificado

- La lectura independiente de las tres piezas corregidas confirmó que todos sus hallazgos quedaron resueltos, sin observaciones pendientes. Se conservan los resultados independientes anteriores del resto de la documentación y del prototipo.
- El coordinador repitió la comprobación final del paquete: salida 0, 24 DOCX, 77 páginas, 26 archivos dentro del ZIP de 1.519.128 bytes. Cobertura final de 18 FR, 8 NFR, 20 HU, 30 TC y 12 UAT.
- La verificación independiente adicional comprobó entradas maliciosas como texto, liderazgo sin membresía, cambios de estado permitidos, límites de cierre y reinicio del prototipo, con cero errores de consola y cero solicitudes de red. No acredita pruebas de la aplicación real.
- Los cinco archivos de aplicación modificados antes de este trabajo quedan fuera de la entrega y de sus commits. Las herramientas y los renders locales de QA están excluidos del control de versiones mediante `docs/fases-1-5/.gitignore`.
- RDD permanece desactivado. El espejo Engram está pendiente por indisponibilidad de sus herramientas; el documento local conserva íntegro el avance.

Unidad documental guardada en el commit `af5781cda4dba92abf9ae768be5ad88cfbcc7777` de la rama `codex/documentacion-fases-1-5`.

La evaluación final sobre ese rango comprometido, desde `eab6caceb41128ea87bf12ef08d7174e0d73cfa3`, terminó con salida 0: riesgo `medium`, 29 rutas y 121 líneas, `review_due: false`, motivo `under_budget`. Esta evaluación resuelve la indisponibilidad inicial por archivos sin seguimiento. RDD sigue desactivado y la verificación independiente documental está completa.

La comparación SHA-256 del coordinador confirmó que los cinco archivos de aplicación previamente modificados conservaron exactamente sus bytes. Se guardaron únicamente documentos y seguimiento local, sin publicación ni operaciones remotas.

## Consolidación académica

Objetivo general acordado en la conversación: diseñar una propuesta de Administración Informática para CastleWalk Tickets, sustentada en el diagnóstico del proyecto y las guías del profesor, que alinee la gestión tecnológica con la atención eficiente, segura y trazable de las solicitudes internas.

Objetivos específicos: diagnosticar capacidades y brechas; definir organización TI, responsabilidades y controles; formular PETI con cartera y recursos; especificar y evaluar la solución; establecer calidad, seguridad, continuidad y aceptación; evaluar centralización, trazabilidad y esfuerzo de seguimiento durante el piloto.

Se reutilizará la base documental y técnica válida, sin multiplicar entregables. Las cifras ilustrativas de USD 11.040 iniciales y USD 3.840 anuales deben conciliarse sin doble contabilización; las metas 90 por ciento de centralización, 95 por ciento de trazabilidad y 20 por ciento menos seguimiento son propuestas sujetas a línea base y aprobación.

Previsión: un Word generado, un índice existente actualizado y seguimiento local. Los artefactos Word se excluyen del umbral orientativo de líneas; no se propone una cadena de PR. Engram continúa no disponible y su espejo permanece pendiente.

DOC-02 consolidado y verificado. Próximo paso académico: completar y validar los datos institucionales y las evidencias operativas pendientes antes de solicitar aprobación docente. DOC-01 conserva su cierre histórico.

## DOC 02 Autoría y autoverificación de la consolidación

- Se elaboró un único Word actual, `docs/administracion-informatica/proyecto-administracion-informatica-castlewalk-tickets.docx`, versión 2.0 del 17 de octubre de 2026. Tiene 50 páginas finales, 30 de cuerpo integrado y 20 de anexos, con 22 capítulos PETI y cuatro anexos dentro del mismo archivo. La extensión conserva legibilidad y trazabilidad sin multiplicar entregables.
- El objetivo general y los seis objetivos específicos académicos coinciden literalmente con los comunicados al usuario. Se distinguen AE-01 a AE-06 de los seis objetivos estratégicos OE, seis proyectos P y seis KPI. Incluye diagnóstico, FODA, inventario pendiente, brechas, alternativas ponderadas, perfiles y balance de personal, selección y evaluación con pesos del 100%, presupuesto, adquisiciones, políticas, controles, ITIL/COBIT proporcional, auditoría documental y runbooks propuestos.
- Se leyeron las dos guías DOCX de `GUIAS ESTUDIANTES` y los apartados pertinentes de seis PDF: SEM11 PETI pp. 2, 5–15 y 19–21; soporte PETI pp. 5–10; SEM9 personal pp. 5, 8, 13–14 y evaluación/contratación pp. 3–6 y 12; SEM10 presupuesto pp. 14 y 19–20; SEM6 controles pp. 10, 15, 18 y 20–23. El catálogo F01–F08/R01–R04 y la matriz docente están en el anexo D. Se registra el límite de la guía inferior anunciada pero ausente al final de F01; no se inventa su contenido.
- El presupuesto concilia 320 horas × USD 30 = USD 9.600, reserva común del 15% = USD 1.440, total inicial USD 11.040; infraestructura USD 960/año y soporte USD 2.880/año producen USD 3.840 recurrentes. Año 1 USD 14.880 y cinco años USD 30.240. Las distribuciones por rol y proyecto representan el mismo esfuerzo; futuras expansiones y equipos sin inventario quedan fuera del total y sin financiamiento supuesto.
- Los anexos conservan 18 FR, 8 NFR, 20 HU, 30 TC y 12 UAT. Las 26 filas de la RTM tienen historia, prueba, UAT y vínculo PETI; el diccionario contiene ocho entidades y 55 campos. Arquitectura, organigrama, DER, wireframe y mockup están incrustados en el Word. El contenido navega mediante 26 enlaces internos reales a capítulos y anexos.
- El índice `docs/fases-1-5/index.html` ofrece un único documento principal; los 24 Word, ZIP y prototipo previos permanecen bajo una sección histórica colapsada. Los 27 enlaces locales tienen destinos existentes. No se creó un PDF o ZIP de entrega nuevo; el PDF y las imágenes de render son solo material interno de QA excluido mediante `docs/administracion-informatica/.gitignore`.
- Generación: `/Users/johan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 docs/administracion-informatica/.produccion/crear_informe.py`; salida 0, un DOCX, 63 tablas y cinco imágenes incrustadas. Se ejecutó una sola vez el marcador del runtime para esta nueva operación de creación de un DOCX.
- Render final: `/Users/johan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 /Users/johan/.cache/codex-runtimes/codex-primary-runtime/plugins/openai-primary-runtime/plugins/documents/skills/documents/render_docx.py docs/administracion-informatica/proyecto-administracion-informatica-castlewalk-tickets.docx --output_dir docs/administracion-informatica/.produccion/render-final --emit_pdf`; salida 0 con 50 páginas finales. Se utilizó exclusivamente LibreOffice empaquetado. Las 50 imágenes se abrieron individualmente a resolución legible con `tools.view_image`; sin recortes, solapamientos ni páginas vacías observados. `.produccion/visual_record.json` registra páginas y hashes del Word/PNG. Se corrigieron saltos y continuidad de diccionario/UI antes de esa inspección final.
- Comprobación estable para el coordinador y revisión independiente: `/Users/johan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 docs/administracion-informatica/.produccion/verificar_informe.py --check-only`; salida 0, `passed`, 50 páginas, objetivos literales, cobertura de identificadores y RTM, ocho entidades/55 campos, 24 antecedentes mapeados, 12 entradas de fuentes, enlaces internos/locales, aritmética y pesos, estilos y ausencia de rutas privadas o patrones sensibles comprobados.
- La comparación SHA-256 confirma bytes idénticos en 31 archivos protegidos: los 24 Word anteriores, el ZIP histórico, el prototipo y los cinco archivos de aplicación previamente modificados. El prototipo no cambió ni se repitieron sus pruebas. No se ejecutaron pruebas/build de la aplicación, instalaciones, operaciones remotas ni commits por el autor.
- Pendientes reales: institución destinataria y personas, misión/visión reales, inventario físico y licencias, demanda y carga, línea base, presupuesto/fondos, marco de contratación, aprobaciones, firmas y ejecución de pruebas/controles. La rúbrica SEM6 se identifica como específica de esa práctica; no se acredita implementación mediante este informe.
- Habilidades cargadas por rutas exactas: documents, pdf y design-kpis, con instrucciones compartidas de Data; `skill_resolution: paths-injected`. Registro de habilidades de proyecto y Engram no disponibles; espejo pendiente.

## DOC 02 Cierre verificado

- La revisión independiente leyó el informe completo y sus tablas, contrastó las guías y fuentes docentes ya verificadas y terminó sin hallazgos materiales pendientes. Comprobó visualmente las páginas 4, 19, 21, 26, 48, 49 y 50, con objetivos, presupuesto, KPI, controles y matrices legibles.
- El coordinador repitió `verificar_informe.py --check-only`, con salida 0 y estado `passed`, y abrió la primera página renderizada sin defectos observados. Se confirman 50 páginas, 22 capítulos, seis objetivos académicos literales, seis objetivos estratégicos/proyectos/KPI, 26 requisitos trazados y 31 archivos protegidos intactos.
- La comparación SHA-256 adicional del coordinador confirmó que los cinco archivos de aplicación conservaron exactamente los bytes del inicio de DOC-02. No se ejecutaron pruebas funcionales del producto porque no hubo cambios de aplicación; los resultados de campo y aprobaciones siguen pendientes, explícitos en el informe.
- La entrega actual es un único Word; no se crearon nuevos PDF o ZIP de entrega. El índice señala la versión actual y mantiene el material anterior como histórico.
- RDD permanece desactivado por decisión global. El espejo de Engram sigue pendiente por falta de herramientas disponibles, con avance y evidencia íntegros en este archivo local.

Unidad DOC-02 guardada en el commit `02d92a626935fc0ded6c8bdba3d9c4999e1a14eb` de `codex/documentacion-fases-1-5`.

La evaluación sobre ese rango comprometido, desde `0ed08d553c5974e5b3dccb66ddb4a815d96550d3`, finalizó con salida 0: riesgo `medium`, cuatro rutas, 53 líneas, `review_due: false` y motivo `under_budget`. La autoverificación y la revisión independiente de DOC-02 están completas; RDD permanece desactivado y no se inició ningún ciclo de revisión nativa.
