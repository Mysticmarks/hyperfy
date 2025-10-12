import { Entity } from './Entity'
import { createNode } from '../extras/createNode'

const DEFAULT_APPEARANCE = {
  type: 'model',
  url: 'asset://mount.glb',
  scale: 1.2,
  height: 1.6,
}

export class Mount extends Entity {
  constructor(world, data, local) {
    super(world, data, local)
    this.isMount = true
    this.appearance = { ...DEFAULT_APPEARANCE, ...(data.appearance || {}) }
    this.movement = { ...(data.movement || {}) }
    this.seating = Array.isArray(data.seating) ? [...data.seating] : []
    this.seats = { ...(data.seats || {}) }

    if (!this.world.network?.isServer) {
      this.initNodes()
    }
  }

  initNodes() {
    this.base = createNode('group')
    this.base.position.fromArray(this.data.position || [0, 0, 0])
    this.base.quaternion.fromArray(this.data.quaternion || [0, 0, 0, 1])

    const nametagLabel = this.data.name || 'Mount'
    const subtitle = this.data.description || null
    this.nametag = createNode('nametag', {
      label: nametagLabel,
      subtitle,
      active: true,
    })
    const height = this.appearance.height || DEFAULT_APPEARANCE.height
    this.nametag.position.y = height + 0.2
    this.base.add(this.nametag)

    this.base.activate({ world: this.world, entity: this })
    this.applyAppearance()
    this.world.setHot(this, true)
  }

  applyAppearance() {
    if (!this.world.loader || this.world.network?.isServer) return
    const url = this.appearance.url || DEFAULT_APPEARANCE.url
    const type = this.appearance.type === 'avatar' || url.endsWith('.vrm') ? 'avatar' : 'model'
    this.world.loader.load(type, url).then(src => {
      if (!src) return
      if (this.avatar) {
        this.avatar.deactivate()
      }
      const node = src.toNodes().get(type === 'avatar' ? 'avatar' : 'model')
      if (!node) return
      this.avatar = node
      const scale = this.appearance.scale || DEFAULT_APPEARANCE.scale
      this.avatar.scale.setScalar(scale)
      this.base.add(this.avatar)
      const height = this.appearance.height || DEFAULT_APPEARANCE.height
      if (this.nametag) {
        this.nametag.position.y = height + 0.2
      }
    })
  }

  modify(data) {
    Object.assign(this.data, data)
    if (data.appearance) {
      this.appearance = { ...this.appearance, ...data.appearance }
      this.applyAppearance()
    }
    if (data.movement) {
      this.movement = { ...this.movement, ...data.movement }
    }
    if (data.seating) {
      this.seating = Array.isArray(data.seating) ? [...data.seating] : this.seating
    }
    if (data.seats) {
      this.seats = { ...this.seats, ...data.seats }
    }
    if (data.position && this.base) {
      this.base.position.fromArray(data.position)
    }
    if (data.quaternion && this.base) {
      this.base.quaternion.fromArray(data.quaternion)
    }
  }

  destroy() {
    if (!this.world.network?.isServer) {
      if (this.avatar) {
        this.avatar.deactivate()
        this.avatar = null
      }
      if (this.nametag) {
        this.nametag.deactivate()
        this.nametag = null
      }
      if (this.base) {
        this.base.deactivate()
        this.base = null
      }
    }
    this.world.setHot(this, false)
  }
}
