import { withPatientErrors } from "@/lib/patients/http";
import {
  confirmDuplicate,
  parseCreatePatient,
  parseListQuery,
  readJsonBody,
} from "@/lib/patients/schema";
import { createPatient, listLivePatients } from "@/lib/patients/service";

export async function GET(request: Request): Promise<Response> {
  return withPatientErrors(async () => {
    const query = parseListQuery(new URL(request.url));
    const body = await listLivePatients(query);
    return Response.json(body);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withPatientErrors(async () => {
    const url = new URL(request.url);
    const input = parseCreatePatient(await readJsonBody(request));
    const patient = await createPatient(input, {
      confirmDuplicate: confirmDuplicate(url),
    });
    return Response.json(patient, { status: 201 });
  });
}
