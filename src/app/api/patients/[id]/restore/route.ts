import { withPatientErrors } from "@/lib/patients/http";
import { restorePatient } from "@/lib/patients/service";

type Context = { params: Promise<{ id: string }> };

export async function POST(
  _request: Request,
  context: Context,
): Promise<Response> {
  return withPatientErrors(async () => {
    const { id } = await context.params;
    return Response.json(await restorePatient(id));
  });
}
