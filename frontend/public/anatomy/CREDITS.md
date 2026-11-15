# Créditos del modelo anatómico

`body.glb` se generó a partir de **BodyParts3D 4.0** (paquete `partof_BP3D_4.0_obj_99`).

> "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International"

- Licencia: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html
- Descarga: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html

Cambios hechos al original:
- Las piezas se agruparon por sistema: piel, corazón, pulmones, cerebro, esqueleto, arterias y venas.
- El modelo se pasó a metros con el eje Y hacia arriba.
- Se simplificó al 12 % de los triángulos y se comprimió con meshopt.

# Cabeza anatómica (`head.glb`)

Modelo generado con **Tripo AI** y aportado por el equipo para el HUD de `/vision`
(sujeto sintético cuando no se usa la webcam). Malla única comprimida con meshopt
(`gltfpack`); sin blendshapes ni esqueleto. En código se gira -90° en Y para que mire a la cámara.
