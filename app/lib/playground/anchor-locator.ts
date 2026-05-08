export function findAnchorPosition(content: string, anchor: string) {
  const lines = content.split('\n');
  const index = lines.findIndex((line) => line.includes(anchor));

  return {
    lineNumber: index >= 0 ? index + 1 : 1,
    column: 1
  };
}
