// Fork: one look for a status label or tag ("Current plan", "Live", a
// template's tags): a quiet gray fill, no border, small regular text. A
// border made them read as buttons, and each screen drew its own (picture
// review, Oct 9; Apple HIG, Consistency; NN/g #4). The 90%/19% gray shows on
// white cards, on the warm canvas and on the dark card; muted text on it is
// about 4.7:1.
export const STATUS_BADGE_CLASS =
  "bg-sidebar-accent text-muted-foreground rounded-md border-transparent text-xs font-normal";
