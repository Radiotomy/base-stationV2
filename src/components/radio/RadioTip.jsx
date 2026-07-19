import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Hover tooltip styled to match the boombox chassis.
 * Wraps any interactive element without altering layout (asChild).
 */
export default function RadioTip({ tip, side = "top", children }) {
  if (!tip) return children;
  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side={side}
          className="bg-[#1C1712] border border-[#C6F27E]/25 text-[#E8DFD2] text-xs font-medium max-w-[230px] shadow-[0_6px_20px_rgba(0,0,0,0.7)]"
        >
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}