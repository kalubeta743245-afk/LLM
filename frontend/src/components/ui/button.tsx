import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 border-[3px] border-nb-black font-body font-bold leading-none no-underline transition-all duration-75 rounded-none cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-nb-yellow text-nb-black shadow-nb hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-nb-sm active:translate-x-[6px] active:translate-y-[6px] active:shadow-none",
        dark: "bg-nb-black text-nb-white shadow-nb hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-nb-sm active:translate-x-[6px] active:translate-y-[6px] active:shadow-none",
        outline: "bg-nb-white text-nb-black shadow-nb hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-nb-sm active:translate-x-[6px] active:translate-y-[6px] active:shadow-none",
        ghost: "bg-transparent text-nb-black border-transparent shadow-none hover:bg-nb-gray/50",
        link: "bg-transparent text-nb-black border-none shadow-none underline underline-offset-4 decoration-2 hover:opacity-70",
      },
      size: {
        default: "px-6 py-3 text-sm tracking-tight",
        sm: "px-4 py-2 text-xs",
        lg: "px-8 py-4 text-base",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
