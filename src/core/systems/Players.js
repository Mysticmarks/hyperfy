import { System } from './System'
import { uuid } from '../utils'

export class Players extends System {
  constructor(world) {
    super(world)
    this.players = new Map()
    this.onEnter = this.onEnter.bind(this)
    this.onLeave = this.onLeave.bind(this)
  }

  start() {
    this.world.events.on('enter', this.onEnter)
    this.world.events.on('leave', this.onLeave)
  }

  destroy() {
    this.world.events.off('enter', this.onEnter)
    this.world.events.off('leave', this.onLeave)
    this.players.clear()
  }

  onEnter({ playerId }) {
    if (!playerId) return
    if (!this.players.has(playerId)) {
      this.players.set(playerId, { id: playerId, joinedAt: Date.now(), sessionId: uuid() })
    }
    this.world.economy?.ensurePlayerLedger(playerId)
  }

  onLeave({ playerId }) {
    if (!playerId) return
    const record = this.players.get(playerId)
    if (record) {
      record.leftAt = Date.now()
    }
  }

  get(playerId) {
    return this.players.get(playerId) || null
  }

  getCurrency(playerId) {
    return this.world.economy?.getPlayerSnapshot(playerId)?.currency || null
  }

  getInventory(playerId) {
    return this.world.economy?.getInventory(playerId) || []
  }

  getTransactions(playerId) {
    return this.world.economy?.getPlayerSnapshot(playerId)?.transactions || []
  }

  credit(playerId, amount, context) {
    return this.world.economy?.credit(playerId, amount, context)
  }

  debit(playerId, amount, context) {
    return this.world.economy?.debit(playerId, amount, context)
  }

  addToInventory(playerId, item) {
    return this.world.economy?.addToInventory(playerId, item)
  }

  removeFromInventory(playerId, itemId) {
    return this.world.economy?.removeFromInventory(playerId, itemId)
  }

  listItem(playerId, itemId, price, options) {
    return this.world.economy?.listItem(playerId, itemId, price, options)
  }

  cancelListing(playerId, listingId) {
    return this.world.economy?.cancelListing(playerId, listingId)
  }

  purchase(listingId, buyerId) {
    return this.world.economy?.purchaseListing(listingId, buyerId)
  }
}
