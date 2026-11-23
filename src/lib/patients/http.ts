import {
  PatientNotFoundError,
  PatientValidationError,
  PossibleDuplicateError,
  SsnDuplicateError,
} from "./errors";

/**
 * Turns the service's typed failures into the HTTP contract. Anything else
 * is rethrown so Next.js logs the real error instead of hiding a bug as a 500.
 */
export async function withPatientErrors(
  work: () => Promise<Response>,
): Promise<Response> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof PatientValidationError) {
      return Response.json({ errors: error.fieldErrors }, { status: 422 });
    }

    if (error instanceof SsnDuplicateError) {
      return Response.json(
        {
          error: "ssn_duplicate",
          existing_id: error.existingId,
          message: "A patient with this Social Security number already exists.",
        },
        { status: 409 },
      );
    }

    if (error instanceof PossibleDuplicateError) {
      return Response.json(
        {
          error: "possible_duplicate",
          possible_duplicates: error.possibleDuplicates,
          message:
            "A patient with the same name and date of birth already exists. Resubmit with confirm_duplicate=true to create the record anyway.",
        },
        { status: 409 },
      );
    }

    if (error instanceof PatientNotFoundError) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    throw error;
  }
}
