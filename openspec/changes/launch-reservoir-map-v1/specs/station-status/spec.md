# Spec Delta

## Purpose

Gives each station exactly one status that describes how full its storage zone is, plus its change since yesterday, so a lay reader can judge it at a glance. The status makes no claim about what is normal for the season, because v1 has no history to compare against.

## ADDED Requirements

### Requirement: Status precedence
Each shown station SHALL have exactly one status, taken from the first rule that matches in this order: "Bez dat", "Plánované snížení", "Nad zásobní hladinou", no storage zone defined, "Vysoká zásoba", "Střední zásoba", "Nízká zásoba".

#### Scenario: Planned drawdown at low fill
- **WHEN** a station has an active planned-drawdown entry and its storage zone is 20 % full
- **THEN** its status is "Plánované snížení", not "Nízká zásoba"

#### Scenario: No data wins over a planned drawdown
- **WHEN** a station has an active planned-drawdown entry and its source failed today
- **THEN** its status is "Bez dat"

### Requirement: No data
A station SHALL have the status "Bez dat" when its source failed in the latest snapshot, when its latest measurement is older than 36 hours, or when its storage zone is defined but its fill is missing. The 36-hour check MUST use the viewer's current time, so it holds even when the site has not been rebuilt.

#### Scenario: Source failed today
- **WHEN** the latest snapshot records the station's source as "failed"
- **THEN** the station's status is "Bez dat"

#### Scenario: Collection stopped
- **WHEN** a visitor opens the site 37 hours after the station's latest measurement and no newer data was published
- **THEN** the station's status is "Bez dat"

#### Scenario: Fill not measured
- **WHEN** the station has a storage zone but the portal left its fill blank
- **THEN** the station's status is "Bez dat"

### Requirement: Planned drawdown
A station SHALL have the status "Plánované snížení" when the owner has entered a planned drawdown for it whose date range includes today, or when the portal note for the station states a deliberate drawdown. An entry whose end date has passed MUST be ignored.

#### Scenario: Active entry
- **WHEN** a planned-drawdown entry for the station runs until 31 March 2027 and today is 1 March 2027
- **THEN** the station's status is "Plánované snížení" and the card shows the entry's reason

#### Scenario: Expired entry
- **WHEN** the entry ended on 31 March 2027 and today is 1 April 2027
- **THEN** the entry has no effect and the station's status follows the remaining rules

### Requirement: Above the storage level
A station SHALL have the status "Nad zásobní hladinou" when any of its retention volume is filled or its level is above the top of its storage zone.

#### Scenario: Retention in use
- **WHEN** the station's filled retention volume is greater than zero
- **THEN** its status is "Nad zásobní hladinou"

#### Scenario: Fill above 100 %
- **WHEN** the portal reports the storage zone as 104 % full
- **THEN** the station's status is "Nad zásobní hladinou"
- **AND** its circle and card show the fill drawn at 100 %

### Requirement: No storage zone defined
A station whose portal defines no storage zone SHALL get no fill percentage and no fill rating. It SHALL show its level only and count as outside the rating.

#### Scenario: Dash on the volumes page
- **WHEN** the station's storage zone is marked as not defined
- **THEN** the station shows its level without a fill percentage
- **AND** it counts towards "mimo hodnocení"

### Requirement: Fill rating
A station with a measured storage-zone fill SHALL have the status "Vysoká zásoba" at 70 % or more, "Střední zásoba" from 40 % to under 70 %, and "Nízká zásoba" under 40 %.

#### Scenario: Exactly 70 %
- **WHEN** the storage zone is 70.0 % full
- **THEN** the status is "Vysoká zásoba"

#### Scenario: Exactly 40 %
- **WHEN** the storage zone is 40.0 % full
- **THEN** the status is "Střední zásoba"

#### Scenario: Just under 40 %
- **WHEN** the storage zone is 39.9 % full
- **THEN** the status is "Nízká zásoba"

### Requirement: Change since yesterday
The system SHALL show each station's level change against its measurement taken 18 to 30 hours before the current one, in whole centimetres. A change under 1 cm either way SHALL read "Od včerejška beze změny". Without such a measurement it SHALL read "Změnu od včerejška neznáme".

#### Scenario: Level rose
- **WHEN** today's level is 491.32 m and the level 24 hours earlier was 491.20 m
- **THEN** the change reads +12 cm with an upward arrow

#### Scenario: No meaningful change
- **WHEN** the level differs by 0.4 cm from the measurement 24 hours earlier
- **THEN** the change reads "Od včerejška beze změny"

#### Scenario: First day
- **WHEN** no earlier snapshot holds a measurement for the station
- **THEN** the change reads "Změnu od včerejška neznáme"

#### Scenario: Portal did not update
- **WHEN** the latest snapshot repeats the same measurement time as the previous day's snapshot
- **THEN** the change reads "Změnu od včerejška neznáme"

### Requirement: Trend source
The change since yesterday MUST be based on measured levels only. Inflow minus outflow MUST NOT be used as a trend, because it ignores withdrawals such as drinking-water intake.

#### Scenario: Inflow exceeds outflow but level fell
- **WHEN** inflow is greater than outflow and the level fell by 3 cm since yesterday
- **THEN** the change reads -3 cm
