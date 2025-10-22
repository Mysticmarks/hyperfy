import { css } from '@firebolt-dev/css'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BoxIcon,
  BrickWallIcon,
  CrosshairIcon,
  EyeIcon,
  EyeOffIcon,
  FileCode2Icon,
  HardDriveIcon,
  HashIcon,
  RotateCcwIcon,
  SearchIcon,
  SettingsIcon,
  TriangleIcon,
  XIcon,
} from 'lucide-react'

import { usePane } from './usePane'
import { cls } from './cls'
import { orderBy } from 'lodash-es'
import { formatBytes } from '../../core/extras/formatBytes'
import { useFocusTrap } from './useFocusTrap'
import { useRank } from './useRank'

export function AppsPane({ world, close, visible = true }) {
  const paneRef = useRef()
  const headRef = useRef()
  usePane('apps', paneRef, headRef)
  useFocusTrap(paneRef, { active: visible })
  const player = world.entities.player
  const { isBuilder } = useRank(world, player)
  const [query, setQuery] = useState('')
  const [refresh, setRefresh] = useState(0)
  return (
    <div
      ref={paneRef}
      className='apane'
      css={css`
        position: absolute;
        top: 0;
        left: 0;
        width: min(40rem, calc(100vw - 4rem));
        background-color: var(--hf-color-surface);
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        font-size: 1rem;
        border: 1px solid var(--hf-color-border);
        border-radius: 1rem;
        box-shadow: var(--hf-shadow-soft);
        color: var(--hf-color-text);
        opacity: ${visible ? 1 : 0};
        transform: translateY(${visible ? '0' : '12px'});
        transition: opacity 200ms ease, transform 200ms ease;
        .apane-head {
          height: 3.125rem;
          background: var(--hf-color-surface-raised);
          display: flex;
          align-items: center;
          padding: 0 1.25rem;
          &-title {
            font-size: 1.2rem;
            font-weight: 500;
            flex: 1;
          }
          &-search {
            width: 9.375rem;
            display: flex;
            align-items: center;
            svg {
              margin-right: 0.3125rem;
            }
            input {
              flex: 1;
              font-size: 1rem;
            }
          }
          &-btn {
            width: 1.875rem;
            height: 2.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--hf-color-text-muted);
            background: none;
            border: none;
            &:hover {
              cursor: pointer;
              color: var(--hf-color-heading);
            }
          }
        }
      `}
      role='dialog'
      aria-modal='true'
      aria-label='Apps'
      aria-hidden={!visible}
      tabIndex={-1}
    >
      <div className='apane-head' ref={headRef}>
        <div className='apane-head-title'>Apps</div>
        <div className='apane-head-search'>
          <SearchIcon size={16} />
          <input
            type='text'
            placeholder='Search apps'
            aria-label='Search apps'
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <button className='apane-head-btn' type='button' onClick={() => setRefresh(n => n + 1)} aria-label='Refresh list'>
          <RotateCcwIcon size={16} />
        </button>
        <button className='apane-head-btn' type='button' onClick={close} aria-label='Close apps pane'>
          <XIcon size={20} />
        </button>
      </div>
      <AppsPaneContent
        world={world}
        query={query}
        refresh={refresh}
        setRefresh={setRefresh}
        isBuilder={isBuilder}
      />
    </div>
  )
}

function AppsPaneContent({ world, query, refresh, setRefresh, isBuilder }) {
  const [sort, setSort] = useState('count')
  const [asc, setAsc] = useState(false)
  const [activeItem, setActiveItem] = useState(null)
  const items = useMemo(() => {
    // Use refresh as a memo-buster when manual recomputation is requested.
    void refresh
    const itemMap = new Map() // id -> { blueprint, count }
    const results = []
    for (const [_, entity] of world.entities.items) {
      if (!entity.isApp) continue
      const blueprint = entity.blueprint
      if (!blueprint) continue // still loading?
      let item = itemMap.get(blueprint.id)
      if (!item) {
        const count = 0
        const type = blueprint.model.endsWith('.vrm') ? 'avatar' : 'model'
        const model = world.loader.get(type, blueprint.model)
        if (!model) continue
        const stats = model.getStats()
        const name = blueprint.name || '-'
        item = {
          blueprint,
          keywords: name.toLowerCase(),
          name,
          count,
          geometries: stats.geometries.size,
          triangles: stats.triangles,
          textureBytes: stats.textureBytes,
          textureSize: formatBytes(stats.textureBytes),
          code: blueprint.script ? 1 : 0,
          fileBytes: stats.fileBytes,
          fileSize: formatBytes(stats.fileBytes),
        }
        itemMap.set(blueprint.id, item)
      }
      item.count += 1
    }
    for (const [_, item] of itemMap) {
      results.push(item)
    }
    return results
  }, [refresh, world])
  const normalizedQuery = query ? query.trim().toLowerCase() : ''
  const filteredItems = useMemo(() => {
    let newItems = items
    if (normalizedQuery) {
      newItems = newItems.filter(item => item.keywords.includes(normalizedQuery))
    }
    newItems = orderBy(newItems, sort, asc ? 'asc' : 'desc')
    return newItems
  }, [items, sort, asc, normalizedQuery])
  const reorder = key => {
    if (sort === key) {
      setAsc(!asc)
    } else {
      setSort(key)
      setAsc(false)
    }
  }
  useEffect(() => {
    return () => world.target.hide()
  }, [world.target])
  const getClosest = item => {
    // find closest entity
    const playerPosition = world.rig.position
    let closestEntity
    let closestDistance = null
    for (const [_, entity] of world.entities.items) {
      if (entity.blueprint === item.blueprint) {
        const distance = playerPosition.distanceTo(entity.root.position)
        if (closestDistance === null || closestDistance > distance) {
          closestEntity = entity
          closestDistance = distance
        }
      }
    }
    return closestEntity
  }
  const toggleTarget = item => {
    if (!isBuilder) {
      const message =
        world.ui?.getLocalizedString?.(
          'ui.apps.highlight.buildersOnly',
          'Highlighting apps is available to builders only.'
        ) || 'Highlighting apps is available to builders only.'
      world.emit('toast', message)
      return
    }
    if (activeItem === item) {
      world.target.hide()
      setActiveItem(null)
      return
    }
    const entity = getClosest(item)
    if (!entity) return
    world.target.show(entity.root.position)
    setActiveItem(item)
  }
  const inspect = item => {
    const entity = getClosest(item)
    if (!entity) return
    world.ui.toggleApps(false)
    world.ui.setMenu({ type: 'app', app: entity })
  }
  const toggle = item => {
    const blueprint = world.blueprints.get(item.blueprint.id)
    const version = blueprint.version + 1
    const disabled = !blueprint.disabled
    world.blueprints.modify({ id: blueprint.id, version, disabled })
    world.network.send('blueprintModified', { id: blueprint.id, version, disabled })
    setRefresh(n => n + 1)
  }
  return (
    <div
      className='asettings'
      css={css`
        flex: 1;
        padding: 1.25rem 1.25rem 0;
        .asettings-head {
          position: sticky;
          top: 0;
          display: flex;
          align-items: center;
          margin: 0 0 0.3125rem;
          background: var(--hf-color-surface);
          border-bottom: 1px solid var(--hf-color-border);
          padding-bottom: 0.5rem;
        }
        .asettings-headitem {
          font-size: 1rem;
          font-weight: 500;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          color: var(--hf-color-text-muted);
          background: none;
          border: none;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 0;
          height: 2rem;
          &.name {
            flex: 1;
            justify-content: flex-start;
          }
          &.code {
            width: 3rem;
            text-align: right;
          }
          &.count,
          &.geometries,
          &.triangles {
            width: 4rem;
            text-align: right;
          }
          &.textureSize,
          &.fileSize {
            width: 5rem;
            text-align: right;
          }
          &.actions {
            width: 5.45rem;
            text-align: right;
          }
          &:hover:not(.active) {
            cursor: pointer;
            color: var(--hf-color-heading);
          }
          &.active {
            color: var(--hf-color-primary);
          }
        }
        .asettings-rows {
          overflow-y: auto;
          padding-bottom: 1.25rem;
          max-height: 18.75rem;
        }
        .asettings-row {
          display: flex;
          align-items: center;
          margin: 0 0 0.3125rem;
          border-radius: 0.4rem;
          &:hover {
            background: var(--hf-color-surface-hover);
          }
        }
        .asettings-rowitem {
          font-size: 1rem;
          color: var(--hf-color-text);
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
          display: flex;
          align-items: center;
          &.name {
            flex: 1;
          }
          &.code {
            width: 3rem;
            text-align: right;
          }
          &.count,
          &.geometries,
          &.triangles {
            width: 4rem;
            text-align: right;
          }
          &.textureSize,
          &.fileSize {
            width: 5rem;
            text-align: right;
          }
          &.actions {
            width: 5.45rem;
            display: flex;
            justify-content: flex-end;
          }
        }
        .asettings-action {
          margin-left: 0.625rem;
          color: var(--hf-color-text-muted);
          background: none;
          border: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          &.active {
            color: var(--hf-color-primary);
          }
          &.red {
            color: #fb4848;
          }
          &:hover {
            cursor: pointer;
          }
          &:hover:not(.active):not(.red) {
            color: var(--hf-color-heading);
          }
        }
      `}
    >
      <div className='asettings-head'>
        <button
          type='button'
          className={cls('asettings-headitem name', { active: sort === 'name' })}
          onClick={() => reorder('name')}
          title='Name'
        >
          <span>Name</span>
        </button>
        <button
          type='button'
          className={cls('asettings-headitem count', { active: sort === 'count' })}
          onClick={() => reorder('count')}
          title='Instances'
        >
          <HashIcon size={16} />
        </button>
        <button
          type='button'
          className={cls('asettings-headitem geometries', { active: sort === 'geometries' })}
          onClick={() => reorder('geometries')}
          title='Geometries'
        >
          <BoxIcon size={16} />
        </button>
        <button
          type='button'
          className={cls('asettings-headitem triangles', { active: sort === 'triangles' })}
          onClick={() => reorder('triangles')}
          title='Triangles'
        >
          <TriangleIcon size={16} />
        </button>
        <button
          type='button'
          className={cls('asettings-headitem textureSize', { active: sort === 'textureBytes' })}
          onClick={() => reorder('textureBytes')}
          title='Texture Memory Size'
        >
          <BrickWallIcon size={16} />
        </button>
        <button
          type='button'
          className={cls('asettings-headitem code', { active: sort === 'code' })}
          onClick={() => reorder('code')}
          title='Code'
        >
          <FileCode2Icon size={16} />
        </button>
        <button
          type='button'
          className={cls('asettings-headitem fileSize', { active: sort === 'fileBytes' })}
          onClick={() => reorder('fileBytes')}
          title='File Size'
        >
          <HardDriveIcon size={16} />
        </button>
        <div className='asettings-headitem actions' aria-hidden='true' />
      </div>
      <div className='asettings-rows noscrollbar'>
        {filteredItems.map(item => (
          <div key={item.blueprint.id} className='asettings-row'>
            <div
              className='asettings-rowitem name'
              role='button'
              tabIndex={0}
              onClick={() => toggleTarget(item)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggleTarget(item)
                }
              }}
            >
              <span>{item.name}</span>
            </div>
            <div className='asettings-rowitem count'>
              <span>{item.count}</span>
            </div>
            <div className='asettings-rowitem geometries'>
              <span>{item.geometries}</span>
            </div>
            <div className='asettings-rowitem triangles'>
              <span>{formatNumber(item.triangles)}</span>
            </div>
            <div className='asettings-rowitem textureSize'>
              <span>{item.textureSize}</span>
            </div>
            <div className='asettings-rowitem code'>
              <span>{item.code ? 'Yes' : 'No'}</span>
            </div>
            <div className='asettings-rowitem fileSize'>
              <span>{item.fileSize}</span>
            </div>
            <div className={'asettings-rowitem actions'}>
              <button
                type='button'
                className={cls('asettings-action', { red: item.blueprint.disabled })}
                onClick={() => toggle(item)}
                aria-label={item.blueprint.disabled ? 'Enable app' : 'Disable app'}
              >
                {item.blueprint.disabled ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
              </button>
              <button
                type='button'
                className={cls('asettings-action', { active: activeItem === item })}
                onClick={() => toggleTarget(item)}
                aria-label='Highlight nearest instance'
              >
                <CrosshairIcon size={16} />
              </button>
              <button
                type='button'
                className={'asettings-action'}
                onClick={() => inspect(item)}
                aria-label='Inspect app'
              >
                <SettingsIcon size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) {
    return '0'
  }
  const million = 1000000
  const thousand = 1000
  let result
  if (num >= million) {
    result = (num / million).toFixed(1) + 'M'
  } else if (num >= thousand) {
    result = (num / thousand).toFixed(1) + 'K'
  } else {
    result = Math.round(num).toString()
  }
  return result
    .replace(/\.0+([KM])?$/, '$1') // Replace .0K with K or .0M with M
    .replace(/(\.\d+[1-9])0+([KM])?$/, '$1$2') // Trim trailing zeros (1.50M → 1.5M)
}
