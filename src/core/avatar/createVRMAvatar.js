import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'

import * as THREE from '../extras/three'
import { DEG2RAD } from '../extras/general'
import { getTrianglesFromGeometry } from '../extras/getTrianglesFromGeometry'
import { getTextureBytesFromMaterial } from '../extras/getTextureBytesFromMaterial'
import { Emotes } from '../extras/playerEmotes'

const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()
const q1 = new THREE.Quaternion()
const m1 = new THREE.Matrix4()

const DIST_MIN_RATE = 1 / 5 // 5 times per second
const DIST_MAX_RATE = 1 / 60 // 40 times per second
const DIST_MIN = 5 // <= 5m = max rate
const DIST_MAX = 60 // >= 60m = min rate

const MAX_GAZE_DISTANCE = 40

const material = new THREE.MeshBasicMaterial()

const AimAxis = {
  X: new THREE.Vector3(1, 0, 0),
  Y: new THREE.Vector3(0, 1, 0),
  Z: new THREE.Vector3(0, 0, 1),
  NEG_X: new THREE.Vector3(-1, 0, 0),
  NEG_Y: new THREE.Vector3(0, -1, 0),
  NEG_Z: new THREE.Vector3(0, 0, -1),
}

const UpAxis = {
  X: new THREE.Vector3(1, 0, 0),
  Y: new THREE.Vector3(0, 1, 0),
  Z: new THREE.Vector3(0, 0, 1),
  NEG_X: new THREE.Vector3(-1, 0, 0),
  NEG_Y: new THREE.Vector3(0, -1, 0),
  NEG_Z: new THREE.Vector3(0, 0, -1),
}

export const AvatarModes = {
  IDLE: 0,
  WALK: 1,
  RUN: 2,
  JUMP: 3,
  FALL: 4,
  FLY: 5,
  TALK: 6,
  FLIP: 7,
}

export function createVRMAvatarContext(glb, options = {}) {
  const { setupMaterial } = options

  glb.scene.matrixAutoUpdate = false
  glb.scene.matrixWorldAutoUpdate = false

  const expressions = glb.scene.children.filter(n => n.type === 'VRMExpression')
  for (const node of expressions) node.removeFromParent()

  const vrmHumanoidRigs = glb.scene.children.filter(n => n.name === 'VRMHumanoidRig')
  for (const node of vrmHumanoidRigs) node.removeFromParent()

  const secondaries = glb.scene.children.filter(n => n.name === 'secondary')
  for (const node of secondaries) node.removeFromParent()

  glb.scene.traverse(obj => {
    if (obj.isMesh) {
      obj.castShadow = true
      obj.receiveShadow = true
    }
  })

  const humanoid = glb.userData?.vrm?.humanoid
  const rawBones = humanoid?._rawHumanBones?.humanBones ?? {}
  const normalizedBones = humanoid?._normalizedHumanBones?.humanBones ?? {}
  const rootBoneMatrix = rawBones.root?.node?.matrixWorld ?? new THREE.Matrix4()
  const hipsPosition = v1.setFromMatrixPosition(rawBones.hips?.node?.matrixWorld ?? new THREE.Matrix4())
  const rootPosition = v2.setFromMatrixPosition(rootBoneMatrix)
  const rootToHips = hipsPosition.y - rootPosition.y

  const version = glb.userData?.vrm?.meta?.metaVersion

  const skinnedMeshes = []
  glb.scene.traverse(node => {
    if (node.isSkinnedMesh) {
      node.bindMode = THREE.DetachedBindMode
      node.bindMatrix.copy(node.matrixWorld)
      node.bindMatrixInverse.copy(node.bindMatrix).invert()
      skinnedMeshes.push(node)
    }
    if (node.isMesh) {
      node.geometry.computeBoundsTree?.()
      node.material.shadowSide = THREE.BackSide
      setupMaterial?.(node.material)
    }
  })

  const skeleton = skinnedMeshes[0]?.skeleton
  if (!skeleton) {
    throw new Error('[createVRMAvatarContext] Missing skeleton on VRM model')
  }

  const poseArmDown = () => {
    if (!normalizedBones) return
    const leftArm = normalizedBones.leftUpperArm?.node
    if (leftArm) leftArm.rotation.z = 75 * DEG2RAD
    const rightArm = normalizedBones.rightUpperArm?.node
    if (rightArm) rightArm.rotation.z = -75 * DEG2RAD
    humanoid?.update(0)
    skeleton.update()
  }
  poseArmDown()

  let height = 0.5
  for (const mesh of skinnedMeshes) {
    mesh.computeBoundingBox?.()
    if (mesh.boundingBox && height < mesh.boundingBox.max.y) {
      height = mesh.boundingBox.max.y
    }
  }

  const headNode = normalizedBones.head?.node
  const headPos = headNode?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3()
  const headToHeight = height - headPos.y

  const getHumanoidBoneNode = boneName => humanoid?.getNormalizedBoneNode?.(boneName) ?? null
  const getHumanoidBoneName = boneName => getHumanoidBoneNode(boneName)?.name

  const noop = () => {
    // ...
  }

  return {
    glb,
    humanoid,
    skeleton,
    rootToHips,
    version,
    height,
    headToHeight,
    getHumanoidBoneNode,
    getHumanoidBoneName,
    applyStats(stats) {
      glb.scene.traverse(obj => {
        if (obj.geometry && !stats.geometries.has(obj.geometry.uuid)) {
          stats.geometries.add(obj.geometry.uuid)
          stats.triangles += getTrianglesFromGeometry(obj.geometry)
        }
        if (obj.material && !stats.materials.has(obj.material.uuid)) {
          stats.materials.add(obj.material.uuid)
          stats.textureBytes += getTextureBytesFromMaterial(obj.material)
        }
      })
    },
    createInstance({ matrix, hooks, node }) {
      const vrm = cloneGLB(glb)
      const instanceSkinnedMeshes = getSkinnedMeshes(vrm.scene)
      const instanceSkeleton = instanceSkinnedMeshes[0].skeleton
      const rootBone = instanceSkeleton.bones[0]
      rootBone.parent.remove(rootBone)
      rootBone.updateMatrixWorld(true)
      vrm.scene.matrix = matrix
      vrm.scene.matrixWorld = matrix
      hooks.scene.add(vrm.scene)

      const getEntity = () => node?.ctx.entity

      const cRadius = 0.3
      const spatialItem = {
        matrix,
        geometry: createCapsule(cRadius, height - cRadius * 2),
        material,
        getEntity,
      }
      hooks.octree?.insert(spatialItem)

      vrm.scene.traverse(o => {
        o.getEntity = getEntity
      })

      const mixer = new THREE.AnimationMixer(instanceSkinnedMeshes[0])
      const bonesByName = {}
      const findBone = name => {
        if (!bonesByName[name]) {
          const actualName = getHumanoidBoneName(name)
          if (actualName) {
            bonesByName[name] = instanceSkeleton.getBoneByName(actualName)
          }
        }
        return bonesByName[name]
      }

      const getBoneTransform = boneName => {
        const bone = findBone(boneName)
        if (!bone) return null
        return m1.multiplyMatrices(vrm.scene.matrixWorld, bone.matrixWorld)
      }

      const loco = {
        mode: AvatarModes.IDLE,
        axis: new THREE.Vector3(),
        gazeDir: null,
      }

      const setLocomotion = (mode, axis, gazeDir) => {
        loco.mode = mode
        loco.axis = axis
        loco.gazeDir = gazeDir
      }

      const emotes = {}
      let currentEmote
      const setEmote = url => {
        if (currentEmote?.url === url) return
        if (currentEmote) {
          currentEmote.action?.fadeOut(0.15)
          currentEmote = null
        }
        if (!url) return
        const opts = getQueryParams(url)
        const loop = opts.l !== '0'
        const speed = parseFloat(opts.s || 1)
        const gaze = opts.g == '1'

        if (emotes[url]) {
          currentEmote = emotes[url]
          if (currentEmote.action) {
            currentEmote.action.clampWhenFinished = !loop
            currentEmote.action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce)
            currentEmote.action.reset().fadeIn(0.15).play()
            clearLocomotion()
          }
        } else {
          const emote = {
            url,
            loading: true,
            action: null,
            gaze,
          }
          emotes[url] = emote
          currentEmote = emote
          hooks.loader.load('emote', url).then(emo => {
            const clip = emo.toClip({
              rootToHips,
              version,
              getHumanoidBoneName,
            })
            const action = mixer.clipAction(clip)
            action.timeScale = speed
            emote.action = action
            if (currentEmote === emote) {
              action.clampWhenFinished = !loop
              action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce)
              action.play()
              clearLocomotion()
            }
          })
        }
      }

      let elapsed = 0
      let rate = 0
      let rateCheck = true
      let distance

      const updateRate = () => {
        const vrmPos = v1.setFromMatrixPosition(vrm.scene.matrix)
        const camPos = v2.setFromMatrixPosition(hooks.camera.matrixWorld)
        distance = vrmPos.distanceTo(camPos)
        const clampedDistance = Math.max(distance - DIST_MIN, 0)
        const normalizedDistance = Math.min(clampedDistance / (DIST_MAX - DIST_MIN), 1)
        rate = DIST_MAX_RATE + normalizedDistance * (DIST_MIN_RATE - DIST_MAX_RATE)
      }

      const update = delta => {
        elapsed += delta
        const should = rateCheck ? elapsed >= rate : true
        if (should) {
          mixer.update(elapsed)
          instanceSkeleton.bones.forEach(bone => bone.updateMatrixWorld())
          instanceSkeleton.update = THREE.Skeleton.prototype.update
          if (!currentEmote) {
            updateLocomotion(delta)
          }
          if (loco.gazeDir && distance < MAX_GAZE_DISTANCE && (currentEmote ? currentEmote.gaze : true)) {
            aimBone('neck', loco.gazeDir, delta, {
              minAngle: -30,
              maxAngle: 30,
              smoothing: 0.4,
              weight: 0.6,
            })
            aimBone('head', loco.gazeDir, delta, {
              minAngle: -30,
              maxAngle: 30,
              smoothing: 0.4,
              weight: 0.6,
            })
          }
          elapsed = 0
        } else {
          instanceSkeleton.update = noop
        }
      }

      const aimBone = (() => {
        const smoothedRotations = new Map()
        const normalizedDir = new THREE.Vector3()
        const parentWorldMatrix = new THREE.Matrix4()
        const parentWorldRotationInverse = new THREE.Quaternion()
        const localDir = new THREE.Vector3()
        const currentAimDir = new THREE.Vector3()
        const rot = new THREE.Quaternion()
        const worldUp = new THREE.Vector3()
        const localUp = new THREE.Vector3()
        const rotatedUp = new THREE.Vector3()
        const projectedUp = new THREE.Vector3()
        const upCorrection = new THREE.Quaternion()
        const cross = new THREE.Vector3()
        const targetRotation = new THREE.Quaternion()
        const restToTarget = new THREE.Quaternion()

        return function aimBoneFn(boneName, targetDir, delta, options = {}) {
          const {
            aimAxis = AimAxis.NEG_Z,
            upAxis = UpAxis.Y,
            smoothing = 0.7,
            weight = 1.0,
            maintainOffset = false,
            minAngle = -180,
            maxAngle = 180,
          } = options
          const bone = findBone(boneName)
          const parentBone = humanoid?.humanBones?.[boneName]?.node.parent
          if (!bone) return
          if (!parentBone) return
          const boneId = bone.uuid
          if (!smoothedRotations.has(boneId)) {
            smoothedRotations.set(boneId, {
              current: bone.quaternion.clone(),
              target: new THREE.Quaternion(),
            })
          }
          const smoothState = smoothedRotations.get(boneId)
          normalizedDir.copy(targetDir).normalize()
          parentWorldMatrix.multiplyMatrices(vrm.scene.matrixWorld, parentBone.matrixWorld)
          parentWorldMatrix.decompose(v1, parentWorldRotationInverse, v2)
          parentWorldRotationInverse.invert()
          localDir.copy(normalizedDir).applyQuaternion(parentWorldRotationInverse)
          if (maintainOffset && !bone.userData.initialRotationOffset) {
            bone.userData.initialRotationOffset = bone.quaternion.clone()
          }
          currentAimDir.copy(aimAxis)
          if (maintainOffset && bone.userData.initialRotationOffset) {
            currentAimDir.applyQuaternion(bone.userData.initialRotationOffset)
          }
          rot.setFromUnitVectors(aimAxis, localDir)
          worldUp.copy(upAxis)
          localUp.copy(worldUp).applyQuaternion(parentWorldRotationInverse)
          rotatedUp.copy(upAxis).applyQuaternion(rot)
          projectedUp.copy(localUp)
          projectedUp.sub(v1.copy(localDir).multiplyScalar(localDir.dot(localUp)))
          projectedUp.normalize()
          if (projectedUp.lengthSq() > 0.001) {
            upCorrection.setFromUnitVectors(rotatedUp, projectedUp)
            const angle = rotatedUp.angleTo(projectedUp)
            cross.crossVectors(rotatedUp, projectedUp)
            if (cross.dot(localDir) < 0) {
              upCorrection.setFromAxisAngle(localDir, -angle)
            } else {
              upCorrection.setFromAxisAngle(localDir, angle)
            }
            rot.premultiply(upCorrection)
          }
          targetRotation.copy(rot)
          if (maintainOffset && bone.userData.initialRotationOffset) {
            targetRotation.multiply(bone.userData.initialRotationOffset)
          }
          if (minAngle > -180 || maxAngle < 180) {
            if (!bone.userData.restRotation) {
              bone.userData.restRotation = bone.quaternion.clone()
            }
            restToTarget.copy(bone.userData.restRotation).invert().multiply(targetRotation)
            const w = restToTarget.w
            const angle = 2 * Math.acos(Math.min(Math.max(w, -1), 1))
            const angleDeg = THREE.MathUtils.radToDeg(angle)
            if (angleDeg > maxAngle || angleDeg < minAngle) {
              const clampedAngleDeg = THREE.MathUtils.clamp(angleDeg, minAngle, maxAngle)
              const clampedAngleRad = THREE.MathUtils.degToRad(clampedAngleDeg)
              const scale = clampedAngleRad / angle
              q1.copy(targetRotation)
              targetRotation.slerpQuaternions(bone.userData.restRotation, q1, scale)
            }
          }
          if (weight < 1.0) {
            targetRotation.slerp(bone.quaternion, 1.0 - weight)
          }
          smoothState.target.copy(targetRotation)
          smoothState.current.slerp(smoothState.target, smoothing)
          bone.quaternion.copy(smoothState.current)
          bone.updateMatrixWorld(true)
        }
      })()

      const poses = {}
      function addPose(key, url) {
        const opts = getQueryParams(url)
        const speed = parseFloat(opts.s || 1)
        const pose = {
          loading: true,
          active: false,
          action: null,
          weight: 0,
          target: 0,
          setWeight: value => {
            pose.weight = value
            if (pose.action) {
              pose.action.weight = value
              if (!pose.active) {
                pose.action.reset().fadeIn(0.15).play()
                pose.active = true
              }
            }
          },
          fadeOut: () => {
            pose.weight = 0
            pose.action?.fadeOut(0.15)
            pose.active = false
          },
        }
        hooks.loader.load('emote', url).then(emo => {
          const clip = emo.toClip({
            rootToHips,
            version,
            getHumanoidBoneName,
          })
          pose.action = mixer.clipAction(clip)
          pose.action.timeScale = speed
          pose.action.weight = pose.weight
          pose.action.play()
        })
        poses[key] = pose
      }

      addPose('idle', Emotes.IDLE)
      addPose('walk', Emotes.WALK)
      addPose('walkLeft', Emotes.WALK_LEFT)
      addPose('walkBack', Emotes.WALK_BACK)
      addPose('walkRight', Emotes.WALK_RIGHT)
      addPose('run', Emotes.RUN)
      addPose('runLeft', Emotes.RUN_LEFT)
      addPose('runBack', Emotes.RUN_BACK)
      addPose('runRight', Emotes.RUN_RIGHT)
      addPose('jump', Emotes.JUMP)
      addPose('fall', Emotes.FALL)
      addPose('fly', Emotes.FLY)
      addPose('talk', Emotes.TALK)

      const clearLocomotion = () => {
        for (const key in poses) {
          poses[key].fadeOut()
        }
      }

      const updateLocomotion = delta => {
        const { mode, axis } = loco
        for (const key in poses) {
          poses[key].target = 0
        }
        if (mode === AvatarModes.IDLE) {
          poses.idle.target = 1
        } else if (mode === AvatarModes.WALK || mode === AvatarModes.RUN) {
          const angle = Math.atan2(axis.x, -axis.z)
          const angleDeg = ((angle * 180) / Math.PI + 360) % 360
          const prefix = mode === AvatarModes.RUN ? 'run' : 'walk'
          const forwardKey = prefix
          const leftKey = `${prefix}Left`
          const backKey = `${prefix}Back`
          const rightKey = `${prefix}Right`
          if (axis.length() > 0.01) {
            if (angleDeg >= 337.5 || angleDeg < 22.5) {
              poses[forwardKey].target = 1
            } else if (angleDeg >= 22.5 && angleDeg < 67.5) {
              const blend = (angleDeg - 22.5) / 45
              poses[forwardKey].target = 1 - blend
              poses[rightKey].target = blend
            } else if (angleDeg >= 67.5 && angleDeg < 112.5) {
              poses[rightKey].target = 1
            } else if (angleDeg >= 112.5 && angleDeg < 157.5) {
              const blend = (angleDeg - 112.5) / 45
              poses[rightKey].target = 1 - blend
              poses[backKey].target = blend
            } else if (angleDeg >= 157.5 && angleDeg < 202.5) {
              poses[backKey].target = 1
            } else if (angleDeg >= 202.5 && angleDeg < 247.5) {
              const blend = (angleDeg - 202.5) / 45
              poses[backKey].target = 1 - blend
              poses[leftKey].target = blend
            } else if (angleDeg >= 247.5 && angleDeg < 292.5) {
              poses[leftKey].target = 1
            } else if (angleDeg >= 292.5 && angleDeg < 337.5) {
              const blend = (angleDeg - 292.5) / 45
              poses[leftKey].target = 1 - blend
              poses[forwardKey].target = blend
            }
          }
        } else if (mode === AvatarModes.JUMP) {
          poses.jump.target = 1
        } else if (mode === AvatarModes.FALL) {
          poses.fall.target = 1
        } else if (mode === AvatarModes.FLY) {
          poses.fly.target = 1
        } else if (mode === AvatarModes.TALK) {
          poses.talk.target = 1
        }
        const lerpSpeed = 16
        for (const key in poses) {
          const pose = poses[key]
          const weight = THREE.MathUtils.lerp(pose.weight, pose.target, 1 - Math.exp(-lerpSpeed * delta))
          pose.setWeight(weight)
        }
      }

      let firstPersonActive = false
      const setFirstPerson = active => {
        if (firstPersonActive === active) return
        const head = findBone('neck')
        if (head) {
          head.scale.setScalar(active ? 0 : 1)
        }
        firstPersonActive = active
      }

      return {
        raw: vrm,
        height,
        headToHeight,
        setEmote,
        setFirstPerson,
        update,
        updateRate,
        getBoneTransform,
        setLocomotion,
        setVisible(visible) {
          vrm.scene.traverse(o => {
            o.visible = visible
          })
        },
        move(_matrix) {
          matrix.copy(_matrix)
          hooks.octree?.move(spatialItem)
        },
        disableRateCheck() {
          rateCheck = false
        },
        destroy() {
          hooks.scene.remove(vrm.scene)
          hooks.octree?.remove(spatialItem)
        },
      }
    },
  }
}

function cloneGLB(glb) {
  return { ...glb, scene: SkeletonUtils.clone(glb.scene) }
}

function getSkinnedMeshes(scene) {
  const meshes = []
  scene.traverse(o => {
    if (o.isSkinnedMesh) {
      meshes.push(o)
    }
  })
  return meshes
}

function createCapsule(radius, height) {
  const fullHeight = radius + height + radius
  const geometry = new THREE.CapsuleGeometry(radius, height)
  geometry.translate(0, fullHeight / 2, 0)
  return geometry
}

const queryParams = {}
function getQueryParams(url) {
  if (!queryParams[url]) {
    url = new URL(url)
    const params = {}
    for (const [key, value] of url.searchParams.entries()) {
      params[key] = value
    }
    queryParams[url] = params
  }
  return queryParams[url]
}
