export type WorldAssetKind = "model" | "texture" | "material" | "image" | "audio" | "room";
export type WorldAssetStatus = "planned" | "candidate-only" | "accepted" | "blocked" | "missing";

export type WorldAssetManifestEntry = {
  id: string;
  kind: WorldAssetKind;
  path: string;
  sha256: string;
  bytes: number;
  license: string;
  source?: string;
  attribution?: string;
  status: WorldAssetStatus;
  humanApproval: boolean;
  runtimeVerified: boolean;
  dimensionsMeters?: [number, number, number];
};

export type WorldAssetManifest = {
  schema: "world-asset-manifest.v1";
  packageId: string;
  version: string;
  generatedAt: string;
  policy: {
    licenseRequired: boolean;
    humanReviewRequired: boolean;
    runtimeVerificationRequired: boolean;
  };
  assets: WorldAssetManifestEntry[];
};

function hasAbsolutePath(value: string) {
  return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("/") || value.startsWith("\\\\");
}

function scanUnsafe(value: unknown, label = "$", errors: string[] = []) {
  if (typeof value === "string") {
    if (/\bsk-[A-Za-z0-9][A-Za-z0-9_-]{12,}\b/.test(value) || /authorization:\s*bearer/i.test(value)) errors.push(`${label} may contain a secret`);
    if (hasAbsolutePath(value)) errors.push(`${label} contains an absolute path`);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => scanUnsafe(item, `${label}[${index}]`, errors));
  } else if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (/api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token/i.test(key)) errors.push(`${label}.${key} may contain a secret`);
      scanUnsafe(nested, `${label}.${key}`, errors);
    }
  }
  return errors;
}

export function validateWorldAssetManifest(value: unknown, expectedPackageId?: string) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const candidate = value as Partial<WorldAssetManifest>;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    errors.push("asset-manifest.json must be an object");
    return { ok: false, errors, warnings, manifest: null };
  }
  if (candidate.schema !== "world-asset-manifest.v1") errors.push("asset-manifest schema must be world-asset-manifest.v1");
  if (typeof candidate.packageId !== "string" || !candidate.packageId) errors.push("asset-manifest packageId is required");
  if (expectedPackageId && candidate.packageId !== expectedPackageId) errors.push(`asset-manifest packageId must be ${expectedPackageId}`);
  if (typeof candidate.version !== "string" || !candidate.version) errors.push("asset-manifest version is required");
  if (typeof candidate.generatedAt !== "string" || !candidate.generatedAt) errors.push("asset-manifest generatedAt is required");
  const policy = candidate.policy as Partial<WorldAssetManifest["policy"]> | undefined;
  if (!policy || typeof policy !== "object") {
    errors.push("asset-manifest policy is required");
  } else {
    for (const key of ["licenseRequired", "humanReviewRequired", "runtimeVerificationRequired"] as const) {
      if (typeof policy[key] !== "boolean") errors.push(`asset-manifest policy.${key} must be boolean`);
    }
  }
  if (!Array.isArray(candidate.assets)) errors.push("asset-manifest assets must be an array");
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const asset of candidate.assets || []) {
    if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
      errors.push("asset-manifest entries must be objects");
      continue;
    }
    const entry = asset as Partial<WorldAssetManifestEntry>;
    if (typeof entry.id !== "string" || !entry.id) errors.push("asset-manifest asset.id is required");
    if (entry.id && ids.has(entry.id)) errors.push(`asset-manifest asset ${entry.id} is duplicated`);
    if (entry.id) ids.add(entry.id);
    if (typeof entry.kind !== "string" || !["model", "texture", "material", "image", "audio", "room"].includes(entry.kind)) errors.push(`asset-manifest asset ${entry.id || "(missing id)"} kind is invalid`);
    if (typeof entry.path !== "string" || !entry.path || hasAbsolutePath(entry.path) || entry.path.split(/[\\/]/).includes("..")) errors.push(`asset-manifest asset ${entry.id || "(missing id)"} path must be relative`);
    if (entry.path && paths.has(entry.path)) errors.push(`asset-manifest asset path ${entry.path} is duplicated`);
    if (entry.path) paths.add(entry.path);
    if (typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256)) errors.push(`asset-manifest asset ${entry.id || "(missing id)"} sha256 must be lowercase SHA-256`);
    if (!Number.isInteger(entry.bytes) || (entry.bytes as number) < 0) errors.push(`asset-manifest asset ${entry.id || "(missing id)"} bytes must be a non-negative integer`);
    if (typeof entry.license !== "string" || !entry.license) errors.push(`asset-manifest asset ${entry.id || "(missing id)"} license is required`);
    if (typeof entry.status !== "string" || !["planned", "candidate-only", "accepted", "blocked", "missing"].includes(entry.status)) errors.push(`asset-manifest asset ${entry.id || "(missing id)"} status is invalid`);
    if (typeof entry.humanApproval !== "boolean") errors.push(`asset-manifest asset ${entry.id || "(missing id)"} humanApproval must be boolean`);
    if (typeof entry.runtimeVerified !== "boolean") errors.push(`asset-manifest asset ${entry.id || "(missing id)"} runtimeVerified must be boolean`);
    if (entry.status === "accepted" && (entry.humanApproval !== true || entry.runtimeVerified !== true)) errors.push(`asset-manifest asset ${entry.id || "(missing id)"} cannot be accepted before human and runtime gates pass`);
    if (entry.dimensionsMeters !== undefined && (!Array.isArray(entry.dimensionsMeters) || entry.dimensionsMeters.length !== 3 || entry.dimensionsMeters.some((dimension) => typeof dimension !== "number" || !Number.isFinite(dimension) || dimension <= 0))) errors.push(`asset-manifest asset ${entry.id || "(missing id)"} dimensionsMeters must contain three positive numbers`);
  }
  errors.push(...scanUnsafe(candidate));
  const uniqueErrors = Array.from(new Set(errors));
  return { ok: uniqueErrors.length === 0, errors: uniqueErrors, warnings: Array.from(new Set(warnings)), manifest: uniqueErrors.length === 0 ? candidate as WorldAssetManifest : null };
}
