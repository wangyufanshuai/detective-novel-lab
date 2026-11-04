import type { Metadata } from "next";
import LivingTown from "./LivingTown";

export const metadata: Metadata = { title: "河湾的一个上午 · 居民日常", description: "走进旧书店、车站与旅馆，观察居民的工作、休息与离岗。" };
export default function LivingTownPage() { return <LivingTown />; }
