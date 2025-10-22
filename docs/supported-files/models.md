# Models

Dragging and dropping a `glb` model directly into a world will convert it into an "App" with no script or config attached to it.

For the purposes of these docs, we will assume you are using Blender to author 3D models and export them to GLTF-Binary (glb) files to use in your world.

## Naming Conventions

The names of your objects will be used as the ID's for nodes when using the scripting API.

It's recommended to use UpperCamelCase for all blender object names, as the GLTF exporter will replace things like spaces with other characters, making it harder to find your meshes/nodes when writing scripts in-world.

## Duplicate Linked

When using the same mesh multiple times inside a single model, be sure to use the Duplicate Linked (Option + D) option so that the objects share the same underlying mesh.

This not only reduces the file size of your model, but our engine is able to better optimize and automatically instance those meshes together in a single draw-call for huge performance.

## Instanced Skinned Meshes

- Skinned primitives authored with the `EXT_mesh_gpu_instancing` extension are supported when the `ENABLE_INSTANCED_SKINNING` feature flag is enabled. Set `ENABLE_INSTANCED_SKINNING=true` (or the public equivalent) in the environment to toggle the loader path. 【F:src/core/constants/featureFlags.js†L1-L18】【F:src/core/libs/gltfloader/GLTFLoader.js†L1-L79】
- With the flag active the loader clones the armature per instance while reusing the original geometry and base material, ensuring bone matrices remain isolated without duplicating buffers. Per-instance colour attributes (`_COLOR_0`) trigger a lightweight material clone so author palettes continue to render correctly. 【F:src/core/libs/gltfloader/GLTFLoader.js†L1718-L1823】
- When the flag is disabled the loader falls back to a single skinned mesh so you can profile baseline costs before opting into instancing. Use this mode to validate animation budgets or when targeting platforms that cannot afford the additional skeleton updates.

## LODs

- Add a custom property named `node` with the value `lod` on an Empty or collection root to mark it as an LOD group. The
  converter recognises this flag and spawns a dedicated [`LOD` node](../scripting/nodes/types/LOD.md) at runtime. 【F:src/core/extras/glbToNodes.js†L40-L55】
- Toggle `scaleAware` on the same object when you want distances to scale with the rendered model; it maps straight through to
  the node's `scaleAware` property. 【F:src/core/extras/glbToNodes.js†L40-L55】
- Give each child mesh a `maxDistance` custom property (in metres). During import the loader uses that value when inserting the
  child into the LOD so that higher-detail meshes disable themselves automatically. The bundled Blender panel exposes this field
  as **Max Distance** to make editing easier. 【F:src/core/extras/glbToNodes.js†L12-L33】【F:docs/extras/blender-addon.py†L776-L865】

## Collision

- Create a rigidbody root by setting `node = rigidbody` on an Empty. Optional properties such as `type` (`static`, `kinematic`,
  or `dynamic`) and `mass` are preserved on export and initialise the [`RigidBody` node](../scripting/nodes/types/RigidBody.md)
  in the engine. 【F:src/core/extras/glbToNodes.js†L56-L68】
- Add collider children underneath the rigidbody. Setting `node = collider` on a mesh plus flags like `convex`, `trigger`, or a
  custom `layer` makes the importer emit [`Collider` nodes](../scripting/nodes/types/Collider.md) that PhysX can attach to the
  rigidbody. The addon includes Convex and Trigger toggles so you can confirm their state directly inside Blender. 【F:src/core/extras/glbToNodes.js†L69-L89】【F:docs/extras/blender-addon.py†L728-L756】
- Collider meshes act purely as metadata—the engine consumes their geometry and discards their materials—so keep them as simple
  single-material shapes that are easy to read in wireframe. Complex, multi-material collider meshes are ignored during import,
  matching the warning in the loader. 【F:src/core/extras/glbToNodes.js†L69-L83】