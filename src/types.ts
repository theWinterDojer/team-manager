export type Team = {
  id: string
  name: string
}

export type Player = {
  id: string
  name: string
}

export type Position = {
  id: string
  label: string
  shortLabel: string
  x: number
  y: number
}

export type Lineup = {
  id: string
  name: string
  assignments: Record<string, string | null>
  wildcardPlayerId: string | null
  updatedAt: string
}

export type Settings = {
  wildcardEnabled: boolean
  hasOnboarded: boolean
  roverEnabled: boolean
}

export type AppState = {
  schemaVersion: 1
  team: Team
  roster: Player[]
  positions: Position[]
  lineups: Lineup[]
  activeLineupId: string
  settings: Settings
}
