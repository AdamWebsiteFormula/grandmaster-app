import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@anlg/utils";

// Fork: the off track is the field-border gray (--input), 3:1 or more against
// every surface a switch sits on in both themes (WCAG 2.2 SC 1.4.11). As on
// macOS, the thumb is white in both themes and the track fills with the
// accent color when on (Apple HIG, Toggles; owner's pick, Oct 5: the dark
// thumb was black, unlike every Mac switch).
const switchVariants = cva(
  "peer focus-visible:ring-ring focus-visible:ring-offset-background data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=unchecked]:border-input data-[state=unchecked]:bg-input rounded-pill inline-flex shrink-0 cursor-pointer items-center border-2 transition-colors [corner-shape:round] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      size: {
        sm: "h-4 w-8",
        default: "h-6 w-11",
        lg: "h-7 w-14",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

const thumbVariants = cva(
  "rounded-pill pointer-events-none block bg-white shadow-sm ring-0 transition-transform [corner-shape:round]",
  {
    variants: {
      size: {
        sm: "h-3 w-3 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
        default:
          "h-5 w-5 data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
        lg: "h-6 w-6 data-[state=checked]:translate-x-7 data-[state=unchecked]:translate-x-0",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

interface SwitchProps
  extends
    React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>,
    VariantProps<typeof switchVariants> {}

const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, size, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn([switchVariants({ size, className })])}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb className={cn([thumbVariants({ size })])} />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
