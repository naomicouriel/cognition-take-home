import { db } from "@/platform/data";
import { asActor, requirePermission } from "@/platform/server";
import { Can } from "@/platform/ui/Can";
import { DataTable } from "@/platform/ui/DataTable";
import { DetailPanel } from "@/platform/ui/DetailPanel";
import { SchemaForm } from "@/platform/ui/SchemaForm";
import { fieldsFromSchema } from "@/platform/ui/fields";
import { approveAccessRequest, createAccessRequest } from "./actions";
import { manifest } from "./manifest";
import { accessRequestSchema } from "./schema";

export async function DirectoryView() {
  const actor = await requirePermission(manifest.nav.permission);

  const { people, requests } = await asActor(actor, async () => ({
    people: await db.user.findMany({ orderBy: { name: "asc" } }),
    requests: await db.accessRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="mb-1 text-xl font-semibold">{manifest.name}</h1>
        <p className="mb-4 text-sm text-slate-500">
          PII columns are removed server side for roles without the permission.
        </p>
        <DataTable
          rows={people.map((person) => ({
            id: person.id,
            name: person.name,
            email: person.email,
            role: person.role,
            phone: "phone" in person ? (person.phone ?? "—") : "restricted",
            nationalId:
              "nationalId" in person ? (person.nationalId ?? "—") : "restricted",
          }))}
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role" },
            { key: "phone", label: "Phone (PII)" },
            { key: "nationalId", label: "National ID (PII)" },
          ]}
        />
      </div>

      <Can actor={actor} permission="access_request.read">
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Access requests</h2>
          {requests.map((request) => (
            <DetailPanel
              key={request.id}
              title={`${request.requestedRole} — ${request.status}`}
              subtitle={request.reason}
              actor={actor}
              fields={[
                { label: "Requested role", value: request.requestedRole },
                { label: "Status", value: request.status },
                {
                  label: "Created",
                  value: request.createdAt.toISOString().slice(0, 16),
                },
              ]}
              approval={{
                permission: "access_request.approve",
                label: "Approve",
                action: approveAccessRequest,
                hiddenFields: { id: request.id },
                disabled: request.status === "approved",
              }}
            />
          ))}
          <div>
            <h3 className="mb-2 text-sm font-semibold">New access request</h3>
            <SchemaForm
              fields={fieldsFromSchema(accessRequestSchema)}
              action={createAccessRequest}
              submitLabel="Request access"
            />
          </div>
        </div>
      </Can>
    </div>
  );
}
