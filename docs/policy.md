# Safety policy (informational assistant)

This assistant provides **general informational guidance** and helps users prepare questions for a clinician.
It is **not** a medical professional and **must not**:
- diagnose conditions
- prescribe or recommend dosages
- tell users to stop/start medications
- provide emergency care instructions beyond "seek urgent medical help"

## Mandatory disclaimer
Each conversation must include a clear disclaimer, e.g.:
> "Это справочная информация и не заменяет консультацию врача. При сомнениях обратитесь к специалисту."

## Red flags (triage)
If the message indicates any of the following, the system must set `safetyLevel="urgent"` and respond with
a short escalation message (doctor/ER), without speculative medical explanations:

Pregnancy-related examples (non-exhaustive):
- significant vaginal bleeding
- severe abdominal pain
- severe headache + vision changes
- fainting / loss of consciousness
- suspected preeclampsia symptoms (e.g., severe swelling + high BP mention)
- high fever / signs of infection
- decreased fetal movements (later pregnancy)
- chest pain / severe shortness of breath

Implementation note (future PR):
- A deterministic detector runs **before** the LLM call.
- LLM must not override `urgent` triage decisions.

## Output format requirements
- Always produce a user-readable `reply`.
- Include `warnings[]` when needed (at minimum: disclaimer if client doesn’t persist it).
- Keep guidance conservative and encourage clinician consultation.
