# Spec Delta

## Purpose

Gives a first-time visitor the national situation within 30 seconds: one headline a lay reader understands, a volume-weighted figure for context, and the number of stations in each status.

## ADDED Requirements

### Requirement: Count-based headline
The site SHALL lead with the number of stations whose status is "Nad zásobní hladinou" or "Vysoká zásoba", out of all shown stations, worded as "V {n} z {total} nádrží je zásoba vody nad 70 %".

#### Scenario: Typical day
- **WHEN** 3 stations are "Nad zásobní hladinou", 22 are "Vysoká zásoba" and 37 stations are shown
- **THEN** the headline reads "V 25 z 37 nádrží je zásoba vody nad 70 %"

### Requirement: Volume-weighted fill
Below the headline the site SHALL state the total filled storage volume divided by the total storage capacity, as "Souhrnná naplněnost zásobních prostorů je {p} %.", rounded to a whole percent. Stations that are "Bez dat", "Plánované snížení" or "Jen hladina" MUST be left out of both totals.

#### Scenario: Weighted figure
- **WHEN** the included stations hold 700 mil. m³ of 1000 mil. m³ storage capacity
- **THEN** the sentence reads "Souhrnná naplněnost zásobních prostorů je 70 %."

#### Scenario: Planned drawdown excluded
- **WHEN** a large reservoir is in "Plánované snížení"
- **THEN** neither its filled volume nor its capacity counts towards the weighted figure

### Requirement: Status counts
The site SHALL show one chip per status with the number of stations in it. Stations that are "Bez dat", "Plánované snížení" or "Jen hladina" SHALL also be presented together as "mimo hodnocení".

#### Scenario: Stations outside the rating
- **WHEN** 2 stations are "Bez dat", 1 is "Plánované snížení" and 1 is "Jen hladina"
- **THEN** the hero shows 4 stations as "mimo hodnocení"

### Requirement: Headline follows what the visitor sees
The headline numbers MUST reflect the statuses the visitor sees, including stations that became "Bez dat" because their data is older than 36 hours.

#### Scenario: Some data aged in the browser
- **WHEN** 20 stations are "Vysoká zásoba" with fresh data and 7 of the 37 shown stations have data older than 36 hours
- **THEN** the headline reads "V 20 z 37 nádrží je zásoba vody nad 70 %"
- **AND** the 7 stations count as "Bez dat"

### Requirement: No headline without rated stations
When no shown station has a fill rating ("Nad zásobní hladinou", "Vysoká zásoba", "Střední zásoba" or "Nízká zásoba"), the site SHALL show "Aktuální data nejsou k dispozici." in place of the headline and the weighted-fill sentence, and MUST NOT state a count.

#### Scenario: All data aged in the browser
- **WHEN** a visitor opens the site 40 hours after the last successful collection
- **THEN** every station counts as "Bez dat"
- **AND** the hero reads "Aktuální data nejsou k dispozici." and states no count of reservoirs above 70 %
