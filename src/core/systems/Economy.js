import { cloneDeep } from 'lodash-es'
import { System } from './System'
import { uuid } from '../utils'

const STORAGE_KEY = 'economy.state'
const BIT_PER_BYTE = 100
const TRANSACTION_HISTORY_LIMIT = 64

class TransactionLog {
  constructor(limit = TRANSACTION_HISTORY_LIMIT) {
    this.limit = limit
    this.items = new Array(limit)
    this.head = 0
    this.count = 0
  }

  record(entry) {
    this.items[this.head] = entry
    this.head = (this.head + 1) % this.limit
    if (this.count < this.limit) {
      this.count++
    }
  }

  toArray() {
    const result = []
    for (let i = 0; i < this.count; i++) {
      const index = (this.head - this.count + i + this.limit) % this.limit
      result.push(this.items[index])
    }
    return result
  }

  static from(data) {
    const log = new TransactionLog(data?.limit || TRANSACTION_HISTORY_LIMIT)
    const entries = Array.isArray(data?.items) ? data.items : []
    const count = Math.min(entries.length, log.limit)
    const start = Math.max(entries.length - count, 0)
    for (let i = start; i < entries.length; i++) {
      log.record(entries[i])
    }
    return log
  }
}

function normalizeCurrency({ bytes = 0, bits = 0 } = {}) {
  const major = Math.trunc(bytes)
  const minor = Math.trunc(bits)
  if (!Number.isFinite(major) || !Number.isFinite(minor)) {
    throw new Error('invalid currency value')
  }
  let totalBits = major * BIT_PER_BYTE + minor
  if (!Number.isFinite(totalBits)) throw new Error('invalid currency value')
  if (totalBits < 0) totalBits = 0
  const normalizedBytes = Math.floor(totalBits / BIT_PER_BYTE)
  const normalizedBits = totalBits % BIT_PER_BYTE
  return { bytes: normalizedBytes, bits: normalizedBits }
}

function addCurrency(a, b) {
  return normalizeCurrency({ bytes: a.bytes + b.bytes, bits: a.bits + b.bits })
}

function subtractCurrency(a, b) {
  let totalBitsA = a.bytes * BIT_PER_BYTE + a.bits
  const totalBitsB = b.bytes * BIT_PER_BYTE + b.bits
  totalBitsA -= totalBitsB
  if (totalBitsA < 0) throw new Error('insufficient funds')
  const bytes = Math.floor(totalBitsA / BIT_PER_BYTE)
  const bits = totalBitsA % BIT_PER_BYTE
  return { bytes, bits }
}

function hasCurrency(a, b) {
  const totalBitsA = a.bytes * BIT_PER_BYTE + a.bits
  const totalBitsB = b.bytes * BIT_PER_BYTE + b.bits
  return totalBitsA >= totalBitsB
}

function shallowClone(value) {
  return value == null ? value : cloneDeep(value)
}

function createListingSnapshot(listing) {
  return {
    id: listing.id,
    item: shallowClone(listing.item),
    price: normalizeCurrency(listing.price),
    sellerId: listing.sellerId,
    buyerId: listing.buyerId || null,
    status: listing.status,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
    soldAt: listing.soldAt || null,
  }
}

export class Economy extends System {
  constructor(world) {
    super(world)
    this.storage = null
    this.players = new Map()
    this.auctions = new Map()
    this.playerListings = new Map()
    this.categoryIndex = new Map()
    this.listingLocks = new Set()
    this.transactionLogs = new Map()
    this.companionToPlayer = new Map()
    this.playerToCompanions = new Map()
    this.currency = {
      major: {
        name: 'Byte',
        symbol: 'Ɓ',
        unit: 'byte',
        model: 'asset://economy/byte-diamond.glb',
        description: 'A byte gemstone representing 100 bits of value.',
      },
      minor: {
        name: 'Bit',
        symbol: 'ƀ',
        unit: 'bit',
        model: 'asset://economy/bit-diamond.glb',
        description: 'A bit gemstone representing 1/100th of a byte.',
      },
      ratio: BIT_PER_BYTE,
    }

    this.onPlayerEnter = this.onPlayerEnter.bind(this)
    this.onPlayerLeave = this.onPlayerLeave.bind(this)
  }

  async init({ storage } = {}) {
    this.storage = storage || null
    if (this.world.network?.isServer) {
      await this.loadFromStorage()
    }
  }

  start() {
    this.world.events.on('enter', this.onPlayerEnter)
    this.world.events.on('leave', this.onPlayerLeave)
  }

  destroy() {
    this.world.events.off('enter', this.onPlayerEnter)
    this.world.events.off('leave', this.onPlayerLeave)
  }

  async loadFromStorage() {
    if (!this.storage) return
    try {
      const data = this.storage.get(STORAGE_KEY)
      if (!data) return
      this.deserializeState(data)
    } catch (err) {
      console.warn('failed to load economy state', err)
    }
  }

  persistState() {
    if (!this.world.network?.isServer) return
    if (!this.storage) return
    this.storage.set(STORAGE_KEY, this.serializeState())
  }

  serializeState() {
    const players = {}
    this.players.forEach((ledger, playerId) => {
      players[playerId] = {
        currency: normalizeCurrency(ledger.currency),
        inventory: Array.from(ledger.inventory.values()).map(item => shallowClone(item)),
        listings: Array.from(ledger.listings),
        transactions: {
          limit: ledger.transactions.limit,
          items: ledger.transactions.toArray(),
        },
      }
    })
    const auctions = Array.from(this.auctions.values()).map(listing => ({
      id: listing.id,
      item: shallowClone(listing.item),
      price: normalizeCurrency(listing.price),
      sellerId: listing.sellerId,
      buyerId: listing.buyerId || null,
      status: listing.status,
      createdAt: listing.createdAt,
      updatedAt: listing.updatedAt,
      soldAt: listing.soldAt || null,
      category: listing.category,
    }))
    return { players, auctions }
  }

  deserializeState(state = {}) {
    const players = state.players || {}
    this.players.clear()
    this.playerListings.clear()
    this.transactionLogs.clear()
    Object.entries(players).forEach(([playerId, data]) => {
      const ledger = this.createEmptyLedger()
      ledger.currency = normalizeCurrency(data.currency || {})
      const inventoryItems = Array.isArray(data.inventory) ? data.inventory : []
      inventoryItems.forEach(item => {
        ledger.inventory.set(item.id, shallowClone(item))
      })
      const listings = Array.isArray(data.listings) ? data.listings : []
      ledger.listings = new Set(listings)
      ledger.transactions = TransactionLog.from(data.transactions)
      this.players.set(playerId, ledger)
      if (listings.length) {
        this.playerListings.set(playerId, new Set(listings))
      }
      this.transactionLogs.set(playerId, ledger.transactions)
    })

    this.auctions.clear()
    this.categoryIndex.clear()
    const auctions = Array.isArray(state.auctions) ? state.auctions : []
    auctions.forEach(raw => {
      const listing = {
        id: raw.id,
        item: shallowClone(raw.item),
        price: normalizeCurrency(raw.price),
        sellerId: raw.sellerId,
        buyerId: raw.buyerId || null,
        status: raw.status || 'listed',
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt || raw.createdAt,
        soldAt: raw.soldAt || null,
        category: raw.category || raw.item?.type || 'general',
      }
      this.auctions.set(listing.id, listing)
      this.indexListing(listing)
      this.addListingToSeller(listing.sellerId, listing.id)
    })
  }

  createEmptyLedger() {
    return {
      currency: { bytes: 0, bits: 0 },
      inventory: new Map(),
      listings: new Set(),
      transactions: new TransactionLog(),
    }
  }

  ensurePlayerLedger(playerId) {
    if (!playerId) return null
    if (!this.players.has(playerId)) {
      const ledger = this.createEmptyLedger()
      this.players.set(playerId, ledger)
      this.transactionLogs.set(playerId, ledger.transactions)
    }
    if (!this.playerListings.has(playerId)) {
      this.playerListings.set(playerId, new Set())
    }
    return this.players.get(playerId)
  }

  onPlayerEnter({ playerId }) {
    const ledger = this.ensurePlayerLedger(playerId)
    if (!ledger) return
    if (ledger.transactions.count === 0) {
      this.recordTransaction(playerId, {
        id: uuid(),
        type: 'system:init',
        at: Date.now(),
        summary: 'Ledger initialized',
      })
    }
  }

  onPlayerLeave({ playerId }) {
    const ledger = this.players.get(playerId)
    if (!ledger) return
    this.recordTransaction(playerId, {
      id: uuid(),
      type: 'system:leave',
      at: Date.now(),
      summary: 'Player left world',
    })
  }

  getCurrencyMetadata() {
    return cloneDeep(this.currency)
  }

  getPlayerSnapshot(playerId) {
    const ledger = this.players.get(playerId)
    if (!ledger) return null
    return {
      playerId,
      currency: normalizeCurrency(ledger.currency),
      inventory: Array.from(ledger.inventory.values()).map(item => shallowClone(item)),
      listings: Array.from(ledger.listings),
      transactions: ledger.transactions.toArray(),
    }
  }

  getInventory(playerId) {
    const ledger = this.ensurePlayerLedger(playerId)
    if (!ledger) return []
    return Array.from(ledger.inventory.values()).map(item => shallowClone(item))
  }

  addToInventory(playerId, item) {
    const ledger = this.ensurePlayerLedger(playerId)
    if (!ledger) throw new Error('missing player ledger')
    const id = item.id || uuid()
    const entry = { ...shallowClone(item), id }
    ledger.inventory.set(id, entry)
    this.recordTransaction(playerId, {
      id: uuid(),
      type: 'inventory:add',
      at: Date.now(),
      item: shallowClone(entry),
      summary: `Added ${entry.type || 'item'} ${entry.name || entry.id} to inventory`,
    })
    this.persistState()
    return entry
  }

  removeFromInventory(playerId, itemId) {
    const ledger = this.ensurePlayerLedger(playerId)
    if (!ledger) throw new Error('missing player ledger')
    const entry = ledger.inventory.get(itemId)
    if (!entry) return null
    ledger.inventory.delete(itemId)
    this.recordTransaction(playerId, {
      id: uuid(),
      type: 'inventory:remove',
      at: Date.now(),
      item: shallowClone(entry),
      summary: `Removed ${entry.type || 'item'} ${entry.name || entry.id} from inventory`,
    })
    this.persistState()
    return entry
  }

  credit(playerId, value, context = {}) {
    const ledger = this.ensurePlayerLedger(playerId)
    if (!ledger) throw new Error('missing player ledger')
    const amount = normalizeCurrency(value)
    ledger.currency = addCurrency(ledger.currency, amount)
    this.recordTransaction(playerId, {
      id: uuid(),
      type: 'currency:credit',
      at: Date.now(),
      amount,
      context,
      summary: `Received ${amount.bytes} Bytes and ${amount.bits} Bits`,
    })
    this.persistState()
    return ledger.currency
  }

  debit(playerId, value, context = {}) {
    const ledger = this.ensurePlayerLedger(playerId)
    if (!ledger) throw new Error('missing player ledger')
    const amount = normalizeCurrency(value)
    if (!hasCurrency(ledger.currency, amount)) {
      throw new Error('insufficient funds')
    }
    ledger.currency = subtractCurrency(ledger.currency, amount)
    this.recordTransaction(playerId, {
      id: uuid(),
      type: 'currency:debit',
      at: Date.now(),
      amount,
      context,
      summary: `Spent ${amount.bytes} Bytes and ${amount.bits} Bits`,
    })
    this.persistState()
    return ledger.currency
  }

  recordTransaction(playerId, entry) {
    const ledger = this.ensurePlayerLedger(playerId)
    if (!ledger) return
    ledger.transactions.record(entry)
    this.transactionLogs.set(playerId, ledger.transactions)
    const event = { playerId, entry }
    this.emit('transaction', event)
    this.world.events.emit('economy:transaction', event)
  }

  listItem(playerId, itemId, price, { category, metadata } = {}) {
    const ledger = this.ensurePlayerLedger(playerId)
    if (!ledger) throw new Error('missing player ledger')
    const normalizedPrice = normalizeCurrency(price)
    const item = ledger.inventory.get(itemId)
    if (!item) throw new Error('item not found in inventory')
    ledger.inventory.delete(itemId)
    const listing = {
      id: uuid(),
      item: shallowClone(item),
      price: normalizedPrice,
      sellerId: playerId,
      buyerId: null,
      status: 'listed',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      category: category || item.type || 'general',
      metadata: metadata ? shallowClone(metadata) : undefined,
    }
    this.auctions.set(listing.id, listing)
    ledger.listings.add(listing.id)
    this.addListingToSeller(playerId, listing.id)
    this.indexListing(listing)
    this.recordTransaction(playerId, {
      id: uuid(),
      type: 'auction:list',
      at: Date.now(),
      listingId: listing.id,
      price: normalizedPrice,
      item: shallowClone(item),
      summary: `Listed ${item.type || 'item'} ${item.name || item.id} for auction`,
    })
    this.persistState()
    const snapshot = createListingSnapshot(listing)
    this.emit('auction:list', snapshot)
    this.world.events.emit('economy:auction:list', snapshot)
    return snapshot
  }

  cancelListing(playerId, listingId) {
    const listing = this.auctions.get(listingId)
    if (!listing) return null
    if (listing.sellerId !== playerId) throw new Error('cannot cancel another players listing')
    if (listing.status !== 'listed') throw new Error('listing not active')
    this.unlockListing(listingId)
    this.auctions.delete(listingId)
    this.removeListingFromSeller(playerId, listingId)
    const ledger = this.ensurePlayerLedger(playerId)
    if (ledger) {
      ledger.listings.delete(listingId)
      ledger.inventory.set(listing.item.id, shallowClone(listing.item))
      this.recordTransaction(playerId, {
        id: uuid(),
        type: 'auction:cancel',
        at: Date.now(),
        listingId,
        item: shallowClone(listing.item),
        summary: `Cancelled listing ${listing.item.name || listing.item.id}`,
      })
    }
    this.unindexListing(listing)
    this.persistState()
    const snapshot = createListingSnapshot(listing)
    snapshot.status = 'cancelled'
    this.emit('auction:cancel', snapshot)
    this.world.events.emit('economy:auction:cancel', snapshot)
    return snapshot
  }

  purchaseListing(listingId, buyerId) {
    const listing = this.auctions.get(listingId)
    if (!listing) throw new Error('listing not found')
    if (listing.status !== 'listed') throw new Error('listing not available')
    if (!this.tryLockListing(listingId)) {
      throw new Error('listing locked')
    }
    try {
      const buyerLedger = this.ensurePlayerLedger(buyerId)
      if (!buyerLedger) throw new Error('missing buyer ledger')
      if (!hasCurrency(buyerLedger.currency, listing.price)) {
        throw new Error('buyer has insufficient funds')
      }
      const sellerLedger = this.ensurePlayerLedger(listing.sellerId)
      if (!sellerLedger) throw new Error('missing seller ledger')
      buyerLedger.currency = subtractCurrency(buyerLedger.currency, listing.price)
      sellerLedger.currency = addCurrency(sellerLedger.currency, listing.price)
      buyerLedger.inventory.set(listing.item.id, shallowClone(listing.item))
      sellerLedger.listings.delete(listing.id)
      this.removeListingFromSeller(listing.sellerId, listing.id)
      listing.status = 'sold'
      listing.buyerId = buyerId
      listing.updatedAt = Date.now()
      listing.soldAt = listing.updatedAt
      this.auctions.delete(listingId)
      this.unindexListing(listing)

      const buyerContext = {
        listingId,
        sellerId: listing.sellerId,
        item: shallowClone(listing.item),
      }
      const sellerContext = {
        listingId,
        buyerId,
        item: shallowClone(listing.item),
      }
      this.recordTransaction(buyerId, {
        id: uuid(),
        type: 'auction:purchase',
        at: listing.updatedAt,
        amount: normalizeCurrency(listing.price),
        context: buyerContext,
        summary: `Purchased ${listing.item.name || listing.item.id}`,
      })
      this.recordTransaction(listing.sellerId, {
        id: uuid(),
        type: 'auction:sale',
        at: listing.updatedAt,
        amount: normalizeCurrency(listing.price),
        context: sellerContext,
        summary: `Sold ${listing.item.name || listing.item.id}`,
      })
      this.persistState()
      const snapshot = createListingSnapshot(listing)
      this.emit('auction:sold', snapshot)
      this.world.events.emit('economy:auction:sold', snapshot)
      return snapshot
    } finally {
      this.unlockListing(listingId)
    }
  }

  tryLockListing(listingId) {
    if (this.listingLocks.has(listingId)) return false
    this.listingLocks.add(listingId)
    return true
  }

  unlockListing(listingId) {
    this.listingLocks.delete(listingId)
  }

  indexListing(listing) {
    const category = listing.category || listing.item?.type || 'general'
    if (!this.categoryIndex.has(category)) {
      this.categoryIndex.set(category, new Set())
    }
    this.categoryIndex.get(category).add(listing.id)
  }

  unindexListing(listing) {
    const category = listing.category || listing.item?.type || 'general'
    const index = this.categoryIndex.get(category)
    if (index) {
      index.delete(listing.id)
      if (index.size === 0) {
        this.categoryIndex.delete(category)
      }
    }
  }

  addListingToSeller(playerId, listingId) {
    if (!this.playerListings.has(playerId)) {
      this.playerListings.set(playerId, new Set())
    }
    this.playerListings.get(playerId).add(listingId)
  }

  removeListingFromSeller(playerId, listingId) {
    const set = this.playerListings.get(playerId)
    if (!set) return
    set.delete(listingId)
    if (set.size === 0) {
      this.playerListings.delete(playerId)
    }
  }

  getListings({ category } = {}) {
    if (!category) {
      return Array.from(this.auctions.values()).map(listing => createListingSnapshot(listing))
    }
    const set = this.categoryIndex.get(category)
    if (!set) return []
    const result = []
    set.forEach(id => {
      const listing = this.auctions.get(id)
      if (listing) {
        result.push(createListingSnapshot(listing))
      }
    })
    return result
  }

  linkCompanion(companionId, playerId) {
    if (!companionId || !playerId) return
    this.ensurePlayerLedger(playerId)
    this.companionToPlayer.set(companionId, playerId)
    if (!this.playerToCompanions.has(playerId)) {
      this.playerToCompanions.set(playerId, new Set())
    }
    this.playerToCompanions.get(playerId).add(companionId)
  }

  unlinkCompanion(companionId) {
    const playerId = this.companionToPlayer.get(companionId)
    if (!playerId) return
    this.companionToPlayer.delete(companionId)
    const set = this.playerToCompanions.get(playerId)
    if (set) {
      set.delete(companionId)
      if (set.size === 0) this.playerToCompanions.delete(playerId)
    }
  }

  getCompanionLedger(companionId) {
    const playerId = this.companionToPlayer.get(companionId)
    if (!playerId) return null
    return this.getPlayerSnapshot(playerId)
  }
}
