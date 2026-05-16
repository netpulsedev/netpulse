import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface AnimatedNumberProps {
  value: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export function AnimatedNumber({ value, className, style }: AnimatedNumberProps) {
  // If value is not a number (like '—' or 'Excellent'), render it directly
  const isNumeric = typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)) && value.trim() !== '');
  
  const numValue = isNumeric ? parseFloat(value as string) : 0;
  
  const motionValue = useMotionValue(numValue);
  const springValue = useSpring(motionValue, { 
    damping: 25, 
    stiffness: 150,
    restDelta: 0.001
  });

  useEffect(() => {
    if (isNumeric) {
      motionValue.set(numValue);
    }
  }, [numValue, isNumeric, motionValue]);

  const displayValue = useTransform(springValue, (latest) => {
    if (!isNumeric) return String(value);
    
    // Determine decimal places from original string
    const strVal = String(value);
    const decimals = strVal.includes('.') ? strVal.split('.')[1].length : 0;
    
    // Avoid showing '-0' or weird rounding
    return Math.max(0, latest).toFixed(decimals);
  });

  // Need to force re-render when switching between text and number
  const prevIsNumeric = useRef(isNumeric);
  useEffect(() => {
    prevIsNumeric.current = isNumeric;
  }, [isNumeric]);

  if (!isNumeric) {
    return <span className={className} style={style}>{value}</span>;
  }

  return <motion.span className={className} style={style}>{displayValue}</motion.span>;
}
