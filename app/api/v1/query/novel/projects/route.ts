import { errorResponse, ok } from "@/app/api/v1/_utils";
import { getNovelRuntimeRecord, listNovelRuntimeProjects } from "@/app/api/v1/_novel-store";

export async function GET() {
  try {
    if (listNovelRuntimeProjects().length === 0) getNovelRuntimeRecord();
    return ok({ projects: listNovelRuntimeProjects() });
  } catch (error) {
    return errorResponse(error);
  }
}
