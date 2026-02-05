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
          "flex h-14 w-full rounded-md border-2 border-warmgray-400 bg-white px-5 py-4 text-lg transition-colors file:border-0 file:bg-transparent file:text-lg file:font-medium placeholder:text-warmgray-600 focus-visible:outline-none focus-visible:border-sage-500 focus-visible:ring-[3px] focus-visible:ring-sage-100 disabled:cursor-not-allowed disabled:opacity-50",
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
