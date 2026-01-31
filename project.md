# Team Manager (TBA)

Last updated: 2026-01-31
Status: Planning in progress

## Goal
Create a mobile-first, device-agnostic PWA that helps a kickball team manager build a roster, assign players to standard field positions, and export a stylized field graphic. Offline-first, no authentication.

## MVP Scope
- Team name setup
- Roster CRUD (add/edit/remove players)
- Standard kickball positions (including Rover)
- Position assignment via field view (primary) and dropdown list (fallback)
- Stylized field graphic with assigned names
- Export/share image (PNG)
- Offline support

## Mobile-First Requirements
- Design for small screens first; desktop is secondary and not optimized
- Primary interactions are tap-based; avoid hover-only UI
- Large tap targets (>= 44px)
- Portrait layout is the default; landscape support is optional
- Keep primary actions within thumb reach (bottom area)

### Mobile Layout Constraints
- Single-column layout on phones
- Avoid modal stacking; use bottom sheets or full-screen pickers
- Field and roster tools share a single view with collapsible panels
- Respect iOS safe areas (notch, home indicator)

### Performance Targets (Mobile)
- App launches under 2 seconds on mid-range devices
- Export completes under 2 seconds for a full lineup
- Avoid blocking operations on the main thread

### Accessibility (Mobile)
- Text scales with system font size where reasonable
- High-contrast labels on field background
- Clear focus and selection states for touch

## Out of Scope (Initial)
- Multi-user access
- Authentication
- League integrations

## Priority Planning (Steps 1 and 2)
This document covers the first two priorities:
1) MVP screens and flows
2) Positions list + field layout

## 1) MVP Screens and Flows

### Screen A: Onboarding
Purpose: Capture team name and initial roster.

Key UI elements:
- Team name input
- Roster list
- Add player (single add)
- Optional: bulk paste players (one per line)
- Continue to Lineup Editor

Flow:
1. User enters team name
2. User adds players
3. Continue to Lineup Editor

### Screen B: Roster Management
Purpose: Edit roster without re-onboarding.

Key UI elements:
- Roster list with edit/delete
- Add player
- Search/filter (optional for MVP)

Flow:
1. User edits roster
2. Return to Lineup Editor

### Screen C: Lineup Editor (Primary)
Purpose: Assign players to positions via field view.

Key UI elements:
- Stylized kickball field
- Tap position to assign player
- Fallback dropdown list per position
- Wildcard slot (special)
- Swap action (optional) or tap to replace

Flow:
1. User taps a field position
2. Picker shows roster list
3. Selected player appears on field
4. Wildcard slot can be assigned to any position or left empty

### Screen D: Export / Share
Purpose: Generate and share a graphic image.

Key UI elements:
- Export preview
- Download PNG
- Native share sheet (if supported)

Flow:
1. User taps Export
2. App renders field as PNG
3. User downloads or shares

### Screen E: Settings
Purpose: Lightweight controls.

Key UI elements:
- Toggle wildcard slot on/off
- Reset lineup
- Clear app data (optional)

## 2) Positions List + Field Layout

### Standard Positions (Kickball)
- Pitcher
- Catcher
- First Base (1B)
- Second Base (2B)
- Third Base (3B)
- Shortstop (SS)
- Left Field (LF)
- Center Field (CF)
- Right Field (RF)
- Rover (optional but included for MVP)

### Field Layout Coordinate System
Use a normalized coordinate system based on the field container:
- X axis: 0 to 100 (left to right)
- Y axis: 0 to 100 (top to bottom)

The origin (0,0) is the top-left of the field graphic.
These coordinates are anchors for labels/markers and can be scaled to any screen.

### Position Anchor Coordinates (Percent)
- Catcher:   (50, 78)
- Pitcher:   (50, 52)
- 1B:        (75, 60)
- 2B:        (50, 30)
- 3B:        (25, 60)
- SS:        (40, 50)
- LF:        (25, 38)
- CF:        (50, 20)
- RF:        (75, 38)
- Rover:     (60, 40)

### Layout Notes
- Bases form a kickball diamond with home plate at (50, 88).
- The pitching strip sits between home plate and 2B, centered at (50, 52).
- Outfield labels sit closer to the top to leave space for name tags.
- Rover is placed in shallow right-center by default.
- If the field is portrait-oriented, keep ~8-10% bottom padding for UI controls.

### Visual Guidance (ASCII)
Approximate layout for reference (not to scale):

    LF       CF       RF
      \      |      /
         SS   2B
      3B   P   1B
           C

## 3) Data Model + Storage Choice

### Storage Choice
Primary storage: IndexedDB (offline-first, scalable, reliable on mobile).

Implementation approach:
- One database: `team-manager`
- Versioned schema: start at `schemaVersion: 1`
- One object store: `app_state` with a single record (key: `state`)
- Autosave on every change (debounced to reduce writes)

Rationale:
- Allows larger data sets than localStorage
- Durable offline storage for PWAs
- Easy to migrate with schema versioning

Fallback: If IndexedDB is unavailable, use localStorage with the same `app_state` payload.

### Data Model (App State)
All data stored as a single JSON object under `app_state`:

```
{
  "schemaVersion": 1,
  "team": {
    "id": "team_1",
    "name": "Team Manager"
  },
  "roster": [
    { "id": "player_1", "name": "Alex" }
  ],
  "positions": [
    { "id": "pos_catcher", "label": "Catcher", "x": 50, "y": 88 }
  ],
  "lineups": [
    {
      "id": "lineup_1",
      "name": "Default",
      "assignments": {
        "pos_catcher": "player_1"
      },
      "wildcardPlayerId": null,
      "updatedAt": "2026-01-31T00:00:00Z"
    }
  ],
  "activeLineupId": "lineup_1",
  "settings": {
    "wildcardEnabled": true
  }
}
```

### Data Rules
- Each position can be assigned to at most one player.
- A player should only appear once across positions (prevent duplicates by clearing the prior assignment when re-used).
- Wildcard is a special player slot; assigning the wildcard to a position behaves like a normal assignment.
- If wildcard is disabled, `wildcardPlayerId` should be null.

### ID Strategy
- Use simple prefixed IDs: `team_1`, `player_1`, `pos_1`, `lineup_1`.
- IDs are stable even if names change.

## 4) Export Pipeline (SVG -> PNG)

### Approach
- Build the field as an SVG layout with layered elements:
  - Background (grass + infield dirt)
  - Bases and lines
  - Position markers + player names
  - Team name and date (optional)

### Rendering Steps
1. Render SVG at a fixed logical size (e.g., 1080x1350 portrait)
2. Use a scale factor for export (2x or 3x) for crisp output
3. Convert SVG to a canvas
4. Export canvas to PNG
5. Offer download or native share (if supported)

### Export Quality Rules
- Use a high DPI export (2x/3x) for sharp text on phones
- Ensure text wrap or shrink-to-fit for long names
- Maintain minimum text size for legibility
- Keep a margin around the field to avoid edge clipping

### Styling Rules
- Use consistent typography for labels and names
- Ensure contrast between text and field colors
- Keep outlines or drop shadows subtle to improve readability

## Quality Checklist (MVP)
- Exported PNG is crisp at 2x/3x scale on mobile
- Field labels never overlap or overflow (shrink-to-fit or wrap)
- Incomplete lineup warning before export (non-blocking)
- Duplicate assignment prevention (auto-clear previous position)
- Clear lineup keeps roster intact
- Offline launch works with no network
- Tap targets >= 44px and dropdown fallback works
- Contrast check on field background for readability

## Sharing (MVP)
Purpose: share the lineup quickly with the team using an image.

### Share Lineup (Image)
- Generate a PNG from the export pipeline
- Open the native share sheet if supported
- Fallback: download PNG

### Phase 2 (Online Sharing)
- Optional shared link for a read-only lineup
- Optional live room for real-time updates

## 5) Wireframe Sketches (Mobile-First)

### Screen A: Onboarding
```
[Header]
Team Manager (TBA)

[Team Name]
Input: "Team name"

[Roster List]
- Player 1    (edit)
- Player 2    (edit)

[Add Player]
Input: "Add player"
Button: Add

[Bulk Paste]
Textarea: one name per line
Button: Import

[Primary CTA]
Button: Continue to Lineup
```

### Screen C: Lineup Editor (Primary)
```
[Header]
Team name + Active lineup

[Field View]
Stylized field graphic with tap targets
Each position shows a name or "Tap to assign"

[Bottom Sheet / Picker]
Opens when a position is tapped
- Search (optional)
- Roster list
- Clear assignment

[Bottom Bar]
Button: Export
Button: Roster
Button: Settings
```

### Screen D: Export / Share
```
[Header]
Share Lineup

[Preview]
Rendered field graphic

[Actions]
Button: Download PNG
Button: Share
Toggle: Include date (optional)
```

### Screen E: Settings
```
[Header]
Settings

[Toggles]
- Wildcard slot (on/off)
- Include rover (on/off) [optional]

[Actions]
Button: Clear lineup
Button: Clear app data (danger)
```

## 6) Visual Style (Clean Realistic Kickball)

### Style Direction
- Clean, realistic kickball field with simple geometry
- No foul territory shading or foul lines
- Focus on clarity for mobile viewing and exports

### Field Geometry
- Diamond-based infield with home plate at bottom
- Visible pitcher strip
- Bases as rotated squares

### Palette (Reference)
- Grass base: #6FB461 to #8ED27D
- Dirt: #D6A36A with subtle speckle texture
- Bases / home plate: #F6F1E7
- Labels: #F9F6F0 background, #1E1F21 text

### Label Style
- Pill chips with soft drop shadow
- Shrink-to-fit, then wrap to 2 lines max
- Minimum legible size for mobile (12-14px at 1x)

### Reference
- Use `field-clean-realistic.html` as the visual baseline

## Reference Assets
- Field baseline: `field-clean-realistic.html`

## 7) PWA Manifest + Offline Caching Strategy

### PWA Manifest
- name: Team Manager
- short_name: Team Manager
- start_url: /
- display: standalone
- theme_color: #6FB461
- background_color: #F4F6F2
- icons: 192x192, 512x512, 1024x1024 (PNG)

### Offline Strategy
- Cache app shell (HTML, CSS, JS, fonts, SVG)
- Cache field assets and icons
- Use cache-first for app shell
- Use stale-while-revalidate for static assets
- Always serve app shell when offline

### Update Flow
- Show a non-blocking "Update available" prompt
- Allow the user to refresh to get new assets

## 8) Landscape Support
- Portrait-only for MVP
- If landscape is detected, show a light hint: "Rotate back for the best layout"

## 9) Export Pipeline (Confirmed)

### Render Path
- SVG -> Canvas -> PNG

### Export Size
- Base logical size: 1080x1350 (portrait)
- Export scale: 2x or 3x for crisp text

### Text Handling
- Shrink-to-fit, then wrap to 2 lines max
- Maintain minimum font size for legibility

### Export Contents
- Team name
- Position labels + player names
- Optional date stamp

## Next Planning Steps (After This Document)
1) Define icon set + app name lock
2) Add schedule feature plan (phase 2)
3) Define phase 2 online sharing scope
4) Draft build milestones and delivery timeline
5) Decide final font licensing/hosting for offline PWA

## Handoff Notes

### Locked Decisions
- MVP is portrait-only
- Sharing is image-only (PNG) via native share sheet
- Field style is "Clean Realistic Kickball" (no foul lines or foul territory)
- Export pipeline: SVG -> Canvas -> PNG at 1080x1350 base

### Key Files
- Planning doc: `project.md`
- Field baseline: `field-clean-realistic.html`

### Implementation Reminders
- Keep UI mobile-first with large tap targets
- Use the anchor coordinates in Section 2 for placement
- Preserve offline-first storage (IndexedDB + localStorage fallback)

## Open Questions (Optional)
- Do we include a designated "Rover" in all templates or allow it to be disabled per lineup?
- Will roster support jersey numbers or just names?
