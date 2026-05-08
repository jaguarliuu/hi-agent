'use client';

import React, { createContext, useContext, type ReactNode } from 'react';

interface PlaygroundSectionContextValue {
  sectionId: string;
}

const PlaygroundSectionContext =
  createContext<PlaygroundSectionContextValue | null>(null);

interface PlaygroundSectionProps {
  sectionId: string;
  children: ReactNode;
}

export function PlaygroundSection({
  sectionId,
  children
}: PlaygroundSectionProps) {
  return (
    <PlaygroundSectionContext.Provider value={{ sectionId }}>
      {children}
    </PlaygroundSectionContext.Provider>
  );
}

export function usePlaygroundSection() {
  const context = useContext(PlaygroundSectionContext);

  if (!context) {
    throw new Error('Playground actions must be used inside PlaygroundSection');
  }

  return context;
}
