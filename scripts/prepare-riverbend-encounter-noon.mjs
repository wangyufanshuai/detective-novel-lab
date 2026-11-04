import fs from "node:fs";
const runner=fs.readFileSync("output/playwright/riverbend-encounter-case.js","utf8").replaceAll("\r\n","\n"),marker="  try {\n    const reviewContext";
if(!runner.includes(marker))throw new Error("Case runner boundary is missing");
const prefix=runner.split(marker)[0].replaceAll("riverbend-encounter-case-","riverbend-encounter-noon-");
fs.writeFileSync("output/playwright/riverbend-encounter-noon.js",prefix+fs.readFileSync("output/playwright/riverbend-encounter-noon-body.js","utf8"));
console.log("Prepared current noon camera review using the preserved local save.");
