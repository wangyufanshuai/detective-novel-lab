import type { Metadata } from "next";
import ClassicArtSample from "../art-sample/ClassicArtSample";

export const metadata: Metadata = { title: "铁路街角 · 人物与动线样板" };

export default function MotionSamplePage() {
  return <ClassicArtSample motionPreview />;
}
