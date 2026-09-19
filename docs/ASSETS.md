# Asset provenance

| Asset | Source | License / changes |
|---|---|---|
| `public/assets/gardens-esplanade.jpg` | [2017 Yerba Buena Gardens](https://commons.wikimedia.org/wiki/File:2017_Yerba_Buena_Gardens.jpg), Beyond My Ken, 19 April 2017 | CC BY-SA 4.0. Original photograph stored unchanged; cropped/stretched by the visual background renderer. The photograph and derived scene images/video are distributed under CC BY-SA 4.0. |
| `public/assets/yerba-buena.jpg` | [Yerba Buena Gardens, San Francisco 2023-07-14-2](https://commons.wikimedia.org/wiki/File:Yerba_Buena_Gardens,_San_Francisco_2023-07-14-2.jpg), The wub | CC BY-SA 4.0. Unmodified reference photograph, not used as a reconstruction. |
| `public/assets/paving-color.jpg`, `paving-normal.jpg` | [Concrete Floor Worn 001, Poly Haven](https://polyhaven.com/a/concrete_floor_worn_001) | CC0. Reused from the existing workspace; scan is a proxy material, not local SF capture. Tinted and tiled in the renderer. |
| `vendor/g1`, `public/assets/g1` | [Unitree RL Gym](https://github.com/unitreerobotics/unitree_rl_gym), preexisting workspace vendor copy | BSD-3-Clause; notice in `vendor/UNITREE_LICENSE`. G1 12-DoF model and STL geometry. Browser materials changed for the demo. MJCF mesh path adjusted for the portable project layout. |
| `vendor/gait.npz` | Existing workspace NumPy export of Unitree's supplied `deploy/pre_train/g1/motion.pt` | Frozen official LSTM weights. No training or claimed new locomotion research. NumPy evaluator copied from the prior Streetwise work and attributed in the source tree. |
| Plaza / bench / planter / backpack | CORTEX procedural render geometry | Newly authored, inferred dimensions. Not surveyed. |
| README / pitch / demo captures | This running application | Real simulation screenshots with CC BY-SA 4.0 photographic background attribution. No generated image is presented as a simulator output. |

The original Streetwise work remains in the separate chennai-gta workspace. CORTEX reuses its official G1 asset preparation and NumPy policy export. CORTEX's emotion mapper, safety runtime, provider adapters, new UI and presentation are new work.


## Waterfall edition

| Asset | Source | License / use |
|---|---|---|
| `waterfall-original.jpg` | [Beyond My Ken, MLK Memorial, 2017](https://commons.wikimedia.org/wiki/File:2017_Yerba_Buena_Gardens_Martin_Luther_King,_Jr._Memorial.jpg) | CC BY-SA 4.0, unmodified location reference. A UV-selected stone region textures the 3D granite; rendered derivatives carry the same attribution and CC BY-SA 4.0 license. |
| `waterfall-plate.png` | Built-in image-generation tool, based on the above reference | AI-assisted art-direction study; empty foreground extended and people removed. Distributed under CC BY-SA 4.0. **Not used as the running scene background.** Prompt in `IMAGE_PROMPT.md`. |
| `slab-*.jpg` | [Granite Tile 03, Poly Haven](https://polyhaven.com/a/granite_tile_03) | CC0 diffuse, normal and roughness scans; Normal/roughness scans support the gray slabs; the diffuse scan is retained as an alternate material. |
| `granite-*.jpg` | [Granite Wall, Poly Haven](https://polyhaven.com/a/granite_wall) | CC0, unused initial material study. |
| `pavement-*.jpg` | [Concrete Pavement, Poly Haven](https://polyhaven.com/a/concrete_pavement) | CC0, tiled foreground material. |
| `daylight.hdr` | [Kloofendal 48d Partly Cloudy, Poly Haven](https://polyhaven.com/a/kloofendal_48d_partly_cloudy) | CC0, lighting and sky reference; not captured at Yerba Buena. |
| `water-normal.jpg` | [Three.js examples](https://github.com/mrdoob/three.js/blob/dev/examples/textures/waternormals.jpg) | Three.js MIT license; normal texture for planar reflecting water. |
| Waterfall scene meshes, particles and flow shader | Authored in `src/scene/waterfall.ts` | Reference-informed dimensions, not surveyed reconstruction. |

Updated screenshots and film are direct captures of the full 3D application. They do not use the generated plate as a background. The scene still needs an independent photorealism acceptance review.
