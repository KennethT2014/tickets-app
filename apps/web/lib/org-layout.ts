import type { Edge, Node } from "@xyflow/react";
import type { AreaNode } from "./types";

const NODE_W = 240;
const NODE_H = 108;
const H_GAP = 36;
const V_GAP = 72;

function subtreeWidth(node: AreaNode): number {
  if (node.children.length === 0) return NODE_W;
  return Math.max(
    NODE_W,
    node.children.reduce((sum, child) => sum + subtreeWidth(child), 0) +
      H_GAP * (node.children.length - 1),
  );
}

export function layoutOrgTree(forest: AreaNode[]): {
  nodes: Node<AreaNode>[];
  edges: Edge[];
} {
  const nodes: Node<AreaNode>[] = [];
  const edges: Edge[] = [];

  function walk(node: AreaNode, x: number, y: number) {
    nodes.push({
      id: node.id,
      position: { x: x - NODE_W / 2, y },
      data: node,
      type: "area",
    });
    const width = subtreeWidth(node);
    let childX = x - width / 2;
    for (const child of node.children) {
      const childWidth = subtreeWidth(child);
      const cx = childX + childWidth / 2;
      edges.push({
        id: `${node.id}-${child.id}`,
        source: node.id,
        target: child.id,
      });
      walk(child, cx, y + NODE_H + V_GAP);
      childX += childWidth + H_GAP;
    }
  }

  let offsetX = 0;
  for (const root of forest) {
    const width = subtreeWidth(root);
    walk(root, offsetX + width / 2, 0);
    offsetX += width + H_GAP * 2;
  }

  return { nodes, edges };
}

export function flattenAreas(forest: AreaNode[]): AreaNode[] {
  const list: AreaNode[] = [];
  const walk = (node: AreaNode) => {
    list.push(node);
    node.children.forEach(walk);
  };
  forest.forEach(walk);
  return list;
}
