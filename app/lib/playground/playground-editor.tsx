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
      language={resolveEditorLanguage(path)}
      theme="vs-dark"
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
        lineNumbersMinChars: 3,
        scrollBeyondLastLine: false,
        roundedSelection: false,
        padding: { top: 14, bottom: 14 },
        renderLineHighlight: 'gutter',
        wordWrap: 'on',
        automaticLayout: true
      }}
    />
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
