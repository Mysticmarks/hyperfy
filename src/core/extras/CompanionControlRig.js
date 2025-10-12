import * as THREE from './three'

const WORLD_UP = new THREE.Vector3(0, 1, 0)
const v1 = new THREE.Vector3()
const q1 = new THREE.Quaternion()

function getTime(world) {
  if (world?.time !== undefined) return world.time
  return performance.now() / 1000
}

export class CompanionControlRig {
  constructor(companion, options = {}) {
    this.companion = companion
    this.manualTimeout = options.manualTimeout ?? 2.5
    this.movementSpeed = options.movementSpeed ?? 3
    this.canFly = !!options.canFly

    this.axis = new THREE.Vector2(0, 0)
    this.vertical = 0
    this.manualUntil = 0
    this.jumpQueued = false
    this.running = false
    this.manualYaw = false
    this.yaw = companion.base?.rotation?.y ?? 0
    this.pitch = 0
  }

  applyInput(input = {}) {
    const { move, look, jump, duration, run, vertical, sprint, actions } = input

    if (Array.isArray(move)) {
      this.axis.set(move[0] ?? 0, move[1] ?? 0)
    } else if (move && typeof move === 'object') {
      this.axis.set(move.x ?? move[0] ?? 0, move.y ?? move[1] ?? 0)
    } else if (typeof move === 'number') {
      this.axis.set(0, move)
    }

    if (Array.isArray(look)) {
      this.yaw += look[0] ?? 0
      this.pitch = THREE.MathUtils.clamp(this.pitch + (look[1] ?? 0), -Math.PI / 3, Math.PI / 3)
      this.manualYaw = true
    } else if (look && typeof look === 'object') {
      this.yaw += look.x ?? 0
      this.pitch = THREE.MathUtils.clamp(this.pitch + (look.y ?? 0), -Math.PI / 3, Math.PI / 3)
      this.manualYaw = true
    }

    if (typeof vertical === 'number') {
      this.vertical = vertical
    }

    if (jump) {
      this.jumpQueued = true
    }

    if (run !== undefined) this.running = run
    if (sprint !== undefined) this.running = sprint

    if (actions?.length) {
      for (const action of actions) {
        this.companion.world.events.emit('companion:command', {
          companionId: this.companion.data.id,
          playerId: this.companion.data.ownerId,
          action,
        })
      }
    }

    const manualDuration = duration ?? this.manualTimeout
    const now = getTime(this.companion.world)
    this.manualUntil = Math.max(this.manualUntil, now + manualDuration)
  }

  update(delta) {
    const now = getTime(this.companion.world)
    const manualActive = now <= this.manualUntil
    if (!manualActive) {
      this.axis.set(0, 0)
      this.vertical = 0
      this.manualYaw = false
      return false
    }

    this.integrateMovement(delta)
    this.jumpQueued = false
    return true
  }

  integrateMovement(delta) {
    const base = this.companion.base
    if (!base) return

    const axis = this.axis.clone()
    if (axis.lengthSq() > 1) axis.normalize()
    const speedMultiplier = this.running ? 1.5 : 1
    const speed = this.movementSpeed * speedMultiplier

    const hasMove = axis.lengthSq() > 0.0001
    if (hasMove && !this.manualYaw) {
      const targetYaw = Math.atan2(axis.x, axis.y)
      this.yaw = targetYaw
    }

    q1.setFromAxisAngle(WORLD_UP, this.yaw)
    v1.set(axis.x, 0, axis.y)
    v1.applyQuaternion(q1)
    v1.multiplyScalar(speed * delta)

    base.position.add(v1)

    if (this.canFly && this.vertical !== 0) {
      base.position.y += this.vertical * speed * delta
    }

    if (!this.canFly && this.jumpQueued) {
      base.position.y += 0.2
    }

    base.rotation.y = this.yaw
  }
}
