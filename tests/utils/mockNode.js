import { strict as assert } from 'node:assert'

export class MockNode {
  constructor(type, options = {}) {
    this.type = type
    this.id = options.id ?? type
    this.children = []
    this.factory = options.factory ?? null
    this.hooks = options.hooks ?? null
    this.props = { ...options }
  }

  add(child) {
    assert(child, 'child node is required')
    this.children.push(child)
    return child
  }

  get(targetId) {
    if (this.id === targetId) {
      return this
    }
    for (const child of this.children) {
      const found = child.get(targetId)
      if (found) return found
    }
    return null
  }

  clone(deep = false) {
    const copy = new MockNode(this.type, { ...this.props, id: this.id })
    copy.factory = this.factory
    copy.hooks = this.hooks
    if (deep) {
      for (const child of this.children) {
        copy.add(child.clone(true))
      }
    }
    return copy
  }

  getStats(includeChildren = false) {
    let nodeCount = 1
    if (includeChildren) {
      for (const child of this.children) {
        nodeCount += child.getStats(true).nodes
      }
    }
    return {
      nodes: nodeCount,
      geometries: 0,
      materials: 0,
      textureBytes: 0,
      fileBytes: 0,
    }
  }
}
