export interface PaginationProps {
  prevHref?: string | null;
  nextHref?: string | null;
}

/** A plain prev/next link pair for a cursor-paged table; a disabled side renders as inert text instead of a link. */
export function Pagination({ prevHref, nextHref }: PaginationProps) {
  return (
    <div class="pagination">
      {prevHref ? (
        <a class="btn" href={prevHref}>
          ← Newer
        </a>
      ) : (
        <span class="btn btn-disabled">← Newer</span>
      )}
      {nextHref ? (
        <a class="btn" href={nextHref}>
          Older →
        </a>
      ) : (
        <span class="btn btn-disabled">Older →</span>
      )}
    </div>
  );
}
