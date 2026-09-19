# Asset provenance

## Current Painted Ladies environment

| Asset | Source | License / use |
|---|---|---|
| `painted-ladies/scene.glb` | [San Francisco Painted Ladies by jtressle](https://sketchfab.com/3d-models/san-francisco-painted-ladies-cf5aeb7fb0ac4152b43f72ce1dac60d6) via [AllenAI Objaverse](https://objaverse.allenai.org/docs/objaverse-1.0/) | CC BY 4.0. Original GLB unchanged; runtime rotation, scaling, positioning and selected sky fragment filtering. Retained hidden reference only. Partial frontal scan, baked lighting, 1024² distributed atlas. SOURCE.json records SHA-256 and download URL. |
| `asphalt-*.jpg` | [Asphalt 02, Poly Haven](https://polyhaven.com/a/asphalt_02) | CC0 diffuse, normal and roughness; Steiner Street surface. |
| `grass-*.jpg` | [Aerial Grass Rock, Poly Haven](https://polyhaven.com/a/aerial_grass_rock) | CC0 diffuse, normal and roughness scans. |
| `concrete-*.jpg` | [Concrete Floor Worn 001, Poly Haven](https://polyhaven.com/a/concrete_floor_worn_001) | CC0, current park-path diffuse/normal/roughness. |
| `park-tree.glb` | Derived from [Island Tree 02, Poly Haven](https://polyhaven.com/a/island_tree_02) in the existing chennai-gta workspace | CC0 source textures; custom bent-leaf geometry and baked clusters. Details in `park-tree.attribution.json`. |
| `pavement-*.jpg` | [Concrete Pavement, Poly Haven](https://polyhaven.com/a/concrete_pavement) | CC0, park-path material. |
| `daylight.hdr` | [Kloofendal 48d Partly Cloudy, Poly Haven](https://polyhaven.com/a/kloofendal_48d_partly_cloudy) | CC0 environment illumination, not a San Francisco capture. |
| Victorian houses / park path / slope / bench / planter / backpack | CORTEX authored geometry | Inferred demo placements and scale, not surveyed Alamo Square furniture. |

Screenshots are intermediate application captures. The bundled video/GIF still show the previous scene and must be regenerated after visual acceptance. Scan attribution also appears in the app provenance panel, README, deck and video metadata.

## Robot and retained earlier studies

The entries below preserve attribution for existing files from the earlier Yerba Buena scene. Those photographs and waterfall materials are **not used by the current Painted Ladies environment**.


| Asset | Source | License / changes |
|---|---|---|
| `public/assets/gardens-esplanade.jpg` | [2017 Yerba Buena Gardens](https://commons.wikimedia.org/wiki/File:2017_Yerba_Buena_Gardens.jpg), Beyond My Ken, 19 April 2017 | CC BY-SA 4.0. Original photograph retained unchanged; used only in an earlier prototype. The photograph and derived scene images/video are distributed under CC BY-SA 4.0. |
| `public/assets/yerba-buena.jpg` | [Yerba Buena Gardens, San Francisco 2023-07-14-2](https://commons.wikimedia.org/wiki/File:Yerba_Buena_Gardens,_San_Francisco_2023-07-14-2.jpg), The wub | CC BY-SA 4.0. Unmodified reference photograph, not used as a reconstruction. |
| `public/assets/paving-color.jpg`, `paving-normal.jpg` | [Concrete Floor Worn 001, Poly Haven](https://polyhaven.com/a/concrete_floor_worn_001) | CC0. Reused from the existing workspace; scan is a proxy material, not local SF capture. Tinted and tiled in the renderer. |
| `vendor/g1`, `public/assets/g1` | [Unitree RL Gym](https://github.com/unitreerobotics/unitree_rl_gym), preexisting workspace vendor copy | BSD-3-Clause; notice in `vendor/UNITREE_LICENSE`. G1 12-DoF model and STL geometry. Browser materials changed for the demo. MJCF mesh path adjusted for the portable project layout. |
| `vendor/gait.npz` | Existing workspace NumPy export of Unitree's supplied `deploy/pre_train/g1/motion.pt` | Frozen official LSTM weights. No training or claimed new locomotion research. NumPy evaluator copied from the prior Streetwise work and attributed in the source tree. |
| Plaza / bench / planter / backpack | CORTEX procedural render geometry | Newly authored, inferred dimensions. Not surveyed. |
| README / pitch / demo captures | This running application | Real simulation screenshots. Earlier photographic studies retain their CC BY-SA 4.0 attribution. No generated image is presented as a simulator output. |

The original Streetwise work remains in the separate chennai-gta workspace. CORTEX reuses its official G1 asset preparation and NumPy policy export. CORTEX's emotion mapper, safety runtime, provider adapters, new UI and presentation are new work.


## Waterfall edition

| Asset | Source | License / use |
|---|---|---|
| `waterfall-original.jpg` | [Beyond My Ken, MLK Memorial, 2017](https://commons.wikimedia.org/wiki/File:2017_Yerba_Buena_Gardens_Martin_Luther_King,_Jr._Memorial.jpg) | CC BY-SA 4.0, unmodified location reference. Used to inform geometry and the separate generated art-direction study; not sampled as a runtime material. Earlier rendered derivatives retain their CC BY-SA 4.0 attribution. |
| `waterfall-plate.png` | Built-in image-generation tool, based on the above reference | AI-assisted art-direction study; empty foreground extended and people removed. Distributed under CC BY-SA 4.0. **Not used as the running scene background.** Prompt in `IMAGE_PROMPT.md`. |
| `slab-*.jpg` | [Granite Tile 03, Poly Haven](https://polyhaven.com/a/granite_tile_03) | CC0 diffuse, normal and roughness scans; All three scans texture the gray slabs, with UVs restricted to a tile interior to exclude photographed grout. |
| `granite-*.jpg` | [Granite Wall, Poly Haven](https://polyhaven.com/a/granite_wall) | CC0, unused initial material study. |
| `pavement-*.jpg` | [Concrete Pavement, Poly Haven](https://polyhaven.com/a/concrete_pavement) | CC0, tiled foreground material. |
| `daylight.hdr` | [Kloofendal 48d Partly Cloudy, Poly Haven](https://polyhaven.com/a/kloofendal_48d_partly_cloudy) | CC0, lighting and sky reference; not captured at Yerba Buena. |
| `water-normal.jpg` | [Three.js examples](https://github.com/mrdoob/three.js/blob/dev/examples/textures/waternormals.jpg) | Three.js MIT license; normal texture for planar reflecting water. |
| Earlier waterfall geometry | Previous Git revision | Superseded by the Painted Ladies scene. |

The generated waterfall plate is retained only as an archived art-direction study.

## Architectural material refinement

`public/assets/architecture` contains 2K CC0 diffuse, OpenGL normal and roughness scans from [Blue Painted Planks](https://polyhaven.com/a/blue_painted_planks) and [Roof Slates 03](https://polyhaven.com/a/roof_slates_03). SOURCE.json records download URLs and hashes. Runtime siding pigment is remapped to the authored pastel palette; metric UVs preserve material scale. These are material proxies, not captures of the actual Painted Ladies.

## DataSF neighborhood context

`public/assets/neighborhood/buildings.json` derives from the [City and County of San Francisco building footprints](https://catalog.data.gov/dataset/building-footprints-file-geodatabase-format), licensed [PDDL 1.0](https://opendatacommons.org/licenses/pddl/1-0/). The [published ArcGIS layer](https://services5.arcgis.com/wXYNaciObHUosEnt/ArcGIS/rest/services/Rooftop_Solar_Power_Potential_San_Francisco_WFL1/FeatureServer/9) supplies the queried geometry and documented elevation fields. Credit: San Francisco Open Data Program, Enterprise GIS Program, Department of Environment and Department of Technology.

SOURCE.json preserves the query, source feature count, output checksum, units and limitations. 362 queried footprints become 355 background buildings plus seven elevation references for the authored row. Local coordinate rotation/translation, extrusion, window treatment and terrain interpolation are CORTEX transformations; they do not recover actual façade appearance or roof geometry.

`daylight.SOURCE.json` records the original 2K Poly Haven HDR download and hash. No source bitmap edits were made.
