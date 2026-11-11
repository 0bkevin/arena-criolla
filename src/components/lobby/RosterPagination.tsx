import { ChevronLeft, ChevronRight } from "lucide-react";

export function RosterPagination({
  currentPage,
  pageCount,
  onPage,
}: {
  /** Zero-based index of the page on screen. */
  currentPage: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="roster-pagination" aria-label="Páginas de luchadores">
      <button
        aria-label="Página anterior de luchadores"
        disabled={currentPage === 0}
        onClick={() => onPage(currentPage - 1)}
      >
        <ChevronLeft size={16} />
      </button>
      <span role="status">
        Página {currentPage + 1} de {pageCount}
      </span>
      <button
        aria-label="Página siguiente de luchadores"
        disabled={currentPage >= pageCount - 1}
        onClick={() => onPage(currentPage + 1)}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
