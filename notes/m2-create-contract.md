# M2 - the create-project contract, what I proved

## My own words (fill these in, no peeking at chat)

- The three required fields are:
- Customer matching, the three-row table (exists any-case / unknown no-flag / unknown + autoCreateCompany):
- Where a template project's dueDate comes from:
- What externalReferenceId is for, in one sentence:
- My docs-vs-truth sentence:

## Evidence appendix - exact calls and returns (2026-07-29, trial workspace)

**Call 1 - capital "Acme":**
```bash
curl -s -X POST "https://api.rocketlane.com/api/1.0/projects" \
  -H "api-key: $RL_API_KEY" -H "content-type: application/json" \
  -d '{"projectName":"My first API project","customer":{"companyName":"Acme"},"owner":{"emailId":"auskin@klenty.com"}}'
```
Result: 201. Response `customer`: `{ "companyId": 5000000080301, "companyName": "Acme" }` (temp/created.json)

**Call 2 - lowercase "acme", no autoCreateCompany (docs predict failure):**
```bash
curl -s -X POST "https://api.rocketlane.com/api/1.0/projects" \
  -H "api-key: $RL_API_KEY" -H "content-type: application/json" \
  -d '{"projectName":"Should fail 1","customer":{"companyName":"acme"},"owner":{"emailId":"auskin@klenty.com"}}'
```
Result: **201, not 400.** Response `customer`: `{ "companyId": 5000000080301, "companyName": "Acme" }` (temp/fail1.json) - same company record as Call 1, name normalized.

**Call 3 - the control, company existing in no casing:**
```bash
curl -s -X POST "https://api.rocketlane.com/api/1.0/projects" \
  -H "api-key: $RL_API_KEY" -H "content-type: application/json" \
  -d '{"projectName":"Unknown company test","customer":{"companyName":"Zebra Corp"},"owner":{"emailId":"auskin@klenty.com"}}'
```
Result: 400 - `{"errors":[{"errorCode":"BAD_REQUEST","errorMessage":"Bad Request: No customer company found for provided value","field":"customer"}]}` (temp/fail3.json). Rules out silent company creation.

**The docs claim** (create-project reference, Body Params, `customer` field description, developer.rocketlane.com/reference/create-project): "The customer's name is case-sensitive, and an exact match is required for further processing. It should be noted that once the customer information is entered, it cannot be modified during the project's lifespan."

**Conclusion:** matching is case-insensitive in practice; docs say case-sensitive. Immutability half of the claim untested yet (Module 3: try a PUT changing customer, expect refusal).

**Also proved this session:** owner missing -> 400 with `field: "projectOwner"` (note: request field is named `owner`) · DELETE /projects/{id} -> 204, verified by re-listing · createdBy attributes to the API key's identity, not the human.
