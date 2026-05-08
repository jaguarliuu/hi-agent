'use client';

import React from 'react';
import Editor from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import { findAnchorPosition } from './anchor-locator';

interface PlaygroundEditorProps {
  path: string | null;
  value: string;
  anchor: string | null;
  onChange: (next: string) => Promise<void>;
}

export function PlaygroundEditor({
  path,
  value,
  anchor,
  onChange
}: PlaygroundEditorProps) {
  const editorRef = useRef<{
    setPosition: (position: { lineNumber: number; column: number }) => void;
    revealLineInCenter: (lineNumber: number) => void;
  } | null>(null);

  useEffect(() => {
    if (!editorRef.current || !anchor) {
      return;
    }

    const position = findAnchorPosition(value, anchor);
    editorRef.current.setPosition(position);
    editorRef.current.revealLineInCenter(position.lineNumber);
  }, [anchor, value]);

  return (
    <Editor
      height="100%"
      path={path ?? undefined}
      language={path?.endsWith('.ts') ? 'typescript' : 'plaintext'}
      value={value}
      onChange={(next) => {
        void onChange(next ?? '');
      }}
      onMount={(editor) => {
        editorRef.current = editor;

        if (!anchor) {
          return;
        }

        const position = findAnchorPosition(value, anchor);
        editor.setPosition(position);
        editor.revealLineInCenter(position.lineNumber);
      }}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        scrollBeyondLastLine: false
      }}
    />
  );
}
