"use client";

import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  Variants,
} from "motion/react";
import { useRef } from "react";

// Derived from the hook itself rather than hardcoded as `string`, so it stays
// correct across framer-motion versions. framer-motion types `margin` as a
// template literal (e.g. `-50px`), which a plain `string` is not assignable to.
type InViewMargin = NonNullable<Parameters<typeof useInView>[1]>["margin"];

interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  variant?: {
    hidden: { y: number };
    visible: { y: number };
  };
  duration?: number;
  delay?: number;
  yOffset?: number;
  inView?: boolean;
  inViewMargin?: InViewMargin;
  blur?: string;
}
const BlurFade = ({
  children,
  className,
  variant,
  duration = 0.4,
  delay = 0,
  yOffset = 6,
  // On by default: each block waits until it scrolls into view, so a long
  // page reveals section by section instead of all at once on load.
  inView = true,
  inViewMargin = "-50px",
  blur = "6px",
}: BlurFadeProps) => {
  const ref = useRef(null);
  const inViewResult = useInView(ref, { once: true, margin: inViewMargin });
  const isInView = !inView || inViewResult;
  const shouldReduceMotion = useReducedMotion();
  // Drops in from above and settles at rest, as the Magic UI template does
  // (and as .animate-blur-fade in globals.css does in CSS).
  //
  // One variant set for everyone. The server cannot know the visitor's motion
  // preference, so it always renders the hidden state with the blur and the
  // offset. If reduced motion swapped in variants without y and filter, the
  // browser would never animate those keys and the server's inline blur and
  // translate would stay on the page for good. Instead, reduced motion keeps
  // the same keys and only makes y and filter instant: the text appears with
  // a plain opacity fade.
  const defaultVariants: Variants = {
    hidden: { y: -yOffset, opacity: 0, filter: `blur(${blur})` },
    visible: { y: 0, opacity: 1, filter: `blur(0px)` },
  };
  const combinedVariants = variant || defaultVariants;
  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        exit="hidden"
        variants={combinedVariants}
        transition={{
          delay: 0.04 + delay,
          duration,
          ease: "easeOut",
          ...(shouldReduceMotion && {
            y: { duration: 0 },
            filter: { duration: 0 },
          }),
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

export default BlurFade;
