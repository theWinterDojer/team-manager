import type { AppState, Lineup, Position } from './types'
import { defaultPositions } from './positions'

const nowIso = () => new Date().toISOString()

export const createAssignments = (positions: Position[]) => {
  return positions.reduce<Record<string, string | null>>((accumulator, position) => {
    accumulator[position.id] = null
    return accumulator
  }, {})
}

export const createLineup = (positions: Position[]): Lineup => {
  return {
    id: 'lineup_1',
    name: 'Default',
    assignments: createAssignments(positions),
    wildcardPlayerId: null,
    updatedAt: nowIso(),
  }
}

export const createDefaultState = (): AppState => {
  const positions = defaultPositions.map((position) => ({ ...position }))
  return {
    schemaVersion: 1,
    team: { id: 'team_1', name: '' },
    roster: [],
    positions,
    lineups: [createLineup(positions)],
    activeLineupId: 'lineup_1',
    settings: { wildcardEnabled: true, hasOnboarded: false, roverEnabled: false },
  }
}

export const normalizeState = (state: AppState | null): AppState => {
  if (!state) {
    return createDefaultState()
  }

  const positions = state.positions?.length ? state.positions : defaultPositions
  const lineups = state.lineups?.length ? state.lineups : [createLineup(positions)]
  const activeLineupId = state.activeLineupId || lineups[0]?.id || 'lineup_1'

  const normalizedLineups = lineups.map((lineup, index) => {
    const assignments = { ...createAssignments(positions), ...lineup.assignments }
    return {
      ...lineup,
      id: lineup.id || `lineup_${index + 1}`,
      name: lineup.name || `Lineup ${index + 1}`,
      assignments,
    }
  })

  return {
    schemaVersion: 1,
    team: state.team || { id: 'team_1', name: '' },
    roster: state.roster || [],
    positions,
    lineups: normalizedLineups,
    activeLineupId,
    settings: {
      wildcardEnabled: state.settings?.wildcardEnabled ?? true,
      hasOnboarded: state.settings?.hasOnboarded ?? false,
      roverEnabled: state.settings?.roverEnabled ?? false,
    },
  }
}
