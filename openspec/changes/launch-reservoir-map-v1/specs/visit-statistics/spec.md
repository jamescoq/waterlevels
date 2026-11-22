# Spec Delta

## Purpose

Tells the owner how many people visit the site and where they come from, without cookies, a consent banner or any effect on how the site works for visitors.

## ADDED Requirements

### Requirement: Visit counting
The site SHALL report each page load on https://stavvody.cz to a visit counter as one visit. Selecting stations within a loaded page MUST NOT count as further visits.

#### Scenario: Page load
- **WHEN** a visitor loads https://stavvody.cz
- **THEN** one visit is reported to the visit counter

#### Scenario: Browsing stations
- **WHEN** a visitor selects five stations after the page has loaded
- **THEN** no further visit is reported

#### Scenario: Arriving through a shared link
- **WHEN** a visitor opens https://stavvody.cz/?stanice=pod-slezska-harta
- **THEN** one visit is reported, and it records that the visit arrived through the link for pod-slezska-harta

### Requirement: No cookies and no consent banner
Visit counting MUST NOT set cookies or store anything else on the visitor's device, and the site MUST NOT show a consent banner.

#### Scenario: First visit
- **WHEN** a visitor loads the site for the first time
- **THEN** visit counting sets no cookie and writes nothing to the browser's storage
- **AND** no consent banner is shown

### Requirement: Counting never affects the site
The site SHALL work fully when the visit counter is blocked, slow or unavailable. Counting MUST NOT delay the first display of the map and data, and its failure MUST NOT show an error.

#### Scenario: Counter blocked
- **WHEN** a visitor's ad blocker blocks the request to the visit counter
- **THEN** the site loads and works as usual and shows no error

#### Scenario: Counter down
- **WHEN** the visit counter does not respond
- **THEN** the map and data appear as fast as they would without counting

### Requirement: Production only
Visits MUST be reported only when the site is served from stavvody.cz.

#### Scenario: Local development
- **WHEN** the site runs on a developer's machine
- **THEN** no request is sent to the visit counter

#### Scenario: Copy on another address
- **WHEN** a copy of the site is served from another host, such as a fork's github.io address
- **THEN** no request is sent to the visit counter

### Requirement: Disclosure
The methodology page SHALL state that visits are counted, name the tool, say that no cookies are used, and list what is recorded about a visit.

#### Scenario: Reading the methodology page
- **WHEN** a visitor reads the methodology page
- **THEN** it names the visit counter and lists what a visit records
