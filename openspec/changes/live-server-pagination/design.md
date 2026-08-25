# Design: Server-Side Pagination for Live

The existing `/api/live/groups/:groupId/vehicles` route remains available for compatibility. Live's primary loading path uses `/api/live/vehicles`, accepting `page`, `plate`, and an optional group filter; page size is a fixed application constant of 50.

MongoDB first returns filtered counts by group (metadata only), then loads only the ranges required for the requested page. The application packs complete groups into pages up to 50 vehicles; a group larger than 50 is split into 50-vehicle chunks. Plate filtering is included in both count and page queries.

`createLoadLiveGroup` resolves contributions, connections, policies, and snapshots only for `items`. It returns the existing `LiveState` plus optional pagination metadata on the loaded fleet. Existing callers without metadata remain valid.

The client loads the first global page on entry, replaces only the loaded groups, and exposes global page controls. Plate search resets the page and reloads the global page. The legacy expanded-fleet path remains intact. Status/provider filtering remains a view concern over loaded data.
