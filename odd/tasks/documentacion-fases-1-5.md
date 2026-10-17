# Documentación de las primeras cinco fases

## Objetivo y alcance autorizado

Preparar en español los 24 documentos independientes del listado facilitado por el usuario para CastleWalk Tickets, junto con los recursos visuales de diseño y el prototipo navegable. La fase 6 queda fuera del alcance. No se modifica el comportamiento de la aplicación ni se publica información en servicios externos.

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
