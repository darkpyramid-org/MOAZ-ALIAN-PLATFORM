"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { type CSSProperties, type ElementType, type JSX, memo, useMemo } from "react";

export type TextShimmerProps = {
  children: string;
  as?: ElementType;
  className?: string;
  duration?: number;
  spread?: number;
};

const ShimmerComponent = ({
  children,
  as: Component = "p",
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) => {
  const dynamicSpread = useMemo(() => (children?.length ?? 0) * spread, [children, spread]);

  return (
    <Component
      className={cn(
        "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
        "[background-repeat:no-repeat,padding-box]",
        "[background-position:100%_center,0_0]",
        "[transition:background-position_0s_ease]",
        className,
      )}
      style={
        {
          "--spread": `${dynamicSpread}px`,
          backgroundImage:
            "linear-gradient(90deg, transparent calc(50% - var(--spread)), currentColor, transparent calc(50% + var(--spread))), linear-gradient(currentColor, currentColor)",
        } as CSSProperties
      }
    >
      <motion.span
        animate={{ backgroundPosition: "0% center" }}
        initial={{ backgroundPosition: "100% center" }}
        transition={{
          repeat: Number.POSITIVE_INFINITY,
          duration,
          ease: "linear",
        }}
        style={{
          backgroundImage:
            "linear-gradient(90deg, transparent calc(50% - var(--spread)), currentColor, transparent calc(50% + var(--spread)))",
          backgroundSize: "250% 100%",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
          display: "inline-block",
          width: "100%",
        }}
      >
        {children}
      </motion.span>
    </Component>
  );
};

export const Shimmer = memo(ShimmerComponent);
