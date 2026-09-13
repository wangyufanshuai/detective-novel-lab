import FirstCaseStudyConsole from "./study-console";

export const dynamic = "force-dynamic";

export default function FirstCaseStudyPage() {
  const buildId = process.env.FIRST_CASE_STUDY_BUILD_ID || "";
  if (!buildId) return <main style={{ maxWidth: 760, margin: "64px auto", padding: 24 }}>
    <h1>首案测试主持台</h1>
    <p>请先在项目目录运行 <code>npm run study:first-case</code>，再打开启动信息中的主持台地址。</p>
    <p>该入口使用单独的测试数据库和已冻结版本。普通游戏服务不会开始研究记录。</p>
  </main>;
  return <FirstCaseStudyConsole buildId={buildId} />;
}
