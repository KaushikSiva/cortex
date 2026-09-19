# Painted Ladies scene status

The default scene uses authored, full-depth Victorian architecture. It no longer presents the partial photographed façade scan as the environment. Seven modeled houses have roofs, side/rear walls, projecting polygonal bays, sash frames, window recesses, stoops, rails, chimneys, clapboard overlap and ornament. Their dimensions and placement are inferred; they are not a surveyed reconstruction.

The park uses scanned CC0 surface materials, bent-leaf trees, a sloped lawn, modeled furniture, and separate MuJoCo collision geometry. A solar-separated HDR lights the robot and authored buildings consistently; the sky is an illustrative lighting asset, not a San Francisco capture. The renderer adds contact occlusion, filtered shadows and antialiasing.

The older jtressle CC BY 4.0 photogrammetry asset remains available as reference, hidden by default. It has partial coverage, a low-resolution distributed atlas and baked lighting. It did not meet the user's realism requirement.

**Acceptance remains open:** the current authored buildings are visibly computer rendered. Full geometric depth and working camera parallax do not establish photorealism. A complete, high-resolution capture or licensed model with broad view coverage is still needed to achieve the requested digital-twin appearance. Do not describe the current render as indistinguishable from reality.

Controls: the hero view is at 1.65 m with a 60° lens. The 60° button switches to an angled inspection view; drag to inspect depth. R returns to the presentation view. Robot motion remains confined to the collision-checked foreground path.

Material pass: 2K CC0 scanned siding/slate normal and roughness maps, metric UVs, dielectric glass, arched entries and turned posts. The postprocessing target now uses multisample antialiasing as well as SMAA. The scene still has approximate massing and visibly rendered materials; the acceptance gap above is unchanged.

## Public-data neighborhood pass

The surrounding scene now extrudes 355 DataSF building footprints at their published median heights and local ground elevations. Seven hero-building ground elevations also replace the earlier reversed, nearly flat row. The street and verge follow an inferred grade between these elevations. The alignment of this geographic data to the authored demonstration apron is approximate, and neither these footprints nor the terrain change MuJoCo collision geometry.

Source geometry is the City’s 2010-era building dataset, published under PDDL 1.0. Background façade colors, windows, flat roofs, and interpolated ground remain authored approximations. The data is useful for spatial context, not evidence of a photoreal or current reconstruction. The source, exact query, conversion notes and checksum are in `public/assets/neighborhood/SOURCE.json`; reproduce with `python3 scripts/build-sf-context.py`.

The sky HDR is now 2048 × 1024, replacing the 1024 × 512 source. It remains the same CC0 illustrative lighting asset, not an Alamo Square capture. Camera clipping/fog distances extend to include the surrounding neighborhood.

The narrated demo video retains its previous scene revision. Photoreal acceptance remains unmet: repeated hero façades and simplified neighboring buildings are plainly visible in the render.

## Architectural depth and contact pass

The corner house now has a hipped roof, while the other houses have differentiated gable geometry, ornament and palette. Glazing uses dielectric transmission and a filtered static 256 px cubemap captured from the scene; curtains, shades and dark room recesses vary between windows. A single probe cannot reproduce correct reflections from every pane, and screen-space contact shading is not full indirect-light transport.

Nearby DataSF footprint extrusions now have authored window surrounds, cornices, floor bands and foundation courses. Grass roots and tree planting use the same elevation function as the lawn; this fixes vegetation floating above or buried under the previous grade. Three original CC0 hatchback models supply road scale and contact shadows. Their source metadata is beside the GLB; their placement is illustrative, not observed SF vehicle positions.

The reference-only photograph used to inspect roof forms and colors is [John O’Neill / jjron’s Painted Ladies photograph](https://commons.wikimedia.org/wiki/File:Alamo_Sq_Painted_Ladies_2,_SF,_CA,_jjron_26.03.2012.jpg), under GFDL 1.2. No photograph pixels or copy of that image are shipped in this refinement. The original jtressle scan download API requires an authenticated Sketchfab account; its higher-resolution original has not been obtained.

`public/media/scene-detail-study.png` records this pass from the 60° view. The older demo video remains unchanged. Browser captures had no page/WebGL errors; TypeScript and production build pass. **Photoreal acceptance remains unmet.**

## Robot telemetry and ground placement

MuJoCo's collision ground is z=0; the rendered paving is z=-0.006 m. Robot meshes are now hidden until a valid 19-value qpos arrives and hidden again on telemetry loss. This removes the default URDF-at-origin view that buried the legs while connecting. Quaternion interpolation now uses spherical interpolation.

A second operator tab retains read-only HTTP telemetry after its control socket is rejected. It shows VIEW ONLY rather than a false controller-offline state; movement controls stay disabled. The browser regression (`node scripts/test-scene-telemetry.mjs`) checks unavailable → available → unavailable telemetry, the rejected-tab display, and visual ground alignment against a real MuJoCo pose. Its measurements and scope are in `scene-telemetry-results.json`.
