'use client';

import React from 'react';

interface PlaygroundOutputPanelProps {
  output: string[];
  error: string | null;
}

export function PlaygroundOutputPanel({
  output,
  error
}: PlaygroundOutputPanelProps) {
  const lines = output.length > 0 ? output : [error ?? '等待命令输出…'];

  return (
    <section className="ha-playground-output-shell" aria-label="Command output">
      <pre className="ha-playground-output">
        {lines.map((line, index) => (
          <span key={`${index}-${line}`} className="ha-playground-output-line">
            {line}
          </span>
        ))}
      </pre>
    </section>
  );
}
