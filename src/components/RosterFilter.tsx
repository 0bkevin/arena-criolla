import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { FIGHTERS, type FighterCategory } from "../../shared/content";

type Category = "all" | FighterCategory;

export function RosterFilter({
  value,
  onChange,
}: {
  value: Category;
  onChange: (category: Category) => void;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<{
    side: "top" | "bottom";
    maxHeight?: number;
  }>({ side: "bottom" });
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const categories: readonly (readonly [Category, string])[] = [
    ["all", "Todos"],
    ["founders", "Founders"],
    ["culture", "Cultura"],
    ["folklore", "Leyendas"],
    ...(value === "community" ||
    FIGHTERS.some((fighter) => fighter.category === "community")
      ? ([["community", "Panas"]] as const)
      : []),
  ];
  const options = categories.map(([id, label]) => ({
    id,
    label,
    count: FIGHTERS.filter(
      (fighter) => id === "all" || (fighter.category ?? "culture") === id,
    ).length,
  }));
  const selected = options.find((option) => option.id === value) ?? options[0];

  useLayoutEffect(() => {
    if (!open) return;
    const positionMenu = () => {
      const bounds = root.current?.getBoundingClientRect();
      const height = menu.current?.scrollHeight;
      if (!bounds || !height) return;
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportBottom =
        viewportTop + (viewport?.height ?? window.innerHeight);
      const header = document
        .querySelector(".site-header")
        ?.getBoundingClientRect();
      const availableTop = header?.height
        ? Math.max(viewportTop, header.bottom)
        : viewportTop;
      const dock = document
        .querySelector(".mobile-setup-dock")
        ?.getBoundingClientRect();
      const availableBottom = dock?.height
        ? Math.min(viewportBottom, dock.top)
        : viewportBottom;
      if (
        bounds.bottom < availableTop + 8 ||
        bounds.top > availableBottom - 8
      ) {
        setOpen(false);
        return;
      }
      const below = Math.max(0, availableBottom - bounds.bottom - 16);
      const above = Math.max(0, bounds.top - availableTop - 16);
      const side = below < height && above > below ? "top" : "bottom";
      const maxHeight = Math.floor(side === "top" ? above : below);
      setPlacement((current) =>
        current.side === side && current.maxHeight === maxHeight
          ? current
          : { side, maxHeight },
      );
    };
    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    window.visualViewport?.addEventListener("resize", positionMenu);
    window.visualViewport?.addEventListener("scroll", positionMenu);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
      window.visualViewport?.removeEventListener("resize", positionMenu);
      window.visualViewport?.removeEventListener("scroll", positionMenu);
    };
  }, [open, options.length]);

  useLayoutEffect(() => {
    const list = menu.current;
    if (!open || !list) return;
    const focused = list.contains(document.activeElement)
      ? (document.activeElement as HTMLElement)
      : list.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!focused) return;
    const top = focused.offsetTop;
    const bottom = top + focused.offsetHeight;
    if (top < list.scrollTop + 4) list.scrollTop = Math.max(0, top - 4);
    else if (bottom > list.scrollTop + list.clientHeight - 4)
      list.scrollTop = bottom - list.clientHeight + 4;
  }, [open, placement]);

  useEffect(() => {
    if (!open) return;
    menu.current
      ?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
      ?.focus({ preventScroll: true });
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className="roster-filter"
      data-active={value !== "all"}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        className="roster-filter-toggle"
        aria-label={`Filtrar por colección: ${selected.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title={`Filtrar por colección: ${selected.label}`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (open) {
              menu.current
                ?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
                ?.focus();
            } else setOpen(true);
          }
        }}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span className="roster-filter-label">
          {selected.label} <span>{selected.count}</span>
        </span>
        <ChevronDown
          className="roster-filter-chevron"
          size={14}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div
          ref={menu}
          id={menuId}
          className="roster-filter-menu"
          data-side={placement.side}
          style={{ maxHeight: placement.maxHeight }}
          role="menu"
          aria-label="Colección de luchadores"
          onKeyDown={(event) => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const items = Array.from(
              event.currentTarget.querySelectorAll("button"),
            );
            const current = items.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? items.length - 1
                  : (current +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      items.length) %
                    items.length;
            items[next]?.focus();
          }}
        >
          {options.map((option) => (
            <button
              key={option.id}
              className="roster-filter-option"
              role="menuitemradio"
              aria-checked={value === option.id}
              tabIndex={-1}
              onClick={() => {
                onChange(option.id);
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <span>{option.label}</span>
              <span className="roster-filter-count">{option.count}</span>
              <Check size={14} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
