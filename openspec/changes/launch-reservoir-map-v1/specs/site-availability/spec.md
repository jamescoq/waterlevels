# Spec Delta

## Purpose

Keeps the site reachable at its own domain, fast on phones and independent of the Povodí portals, and makes its behaviour clear while loading and when data collection fails.

## ADDED Requirements

### Requirement: Domain and HTTPS
The site SHALL be served at https://stavvody.cz. Requests to http:// or to www.stavvody.cz SHALL redirect to https://stavvody.cz.

#### Scenario: Plain HTTP
- **WHEN** a visitor opens http://stavvody.cz
- **THEN** they are redirected to https://stavvody.cz

#### Scenario: www
- **WHEN** a visitor opens https://www.stavvody.cz
- **THEN** they are redirected to https://stavvody.cz

### Requirement: Own files only
A visitor's browser MUST load only files served from stavvody.cz. It MUST NOT contact the Povodí portals, font services or any other third party, with two exceptions: the single request that reports the visit to the visit counter, and links the visitor follows.

#### Scenario: Page load
- **WHEN** a visitor loads the site and selects a station
- **THEN** every file is loaded from stavvody.cz
- **AND** the only request to another host is the one that reports the visit

### Requirement: Survives failed collection
When data collection fails, the site SHALL keep serving the last successfully collected data.

#### Scenario: Collection fails for three days
- **WHEN** no collection has succeeded for three days
- **THEN** the site still loads and shows the last collected values with their measurement times

### Requirement: Stale data banner
When the newest data is older than 36 hours by the visitor's clock, the site SHALL show a banner stating that the data is out of date and giving its date.

#### Scenario: Old data
- **WHEN** a visitor opens the site 40 hours after the last successful collection on 21 November 2026
- **THEN** a banner says the data is out of date and dates from 21 November 2026

### Requirement: Fresh data reaches visitors
After a successful daily collection, visitors SHALL see the new data within 30 minutes.

#### Scenario: Morning update
- **WHEN** the daily collection succeeds
- **THEN** a visitor who loads the site 30 minutes later sees the new measurement times

### Requirement: Loading state
While the data loads, the site SHALL show a skeleton of the map and the panel instead of empty or placeholder numbers.

#### Scenario: Slow connection
- **WHEN** the data file has not arrived yet
- **THEN** the map and panel areas show a skeleton

### Requirement: Responsive layout
The site SHALL work on desktop and on phone-width screens. On phones the map SHALL sit above a bottom sheet holding the list and the station card, and the page MUST NOT scroll sideways.

#### Scenario: Phone
- **WHEN** a visitor opens the site on a 390 px wide screen
- **THEN** the map is shown above the bottom sheet and nothing overflows the screen width

### Requirement: Fast first load
The site SHALL reach Largest Contentful Paint within 2.5 seconds on a mid-range phone over a 4G connection.

#### Scenario: Mobile lab test
- **WHEN** the home page is measured with a mobile lab test on a simulated mid-range phone and 4G
- **THEN** Largest Contentful Paint is 2.5 seconds or less
