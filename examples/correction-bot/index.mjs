const baseUrl = process.env.DETECTIVE_TOWN_BASE_URL || "http://127.0.0.1:3000";

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) }
  });
  const json = await response.json();
  if (!response.ok || json.ok === false) throw new Error(JSON.stringify(json));
  return json.data;
}

const imported = await api("/api/v1/command/novel/import", {
  method: "POST",
  body: JSON.stringify({
    title: "Correction Bot Example",
    chapters: [{
      title: "Chapter 1",
      text: "Lin saw a brass key in the archive. Mei denied entering the archive, but a witness placed her there after dusk."
    }]
  })
});

const projectId = imported.project.id;
const audit = await api(`/api/v1/query/novel/audit?projectId=${encodeURIComponent(projectId)}`);
console.log("Trust score:", audit.audit.trustScore, "issues:", audit.audit.issues.length);

const suggested = await api("/api/v1/command/novel/correction/suggest", {
  method: "POST",
  body: JSON.stringify({ projectId })
});
console.log("Suggested patches:", suggested.patches.length);
