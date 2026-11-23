import { withPatientErrors } from "@/lib/patients/http";
import { listStatusHistory } from "@/lib/patients/service";

type Context = { params: Promise<{ id: string }> };

/** Newest transition first. A deleted chart is 404, same as GET /api/patients/:id. */
export async function GET(
  _request: Request,
  context: Context,
): Promise<Response> {
  return withPatientErrors(async () => {
    const { id } = await context.params;
    const data = await listStatusHistory(id);
    return Response.json({ data });
  });
}
