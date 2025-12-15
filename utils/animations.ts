/**
 * Framer Motion Animation Utilities
 * Editorial design system animations for AI for PI
 */

import { Variants, Transition } from 'framer-motion';

// Transition Presets
export const transitions = {
  // Quick micro-interactions (buttons, hover states)
  fast: { duration: 0.15, ease: [0.25, 0.1, 0.25, 1] } as Transition,

  // Standard transitions
  base: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } as Transition,

  // Slower, more noticeable transitions
  slow: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } as Transition,

  // Page-level transitions
  page: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } as Transition,

  // Reveal animations (scroll-triggered, entrance)
  reveal: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } as Transition,

  // Spring for interactive elements
  spring: { type: 'spring', stiffness: 400, damping: 30 } as Transition,
};

// Fade In
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: transitions.base
  },
};

// Fade In Up (most common entrance animation)
export const fadeInUp: Variants = {
  hidden: {
    opacity: 0,
    y: 16
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.reveal
  },
};

// Fade In Down
export const fadeInDown: Variants = {
  hidden: {
    opacity: 0,
    y: -16
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.reveal
  },
};

// Fade In Left
export const fadeInLeft: Variants = {
  hidden: {
    opacity: 0,
    x: -24
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.reveal
  },
};

// Fade In Right
export const fadeInRight: Variants = {
  hidden: {
    opacity: 0,
    x: 24
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.reveal
  },
};

// Scale fade (for modals, cards)
export const scaleFade: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transitions.base
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: transitions.fast
  }
};

// Stagger Container (parent for staggered children)
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

// Stagger Container (faster)
export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

// Stagger Item (child element)
export const staggerItem: Variants = {
  hidden: {
    opacity: 0,
    y: 12
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.reveal
  },
};

// Page Transition
export const pageTransition: Variants = {
  hidden: {
    opacity: 0,
    y: 8
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.page
  },
  exit: {
    opacity: 0,
    transition: transitions.fast
  }
};

// Modal animation
export const modalOverlay: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 }
  }
};

export const modalContent: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    y: 8
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: [0.16, 1, 0.3, 1]
    }
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: 0.15 }
  }
};

// Dropdown animation
export const dropdown: Variants = {
  hidden: {
    opacity: 0,
    y: -8,
    scale: 0.96
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.15,
      ease: [0.16, 1, 0.3, 1]
    }
  },
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.96,
    transition: { duration: 0.1 }
  }
};

// Expand/Collapse (for accordions)
export const expand: Variants = {
  hidden: {
    height: 0,
    opacity: 0
  },
  visible: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
      opacity: { duration: 0.2, delay: 0.1 }
    }
  },
  exit: {
    height: 0,
    opacity: 0,
    transition: {
      height: { duration: 0.2 },
      opacity: { duration: 0.1 }
    }
  }
};

// Subtle hover scale (for cards, buttons)
export const hoverScale = {
  scale: 1.02,
  transition: transitions.fast
};

export const hoverScaleSmall = {
  scale: 1.01,
  transition: transitions.fast
};

// Press/Tap scale
export const tapScale = {
  scale: 0.98
};

// Slide in from side (for sidebars, drawers)
export const slideInLeft: Variants = {
  hidden: {
    x: '-100%',
    opacity: 0
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1]
    }
  },
  exit: {
    x: '-100%',
    opacity: 0,
    transition: { duration: 0.2 }
  }
};

export const slideInRight: Variants = {
  hidden: {
    x: '100%',
    opacity: 0
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1]
    }
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: { duration: 0.2 }
  }
};

// Progress bar animation
export const progressBar: Variants = {
  hidden: {
    scaleX: 0,
    originX: 0
  },
  visible: (progress: number) => ({
    scaleX: progress / 100,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1]
    }
  }),
};

// List item animations (for history, archive lists)
export const listItem: Variants = {
  hidden: {
    opacity: 0,
    x: -8
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.reveal
  },
  exit: {
    opacity: 0,
    x: 8,
    transition: transitions.fast
  }
};

// Skeleton loading pulse
export const skeletonPulse: Variants = {
  hidden: { opacity: 0.4 },
  visible: {
    opacity: [0.4, 0.7, 0.4],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  }
};
