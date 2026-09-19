# Painted Ladies / Alamo Square: scene coverage and capture

The default environment is an authored, full-depth Painted Ladies architectural study. It has actual side/rear walls, roofs, projecting bays and recessed windows. The former jtressle CC BY 4.0 partial photogrammetric shell is retained only as hidden reference; its original binary and attribution remain bundled. See [current scene status](SCENE_STATUS.md). No complete location reconstruction is available yet.

Six targets remain on the flat demonstration path. The park foreground, furniture and scale are authored approximations, not surveyed SF positions. The robot cannot navigate across Steiner Street.

## Capture a small, navigable patch

Use a 10–20 m section of the Alamo Square park path facing the Painted Ladies, away from busy foot traffic. Capture 2–4 minutes of steady smartphone video: a slow outer loop, a crossing loop, and close passes around the planter and bench. Lock exposure and white balance, avoid digital zoom and blur, overlap heavily, and include several views of every collision boundary. No LiDAR is required. Measure at least two distances between visible ground markers so reconstruction scale is recoverable.

Keep original videos, capture time, camera settings, and a contact sheet. Choose three non-collinear ground anchors for registration: HOME origin, a measured axis point, and a third ground-plane point. Do not use a single distant photo to claim depth reconstruction.

## Reconstruction

On a compatible GPU workstation with Nerfstudio/COLMAP installed:

```sh
ns-process-data video --data capture/alamo-square.mp4 --output-dir capture/processed
ns-train splatfacto --data capture/processed
ns-export gaussian-splat --load-config outputs/REPLACE_WITH_RUN/config.yml --output-dir capture/export
```

These are the documented [custom video processing](https://docs.nerf.studio/quickstart/custom_dataset.html) and [Splatfacto training/export](https://docs.nerf.studio/nerfology/methods/splat.html) steps. No reconstruction command has run here because no overlapping capture dataset is present. Splat training reconstructs the scene; it does not train robot locomotion.

## Appearance and collisions are separate

Store the world-from-reconstruction similarity transform (scale, rotation, translation) with the capture manifest. Apply the same alignment to render assets and invisible collision meshes. Ground, curb, planter, bench and wall must have simplified MuJoCo geometry. Splats are visual only. Existing collisions are in `robot/scene.xml`; render placement is in `src/scene/paintedLadies.ts`.

The optional Spark loader (`src/scene/reconstruction.ts`) accepts a locally hosted Gaussian PLY plus a transform manifest after capture. It never uses the splat as collision geometry. Configure the manifest and verify its three anchors before enabling it. No splat asset is bundled or tested as an Alamo Square Gaussian reconstruction.

## Camera / realism review

The browser camera is at 1.65 m, 60° vertical field of view, with a fixed phone-like viewpoint. Confirm robot scale against measured ground anchors. Match sun direction and white balance, check planted feet and contact shadows, and record approach/turn/stop from the same camera. Do not use an orbital camera for the hero shot.

Run the user's two-second blind screenshot test only after the real reconstruction is installed. Record participant responses and the exact screenshot. The current scene is an authored architectural approximation; acceptance Test B has not passed.

A manifest template is in `reconstruction-manifest.example.json`. Leave `anchorsVerified` false until the measured scale, ground plane, three anchors, robot foot contact and collision placements have been checked. The loader rejects an unverified manifest. Copy the checked manifest into `public/assets/`, set `NEXT_PUBLIC_SPLAT_MANIFEST=/assets/your-manifest.json`, and rebuild. Spark API reference: [SplatMesh](https://sparkjs.dev/docs/splat-mesh/) and [SparkRenderer](https://sparkjs.dev/docs/spark-renderer/), pinned package 2.2.0.
