import React from 'react'
import { abbreviateSector } from '../utils/abbreviateSector'

type SectorTickProps = {
  x?: number
  y?: number
  payload?: { value: string }
}

const SectorTick: React.FC<SectorTickProps> = ({ x, y, payload }) => {
  if (x === undefined || y === undefined || !payload) return null
  const label = abbreviateSector(payload.value)
  return (
    <g transform={`translate(${x},${y}) rotate(-90)`}>
      <text textAnchor="end" dominantBaseline="central" fill="#9aa4b3ff" fontSize={10} fontWeight={600}>
        {label}
      </text>
    </g>
  )
}

export default SectorTick
