"use client";

import { useEffect, useState } from "react";

import { requestCatalogApi } from "./catalog-client";
import { ReviewItem, type ReviewSummary } from "./review-item";

export function PendingReviewsPanel({ autoLoad = false }: { autoLoad?: boolean } = {}) {
  const [reviews, setReviews] = useState<ReviewSummary[]>();
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  async function cargarRevisiones() {
    setLoading(true);
    setError(undefined);
    setNotice(undefined);
    const result = await requestCatalogApi<{ reviews: ReviewSummary[] }>("/api/admin/catalog/reviews", { method: "GET" });
    setLoading(false);
    if (result.error) setError(result.error); else setReviews(result.reviews ?? []);
  }

  function onResolved(reviewId: string) {
    setNotice("Revisión resuelta.");
    setReviews((current) => current?.filter((review) => review.id !== reviewId));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoLoad) void cargarRevisiones();
  }, [autoLoad]);

  return (
    <div className="flex flex-col gap-4">
      <button className="rounded bg-zinc-700 px-3 py-2 disabled:opacity-60" disabled={loading} onClick={cargarRevisiones} type="button">Cargar revisiones pendientes</button>
      {notice ? <p role="status">{notice}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {reviews ? (
        reviews.length ? (
          <ul className="flex flex-col gap-3">{reviews.map((review) => <li key={review.id}><ReviewItem onResolved={onResolved} review={review} /></li>)}</ul>
        ) : <p>No hay revisiones pendientes.</p>
      ) : null}
    </div>
  );
}
