"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./operations.module.css";

type ConnectionState = "disconnected" | "loading" | "connected" | "error";
type AuditOutcome = "authorized" | "missing" | "invalid" | string;

type AuditEvent = {
  id: string;
  route: string;
  method: string;
  outcome: AuditOutcome;
  status: number;
  requestId: string;
  credentialSource: string;
  createdAt: string;
};

type AuditPayload = {
  events: AuditEvent[];
  limit: number;
  generatedAt: string;
};

type OperationalMetrics = {
  windowMinutes: number;
  since: string;
  generatedAt: string;
  adminAudit: {
    total: number;
    byOutcome: Record<string, number>;
    byStatus: Record<string, number>;
    unauthorized: number;
    serverErrorCount: number;
  };
  idempotency: { pending: number; committed: number };
  storage: {
    schemaVersion?: number;
    health?: string;
    quickCheck?: string;
    walEnabled?: boolean;
    counts?: Record<string, number>;
    error?: string;
  };
};

type MetricsPayload = { metrics: OperationalMetrics; generatedAt: string };
type ApiFailure = { error?: { message?: string; code?: string } };

const auditUrl = "/api/v1/query/admin/audit?limit=50";
const metricsUrl = "/api/v1/query/admin/metrics?windowMinutes=60";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorMessage(value: unknown, status?: number) {
  if (isRecord(value)) {
    const error = value.error;
    if (isRecord(error) && typeof error.message === "string") return error.message;
  }
  return status ? `请求失败（HTTP ${status}）` : "无法读取运维数据，请重试。";
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "medium" }).format(parsed);
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function readJson(response: Response) {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errorMessage(payload as ApiFailure, response.status));
  // Runtime query endpoints keep the shared `{ ok, data }` envelope. The
  // console consumes the typed data projections while preserving the envelope
  // for error handling above.
  if (isRecord(payload) && "data" in payload) return payload.data;
  return payload;
}

function isAuditPayload(value: unknown): value is AuditPayload {
  return isRecord(value) && Array.isArray(value.events) && typeof value.generatedAt === "string";
}

function isMetricsPayload(value: unknown): value is MetricsPayload {
  return isRecord(value) && isRecord(value.metrics) && typeof value.generatedAt === "string";
}

export default function OperationsConsole() {
  const [token, setToken] = useState("");
  const [connection, setConnection] = useState<ConnectionState>("disconnected");
  const [audit, setAudit] = useState<AuditPayload | null>(null);
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connectButtonRef = useRef<HTMLButtonElement>(null);
  const generationRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const abortInFlight = useCallback(() => {
    generationRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const disconnect = useCallback(() => {
    abortInFlight();
    setConnection("disconnected");
    setAudit(null);
    setMetrics(null);
    setError(null);
    setToken("");
    window.requestAnimationFrame(() => connectButtonRef.current?.focus());
  }, [abortInFlight]);

  const refresh = useCallback(async () => {
    abortInFlight();
    const generation = generationRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    const presentedToken = token.trim();
    const headers: HeadersInit = { Accept: "application/json" };
    if (presentedToken) headers["x-runtime-admin-token"] = presentedToken;
    setConnection("loading");
    setError(null);

    try {
      const [auditPayload, metricsPayload] = await Promise.all([
        fetch(auditUrl, { headers, cache: "no-store", signal: controller.signal }).then(readJson),
        fetch(metricsUrl, { headers, cache: "no-store", signal: controller.signal }).then(readJson)
      ]);
      if (generation !== generationRef.current || controller.signal.aborted) return;
      if (!isAuditPayload(auditPayload) || !isMetricsPayload(metricsPayload)) {
        throw new Error("运维接口返回了无法识别的数据。");
      }
      setAudit(auditPayload);
      setMetrics(metricsPayload);
      setConnection("connected");
    } catch (caught) {
      if (controller.signal.aborted || generation !== generationRef.current) return;
      setConnection("error");
      setAudit(null);
      setMetrics(null);
      setError(caught instanceof Error ? caught.message : "无法读取运维数据，请重试。");
      // Credentials are intentionally ephemeral. A failed request must not
      // leave a stale operator secret ready for a later retry.
      setToken("");
    } finally {
      if (generation === generationRef.current) controllerRef.current = null;
    }
  }, [abortInFlight, token]);

  useEffect(() => () => abortInFlight(), [abortInFlight]);

  const metricsValue = metrics?.metrics;
  const outcome = metricsValue?.adminAudit.byOutcome ?? {};
  const storageCounts = metricsValue?.storage.counts ?? {};
  const connected = connection === "connected";

  return (
    <main className={styles.page} data-testid="admin-operations-page">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>DETECTIVE TOWN / ADMIN</p>
          <h1>运维观察</h1>
          <p className={styles.lede}>只读查看鉴权审计、幂等队列和存储健康。案件真相与玩家会话不会出现在此页。</p>
        </div>
        <Link className={styles.backLink} href="/">返回小镇</Link>
      </header>

      <section className={styles.connectCard} aria-labelledby="admin-connect-title">
        <div className={styles.cardHeading}>
          <div><p className={styles.eyebrow}>CONTROLLED ACCESS</p><h2 id="admin-connect-title">连接受保护的观察面</h2></div>
          <span className={`${styles.status} ${styles[`status-${connection}`]}`} role="status"><i aria-hidden="true" />{connection === "connected" ? "已连接" : connection === "loading" ? "读取中" : connection === "error" ? "连接失败" : "未连接"}</span>
        </div>
        <p className={styles.helper}>可输入临时 admin token；若由可信代理注入鉴权，保持空白即可连接。token 只保留在本组件内存，断开或失败后会清除。</p>
        <div className={styles.connectRow}>
          <label className={styles.tokenField} htmlFor="admin-token"><span>Admin token（可选）</span><input id="admin-token" type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder="可信代理模式可留空" disabled={connection === "loading"} /></label>
          <div className={styles.actions}>
            <button ref={connectButtonRef} className={styles.primaryButton} type="button" onClick={() => void refresh()} disabled={connection === "loading"}>{connection === "loading" ? "读取中…" : connected ? "刷新观察" : "连接观察"}</button>
            <button className={styles.secondaryButton} type="button" onClick={disconnect} disabled={connection === "disconnected" && !token}>断开</button>
          </div>
        </div>
        {error && <div className={styles.error} data-testid="admin-operations-error" role="alert"><strong>无法读取观察数据</strong><span>{error}</span><button className={styles.retryButton} type="button" onClick={() => void refresh()}>重试</button></div>}
      </section>

      {connection === "disconnected" && <section className={styles.emptyState} aria-live="polite"><span className={styles.emptyMark}>◌</span><h2>观察面尚未连接</h2><p>连接后才会读取审计与运行指标。此页不会自动轮询。</p></section>}
      {connection === "loading" && <section className={styles.loadingState} aria-live="polite"><span className={styles.loader} aria-hidden="true" /><p>正在并行读取审计与指标…</p></section>}

      {connection === "connected" && metricsValue && audit && <div className={styles.dashboard}>
        <section className={styles.metricGrid} aria-label="运行指标">
          <article className={styles.metricCard}><span>鉴权尝试 / {metricsValue.windowMinutes} 分钟</span><strong>{numberValue(metricsValue.adminAudit.total)}</strong><small>通过 {numberValue(outcome.authorized)} · 缺失 {numberValue(outcome.missing)} · 无效 {numberValue(outcome.invalid)}</small></article>
          <article className={styles.metricCard}><span>未授权信号</span><strong className={metricsValue.adminAudit.unauthorized ? styles.metricWarning : styles.metricGood}>{numberValue(metricsValue.adminAudit.unauthorized)}</strong><small>窗口内 401 / 403 记录</small></article>
          <article className={styles.metricCard}><span>幂等收据</span><strong>{numberValue(metricsValue.idempotency.pending) + numberValue(metricsValue.idempotency.committed)}</strong><small>待处理 {numberValue(metricsValue.idempotency.pending)} · 已提交 {numberValue(metricsValue.idempotency.committed)}</small></article>
          <article className={styles.metricCard}><span>存储健康</span><strong className={metricsValue.storage.health === "ok" ? styles.metricGood : styles.metricWarning}>{metricsValue.storage.health || "未知"}</strong><small>schema v{metricsValue.storage.schemaVersion ?? "—"} · WAL {metricsValue.storage.walEnabled ? "开启" : "关闭"}</small></article>
        </section>

        <section className={styles.detailGrid}>
          <article className={styles.panel} aria-labelledby="health-title"><div className={styles.panelHeading}><div><p className={styles.eyebrow}>HEALTH SNAPSHOT</p><h2 id="health-title">运行摘要</h2></div><span>{formatDate(metricsPayloadGenerated(metrics))}</span></div><dl className={styles.healthList}><div><dt>数据库检查</dt><dd>{metricsValue.storage.quickCheck || "未提供"}</dd></div><div><dt>世界 / 事件 / 案件</dt><dd>{numberValue(storageCounts.worlds)} / {numberValue(storageCounts.events)} / {numberValue(storageCounts.cases)}</dd></div><div><dt>服务端错误</dt><dd className={metricsValue.adminAudit.serverErrorCount ? styles.metricWarning : ""}>{numberValue(metricsValue.adminAudit.serverErrorCount)}</dd></div></dl></article>
          <article className={styles.panel} aria-labelledby="audit-title"><div className={styles.panelHeading}><div><p className={styles.eyebrow}>RECENT ACCESS</p><h2 id="audit-title">最近审计记录</h2></div><span>{audit.events.length} 条</span></div><div className={styles.tableWrap}><table className={styles.auditTable}><caption className={styles.srOnly}>最近 admin 鉴权尝试</caption><thead><tr><th scope="col">时间</th><th scope="col">结果</th><th scope="col">入口</th><th scope="col">请求</th></tr></thead><tbody>{audit.events.map((event) => <tr key={event.id}><td data-label="时间">{formatDate(event.createdAt)}</td><td data-label="结果"><span className={`${styles.outcome} ${event.outcome === "authorized" ? styles.outcomeGood : styles.outcomeBad}`}>{event.outcome === "authorized" ? "通过" : event.outcome === "missing" ? "缺失" : event.outcome === "invalid" ? "无效" : event.outcome}</span><small>{event.status} · {event.credentialSource}</small></td><td data-label="入口"><code>{event.method} {event.route}</code></td><td data-label="请求"><code>{event.requestId}</code></td></tr>)}</tbody></table>{audit.events.length === 0 && <p className={styles.tableEmpty}>窗口内还没有审计记录。</p>}</div></article>
        </section>
      </div>}
    </main>
  );
}

function metricsPayloadGenerated(payload: MetricsPayload | null) {
  return payload?.generatedAt || new Date(0).toISOString();
}
