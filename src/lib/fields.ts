export const CLIENT_FIELDS = ["name", "company", "email", "phone", "website", "address", "source", "status", "notes"];

export const QUERY_FIELDS = [
  "client",
  "title",
  "service",
  "description",
  "status",
  "priority",
  "assignedTo",
  "amount",
  "dueDate",
  "notes",
];

export function cleanQuery(data: Record<string, unknown>) {
  if ("amount" in data) data.amount = Number(data.amount) || 0;
  if ("dueDate" in data) data.dueDate = data.dueDate ? new Date(String(data.dueDate)) : null;
  return data;
}
