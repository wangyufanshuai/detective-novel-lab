import type { Metadata } from "next";
import SnowboundManor from "./SnowboundManor";

export const metadata: Metadata = {
  title: "雪松山庄 · 暴风雪之夜",
  description: "走近风雪中的石砌山庄，进入壁炉大厅，查看古典侦探世界的三维场景。",
};

export default function SnowboundManorPage() { return <SnowboundManor />; }
