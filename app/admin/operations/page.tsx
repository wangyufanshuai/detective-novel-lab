import type { Metadata } from "next";
import OperationsConsole from "./operations-console";

export const metadata: Metadata = {
  title: "运维观察 · Detective Town",
  description: "受保护的运行时审计与健康指标观察入口。"
};

export default function OperationsPage() {
  return <OperationsConsole />;
}
