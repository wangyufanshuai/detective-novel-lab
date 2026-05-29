const response = await fetch("http://localhost:3000/api/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    provider: "deepseek",
    stage: "gameCaseFile",
    brief: "mock test",
    currentDraft: {}
  })
});

const data = await response.json();
if (!response.ok || !data.ok || !data.content) {
  throw new Error(`API mock smoke test failed: ${JSON.stringify(data)}`);
}

console.log("API mock smoke test passed.");
