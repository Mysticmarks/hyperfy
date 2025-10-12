import * as THREE from '../extras/three'
import { Entity } from './Entity'
import { createNode } from '../extras/createNode'
import { CompanionControlRig } from '../extras/CompanionControlRig'

const FOLLOW_UP = new THREE.Vector3(0, 1, 0)
const v1 = new THREE.Vector3()
const v2 = new THREE.Vector3()
const v3 = new THREE.Vector3()
const q1 = new THREE.Quaternion()

const DEFAULT_BEHAVIOR = {
  followDistance: 2.5,
  followHeight: 0,
  followResponsiveness: 3,
  tetherRadius: 14,
  idleOrbit: true,
  idleOrbitRadius: 1.5,
  idleOrbitSpeed: 0.4,
  manualTimeout: 2.5,
  movementSpeed: 3,
}

const DEFAULT_LOCOMOTION = {
  walk: true,
  swim: false,
  fly: false,
  hover: false,
  dig: false,
}

const DEFAULT_APPEARANCE = {
  type: 'avatar',
  url: 'asset://avatar.vrm',
  scale: 1,
  tint: '#ffffff',
  idleAnimation: null,
  locomotionSet: 'humanoid',
}

export class Companion extends Entity {
  constructor(world, data, local) {
    super(world, data, local)
    this.isCompanion = true
    this.isAI = true
    this.behavior = { ...DEFAULT_BEHAVIOR, ...(data.behavior || {}) }
    this.locomotion = { ...DEFAULT_LOCOMOTION, ...(data.locomotion || {}) }
    this.appearance = { ...DEFAULT_APPEARANCE, ...(data.appearance || {}) }
    this.instructions = data.instructions || {}
    this.skills = data.skills || []
    this.persona = data.persona || ''
    this.title = data.title || null

    this.data.behavior = this.behavior
    this.data.locomotion = this.locomotion
    this.data.appearance = this.appearance
    this.data.instructions = this.instructions
    this.data.skills = this.skills

    this.manualChatDuration = 4
    this.chatTimer = 0
    this.chatDuration = 0
    this.chatText = ''

    this.controller = new CompanionControlRig(this, {
      manualTimeout: this.behavior.manualTimeout,
      movementSpeed: this.behavior.movementSpeed,
      canFly: this.locomotion.fly || this.locomotion.hover,
    })

    this.idleAngle = Math.random() * Math.PI * 2

    this.init()
  }

  init() {
    this.base = createNode('group')
    this.base.position.fromArray(this.data.position || [0, 0, 0])
    this.base.quaternion.fromArray(this.data.quaternion || [0, 0, 0, 1])

    this.aura = createNode('group')

    const nametagLabel = this.data.displayName || this.data.name || this.data.id || 'Companion'
    this.nametag = createNode('nametag', {
      label: nametagLabel,
      subtitle: this.title || null,
      active: true,
    })
    this.aura.add(this.nametag)

    this.bubble = createNode('ui', {
      width: 340,
      height: 480,
      pivot: 'bottom-center',
      billboard: 'full',
      scaler: [3, 30],
      justifyContent: 'flex-end',
      alignItems: 'center',
      active: false,
    })
    this.bubbleBox = createNode('uiview', {
      backgroundColor: 'rgba(15, 12, 28, 0.8)',
      borderRadius: 12,
      padding: 14,
    })
    this.bubbleText = createNode('uitext', {
      color: 'white',
      fontWeight: 300,
      lineHeight: 1.4,
      fontSize: 16,
    })
    this.bubble.add(this.bubbleBox)
    this.bubbleBox.add(this.bubbleText)
    this.aura.add(this.bubble)

    this.aura.activate({ world: this.world, entity: this })
    this.base.activate({ world: this.world, entity: this })

    this.applyAppearance()

    this.world.setHot(this, true)
  }

  get owner() {
    const ownerId = this.data.ownerId || this.data.owner
    if (!ownerId) return null
    return this.world.entities.get(ownerId)
  }

  applyAppearance() {
    if (!this.world.loader || this.world.network?.isServer) return
    const url = this.appearance.url || DEFAULT_APPEARANCE.url
    if (this.appearance.type === 'avatar' || url.endsWith('.vrm')) {
      this.world.loader.load('avatar', url).then(src => {
        if (this.avatar) this.avatar.deactivate()
        this.avatar = src.toNodes().get('avatar')
        if (!this.avatar) return
        this.avatar.scale.setScalar(this.appearance.scale || 1)
        this.base.add(this.avatar)
        const headHeight = this.avatar.getHeadToHeight?.() || 1.8
        this.nametag.position.y = headHeight + 0.25
        this.bubble.position.y = headHeight + 0.25
        if (this.appearance.tint && this.avatar.instance?.setTint) {
          this.avatar.instance.setTint(this.appearance.tint)
        }
      })
      return
    }
    const type = 'model'
    this.world.loader.load(type, url).then(src => {
      if (this.avatar) this.avatar.deactivate()
      this.avatar = src.toNodes().get('model')
      if (!this.avatar) return
      this.avatar.scale.setScalar(this.appearance.scale || 1)
      this.base.add(this.avatar)
      const height = this.appearance.height || 1.6
      this.nametag.position.y = height + 0.25
      this.bubble.position.y = height + 0.25
    })
  }

  speak(text, { duration, from } = {}) {
    if (!text) return
    this.chatText = text
    this.chatDuration = duration || this.manualChatDuration
    this.chatTimer = 0
    this.bubbleText.text = text
    this.bubble.active = true
    this.world.events.emit('companion:chat', {
      companionId: this.data.id,
      playerId: this.data.ownerId,
      text,
      from: from || 'companion',
    })
  }

  applyDirective(directive) {
    if (!directive) return
    if (directive.type === 'chat') {
      this.speak(directive.text, directive)
      return
    }
    if (directive.type === 'input') {
      this.controller.applyInput(directive)
      return
    }
    if (directive.type === 'state') {
      this.data.state = { ...this.data.state, ...(directive.state || {}) }
      return
    }
    if (directive.type === 'action') {
      const action = directive.action
      if (!action) return
      this.world.events.emit('companion:action', {
        companionId: this.data.id,
        playerId: this.data.ownerId,
        action,
      })
      return
    }
  }

  update(delta) {
    const manualActive = this.controller.update(delta)

    if (!manualActive) {
      this.updateFollow(delta)
    }

    this.updateChat(delta)

    if (this.avatar?.instance?.update) {
      this.avatar.instance.update(delta)
      const matrix = this.avatar.getBoneTransform?.('head')
      if (matrix) {
        this.aura.position.setFromMatrixPosition(matrix)
      } else {
        this.aura.position.copy(this.base.position).add(FOLLOW_UP)
      }
    } else {
      this.aura.position.copy(this.base.position).add(FOLLOW_UP)
    }
  }

  updateFollow(delta) {
    const owner = this.owner
    if (!owner || !owner.base) return

    const followDistance = this.behavior.followDistance
    const followHeight = this.behavior.followHeight
    const responsiveness = Math.max(this.behavior.followResponsiveness || 1, 0.0001)

    owner.base.getWorldDirection(v1)
    v1.multiplyScalar(-followDistance)

    const ownerPos = owner.base.position
    v2.copy(ownerPos).add(v1)
    v2.y += followHeight

    const tetherRadius = this.behavior.tetherRadius || 0
    if (tetherRadius > 0) {
      const dist = v3.copy(ownerPos).sub(this.base.position).length()
      if (dist > tetherRadius * 1.5) {
        // snap closer if too far behind
        this.base.position.copy(v2)
        this.base.quaternion.copy(owner.base.quaternion)
        return
      }
    }

    if (this.behavior.idleOrbit) {
      this.idleAngle += this.behavior.idleOrbitSpeed * delta
      const radius = this.behavior.idleOrbitRadius
      v2.x += Math.cos(this.idleAngle) * radius
      v2.z += Math.sin(this.idleAngle) * radius
    }

    this.base.position.lerp(v2, Math.min(1, responsiveness * delta))
    q1.copy(owner.base.quaternion)
    this.base.quaternion.slerp(q1, Math.min(1, responsiveness * delta))
  }

  updateChat(delta) {
    if (!this.bubble.active) return
    this.chatTimer += delta
    if (this.chatTimer >= this.chatDuration) {
      this.chatTimer = 0
      this.chatDuration = 0
      this.chatText = ''
      this.bubble.active = false
    }
  }

  onEvent(version, name, data) {
    if (name === 'companion-directive') {
      this.applyDirective(data)
    } else if (name === 'companion-chat') {
      this.speak(data?.text, data)
    }
  }

  serialize() {
    return {
      ...this.data,
      position: this.base.position.toArray(),
      quaternion: this.base.quaternion.toArray(),
    }
  }

  destroy() {
    this.world.setHot(this, false)
    this.bubble?.deactivate?.()
    this.bubble = null
    this.bubbleBox = null
    this.bubbleText = null
    this.nametag?.deactivate?.()
    this.nametag = null
    this.avatar?.deactivate?.()
    this.avatar = null
    this.aura?.deactivate?.()
    this.aura = null
    this.base?.deactivate?.()
    this.base = null
  }
}
