'use client';

import React from 'react';
import type { PlaygroundFileEntry } from './playground-provider';

interface PlaygroundFileTreeProps {
  files: PlaygroundFileEntry[];
  activeFile: string | null;
  onSelectFile: (path: string) => Promise<void>;
}

export function PlaygroundFileTree({
  files,
  activeFile,
  onSelectFile
}: PlaygroundFileTreeProps) {
  const tree = buildFileTree(files);

  return (
    <nav className="ha-playground-tree" aria-label="Workspace files">
      {tree.length > 0 ? (
        tree.map((node) => (
          <FileTreeNode
            key={node.path}
            node={node}
            activeFile={activeFile}
            onSelectFile={onSelectFile}
          />
        ))
      ) : (
        <p className="ha-playground-empty">等待工作区加载…</p>
      )}
    </nav>
  );
}

interface FileTreeNodeData {
  name: string;
  path: string;
  type: 'directory' | 'file';
  children: FileTreeNodeData[];
}

function buildFileTree(files: PlaygroundFileEntry[]) {
  type MutableTreeNode = FileTreeNodeData & {
    childrenMap?: Map<string, MutableTreeNode>;
  };

  const root = new Map<string, MutableTreeNode>();

  for (const { path } of files) {
    const segments = path.split('/');
    let currentLevel = root;
    let currentPath = '';

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const isFile = index === segments.length - 1;
      let node = currentLevel.get(segment);

      if (!node) {
        node = {
          name: segment,
          path: currentPath,
          type: isFile ? 'file' : 'directory',
          children: [],
          childrenMap: isFile ? undefined : new Map<string, MutableTreeNode>()
        };
        currentLevel.set(segment, node);
      }

      if (!isFile && node.childrenMap) {
        currentLevel = node.childrenMap;
      }
    }
  }

  function normalize(nodes: MutableTreeNode[]): FileTreeNodeData[] {
    return sortNodes(
      nodes.map((node) => ({
        name: node.name,
        path: node.path,
        type: node.type,
        children: node.childrenMap ? normalize([...node.childrenMap.values()]) : []
      }))
    );
  }

  return normalize([...root.values()]);
}

function sortNodes<T extends FileTreeNodeData>(nodes: T[]) {
  return nodes.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'directory' ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

interface FileTreeNodeProps {
  node: FileTreeNodeData;
  activeFile: string | null;
  onSelectFile: (path: string) => Promise<void>;
}

function FileTreeNode({ node, activeFile, onSelectFile }: FileTreeNodeProps) {
  if (node.type === 'directory') {
    return (
      <div className="ha-playground-tree-group">
        <div className="ha-playground-tree-directory" aria-label={node.path}>
          <span className="ha-playground-tree-chevron" aria-hidden="true">
            ▾
          </span>
          <FolderIcon />
          <span className="ha-playground-tree-label">{node.name}</span>
        </div>
        <div className="ha-playground-tree-children">
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              activeFile={activeFile}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-label={node.path}
      title={node.path}
      className={node.path === activeFile ? 'is-active' : ''}
      onClick={() => {
        void onSelectFile(node.path);
      }}
    >
      <FileIcon filename={node.name} />
      <span className="ha-playground-tree-label">{node.name}</span>
    </button>
  );
}

function FolderIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="ha-playground-tree-folder-icon"
    >
      <path
        d="M2.5 4.5h4l1.2 1.4h5.8v5.6H2.5z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function FileIcon({ filename }: { filename: string }) {
  const isTypeScript = /\.tsx?$/.test(filename);
  const isJavaScript = /\.(?:js|mjs|cjs)$/.test(filename);
  const isJson = /\.json$/.test(filename);
  let label = '·';
  let variant = '';

  if (isTypeScript) {
    label = 'TS';
    variant = 'is-typescript';
  } else if (isJavaScript) {
    label = 'JS';
    variant = 'is-javascript';
  } else if (isJson) {
    label = '{}';
    variant = 'is-json';
  }

  return (
    <span
      className={`ha-playground-tree-file-icon ${variant}`}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}
