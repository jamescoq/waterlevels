# Spec Delta

## Purpose

Explains one selected station in plain terms: how full it is, where its water line sits within the dam, how it changed since yesterday, and where the numbers come from, with a link that can be shared.

## ADDED Requirements

### Requirement: Card content
The card SHALL show the station's name, river and Povodí, its status chip, its storage fill percentage in the status colour when it has one, its level, stored volume, inflow, outflow and change since yesterday with an arrow. A value that is missing SHALL be shown as missing, never as zero.

#### Scenario: Complete data
- **WHEN** a visitor selects a station with all values measured
- **THEN** the card shows every listed item

#### Scenario: Inflow not measured
- **WHEN** the station's inflow is missing in the latest snapshot
- **THEN** the card shows inflow as not available rather than 0 m³/s

### Requirement: Dam cut-through
The card SHALL show a schematic section of the dam with three labelled levels, "Max. hladina", "Plná zásoba" and "Stálé nadržení", and the current water line. The section is not to scale and SHALL say so with the label "Schematický řez".

#### Scenario: Selection changes
- **WHEN** the visitor selects a different station
- **THEN** the water line moves to the new station's level with a gentle wave

#### Scenario: Station without a storage zone
- **WHEN** the selected station has no storage zone defined
- **THEN** the section omits the "Plná zásoba" level and still shows the current water line

### Requirement: Plain-language level sentence
The card SHALL state the distance between the current level and the top of the storage zone in one sentence, in metres with one decimal place and a decimal comma. A station whose storage-zone level is not known SHALL have no such sentence.

#### Scenario: No storage-zone level
- **WHEN** the selected station has no storage zone defined
- **THEN** the card shows its level without the sentence

#### Scenario: Below full storage
- **WHEN** the level is 4.8 m below the top of the storage zone
- **THEN** the card reads "Hladina je 4,8 m pod plnou hladinou"

#### Scenario: Above full storage
- **WHEN** the level is 0.3 m above the top of the storage zone
- **THEN** the card reads "Hladina je 0,3 m nad plnou hladinou"

### Requirement: Note for stations outside the rating
For a station in "Plánované snížení", "Bez dat" or "Jen hladina" the card SHALL show a note box explaining the state. For a planned drawdown it SHALL give the reason and state that the low level is not a sign of drought. For "Jen hladina" it SHALL say whether the dam has no storage zone or its Povodí does not publish the fill.

#### Scenario: Dam without a storage zone
- **WHEN** a station is "Jen hladina" because its dam has no storage zone
- **THEN** the note reads, for example, "Tato nádrž nemá vymezený zásobní prostor, proto u ní neuvádíme naplnění."

#### Scenario: Fill not published
- **WHEN** a station is "Jen hladina" because its Povodí does not publish the fill
- **THEN** the note reads, for example, "Povodí u této nádrže naplnění neuvádí."

#### Scenario: Planned drawdown
- **WHEN** a station is in "Plánované snížení" because of dam repairs
- **THEN** the note reads, for example, "Správce hladinu snížil záměrně kvůli opravě hráze. Nejde o projev sucha."

#### Scenario: Source failed
- **WHEN** a station is "Bez dat" because its source failed today
- **THEN** the card shows the last known values with their measurement time and a note that today's data is missing

### Requirement: Shareable link
The card SHALL offer "Odkaz na tuto nádrž", which copies a URL of the form https://stavvody.cz/?stanice={station id}. Opening that URL SHALL show the site with that station selected.

#### Scenario: Open a shared link
- **WHEN** a visitor opens https://stavvody.cz/?stanice=pod-slezska-harta
- **THEN** the site loads with Slezská Harta selected and its card open

#### Scenario: Unknown station id
- **WHEN** a visitor opens a link with a station id that does not exist
- **THEN** the site loads with no station selected and shows no error page

#### Scenario: Back button
- **WHEN** a visitor selects five stations one after another and presses the browser's back button
- **THEN** the browser leaves the site or returns to the page before it, rather than stepping through the five selections

### Requirement: Link to the live source
The card SHALL offer "Živá data na webu Povodí", which opens the station's page on its Povodí portal.

#### Scenario: Open the source
- **WHEN** a visitor activates "Živá data na webu Povodí" on the Slezská Harta card
- **THEN** the Povodí Odry detail page for Slezská Harta opens
