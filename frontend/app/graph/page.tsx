"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, GraphResponse } from "@/lib/api";
import AppNav from "@/components/AppNav";

/**
 * Positions tag nodes evenly around a circle, then places each entry node
 * at the centroid of the tags it's connected to (nudged outward slightly
 * so entries with only one tag don't stack exactly on top of it). This
 * avoids pulling in a full force-directed layout library for what's
 * fundamentally a small, mostly-static bipartite graph.
 */
function layout(graph: GraphResponse): { nodes: Node[]; edges: Edge[] } {
  const tagNodes = graph.nodes.filter((n) => n.type === "tag");
  const entryNodes = graph.nodes.filter((n) => n.type === "entry");

  const radius = Math.max(220, tagNodes.length * 28);
  const tagPositions = new Map<string, { x: number; y: number }>();

  tagNodes.forEach((tag, i) => {
    const angle = (2 * Math.PI * i) / Math.max(tagNodes.length, 1);
    tagPositions.set(tag.id, {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    });
  });

  const neighborsByEntry = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!neighborsByEntry.has(edge.source)) neighborsByEntry.set(edge.source, []);
    neighborsByEntry.get(edge.source)!.push(edge.target);
  }

  const nodes: Node[] = [];

  for (const tag of tagNodes) {
    const pos = tagPositions.get(tag.id)!;
    const size = Math.min(16, 8 + (tag.tag_count || 1) * 2);
    nodes.push({
      id: tag.id,
      position: pos,
      data: { label: `${tag.label}${tag.tag_count ? ` (${tag.tag_count})` : ""}` },
      style: {
        background: "rgba(183, 205, 227, 0.22)",
        color: "#44576A",
        border: "1px solid rgba(175, 200, 222, 0.55)",
        borderRadius: 999,
        fontSize: 12,
        padding: `${4 + size / 4}px ${10 + size / 2}px`,
        width: "auto",
      },
    });
  }

  entryNodes.forEach((entry, i) => {
    const neighborTags = neighborsByEntry.get(entry.id) || [];
    let x = 0;
    let y = 0;
    if (neighborTags.length > 0) {
      for (const tagId of neighborTags) {
        const p = tagPositions.get(tagId);
        if (p) {
          x += p.x;
          y += p.y;
        }
      }
      x /= neighborTags.length;
      y /= neighborTags.length;
      // pull slightly toward center so clusters of entries fan out rather than overlap exactly
      x *= 0.55;
      y *= 0.55;
    } else {
      // untagged entries: scatter near the center
      const angle = (2 * Math.PI * i) / Math.max(entryNodes.length, 1);
      x = 40 * Math.cos(angle);
      y = 40 * Math.sin(angle);
    }

    nodes.push({
      id: entry.id,
      position: { x, y },
      data: { label: entry.label },
      style: {
        background: "rgba(255,255,255,0.9)",
        color: "#44576A",
        border: "1px solid rgba(230, 237, 245, 0.9)",
        borderRadius: 12,
        fontSize: 11,
        padding: "6px 10px",
        maxWidth: 160,
      },
    });
  });

  const edges: Edge[] = graph.edges.map((e) => ({
    id: `${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    style: { stroke: "rgba(127, 147, 167, 0.2)" },
  }));

  return { nodes, edges };
}

export default function GraphPage() {
  const router = useRouter();
  const { user, accessToken, loading } = useAuth();

  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!accessToken) return;
    setFetching(true);
    api
      .getGraph(accessToken)
      .then(setGraph)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Couldn't load your memory graph.")
      )
      .finally(() => setFetching(false));
  }, [accessToken]);

  const { nodes, edges } = useMemo(() => (graph ? layout(graph) : { nodes: [], edges: [] }), [graph]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7FAFC] text-[#6E8499]">
        Loading…
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-[#F7FAFC] text-[#44576A]">
      <AppNav />

      <div className="px-4 pt-6 sm:px-6">
        <h1 className="font-display text-2xl italic">Memory graph</h1>
        <p className="mt-1 text-sm text-[#6E8499]">
          How your memories connect through the people, places, and topics in them.
        </p>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {!fetching && graph && graph.nodes.length === 0 && !error && (
          <p className="mt-3 text-sm text-[#6E8499]">
            Nothing to show yet — write a few entries with tags and they'll show up here.
          </p>
        )}
      </div>

      <div className="mt-4 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          colorMode="dark"
          nodesDraggable
          nodesConnectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="rgba(127,147,167,0.16)" gap={24} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </main>
  );
}
