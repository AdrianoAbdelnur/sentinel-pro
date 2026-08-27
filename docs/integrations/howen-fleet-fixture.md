# Howen Fleet contract fixture

`integrations/howen/fixtures/fleet-find-all.sanitized.json` is derived from one maintainer-authorized read-only `POST /vss/fleet/findAll.action` response. It retains the successful envelope and the smallest verified root/subFleet pair needed to test company inheritance.

Every provider value was replaced before persistence. Fleet identifiers, parent identifiers, labels, company evidence, contact fields, timestamps, counters, and any other returned value use deterministic placeholders while preserving field presence and JSON types. No raw payload, credential, token, cookie, endpoint host, real company, person, phone number, or email address is retained.

The verified record contract uses `guid`, `parentid`, `fleetname`, and `contacts`. `fleetname` is provider Fleet metadata only. `contacts` is company evidence only inside the Howen adapter. Vehicle display names continue to come from roster `devicename`.

To refresh the fixture, obtain explicit authorization for one read-only call, use the existing Howen session and client, select only the minimum ancestry records in memory, sanitize every returned value before writing, validate the parser test, and discard the raw response without logging or persistence.
