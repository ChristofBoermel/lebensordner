import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-md border-2 border-warmgray-400 bg-white px-4 py-3 text-base transition-colors file:border-0 file:bg-transparent file:text-base file:font-medium placeholder:text-warmgray-500 focus-visible:outline-none focus-visible:border-sage-500 focus-visible:ring-2 focus-visible:ring-sage-100 disabled:cursor-not-allowed disabled:opacity-50",
          "text-gray-900",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
