# Driving Index Workbook Import Specification

## Purpose

Turn a trip workbook and a reporting period into a deduplicated vehicle list with manual KR/KP inputs. Howen resolution, alarms, IM calculation, and persistence are out of scope.

## Requirements

### Requirement: Report period is an explicit input
The system MUST let the user pick an explicit month and year for the report, and MUST NOT derive the period from the current date or workbook contents.

#### Scenario: User selects a period
- GIVEN the screen is open
- WHEN the user picks a month and a year
- THEN both are held as the report period

### Requirement: Trip-grouped rows are forward-filled
The parser MUST treat a blank `Fecha` or `Viaje` cell as a continuation of the nearest preceding row that had a value, not as a new or invalid record.

#### Scenario: Continuation rows inherit trip data
- GIVEN a trip's first row has `Fecha` and `Viaje`, followed by two blank rows
- WHEN the workbook is parsed
- THEN all three rows resolve to the first row's `Fecha` and `Viaje`

### Requirement: Required column and blank rows are validated
The parser MUST resolve `Dominio` case- and accent-insensitively. If no column resolves, the system MUST report a missing-column failure and build no vehicle list. A row with a blank `Dominio` after forward-fill MUST be excluded, without aborting the rest.

#### Scenario: Dominio column is absent
- GIVEN a workbook with no column resolving to `Dominio`
- WHEN parsed
- THEN a missing-column failure is reported and no list is produced

#### Scenario: One row has a blank Dominio
- GIVEN one data row has a blank `Dominio` and the rest are valid
- WHEN parsed
- THEN each valid plate appears once, the blank row is skipped, and parsing completes

### Requirement: Plates normalize to one canonical key and dedupe by it
The system MUST derive a canonical plate per `Dominio` by uppercasing, trimming, collapsing whitespace, and removing separators (spaces, hyphens, dots) between alphanumeric segments, retaining the original text alongside it. Each unique canonical plate MUST appear exactly once in the vehicle list, regardless of row, trip, or `Empresa` count.

#### Scenario: Inconsistent plate text collapses to one entry
- GIVEN rows with `Dominio` values `"ab-123-cd"`, `"AB123CD"`, `" AB123CD "`
- WHEN parsed
- THEN one vehicle entry is produced for that canonical plate

#### Scenario: Same plate across multiple trips
- GIVEN one plate appears in three different trips
- WHEN parsed
- THEN the vehicle list contains exactly one entry for it

### Requirement: Unreadable input and empty results are distinct failures
The system MUST report three distinct failures: a non-workbook file, a missing `Dominio` column, and zero usable rows. No failure MUST render a blank table without a message.

#### Scenario: File is not a workbook
- GIVEN the user selects a non-spreadsheet file
- WHEN parsing is attempted
- THEN an unreadable-file failure is reported and no list is produced

#### Scenario: Workbook has no data rows
- GIVEN valid headers and zero data rows
- WHEN parsed
- THEN a zero-usable-rows failure is reported, distinct from the other two

### Requirement: Manual KR and KP are held per report draft
The system MUST accept one KR value per vehicle row, keyed by canonical plate, and one KP value for the period, both persisting across re-renders and re-sorting within the session, without deriving KP from any KR.

#### Scenario: KR persists across re-render
- GIVEN a row has a KR value entered
- WHEN the list re-renders or re-sorts
- THEN that KR value is still displayed for that plate

#### Scenario: KP applies to the period, not a row
- GIVEN a KP value is entered
- WHEN the list has multiple vehicles
- THEN the same KP applies to the period, not to any single row

### Requirement: A new workbook upload replaces the draft
Uploading a new workbook MUST discard the previous vehicle list and clear any entered KR and KP values, replacing them with the newly parsed draft.

#### Scenario: Re-upload clears prior manual inputs
- GIVEN a list is displayed with KR and KP entered
- WHEN the user uploads a different workbook
- THEN only the new workbook's plates remain and no prior KR or KP value persists
