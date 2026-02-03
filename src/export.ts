import type { AppState, Position } from './types'
import { clamp, splitName } from './utils'

type SvgOptions = {
  teamName: string
  positions: Position[]
  assignments: Record<string, string | null>
  playerNames: Record<string, string>
  includeDate: boolean
}

const viewBoxWidth = 360
const viewBoxHeight = 480

const estimateWidth = (text: string, base = 7) => {
  return clamp(text.length * base + 12, 44, 110)
}

const renderLabel = (position: Position, name: string | null) => {
  const display = name || position.shortLabel
  const lines = splitName(display, 12)
  const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0)
  const width = estimateWidth(''.padEnd(longestLine, 'a'))
  const height = lines.length > 1 ? 28 : 18
  const x = (position.x / 100) * viewBoxWidth
  const y = (position.y / 100) * viewBoxHeight
  const rectX = x - width / 2
  const rectY = y - height / 2
  const textY = rectY + (lines.length > 1 ? 12 : 13)

  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : 12
      return `<tspan x="${x}" dy="${dy}">${line}</tspan>`
    })
    .join('')

  return `
    <g>
      <rect x="${rectX}" y="${rectY}" width="${width}" height="${height}" rx="9" fill="#F9F6F0" />
      <text x="${x}" y="${textY}" text-anchor="middle">${tspans}</text>
    </g>
  `
}

export const buildFieldSvg = ({ teamName, positions, assignments, playerNames, includeDate }: SvgOptions) => {
  const labels = positions
    .map((position) => renderLabel(position, playerNames[assignments[position.id] || ''] || null))
    .join('')

  const dateLabel = includeDate
    ? `<text x="280" y="456" text-anchor="middle" font-size="14" font-weight="600" fill="#1E1F21">${new Date().toLocaleDateString()}</text>`
    : ''

  return `
  <svg width="${viewBoxWidth}" height="${viewBoxHeight}" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="labelShadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000000" flood-opacity="0.2" />
      </filter>
    </defs>

    <rect width="360" height="480" rx="24" fill="#7fb052" />
    <path d="M8 254 A172 192 0 0 1 352 254 L180 425 Z" fill="#7fb052" />
    <path d="M8 254 A172 192 0 0 1 352 254 L180 425 Z" fill="none" stroke="#1f4d2b" stroke-width="7" stroke-linejoin="round" />
    <path d="M50 285 A130 130 0 0 1 310 285 L50 285 Z" fill="#f0ad4e" />
    <path d="M50 285 L180 410 L310 285 Z" fill="#f0ad4e" />
    <polygon points="180,220 260,300 180,380 100,300" fill="#7fb052" />
    <circle cx="180" cy="300" r="18" fill="#f0ad4e" />
    <rect x="172" y="296" width="16" height="8" rx="2" fill="#ffffff" />
    <rect x="173" y="213" width="14" height="14" fill="#ffffff" transform="rotate(45 180 220)" />
    <rect x="253" y="293" width="14" height="14" fill="#ffffff" transform="rotate(45 260 300)" />
    <rect x="93" y="293" width="14" height="14" fill="#ffffff" transform="rotate(45 100 300)" />
    <circle cx="180" cy="400" r="30" fill="#f0ad4e" />
    <polygon points="168,390 192,390 192,402 180,417 168,402" fill="#ffffff" />
    <line x1="180" y1="400" x2="24" y2="240" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
    <line x1="180" y1="400" x2="336" y2="240" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />

    <text x="180" y="42" text-anchor="middle" font-family="Bricolage Grotesque, sans-serif" font-size="16" fill="#1E1F21">${teamName}</text>
    ${dateLabel}

    <g font-family="IBM Plex Sans, sans-serif" font-size="12" fill="#1E1F21" filter="url(#labelShadow)">
      ${labels}
    </g>
  </svg>
  `
}

const loadImage = (src: string) => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export const exportSvgToPng = async (svgMarkup: string) => {
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  const img = await loadImage(url)
  const exportWidth = 1080
  const exportHeight = 1440
  const padding = 24
  const renderedHeight = exportHeight - padding * 2
  const scale = renderedHeight / viewBoxHeight
  const renderedWidth = viewBoxWidth * scale
  const offsetX = (exportWidth - renderedWidth) / 2

  const canvas = document.createElement('canvas')
  canvas.width = exportWidth
  canvas.height = exportHeight

  const context = canvas.getContext('2d')
  if (!context) {
    URL.revokeObjectURL(url)
    throw new Error('Canvas context unavailable')
  }

  context.fillStyle = '#F4F6F2'
  context.fillRect(0, 0, exportWidth, exportHeight)
  context.drawImage(img, offsetX, padding, renderedWidth, renderedHeight)

  URL.revokeObjectURL(url)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to export PNG'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}

export const buildSvgFromState = (state: AppState, includeDate: boolean) => {
  const positions = state.settings.roverEnabled
    ? state.positions
    : state.positions.filter((position) => position.id !== 'pos_rover')
  const lineup = state.lineups.find((entry) => entry.id === state.activeLineupId)
  if (!lineup) {
    return buildFieldSvg({
      teamName: state.team.name,
      positions,
      assignments: createEmptyAssignments(positions),
      playerNames: {},
      includeDate,
    })
  }

  const playerNames = state.roster.reduce<Record<string, string>>((accumulator, player) => {
    accumulator[player.id] = player.name
    return accumulator
  }, {})

  return buildFieldSvg({
    teamName: state.team.name,
    positions,
    assignments: lineup.assignments,
    playerNames,
    includeDate,
  })
}

const createEmptyAssignments = (positions: Position[]) => {
  return positions.reduce<Record<string, string | null>>((accumulator, position) => {
    accumulator[position.id] = null
    return accumulator
  }, {})
}
