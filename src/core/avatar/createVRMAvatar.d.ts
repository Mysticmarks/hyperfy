import * as THREE from 'three'

export interface AvatarStats {
  geometries: Set<string>
  materials: Set<string>
  triangles: number
  textureBytes: number
}

export interface VRMAvatarHooks {
  camera: THREE.Camera
  scene: THREE.Object3D
  octree?: {
    insert(item: unknown): void
    move(item: unknown): void
    remove(item: unknown): void
  }
  loader: {
    load<T = unknown>(type: string, url: string): Promise<T>
  }
  setupMaterial?: (material: THREE.Material) => void
}

export interface VRMAvatarInstance {
  raw: any
  height: number
  headToHeight: number
  setEmote(url: string | null): void
  setFirstPerson(active: boolean): void
  update(delta: number): void
  updateRate(): void
  getBoneTransform(name: string): THREE.Matrix4 | null
  setLocomotion(mode: number, axis: THREE.Vector3, gazeDir?: THREE.Vector3 | null): void
  setVisible(visible: boolean): void
  move(matrix: THREE.Matrix4): void
  disableRateCheck(): void
  destroy(): void
}

export interface VRMAvatarContext {
  glb: any
  height: number
  headToHeight: number
  rootToHips: number
  version?: string
  getHumanoidBoneNode(name: string): THREE.Bone | null
  getHumanoidBoneName(name: string): string | undefined
  applyStats(stats: AvatarStats): void
  createInstance(options: { matrix: THREE.Matrix4; hooks: VRMAvatarHooks; node?: any }): VRMAvatarInstance
}

export declare const AvatarModes: {
  IDLE: number
  WALK: number
  RUN: number
  JUMP: number
  FALL: number
  FLY: number
  TALK: number
  FLIP: number
}

export declare function createVRMAvatarContext(
  glb: any,
  options?: { setupMaterial?: (material: THREE.Material) => void }
): VRMAvatarContext
