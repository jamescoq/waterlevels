# Spec Delta

## Purpose

Collects station measurements from the five Povodí reservoir portals once a day, with minimal load on their servers, and keeps one validated snapshot per day as the record the site and later history features are built from.

## ADDED Requirements

### Requirement: Daily collection
The system SHALL collect current measurements from every configured Povodí source once per day, after the portals publish their 07:00 values (Europe/Prague time), and SHALL produce one snapshot for the current Prague calendar date.

#### Scenario: Scheduled run
- **WHEN** the daily schedule fires
- **THEN** the system fetches the overview and volumes pages of each configured source
- **AND** stores a snapshot named after the current Prague calendar date

#### Scenario: Second run on the same day
- **WHEN** a run is started manually on a day that already has a snapshot
- **THEN** the new snapshot replaces that day's snapshot

### Requirement: Limited load on the portals
The system MUST keep each daily run to at most one robots.txt request and two page requests per source, plus at most two retries per page after a network error or a 5xx response. Requests to one host MUST be sequential and at least 2 seconds apart.

#### Scenario: Normal daily run
- **WHEN** a daily run completes without errors
- **THEN** it made no more than 15 requests in total across the five sources

#### Scenario: Detail pages
- **WHEN** a daily run executes
- **THEN** it fetches no station detail page; detail pages are fetched only when the station registry is built or refreshed

### Requirement: Identification and robots.txt
Every request MUST carry a User-Agent that names stavvody.cz and gives a contact address. The system MUST obey each host's robots.txt.

#### Scenario: Page disallowed
- **WHEN** a source's robots.txt disallows a page the system needs
- **THEN** the system does not fetch that page
- **AND** records the source as "blocked" in the snapshot

### Requirement: Station matching
The system SHALL match portal rows to registered stations by the portal's own station identifier, not by name. Rows that match no registered station MUST NOT be published, and SHALL be recorded in the snapshot for review.

#### Scenario: Station not in the registry
- **WHEN** a portal lists a reservoir that is not in the station registry
- **THEN** the snapshot lists it under unmatched rows with its raw values
- **AND** the run log contains a warning naming it
- **AND** the site does not show it

#### Scenario: Station listed twice
- **WHEN** a portal lists the same station twice, as Povodí Moravy lists Dalešice with a second "přepočítaná" row
- **THEN** the system keeps only the row the registry marks as preferred for that station

### Requirement: Czech number and time formats
The system SHALL read numbers that use a decimal comma and a space or non-breaking space as thousands separator, and SHALL store measurement times as Europe/Prague local time with their UTC offset.

#### Scenario: Decimal comma and thousands separator
- **WHEN** a cell reads "1 234,56"
- **THEN** the stored value is 1234.56

#### Scenario: Summer time
- **WHEN** a portal shows a measurement at 07:00 on 1 July 2027
- **THEN** the stored measurement time is 2027-07-01T07:00:00+02:00

### Requirement: Not measured versus not defined
The system MUST keep a blank cell on a volumes page (value not measured) distinct from a dash (zone not defined for this dam). Neither MUST be stored as zero.

#### Scenario: Blank cell
- **WHEN** a station's storage-zone cell on the volumes page is blank
- **THEN** the snapshot stores the value as missing

#### Scenario: Dash
- **WHEN** a station's storage-zone cell on the volumes page shows a dash
- **THEN** the snapshot marks the zone as not defined for that station

### Requirement: Implausible values
The system SHALL store a value as missing, log a warning and continue the run when the value is outside physical bounds: a level more than 20 m below the permanent-pool level or more than 2 m above the dam crest, or a percentage below 0 or above 150.

#### Scenario: Level far above the crest
- **WHEN** a parsed level is 3 m above the station's dam crest
- **THEN** the snapshot stores that level as missing
- **AND** the run log contains a warning for that station

### Requirement: Validation guards
The system MUST NOT store a snapshot, and the run MUST end as failed so the owner is notified, when every source failed, when any source returned fewer than 70 % of the stations registered for it, or when the snapshot does not match its schema. The previously published data SHALL stay live.

#### Scenario: Portal layout changed
- **WHEN** a source that has 28 registered stations yields 10 parsed rows
- **THEN** no snapshot is stored for that run
- **AND** the run ends as failed
- **AND** the site keeps showing the previous data

#### Scenario: All portals unreachable
- **WHEN** every source fails to load
- **THEN** no snapshot is stored and the run ends as failed

### Requirement: Single source failure
When one source cannot be reached but the guards pass for the others, the system SHALL store the snapshot with values for the reachable sources and SHALL record the unreachable source as "failed".

#### Scenario: One portal down
- **WHEN** Povodí Ohře does not respond after the allowed retries and all other sources succeed
- **THEN** the snapshot is stored with values for the other four sources
- **AND** the snapshot records Ohře as "failed"

### Requirement: Snapshot retention
The system SHALL keep every daily snapshot indefinitely. Snapshots MUST hold parsed values only, with no statuses or other derived values, so that derived data can be recomputed whenever the rules change.

#### Scenario: Rules change
- **WHEN** the status thresholds are changed
- **THEN** the statuses of any past day can be recomputed from its stored snapshot without fetching anything from the portals

### Requirement: Raw page retention
The system SHALL keep the raw pages fetched by each run for at least 90 days, so that snapshots can be parsed again after a parser fix.

#### Scenario: Parser bug found
- **WHEN** a parser bug is fixed 30 days after it first produced wrong values
- **THEN** the snapshots of those 30 days can be regenerated from the kept raw pages
