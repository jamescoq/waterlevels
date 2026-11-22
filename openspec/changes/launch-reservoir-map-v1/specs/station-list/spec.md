# Spec Delta

## Purpose

Lets a visitor find any station by name without hunting on the map: a full list grouped by Povodí that is linked to the map and is the starting view on phones.

## ADDED Requirements

### Requirement: Full list grouped by Povodí
The site SHALL list every shown station, grouped by Povodí, in a tab labelled "Všechny nádrže ({N})" where N is the number of shown stations. Each row SHALL show the station's name, status and fill or level.

#### Scenario: Tab label
- **WHEN** 37 stations are shown
- **THEN** the list tab is labelled "Všechny nádrže (37)"

#### Scenario: Grouping
- **WHEN** the visitor opens the list
- **THEN** stations appear under a heading for their Povodí

### Requirement: Link between list and map
On desktop, hovering over a list row SHALL highlight that station's circle on the map, and clicking a row SHALL select the station.

#### Scenario: Hover a row
- **WHEN** a visitor hovers over the row for Slezská Harta
- **THEN** the Slezská Harta circle is highlighted on the map

#### Scenario: Click a row
- **WHEN** a visitor clicks a row
- **THEN** the station is selected and its card opens in the "Detail nádrže" tab

### Requirement: Phone starts on the list
On phone-width screens the bottom sheet SHALL open on the list. Tapping a row SHALL show that station's card.

#### Scenario: First visit on a phone
- **WHEN** a visitor opens the site on a phone
- **THEN** the bottom sheet shows the list

#### Scenario: Tap a row
- **WHEN** the visitor taps a row
- **THEN** the bottom sheet shows that station's card

### Requirement: Two interactions to any station
Any single station's level SHALL be reachable in at most two interactions from the first view, on desktop and on phones.

#### Scenario: Desktop
- **WHEN** a visitor on desktop wants a station whose circle is not labelled
- **THEN** opening the list tab and clicking its row shows its level

#### Scenario: Phone
- **WHEN** a visitor on a phone wants a station further down the list
- **THEN** scrolling to it and tapping its row shows its level
