import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 border-2 border-nb-black font-body font-bold leading-none rounded-none whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-nb-yellow text-nb-black",
        secondary: "bg-nb-white text-nb-black",
        dark: "bg-nb-black text-nb-white",
        lime: "bg-nb-lime text-nb-black",
        pink: "bg-nb-pink text-nb-black",
        outline: "bg-transparent text-nb-black",
      },
      size: {
        default: "px-3 py-1 text-[11px]",
        sm: "px-2 py-0.5 text-[10px]",
        lg: "px-4 py-1.5 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
