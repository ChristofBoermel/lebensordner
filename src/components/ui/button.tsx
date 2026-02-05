import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-4 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-sage-600 text-white hover:bg-sage-700 shadow-sm",
        destructive: "bg-red-500 text-white hover:bg-red-600 shadow-sm",
        outline: "border-2 border-sage-300 bg-transparent text-sage-700 hover:bg-sage-50 hover:border-sage-400",
        secondary: "bg-warmgray-100 text-warmgray-800 hover:bg-warmgray-200",
        ghost: "text-sage-700 hover:bg-sage-50 hover:text-sage-800",
        link: "text-sage-600 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-14 px-7 py-3.5",
        sm: "h-12 rounded-md px-5 text-base",
        lg: "h-14 rounded-md px-8 text-lg",
        onboarding: "h-14 px-8 py-4 text-lg",
        icon: "h-12 w-12",
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
    const isIconOnly =
      size === "icon" &&
      React.Children.count(props.children) === 1 &&
      typeof props.children !== "string"
    const ariaLabel = isIconOnly
      ? props["aria-label"] || (typeof props.title === "string" ? props.title : undefined)
      : props["aria-label"]
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        aria-label={ariaLabel}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
