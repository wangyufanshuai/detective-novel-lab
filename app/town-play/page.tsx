import type { Metadata } from "next";
import TownPlayClient from "./TownPlayClient";

export const metadata: Metadata = {
  title: "河湾手记 · 侦探小镇",
  description: "在原创 Blender 小镇中步行探索、记录地点与切换全镇俯瞰。"
};

export default function TownPlayPage() {
  return <TownPlayClient />;
}
