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
