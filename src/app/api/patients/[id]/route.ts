import { withPatientErrors } from "@/lib/patients/http";
import { parseUpdatePatient, readJsonBody } from "@/lib/patients/schema";
import {
  deletePatient,
  getPatient,
  updatePatient,
} from "@/lib/patients/service";

type Context = { params: Promise<{ id: string }> };

export async function GET(
  _request: Request,
  context: Context,
): Promise<Response> {
  return withPatientErrors(async () => {
    const { id } = await context.params;
    return Response.json(await getPatient(id));
  });
}

export async function PATCH(
  request: Request,
  context: Context,
): Promise<Response> {
  return withPatientErrors(async () => {
    const { id } = await context.params;
    const input = parseUpdatePatient(await readJsonBody(request));
    return Response.json(await updatePatient(id, input));
  });
}

export async function DELETE(
  _request: Request,
  context: Context,
): Promise<Response> {
  return withPatientErrors(async () => {
    const { id } = await context.params;
    await deletePatient(id);
    return new Response(null, { status: 204 });
  });
}
