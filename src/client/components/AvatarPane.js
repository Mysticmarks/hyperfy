import { css } from '@firebolt-dev/css'
import { useEffect, useRef, useState } from 'react'
import { XIcon } from 'lucide-react'

import { usePane } from './usePane'
import { AvatarPreview } from '../AvatarPreview'
import { formatBytes } from '../../core/extras/formatBytes'

export function AvatarPane({ world, info }) {
  const paneRef = useRef()
  const headRef = useRef()
  const viewportRef = useRef()
  const [previewInfo, setPreviewInfo] = useState(null)
  usePane('avatar', paneRef, headRef)
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return undefined
    const preview = new AvatarPreview(world, viewport)
    let mounted = true
    preview.load(info.file, info.url).then(result => {
      if (mounted) {
        setPreviewInfo(result)
      }
    })
    return () => {
      mounted = false
      preview.destroy()
    }
  }, [world, info.file, info.url])
  return (
    <div
      ref={paneRef}
      className='vpane'
      css={css`
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 16rem;
        background: rgba(11, 10, 21, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 1.375rem;
        backdrop-filter: blur(5px);
        pointer-events: auto;
        display: flex;
        flex-direction: column;
        font-size: 1rem;
        overflow: hidden;
        .vpane-head {
          height: 3.125rem;
          display: flex;
          align-items: center;
          padding: 0 0.3rem 0 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          &-title {
            font-size: 1rem;
            font-weight: 500;
            flex: 1;
          }
          &-close {
            width: 2.5rem;
            height: 2.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #5d6077;
            &:hover {
              cursor: pointer;
              color: white;
            }
          }
        }
        .vpane-content {
          flex: 1;
          position: relative;
        }
        .vpane-viewport {
          height: 17rem;
          position: relative;
        }
        .vpane-viewport-inner {
          position: absolute;
          inset: 0;
        }
        .vpane-actions {
          display: flex;
          align-items: center;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .vpane-action {
          flex: 1;
          height: 2.7rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9375rem;
          &.bl {
            border-left: 1px solid rgba(255, 255, 255, 0.1);
          }
          &:hover {
            cursor: pointer;
          }
        }
        .vpane-stats {
          padding: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .vpane-rank {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
          font-weight: 500;
        }
        .vpane-rank-badge {
          font-size: 0.8125rem;
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
        }
        .vpane-statlist {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem 0.5rem;
          font-size: 0.875rem;
        }
        .vpane-stat {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .vpane-stat-label {
          color: rgba(255, 255, 255, 0.65);
          font-size: 0.75rem;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        .vpane-stat-value {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-weight: 500;
        }
        .vpane-stat-rank {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.5);
        }
      `}
    >
      <div className='vpane-head' ref={headRef}>
        <div className='vpane-head-title'>Avatar</div>
        <div className='vpane-head-close' onClick={() => world.emit('avatar', null)}>
          <XIcon size={20} />
        </div>
      </div>
      <div className='vpane-content'>
        <div className='vpane-viewport'>
          <div className='vpane-viewport-inner' ref={viewportRef}></div>
        </div>
        {previewInfo && <AvatarStats info={previewInfo} />}
        <div className='vpane-actions'>
          <div className='vpane-action' onClick={info.onEquip}>
            <span>Equip</span>
          </div>
          {info.canPlace && (
            <div className='vpane-action bl' onClick={info.onPlace}>
              <span>Place</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const rankLabels = {
  5: 'Perfect',
  4: 'Great',
  3: 'Good',
  2: 'Heavy',
  1: 'Very Poor',
}

const statDescriptors = [
  { key: 'bounds', label: 'Bounds', format: value => value.map(size => `${size}m`).join(' × ') },
  { key: 'triangles', label: 'Triangles', format: value => value.toLocaleString() },
  { key: 'draws', label: 'Draw Calls', format: value => value.toLocaleString() },
  { key: 'bones', label: 'Bones', format: value => value.toLocaleString() },
  { key: 'fileSize', label: 'File Size', format: value => formatBytes(value) },
]

function AvatarStats({ info }) {
  return (
    <div className='vpane-stats'>
      <div className='vpane-rank'>
        <span>{rankLabels[info.rank] || 'Unranked'}</span>
        <span className='vpane-rank-badge'>Rank {info.rank}</span>
      </div>
      <div className='vpane-statlist'>
        {statDescriptors.map(descriptor => {
          const stat = info.stats[descriptor.key]
          if (!stat) return null
          return (
            <div key={descriptor.key} className='vpane-stat'>
              <span className='vpane-stat-label'>{descriptor.label}</span>
              <span className='vpane-stat-value'>
                {descriptor.format(stat.value)}
                <span className='vpane-stat-rank'>≥ Rank {stat.rank}</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
