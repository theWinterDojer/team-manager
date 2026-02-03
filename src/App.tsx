import { useEffect, useMemo, useState } from 'react'
import './App.css'
import type { AppState, Lineup, Player } from './types'
import { createAssignments, createDefaultState, normalizeState } from './state'
import { clearAppState, loadAppState, saveAppState } from './storage'
import { buildSvgFromState, exportSvgToPng } from './export'
import { nextId } from './utils'

const nowIso = () => new Date().toISOString()
type PanelKey = 'roster' | 'assignments' | 'export' | 'settings'

const getActiveLineup = (state: AppState) => {
  return state.lineups.find((lineup) => lineup.id === state.activeLineupId) || state.lineups[0]
}

function App() {
  const [state, setState] = useState<AppState>(() => createDefaultState())
  const [hydrated, setHydrated] = useState(false)
  const [activePositionId, setActivePositionId] = useState<string | null>(null)
  const [playerDraft, setPlayerDraft] = useState('')
  const [bulkDraft, setBulkDraft] = useState('')
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [includeDate, setIncludeDate] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [collapsedPanels, setCollapsedPanels] = useState<Record<PanelKey, boolean>>({
    roster: false,
    assignments: false,
    export: false,
    settings: false,
  })

  const lineup = useMemo(() => getActiveLineup(state), [state])
  const positionLabelById = useMemo(() => {
    return state.positions.reduce<Record<string, string>>((accumulator, position) => {
      accumulator[position.id] = position.shortLabel
      return accumulator
    }, {})
  }, [state.positions])
  const assignedByPlayerId = useMemo(() => {
    const assigned: Record<string, string> = {}
    Object.entries(lineup.assignments).forEach(([positionId, playerId]) => {
      if (!playerId) {
        return
      }
      const label = positionLabelById[positionId]
      if (label) {
        assigned[playerId] = label
      }
    })
    if (state.settings.wildcardEnabled && lineup.wildcardPlayerId) {
      assigned[lineup.wildcardPlayerId] = 'W'
    }
    return assigned
  }, [lineup, positionLabelById, state.settings.wildcardEnabled])
  const svgMarkup = useMemo(() => buildSvgFromState(state, includeDate), [state, includeDate])

  useEffect(() => {
    loadAppState().then((stored) => {
      setState(normalizeState(stored))
      setHydrated(true)
    })
  }, [])

  useEffect(() => {
    if (!hydrated) {
      return
    }
    const handle = window.setTimeout(() => {
      saveAppState(state)
    }, 250)
    return () => window.clearTimeout(handle)
  }, [state, hydrated])

  const updateLineup = (updater: (lineup: Lineup) => Lineup) => {
    setState((current) => {
      const activeId = current.activeLineupId
      const updatedLineups = current.lineups.map((entry) =>
        entry.id === activeId ? updater(entry) : entry,
      )
      return { ...current, lineups: updatedLineups }
    })
  }

  const updateRoster = (updater: (roster: Player[]) => Player[]) => {
    setState((current) => ({ ...current, roster: updater(current.roster) }))
  }

  const visiblePositions = state.settings.roverEnabled
    ? state.positions
    : state.positions.filter((position) => position.id !== 'pos_rover')

  const togglePanel = (key: PanelKey) => {
    setCollapsedPanels((current) => ({ ...current, [key]: !current[key] }))
  }


  const clearPlayerAssignments = (lineupToClear: Lineup, playerId: string) => {
    const assignments = { ...lineupToClear.assignments }
    Object.keys(assignments).forEach((positionId) => {
      if (assignments[positionId] === playerId) {
        assignments[positionId] = null
      }
    })
    const wildcardPlayerId = lineupToClear.wildcardPlayerId === playerId ? null : lineupToClear.wildcardPlayerId
    return { ...lineupToClear, assignments, wildcardPlayerId }
  }

  const assignPlayerToPosition = (positionId: string, playerId: string) => {
    updateLineup((lineupToUpdate) => {
      const cleared = clearPlayerAssignments(lineupToUpdate, playerId)
      return {
        ...cleared,
        assignments: { ...cleared.assignments, [positionId]: playerId },
        updatedAt: nowIso(),
      }
    })
    setActivePositionId(null)
  }

  const clearPosition = (positionId: string) => {
    updateLineup((lineupToUpdate) => ({
      ...lineupToUpdate,
      assignments: { ...lineupToUpdate.assignments, [positionId]: null },
      updatedAt: nowIso(),
    }))
  }

  const assignWildcard = (playerId: string) => {
    updateLineup((lineupToUpdate) => {
      const cleared = clearPlayerAssignments(lineupToUpdate, playerId)
      return {
        ...cleared,
        wildcardPlayerId: playerId,
        updatedAt: nowIso(),
      }
    })
    setActivePositionId(null)
  }

  const clearWildcard = () => {
    updateLineup((lineupToUpdate) => ({
      ...lineupToUpdate,
      wildcardPlayerId: null,
      updatedAt: nowIso(),
    }))
  }

  const handleAddPlayer = () => {
    const name = playerDraft.trim()
    if (!name) {
      return
    }
    updateRoster((roster) => {
      const id = nextId('player', roster.map((player) => player.id))
      return [...roster, { id, name }]
    })
    setPlayerDraft('')
  }

  const handleBulkImport = () => {
    const names = bulkDraft
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean)

    if (!names.length) {
      return
    }

    updateRoster((roster) => {
      const ids = roster.map((player) => player.id)
      const playersToAdd = names.map((name) => {
        const id = nextId('player', ids)
        ids.push(id)
        return { id, name }
      })
      return [...roster, ...playersToAdd]
    })
    setBulkDraft('')
  }

  const startEditingPlayer = (player: Player) => {
    setEditingPlayerId(player.id)
    setEditingName(player.name)
  }

  const savePlayerEdit = () => {
    if (!editingPlayerId) {
      return
    }
    const name = editingName.trim()
    if (!name) {
      return
    }
    updateRoster((roster) =>
      roster.map((player) => (player.id === editingPlayerId ? { ...player, name } : player)),
    )
    setEditingPlayerId(null)
    setEditingName('')
  }

  const cancelPlayerEdit = () => {
    setEditingPlayerId(null)
    setEditingName('')
  }

  const removePlayer = (playerId: string) => {
    updateRoster((roster) => roster.filter((player) => player.id !== playerId))
    updateLineup((lineupToUpdate) => clearPlayerAssignments(lineupToUpdate, playerId))
  }

  const clearLineup = () => {
    updateLineup((lineupToUpdate) => ({
      ...lineupToUpdate,
      assignments: createAssignments(state.positions),
      wildcardPlayerId: null,
      updatedAt: nowIso(),
    }))
  }

  const toggleWildcard = () => {
    setState((current) => {
      const wildcardEnabled = !current.settings.wildcardEnabled
      const updatedLineups = wildcardEnabled
        ? current.lineups
        : current.lineups.map((entry) => ({ ...entry, wildcardPlayerId: null }))
      return {
        ...current,
        settings: { ...current.settings, wildcardEnabled },
        lineups: updatedLineups,
      }
    })
  }

  const toggleRover = () => {
    setState((current) => {
      const roverEnabled = !current.settings.roverEnabled
      const updatedLineups = roverEnabled
        ? current.lineups
        : current.lineups.map((entry) => ({
            ...entry,
            assignments: { ...entry.assignments, pos_rover: null },
          }))

      return {
        ...current,
        settings: { ...current.settings, roverEnabled },
        lineups: updatedLineups,
      }
    })

    if (activePositionId === 'pos_rover') {
      setActivePositionId(null)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    setExportError('')
    try {
      const blob = await exportSvgToPng(svgMarkup)
      const filename = `${state.team.name || 'lineup'}-lineup.png`
      const file = new File([blob], filename, { type: 'image/png' })

      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({
          files: [file],
    title: state.team.name,
        })
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed'
      setExportError(message)
    } finally {
      setExporting(false)
    }
  }

  const handleClearAppData = async () => {
    const confirmed = window.confirm('This will clear your roster, lineup assignments, and settings. Continue?')
    if (!confirmed) {
      return
    }

    await clearAppState()
    setState(createDefaultState())
    setActivePositionId(null)
    setPlayerDraft('')
    setBulkDraft('')
    setEditingPlayerId(null)
    setEditingName('')
  }

  const activePosition = visiblePositions.find((position) => position.id === activePositionId) || null
  const activeAssignedId = activePosition ? lineup.assignments[activePosition.id] : null
  const unassignedPositions = visiblePositions.filter((position) => !lineup.assignments[position.id])
  const hasIncompleteLineup = unassignedPositions.length > 0
  const incompleteParts = [] as string[]
  if (unassignedPositions.length > 0) {
    incompleteParts.push(
      `${unassignedPositions.length} position${unassignedPositions.length === 1 ? '' : 's'} unassigned`,
    )
  }
  const incompleteMessage = hasIncompleteLineup ? `Lineup incomplete: ${incompleteParts.join(', ')}.` : ''

  if (!state.settings.hasOnboarded) {
    return (
      <div className="app">
        <div className="landscape-hint" role="status" aria-live="polite">
          Rotate back to portrait for the best layout.
        </div>
        <header className="app-header">
          <div className="brand">
            <img className="brand-logo" src="/kickball.png" alt="Kickball" />
            <div>
              <p className="brand-title">Team Manager</p>
            </div>
          </div>
        </header>
        <main className="app-main">
          <section className="panel onboarding-panel">
            <div className="panel-header">
              <div className="panel-title">
                <h2>Get started</h2>
                <p>Add your team name and roster to build a lineup.</p>
              </div>
            </div>
            <div className="panel-body">
              <div className="team-input">
                <label htmlFor="teamNameOnboarding">Team name</label>
                <input
                  id="teamNameOnboarding"
                  type="text"
                  value={state.team.name}
                  onChange={(event) =>
                    setState((current) => ({ ...current, team: { ...current.team, name: event.target.value } }))
                  }
                  placeholder="Team name"
                />
              </div>

              <div className="stack">
                <label className="field-label-text" htmlFor="addPlayerOnboarding">
                  Add player
                </label>
                <div className="input-row">
                  <input
                    id="addPlayerOnboarding"
                    type="text"
                    value={playerDraft}
                    onChange={(event) => setPlayerDraft(event.target.value)}
                    placeholder="Player name"
                  />
                  <button className="button button-primary" onClick={handleAddPlayer}>
                    Add
                  </button>
                </div>
              </div>

              <div className="stack">
                <label className="field-label-text" htmlFor="bulkPlayersOnboarding">
                  Bulk paste
                </label>
                <textarea
                  id="bulkPlayersOnboarding"
                  rows={4}
                  value={bulkDraft}
                  onChange={(event) => setBulkDraft(event.target.value)}
                  placeholder="One name per line"
                />
                <button className="button button-secondary" onClick={handleBulkImport}>
                  Import
                </button>
              </div>

              <div className="roster-list">
                {state.roster.length === 0 && <p className="empty">No players yet.</p>}
                {state.roster.map((player) => (
                  <div key={player.id} className="roster-item">
                    {editingPlayerId === player.id ? (
                      <>
                        <input
                          type="text"
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                        />
                        <div className="inline-actions">
                          <button className="button button-primary" onClick={savePlayerEdit}>
                            Save
                          </button>
                          <button className="button button-ghost" onClick={cancelPlayerEdit}>
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span>{player.name}</span>
                        <div className="inline-actions">
                          <button className="button button-ghost" onClick={() => startEditingPlayer(player)}>
                            Edit
                          </button>
                          <button className="button button-ghost" onClick={() => removePlayer(player.id)}>
                            Remove
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <button
                className="button button-primary"
                onClick={() => {
                  setCollapsedPanels((current) => ({ ...current, roster: true }))
                  setState((current) => ({
                    ...current,
                    settings: { ...current.settings, hasOnboarded: true },
                  }))
                }}
                disabled={state.roster.length === 0}
              >
                Continue to Lineup
              </button>
              {state.roster.length === 0 && <p className="helper">Add at least one player to continue.</p>}
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="landscape-hint" role="status" aria-live="polite">
        Rotate back to portrait for the best layout.
      </div>
      <header className="app-header">
        <div className="brand">
          <img className="brand-logo" src="/kickball.png" alt="Kickball" />
          <div>
            <p className="brand-title">Team Manager</p>
          </div>
        </div>
        <div className="team-input">
          <label htmlFor="teamName">Team name</label>
          <input
            id="teamName"
            type="text"
            value={state.team.name}
            onChange={(event) =>
              setState((current) => ({ ...current, team: { ...current.team, name: event.target.value } }))
            }
            placeholder="Team name"
          />
        </div>
      </header>

      <main className="app-main">
        <section className="panel field-panel">
          <div className="panel-header">
            <div className="panel-title">
              <h2>Lineup Editor</h2>
              <p>Tap a position to assign a player.</p>
            </div>
          </div>
          <div className="field-wrapper">
            <svg className="field-svg" viewBox="0 0 360 480" aria-hidden="true">
              <rect width="360" height="480" rx="24" fill="#7fb052" />
              <path d="M8 254 A172 192 0 0 1 352 254 L180 425 Z" fill="#7fb052" />
              <path
                d="M8 254 A172 192 0 0 1 352 254 L180 425 Z"
                fill="none"
                stroke="#1f4d2b"
                strokeWidth="7"
                strokeLinejoin="round"
              />
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
              <line x1="180" y1="400" x2="24" y2="240" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
              <line x1="180" y1="400" x2="336" y2="240" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
            </svg>

            <div className="field-labels" role="list">
              {visiblePositions.map((position) => {
                const assignedId = lineup.assignments[position.id]
                const assignedPlayer = state.roster.find((player) => player.id === assignedId)
                const label = assignedPlayer?.name || position.shortLabel
                return (
                  <button
                    key={position.id}
                    className={`field-label ${assignedPlayer ? 'assigned' : 'unassigned'}`}
                    style={{ left: `${position.x}%`, top: `${position.y}%` }}
                    onClick={() => setActivePositionId(position.id)}
                    aria-label={`${position.label} ${assignedPlayer ? `assigned to ${assignedPlayer.name}` : 'unassigned'}`}
                  >
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="lineup-actions">
            <button className="button button-secondary button-subtle-outline" onClick={clearLineup}>
              Reset lineup
            </button>
          </div>
        </section>

        <section className="panel roster-panel">
          <div className="panel-header">
            <div className="panel-title">
              <h2>Roster</h2>
              <p>Edit your lineup.</p>
            </div>
            <button
              className="panel-toggle"
              type="button"
              aria-expanded={!collapsedPanels.roster}
              aria-controls="panel-roster-body"
              onClick={() => togglePanel('roster')}
            >
              {collapsedPanels.roster ? 'Expand' : 'Collapse'}
            </button>
          </div>
          <div id="panel-roster-body" className="panel-body" hidden={collapsedPanels.roster}>
            <div className="stack">
              <label className="field-label-text" htmlFor="addPlayer">
                Add player
              </label>
              <div className="input-row">
                <input
                  id="addPlayer"
                  type="text"
                  value={playerDraft}
                  onChange={(event) => setPlayerDraft(event.target.value)}
                  placeholder="Player name"
                />
                <button className="button button-primary" onClick={handleAddPlayer}>
                  Add
                </button>
              </div>
            </div>

            <div className="stack">
              <label className="field-label-text" htmlFor="bulkPlayers">
                Bulk paste
              </label>
              <textarea
                id="bulkPlayers"
                rows={4}
                value={bulkDraft}
                onChange={(event) => setBulkDraft(event.target.value)}
                placeholder="One name per line"
              />
                <button className="button button-secondary button-subtle-outline" onClick={handleBulkImport}>
                  Import
                </button>
            </div>

            <div className="roster-list">
              {state.roster.length === 0 && <p className="empty">No players yet.</p>}
              {state.roster.map((player) => (
                <div key={player.id} className="roster-item">
                  {editingPlayerId === player.id ? (
                    <>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                      />
                      <div className="inline-actions">
                        <button className="button button-primary" onClick={savePlayerEdit}>
                          Save
                        </button>
                        <button className="button button-ghost" onClick={cancelPlayerEdit}>
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span>{player.name}</span>
                      <div className="inline-actions">
                        <button className="button button-ghost" onClick={() => startEditingPlayer(player)}>
                          Edit
                        </button>
                        <button className="button button-ghost" onClick={() => removePlayer(player.id)}>
                          Remove
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel assign-panel">
          <div className="panel-header">
            <div className="panel-title">
              <h2>Position Assignments</h2>
              <p>Fallback dropdown list.</p>
            </div>
            <button
              className="panel-toggle"
              type="button"
              aria-expanded={!collapsedPanels.assignments}
              aria-controls="panel-assignments-body"
              onClick={() => togglePanel('assignments')}
            >
              {collapsedPanels.assignments ? 'Expand' : 'Collapse'}
            </button>
          </div>
          <div id="panel-assignments-body" className="panel-body" hidden={collapsedPanels.assignments}>
            <div className="assignments">
            {visiblePositions.map((position) => (
              <div key={position.id} className="assignment-row">
                <div>
                  <p className="assignment-title">{position.label}</p>
                    <p className="assignment-meta">
                      {lineup.assignments[position.id]
                        ? state.roster.find((player) => player.id === lineup.assignments[position.id])?.name
                        : 'Unassigned'}
                    </p>
                  </div>
                  <div className="assignment-controls">
                    <select
                      value={lineup.assignments[position.id] || ''}
                      onChange={(event) => {
                        const value = event.target.value
                        if (!value) {
                          clearPosition(position.id)
                        } else {
                          assignPlayerToPosition(position.id, value)
                        }
                      }}
                    >
                      <option value="">Unassigned</option>
                      {state.roster.map((player) => {
                        const indicator = assignedByPlayerId[player.id]
                        const label = indicator ? `${player.name} · ✓ ${indicator}` : player.name
                        return (
                          <option key={player.id} value={player.id}>
                            {label}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                </div>
              ))}
            </div>
            {state.settings.wildcardEnabled && (
              <div className="assignment-row">
                <div>
                  <p className="assignment-title">Wildcard</p>
                  <p className="assignment-meta">
                    {lineup.wildcardPlayerId
                      ? state.roster.find((player) => player.id === lineup.wildcardPlayerId)?.name
                      : 'Unassigned'}
                  </p>
                </div>
                <div className="assignment-controls">
                  <select
                    value={lineup.wildcardPlayerId || ''}
                    onChange={(event) => {
                      const value = event.target.value
                      if (!value) {
                        clearWildcard()
                      } else {
                        assignWildcard(value)
                      }
                    }}
                  >
                    <option value="">Unassigned</option>
                    {state.roster.map((player) => {
                      const indicator = assignedByPlayerId[player.id]
                      const label = indicator ? `${player.name} · ✓ ${indicator}` : player.name
                      return (
                        <option key={player.id} value={player.id}>
                          {label}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="panel export-panel">
          <div className="panel-header">
            <div className="panel-title">
              <h2>Export</h2>
              <p>Download a PNG or share from your device.</p>
            </div>
            <button
              className="panel-toggle"
              type="button"
              aria-expanded={!collapsedPanels.export}
              aria-controls="panel-export-body"
              onClick={() => togglePanel('export')}
            >
              {collapsedPanels.export ? 'Expand' : 'Collapse'}
            </button>
          </div>
          <div id="panel-export-body" className="panel-body" hidden={collapsedPanels.export}>
            <div className="export-preview" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svgMarkup }} />
            <label className="toggle">
              <input type="checkbox" checked={includeDate} onChange={() => setIncludeDate((value) => !value)} />
              <span>Include date</span>
            </label>
            {hasIncompleteLineup && <p className="warning">{incompleteMessage}</p>}
            <button className="button button-primary" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Exporting...' : 'Export PNG'}
            </button>
            {exportError && <p className="error">{exportError}</p>}
          </div>
        </section>

        <section className="panel settings-panel">
          <div className="panel-header">
            <div className="panel-title">
              <h2>Settings</h2>
            </div>
            <button
              className="panel-toggle"
              type="button"
              aria-expanded={!collapsedPanels.settings}
              aria-controls="panel-settings-body"
              onClick={() => togglePanel('settings')}
            >
              {collapsedPanels.settings ? 'Expand' : 'Collapse'}
            </button>
          </div>
          <div id="panel-settings-body" className="panel-body" hidden={collapsedPanels.settings}>
            <label className="toggle">
              <input
                type="checkbox"
                checked={state.settings.wildcardEnabled}
                onChange={toggleWildcard}
              />
              <span>Enable wildcard slot</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={state.settings.roverEnabled}
                onChange={toggleRover}
              />
              <span>Enable rover position</span>
            </label>
            <button className="button button-danger" onClick={handleClearAppData}>
              Clear app data
            </button>
          </div>
        </section>
      </main>

      {activePosition && (
        <div className="sheet" role="dialog" aria-modal="true">
          <div className="sheet-content">
            <div className="sheet-header">
              <div>
                <h3>{activePosition.label}</h3>
                <p>Select a player to assign.</p>
              </div>
              <button className="button button-ghost" onClick={() => setActivePositionId(null)}>
                Close
              </button>
            </div>
            <div className="sheet-list">
              {state.roster.map((player) => (
                <button
                  key={player.id}
                  className={`sheet-item ${activeAssignedId === player.id ? 'selected' : ''}`}
                  onClick={() => assignPlayerToPosition(activePosition.id, player.id)}
                >
                  <span className="sheet-item-name">{player.name}</span>
                  {assignedByPlayerId[player.id] && (
                    <span className="sheet-item-indicator">✓ {assignedByPlayerId[player.id]}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="sheet-actions">
              <button
                className="button button-secondary"
                onClick={() => {
                  clearPosition(activePosition.id)
                  setActivePositionId(null)
                }}
              >
                Clear assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {activePositionId === 'wildcard' && (
        <div className="sheet" role="dialog" aria-modal="true">
          <div className="sheet-content">
            <div className="sheet-header">
              <div>
                <h3>Wildcard</h3>
                <p>Assign an extra player.</p>
              </div>
              <button className="button button-ghost" onClick={() => setActivePositionId(null)}>
                Close
              </button>
            </div>
            <div className="sheet-list">
              {state.roster.map((player) => (
                <button
                  key={player.id}
                  className={`sheet-item ${lineup.wildcardPlayerId === player.id ? 'selected' : ''}`}
                  onClick={() => assignWildcard(player.id)}
                >
                  <span className="sheet-item-name">{player.name}</span>
                  {assignedByPlayerId[player.id] && (
                    <span className="sheet-item-indicator">✓ {assignedByPlayerId[player.id]}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="sheet-actions">
              <button
                className="button button-secondary"
                onClick={() => {
                  clearWildcard()
                  setActivePositionId(null)
                }}
              >
                Clear wildcard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
