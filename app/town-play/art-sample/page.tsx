import type { Metadata } from "next";
import ClassicArtSample from "./ClassicArtSample";

export const metadata: Metadata = {
  title: "河湾铁路街区 · 古典侦探美术样板",
  description: "步行走进河湾车站、旧书店与铁路旅馆，观察建筑、陈设、人物尺度和古典侦探世界的探索视角。",
};

export default function ClassicArtSamplePage() {
  return <ClassicArtSample />;
}
