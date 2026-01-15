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
      className={cn("bg-black p-3 [&_select]:bg-black [&_select]:text-white [&_select]:border-white/20 [&_select]:rounded-md [&_select]:px-2 [&_select]:py-1 [&_select]:appearance-none [&_select]:cursor-pointer [&_select:focus]:outline-none [&_select:focus]:border-white/50 [&_select_option]:bg-black [&_select_option]:text-white", className)}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-full", defaultClassNames.root),
        months: cn("flex gap-4 flex-col md:flex-row relative w-full", defaultClassNames.months),
        month: cn("flex flex-col w-full gap-4", defaultClassNames.month),
        nav: cn("flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between", defaultClassNames.nav),
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 text-white hover:bg-white/20 hover:text-white",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 text-white hover:bg-white/20 hover:text-white",
          defaultClassNames.button_next
        ),
        month_caption: cn("flex items-center justify-center h-8 w-full px-8", defaultClassNames.month_caption),
        dropdowns: cn("w-full flex items-center text-sm font-medium justify-center h-8 gap-1.5", defaultClassNames.dropdowns),
        dropdown_root: cn("relative has-focus:border-white/50 border border-white/20 has-focus:ring-white/20 has-focus:ring-[3px] rounded-md", defaultClassNames.dropdown_root),
        dropdown: cn("absolute bg-black inset-0 opacity-0", defaultClassNames.dropdown),
        caption_label: cn(
          "select-none font-medium text-white",
          captionLayout === "label"
            ? "text-sm"
            : "rounded-md pl-2 pr-1 flex items-center gap-1 text-sm h-8 [&>svg]:text-white/60 [&>svg]:size-3.5",
          defaultClassNames.caption_label
        ),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn("text-white/60 rounded-md flex-1 font-normal text-[0.8rem] select-none", defaultClassNames.weekday),
        week: cn("flex w-full mt-2", defaultClassNames.week),
        day: cn("relative w-full p-0 text-center group/day select-none", defaultClassNames.day),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "w-full h-9 p-0 font-normal text-white hover:bg-white/20 hover:text-white rounded-md"
        ),
        range_start: "rounded-l-md bg-white/20",
        range_middle: "rounded-none",
        range_end: "rounded-r-md bg-white/20",
        selected: "[&>button]:!bg-white [&>button]:!text-black [&>button]:hover:!bg-white [&>button]:hover:!text-black rounded-md",
        today: "bg-white/20 text-white rounded-md",
        outside: cn("text-white/30 opacity-50", defaultClassNames.outside),
        disabled: cn("text-white/20 opacity-50", defaultClassNames.disabled),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("size-4", className)} {...props} />
          }
          if (orientation === "right") {
            return <ChevronRight className={cn("size-4", className)} {...props} />
          }
          return <ChevronDown className={cn("size-4", className)} {...props} />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
