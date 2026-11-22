# Spec Delta

## Purpose

Makes every number traceable and its limits clear, so the site is never mistaken for an official service and never presents unverified or stale data as current.

## ADDED Requirements

### Requirement: Source and time with every number
Every station's card SHALL name the station's Povodí and give the measurement time of its values. The page header SHALL show the time of the last successful data collection, which is the source time for the numbers in the hero, on the map and in the list.

#### Scenario: Card source line
- **WHEN** a visitor opens a station's card
- **THEN** the card names the Povodí and shows the measurement time of its values

#### Scenario: Header
- **WHEN** the site has loaded
- **THEN** the header shows the date and time of the last successful collection

### Requirement: Disclaimer
Each card and the footer SHALL carry the note "data bez záruky", as the Povodí portals do.

#### Scenario: Card
- **WHEN** a visitor opens any station's card
- **THEN** its source line includes "data bez záruky"

### Requirement: Unofficial site
The site MUST state in its footer and on its methodology page that it is not an official Povodí or government service, and MUST NOT use Povodí or government logos.

#### Scenario: Footer
- **WHEN** a visitor reads the footer
- **THEN** it states that the site is unofficial and names the five Povodí as the data sources

### Requirement: Methodology page
The site SHALL have a short methodology page in Czech, linked from the footer, that explains where the data comes from, what the storage and retention zones are, how statuses are derived, why a planned drawdown is not rated, that the site is unofficial, and the credits and licences of the map data.

#### Scenario: Open methodology
- **WHEN** a visitor follows the methodology link in the footer
- **THEN** the page covers each of the listed topics

### Requirement: No sample data as current
The published site MUST NOT show sample, fixture or illustrative values as real data. Before the first successful collection it SHALL show that no data is available yet.

#### Scenario: Before the first collection
- **WHEN** the site is deployed before any snapshot exists
- **THEN** it shows a notice that data is not yet available instead of any numbers
