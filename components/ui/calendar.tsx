"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react"
import { DayPicker, getDefaultClassNames } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  formatters,
  startMonth,
  endMonth,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames()

  // Default to current month as start, 10 years in future as end
  const defaultStartMonth = startMonth || new Date()
  const defaultEndMonth = endMonth || new Date(new Date().getFullYear() + 10, 11, 31)

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      startMonth={defaultStartMonth}
      endMonth={defaultEndMonth}
      className={cn(
        "bg-black p-3 [--cell-size:2.25rem]",
        "[&_select]:bg-black [&_select]:text-white [&_select]:border-white/20 [&_select]:rounded-md [&_select]:px-2 [&_select]:py-1 [&_select]:appearance-none [&_select]:cursor-pointer [&_select:focus]:outline-none [&_select:focus]:border-white/50 [&_select_option]:bg-black [&_select_option]:text-white",
        className
      )}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("flex gap-4 flex-col md:flex-row relative", defaultClassNames.months),
        month: cn("flex flex-col gap-4", defaultClassNames.month),
        nav: cn("flex items-center gap-1 absolute top-0 inset-x-0 justify-between z-10", defaultClassNames.nav),
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "size-7 p-0 text-white hover:bg-white/20 hover:text-white",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "size-7 p-0 text-white hover:bg-white/20 hover:text-white",
          defaultClassNames.button_next
        ),
        month_caption: cn("flex items-center justify-center h-7 relative px-10", defaultClassNames.month_caption),
        dropdowns: cn("flex items-center text-sm font-medium justify-center gap-1.5", defaultClassNames.dropdowns),
        dropdown_root: cn("relative has-focus:border-white/50 border border-white/20 has-focus:ring-white/20 has-focus:ring-[3px] rounded-md", defaultClassNames.dropdown_root),
        dropdown: cn("absolute bg-black inset-0 opacity-0", defaultClassNames.dropdown),
        caption_label: cn(
          "select-none font-medium text-white",
          captionLayout === "label"
            ? "text-sm"
            : "rounded-md pl-2 pr-1 flex items-center gap-1 text-sm h-7 [&>svg]:text-white/60 [&>svg]:size-3.5",
          defaultClassNames.caption_label
        ),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-white/60 font-normal text-[0.8rem] select-none w-[var(--cell-size)] text-center",
          defaultClassNames.weekday
        ),
        week: cn("flex w-full mt-1", defaultClassNames.week),
        day: cn(
          "relative p-0 text-center select-none w-[var(--cell-size)] h-[var(--cell-size)]",
          defaultClassNames.day
        ),
        day_button: cn(
          "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:pointer-events-none disabled:opacity-50",
          "w-[var(--cell-size)] h-[var(--cell-size)] p-0 font-normal text-white hover:bg-white/20 hover:text-white rounded-md"
        ),
        // Range styling - button colors handled via CSS in global.css for proper specificity
        range_start: cn("bg-white/20 rounded-l-md", defaultClassNames.range_start),
        range_middle: cn("bg-white/20 rounded-none", defaultClassNames.range_middle),
        range_end: cn("bg-white/20 rounded-r-md", defaultClassNames.range_end),
        selected: defaultClassNames.selected,
        today: "[&>button]:ring-1 [&>button]:ring-white/50",
        outside: cn("text-white/30 opacity-50 [&>button]:text-white/30", defaultClassNames.outside),
        disabled: cn("text-white/20 opacity-50 pointer-events-none", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("size-4 pointer-events-none", className)} {...props} />
          }
          if (orientation === "right") {
            return <ChevronRight className={cn("size-4 pointer-events-none", className)} {...props} />
          }
          return <ChevronDown className={cn("size-4 pointer-events-none", className)} {...props} />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
