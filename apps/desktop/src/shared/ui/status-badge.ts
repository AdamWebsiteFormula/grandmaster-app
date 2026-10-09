// Fork: one look for a status label or tag ("Current plan", "Live", a
// template's tags): a quiet gray fill, no border, small regular text. A
// border made them read as buttons, and each screen drew its own (picture
// review, Oct 9; Apple HIG, Consistency; NN/g #4). The fill is a tint of
// the text color, so it shows on any surface: on a white card, the gray
// canvas and a raised dark field alike (a fixed gray vanished on the dark
// dropdown; Apple HIG, Dark Mode). Text stays 4.5:1 or more on it; `!`
// because @anlg/ui's .text-muted-foreground loads later and won in dark.
export const STATUS_BADGE_CLASS =
  "bg-foreground/5 text-muted-foreground dark:bg-foreground/10 dark:text-foreground/85! rounded-md border-transparent text-xs font-normal";
