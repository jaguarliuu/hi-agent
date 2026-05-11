'use client';

import React from 'react';
import Editor from '@monaco-editor/react';
import { useEffect, useRef, useState } from 'react';
import {
  claimPlaygroundFlight,
  startPlaygroundFlight
} from '../motion/playground-flight';
import { useReducedMotion } from '../motion/use-reduced-motion';
import { findAnchorPosition } from './anchor-locator';
import { usePlaygroundTheme } from './use-playground-theme';

interface PlaygroundEditorProps {
  path: string | null;
  value: string;
  anchor: string | null;
  onChange: (next: string) => Promise<void>;
}

interface EditorPosition {
  lineNumber: number;
  column: number;
}

interface PlaygroundEditorHandle {
  setPosition: (position: EditorPosition) => void;
  revealLineInCenter: (lineNumber: number) => void;
  deltaDecorations?: (
    oldDecorations: string[],
    newDecorations: Array<{
      range: {
        startLineNumber: number;
        startColumn: number;
        endLineNumber: number;
        endColumn: number;
      };
      options: {
        className: string;
        isWholeLine: boolean;
      };
    }>
  ) => string[];
}

const HIGHLIGHT_DURATION_MS = 600;
const HIGHLIGHT_REDUCED_DURATION_MS = 180;

export function PlaygroundEditor({
  path,
  value,
  anchor,
  onChange
}: PlaygroundEditorProps) {
  const editorRef = useRef<PlaygroundEditorHandle | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const [editorReadyVersion, setEditorReadyVersion] = useState(0);
  const theme = usePlaygroundTheme();
  const reducedMotion = useReducedMotion();

  function getAnchorPosition(): EditorPosition {
    if (!anchor) {
      return { lineNumber: 1, column: 1 };
    }

    return findAnchorPosition(value, anchor);
  }

  function clearHighlightTimeout() {
    if (highlightTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = null;
  }

  useEffect(() => {
    if (!editorRef.current || !anchor) {
      return;
    }

    const position = getAnchorPosition();
    editorRef.current.setPosition(position);
    editorRef.current.revealLineInCenter(position.lineNumber);
  }, [anchor, value]);

  useEffect(() => {
    if (!editorRef.current || !path) {
      return;
    }

    const cue = claimPlaygroundFlight(path);

    if (!cue) {
      return;
    }

    if (!reducedMotion) {
      startPlaygroundFlight(cue);
    }

    const position = getAnchorPosition();
    const decorations = editorRef.current.deltaDecorations?.([], [
      {
        range: {
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: 1
        },
        options: {
          className: 'ha-playground-editor-highlight',
          isWholeLine: true
        }
      }
    ]) ?? [];

    clearHighlightTimeout();
    highlightTimeoutRef.current = window.setTimeout(() => {
      editorRef.current?.deltaDecorations?.(decorations, []);
      highlightTimeoutRef.current = null;
    }, reducedMotion ? HIGHLIGHT_REDUCED_DURATION_MS : HIGHLIGHT_DURATION_MS);
  }, [anchor, editorReadyVersion, path, reducedMotion, value]);

  useEffect(() => {
    return () => {
      clearHighlightTimeout();
    };
  }, []);

  return (
    <div
      className="ha-playground-editor-target"
      data-playground-flight-target={path ?? ''}
    >
      <Editor
        height="100%"
        path={path ?? undefined}
        language={resolveEditorLanguage(path)}
        theme={theme === 'light' ? 'vs' : 'vs-dark'}
        value={value}
        beforeMount={(monaco) => {
          monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            allowNonTsExtensions: true,
            module: monaco.languages.typescript.ModuleKind.ESNext,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            target: monaco.languages.typescript.ScriptTarget.ES2022,
            jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            resolveJsonModule: true
          });
          monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: true,
            noSyntaxValidation: false
          });
          monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
            allowNonTsExtensions: true,
            module: monaco.languages.typescript.ModuleKind.ESNext,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            target: monaco.languages.typescript.ScriptTarget.ES2022,
            allowSyntheticDefaultImports: true,
            resolveJsonModule: true
          });
          monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: true,
            noSyntaxValidation: false
          });
        }}
        onChange={(next) => {
          void onChange(next ?? '');
        }}
        onMount={(editor) => {
          editorRef.current = editor as PlaygroundEditorHandle;
          setEditorReadyVersion((current) => current + 1);

          if (!anchor) {
            return;
          }

          const position = getAnchorPosition();
          editor.setPosition(position);
          editor.revealLineInCenter(position.lineNumber);
        }}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbersMinChars: 3,
          scrollBeyondLastLine: false,
          roundedSelection: false,
          padding: { top: 14, bottom: 14 },
          renderLineHighlight: 'gutter',
          wordWrap: 'on',
          automaticLayout: true
        }}
      />
    </div>
  );
}

function resolveEditorLanguage(path: string | null) {
  if (!path) {
    return 'plaintext';
  }

  if (path.endsWith('.ts') || path.endsWith('.tsx')) {
    return 'typescript';
  }

  if (path.endsWith('.js') || path.endsWith('.mjs') || path.endsWith('.cjs')) {
    return 'javascript';
  }

  if (path.endsWith('.json')) {
    return 'json';
  }

  if (path.endsWith('.sh')) {
    return 'shell';
  }

  return 'plaintext';
}
