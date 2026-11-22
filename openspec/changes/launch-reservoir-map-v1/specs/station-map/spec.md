# Spec Delta

## Purpose

Shows every station on one map of Czechia, sized by capacity and filled by its current level, so the national picture and any single reservoir can be found at a glance.

## ADDED Requirements

### Requirement: Map content
The map SHALL show Czechia with terrain relief, the country border, rivers in three weights (main rivers, tributaries, small feeder streams) with every tributary meeting its main river, city dots, a legend, and one circle per shown station.

#### Scenario: Page load
- **WHEN** the site has loaded its data
- **THEN** the map shows one circle for every shown station and a legend of all statuses

### Requirement: Circle size
Each circle's diameter SHALL be 10 + 2.45 × √(storage capacity in mil. m³) pixels at a map width of 880 px, scaled with the map, with a minimum of 18 px on desktop and 10 px on phones. A station with no known storage capacity SHALL be drawn at the minimum size.

#### Scenario: Large reservoir
- **WHEN** a station's storage capacity is 182 mil. m³ and the map is 880 px wide
- **THEN** its circle is 43 px in diameter

#### Scenario: Small reservoir on desktop
- **WHEN** a station's storage capacity is 0.5 mil. m³
- **THEN** its circle is drawn at the 18 px minimum

#### Scenario: Dam without a storage zone
- **WHEN** a station has no storage capacity because its dam has no storage zone
- **THEN** its circle is drawn at the minimum size

### Requirement: Circle appearance by status
Each circle SHALL be filled from the bottom up to its storage fill, drawn at most 100 %. Outline and fill SHALL use the status colour: "Nad zásobní hladinou" #B79CFF with a double outline and slow pulse; "Vysoká zásoba" #3DB9F2; "Střední zásoba" #F4B740; "Nízká zásoba" #FF6E6E; "Plánované snížení" #B4C3D6 solid; "Bez dat" #8FA3BA dashed and empty; "Jen hladina" #A9BCD2 solid, empty, with a centre dot.

#### Scenario: Half-full reservoir
- **WHEN** a station's storage zone is 55 % full
- **THEN** its circle is amber and filled to 55 % of its height

#### Scenario: No data
- **WHEN** a station's status is "Bez dat"
- **THEN** its circle has a dashed grey outline and no fill

#### Scenario: Level only
- **WHEN** a station's status is "Jen hladina"
- **THEN** its circle has a solid outline, no fill and a centre dot

### Requirement: Overlap handling
Overlapping circles SHALL be moved apart, aiming for a gap of 3 px, and no circle SHALL move more than 16 px from its true position. The 16 px limit takes precedence: where a cluster cannot reach the gap within it, circles MAY overlap and the smaller circle SHALL be drawn on top. Positions SHALL be worked out separately for the desktop and the phone layout.

#### Scenario: Two neighbouring dams
- **WHEN** two stations' circles would overlap at their true positions and can be separated within the limit
- **THEN** both are shown with at least 3 px between them, each within 16 px of its true position

#### Scenario: Dense cluster
- **WHEN** a cluster of circles cannot reach a 3 px gap without moving one more than 16 px
- **THEN** every circle stays within 16 px of its true position
- **AND** where two still overlap, the smaller one is drawn on top and stays selectable

#### Scenario: Phone layout
- **WHEN** the map is shown on a phone, where small circles are held at the 10 px minimum
- **THEN** the circles are placed by the overlap rule applied at the phone's circle sizes, not by scaling the desktop positions

### Requirement: Labels
The names of the largest reservoirs SHALL always be shown. Other names SHALL appear on hover, focus or selection. City labels SHALL give way where they would collide with each other or with reservoir labels.

#### Scenario: Small reservoir
- **WHEN** a visitor hovers over the circle of a small reservoir whose name is hidden
- **THEN** its name appears

### Requirement: Preview on desktop
On desktop, hovering over or keyboard-focusing a circle SHALL enlarge it, give it a glow and show "{name} · {fill} %", or "{name} · {status}" for a station without a fill percentage. Phones SHALL have no preview.

#### Scenario: Keyboard focus
- **WHEN** a keyboard user moves focus to the Lipno I circle, which is 82 % full
- **THEN** the circle grows and shows "Lipno I · 82 %"

#### Scenario: Station without a fill percentage
- **WHEN** a visitor hovers over a station whose status is "Bez dat"
- **THEN** the preview shows the station's name and "Bez dat"

### Requirement: Selection from the map
Clicking a circle, pressing Enter on a focused circle, or tapping a circle on a phone SHALL select that station and open its detail card.

#### Scenario: Click on desktop
- **WHEN** a visitor clicks a circle
- **THEN** the side panel switches to the "Detail nádrže" tab showing that station's card

#### Scenario: Tap on a phone
- **WHEN** a visitor taps a circle on a phone
- **THEN** the bottom sheet shows that station's card

### Requirement: Zoom limit
The map MUST NOT offer street-level zoom. Zoom, if offered at all, SHALL stop at region level.

#### Scenario: Zoom gesture
- **WHEN** a visitor pinches or scrolls to zoom on the map
- **THEN** the map never shows more detail than a whole region
