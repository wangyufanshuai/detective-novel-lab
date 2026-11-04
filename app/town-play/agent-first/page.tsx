import type { Metadata } from "next";
import AgentFirstTown from "./AgentFirstTown";
export const metadata: Metadata = { title: "河湾手记 · Agent 小镇", description: "跟随居民的日常，在街巷、记忆与线索之间观察一座小镇。" };
export default function Page() { return <AgentFirstTown />; }
