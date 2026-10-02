const ANARLOG_MARK_VIEW_BOX = "233 208 557 610";

export function AnarlogMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={ANARLOG_MARK_VIEW_BOX}
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M237 357A62 62 0 0 1 299 295L323 295A62 62 0 0 1 385 357L385 582A94 94 0 0 0 573 582L573 385Q573 355 598 335L750 219Q768 207 780 218Q785 223 785 235L785 322Q785 337 773 346L730 378Q717 388 717 405L717 572A240 240 0 0 1 237 572Z" />
    </svg>
  );
}
