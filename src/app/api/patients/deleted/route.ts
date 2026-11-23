import { withPatientErrors } from "@/lib/patients/http";
import { parseListQuery } from "@/lib/patients/schema";
import { listDeletedPatients } from "@/lib/patients/service";

/** Same query contract as the live list, so a long deleted archive can be paged. */
export async function GET(request: Request): Promise<Response> {
  return withPatientErrors(async () => {
    const query = parseListQuery(new URL(request.url));
    const body = await listDeletedPatients(query);
    return Response.json(body);
  });
}
