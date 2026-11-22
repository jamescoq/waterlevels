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
Below the headline the site SHALL state the total filled storage volume divided by the total storage capacity, as "Souhrnná naplněnost zásobních prostorů je {p} %.", rounded to a whole percent. Stations that are "Bez dat", "Plánované snížení" or have no storage zone defined MUST be left out of both totals.

#### Scenario: Weighted figure
- **WHEN** the included stations hold 700 mil. m³ of 1000 mil. m³ storage capacity
- **THEN** the sentence reads "Souhrnná naplněnost zásobních prostorů je 70 %."

#### Scenario: Planned drawdown excluded
- **WHEN** a large reservoir is in "Plánované snížení"
- **THEN** neither its filled volume nor its capacity counts towards the weighted figure

#### Scenario: Nothing to weigh
- **WHEN** no station qualifies for the weighted figure
- **THEN** the sentence is not shown

### Requirement: Status counts
The site SHALL show one chip per status with the number of stations in it. Stations that are "Bez dat", "Plánované snížení" or have no storage zone defined SHALL also be presented together as "mimo hodnocení".

#### Scenario: Stations outside the rating
- **WHEN** 2 stations are "Bez dat", 1 is "Plánované snížení" and 1 has no storage zone defined
- **THEN** the hero shows 4 stations as "mimo hodnocení"

### Requirement: Headline follows staleness
The headline numbers MUST reflect the statuses the visitor sees, including stations that became "Bez dat" because their data is older than 36 hours.

#### Scenario: Data aged in the browser
- **WHEN** a visitor opens the site 40 hours after the last successful collection
- **THEN** every station counts as "Bez dat"
- **AND** the headline reads "V 0 z {total} nádrží je zásoba vody nad 70 %"
