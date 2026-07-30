import React, { createContext, useContext, useCallback } from 'react';

const HapticContext = createContext();

export function HapticProvider({ children }) {
  const trigger = useCallback((type = 'light') => {
    if (!('vibrate' in navigator)) return;
    
    const patterns = {
      light: [5],
      medium: [10],
      heavy: [15],
      success: [10, 50, 10],
      warning: [20, 30, 20],
      error: [30, 100, 30],
      tap: [3],
      pop: [1, 10, 1],
    };
    
    navigator.vibrate(patterns[type] || patterns.light);
  }, []);
  
  return (
    <HapticContext.Provider value={trigger}>
      {children}
    </HapticContext.Provider>
  );
}

export function useHaptic() {
  const trigger = useContext(HapticContext);
  if (!trigger) {
    throw new Error('useHaptic must be used within a HapticProvider');
  }
  return trigger;
}

// HapticButton component
export function HapticButton({ 
  hapticType = 'tap', 
  children, 
  onClick,
  ...props 
}) {
  const haptic = useHaptic();
  
  const handleClick = useCallback((e) => {
    haptic(hapticType);
    onClick?.(e);
  }, [haptic, hapticType, onClick]);
  
  return (
    <button onClick={handleClick} {...props}>
      {children}
    </button>
  );
}
