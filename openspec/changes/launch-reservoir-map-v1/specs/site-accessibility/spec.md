# Spec Delta

## Purpose

Makes the whole site usable with a keyboard, a screen reader, reduced motion and impaired colour vision, so that no visitor depends on colour, a mouse or animation to read it.

## ADDED Requirements

### Requirement: Text contrast
All text SHALL have a contrast ratio of at least 4.5:1 against its background, or 3:1 for text 24 px or larger. Labels inside the dam cut-through SHALL sit on a dark backing so they stay readable over water.

#### Scenario: Small grey label
- **WHEN** an 11 px secondary label is drawn on the card background
- **THEN** its contrast ratio is at least 4.5:1

#### Scenario: Label over water
- **WHEN** the water line rises above the "Plná zásoba" label in the cut-through
- **THEN** the label keeps a contrast ratio of at least 4.5:1

### Requirement: Status not by colour alone
Every status SHALL be distinguishable without colour: each station's status SHALL be named in text wherever it is shown in the list and card, "Nad zásobní hladinou" circles SHALL have a double outline, "Bez dat" circles a dashed outline and "Jen hladina" circles a centre dot.

#### Scenario: Greyscale
- **WHEN** the site is viewed in greyscale
- **THEN** each station's status can still be read from its text label

### Requirement: Keyboard use
Every control, every station circle and every list row SHALL be reachable and operable from the keyboard, with a visible focus indicator. Controls SHALL be real buttons and links.

#### Scenario: Keyboard only
- **WHEN** a visitor uses only the Tab and Enter keys
- **THEN** they can select any station, switch between the panel tabs, copy the share link and open the source link

### Requirement: Touch targets
List rows and controls on phones SHALL have touch targets of at least 44 × 44 px.

#### Scenario: List row on a phone
- **WHEN** the list is shown on a phone
- **THEN** each row's tappable area is at least 44 px tall

### Requirement: Reduced motion
When the visitor's system asks for reduced motion, the water wave and the circle pulse SHALL stop.

#### Scenario: Reduced motion set
- **WHEN** the visitor's operating system has reduced motion enabled
- **THEN** the water line moves without a wave and no circle pulses

### Requirement: Screen reader announcements
When the selected station changes, screen readers SHALL announce only the station's name and status.

#### Scenario: Select a station
- **WHEN** a screen-reader user selects Slezská Harta while it is "Střední zásoba"
- **THEN** the announcement is the name "Slezská Harta" and the status "Střední zásoba", and nothing else

### Requirement: Page language
The page SHALL declare Czech as its language so assistive technology pronounces it correctly.

#### Scenario: Screen reader voice
- **WHEN** a screen reader reads the page
- **THEN** it uses its Czech voice
