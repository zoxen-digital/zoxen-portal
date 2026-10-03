export interface ClientT {
  _id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  source?: string;
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QueryT {
  _id: string;
  client: ClientT | string | null;
  title: string;
  service?: string;
  description?: string;
  status: string;
  priority?: string;
  assignedTo?: string;
  amount?: number;
  dueDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  description: string;
  details?: string;
  qty: number;
  unit?: string;
  rate: number;
}

export interface ExtraCost {
  label: string;
  amount: number;
}

export interface Payment {
  amount: number;
  date: string;
  method?: string;
  note?: string;
}

export interface PaymentDetails {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  iban?: string;
  other?: string;
}

export interface Totals {
  itemsTotal: number;
  extrasTotal: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
}

export interface InvoiceT {
  _id: string;
  invoiceNumber: string;
  publicId: string;
  client: ClientT | string | null;
  query?: string | null;
  clientSnapshot: { name: string; company?: string; email?: string; phone?: string; address?: string };
  requirement?: { summary?: string; websites?: number; pages?: number; tags?: string[] };
  items: InvoiceItem[];
  extraCosts: ExtraCost[];
  discountType: "fixed" | "percent";
  discountValue: number;
  discountLabel?: string;
  taxPercent: number;
  currency: string;
  issueDate: string;
  dueDate?: string;
  status: string;
  payments: Payment[];
  notes?: string;
  terms?: string;
  paymentDetails?: PaymentDetails;
  totals: Totals;
  viewCount?: number;
  lastViewedAt?: string;
  confirmedAt?: string;
  lastReminderAt?: string;
  reminderCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingT {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  website?: string;
  services?: string[];
  budget?: string;
  message?: string;
  data?: Record<string, unknown>;
  status: string;
  client?: string | null;
  createdAt: string;
}

export interface SettingsT {
  companyName: string;
  tagline?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  invoicePrefix: string;
  defaultCurrency: string;
  defaultTaxPercent: number;
  defaultDueDays: number;
  defaultNotes?: string;
  defaultTerms?: string;
  paymentDetails: PaymentDetails;
  teamMembers: string[];
  meetingLink?: string;
  contractTemplate?: string;
}

export type RoleT = "super_admin" | "team_admin" | "client";

export interface UserT {
  _id: string;
  name: string;
  email: string;
  role: RoleT;
  client?: ClientT | string | null;
  title?: string;
  phone?: string;
  status: "invited" | "active" | "disabled";
  lastLoginAt?: string;
  createdAt: string;
}

export interface ChecklistItem {
  _id: string;
  label: string;
  done: boolean;
  doneAt?: string;
}

export interface ProjectIssue {
  _id: string;
  title: string;
  details?: string;
  status: string;
  owner?: string;
  dueDate?: string;
  visibleToClient: boolean;
  resolvedAt?: string;
  createdAt: string;
}

export interface ProjectRevision {
  _id: string;
  round: number;
  request: string;
  links?: string;
  status: string;
  requestedBy?: string;
  extra?: boolean;
  completedAt?: string;
  createdAt: string;
}

export interface ProjectDocument {
  _id: string;
  name: string;
  url: string;
  visibleToClient: boolean;
  addedBy?: string;
  createdAt: string;
}

export interface ProjectT {
  _id: string;
  client: ClientT | string | null;
  title: string;
  service?: string;
  description?: string;
  stage: string;
  progress: number;
  team: (Pick<UserT, "_id" | "name" | "email"> | string)[];
  startDate?: string;
  dueDate?: string;
  previewUrl?: string;
  liveUrl?: string;
  domain?: string;
  clientUpdate?: string;
  internalNotes?: string;
  revisionLimit: number;
  checklist: ChecklistItem[];
  issues: ProjectIssue[];
  revisions: ProjectRevision[];
  documents: ProjectDocument[];
  approvedAt?: string;
  approvedBy?: string;
  feedback?: { rating?: number; comment?: string; at?: string };
  stageChangedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** The slice of a project a client is allowed to see. Stage is already the client-facing label. */
export interface PortalProjectT {
  _id: string;
  title: string;
  service?: string;
  description?: string;
  stage: string;
  inReview: boolean;
  progress: number;
  startDate?: string;
  dueDate?: string;
  previewUrl?: string;
  liveUrl?: string;
  domain?: string;
  clientUpdate?: string;
  revisionLimit: number;
  checklist: { label: string; done: boolean }[];
  actionsNeeded: { _id: string; title: string; details?: string; dueDate?: string }[];
  revisions: ProjectRevision[];
  documents: ProjectDocument[];
  approvedAt?: string;
  feedback?: { rating?: number; comment?: string; at?: string };
  team: string[];
  updatedAt: string;
}

export interface ActivityT {
  _id: string;
  project?: string;
  client?: string;
  actor?: string;
  actorRole?: string;
  text: string;
  visibleToClient: boolean;
  createdAt: string;
}

export interface MeetingT {
  _id: string;
  client: string;
  project?: string | null;
  title: string;
  date: string;
  link?: string;
  notes?: string;
  createdBy?: string;
  status?: "Scheduled" | "Requested" | "Declined";
  minutes?: number;
  googleEventId?: string;
}

export interface NotificationT {
  _id: string;
  title: string;
  body?: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface AttachmentT {
  name: string;
  url: string;
  size?: number;
  contentType?: string;
}

export interface MessageT {
  _id: string;
  project?: string;
  ticket?: string;
  authorName?: string;
  authorRole?: RoleT;
  body: string;
  attachments: AttachmentT[];
  createdAt: string;
}

export interface TicketT {
  _id: string;
  number: string;
  client: ClientT | string | null;
  project?: Pick<ProjectT, "_id" | "title"> | string | null;
  title: string;
  description?: string;
  type: string;
  priority: string;
  status: string;
  assignee?: Pick<UserT, "_id" | "name"> | string | null;
  dueDate?: string;
  createdByName?: string;
  createdByRole?: string;
  attachments: AttachmentT[];
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PackageT {
  _id: string;
  name: string;
  service?: string;
  description?: string;
  items: InvoiceItem[];
  currency: string;
  checklist: string[];
  revisionLimit: number;
  durationDays: number;
  active: boolean;
}

export interface QuoteT {
  _id: string;
  number: string;
  publicId: string;
  client: ClientT | string | null;
  title: string;
  intro?: string;
  items: InvoiceItem[];
  extraCosts: ExtraCost[];
  discountType: "fixed" | "percent";
  discountValue: number;
  taxPercent: number;
  currency: string;
  validUntil?: string;
  notes?: string;
  terms?: string;
  status: string;
  totals: Omit<Totals, "paid" | "balance">;
  package?: string | null;
  projectSetup?: { service?: string; checklist?: string[]; revisionLimit?: number; durationDays?: number };
  sentAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
  acceptedName?: string;
  acceptedIp?: string;
  declinedAt?: string;
  declineReason?: string;
  invoice?: string | null;
  project?: string | null;
  createdAt: string;
}

export interface ContractT {
  _id: string;
  number: string;
  publicId: string;
  client: ClientT | string | null;
  project?: string | null;
  quote?: string | null;
  title: string;
  body: string;
  status: string;
  sentAt?: string;
  viewedAt?: string;
  signedName?: string;
  signedAt?: string;
  signedIp?: string;
  signedUA?: string;
  createdBy?: string;
  createdAt: string;
}

export interface RecurringPlanT {
  _id: string;
  client: ClientT | string | null;
  title: string;
  items: InvoiceItem[];
  discountType: "fixed" | "percent";
  discountValue: number;
  taxPercent: number;
  currency: string;
  interval: "monthly" | "quarterly" | "yearly";
  nextRunAt: string;
  dueDays: number;
  notes?: string;
  terms?: string;
  active: boolean;
  lastRunAt?: string;
  lastInvoice?: string | null;
  invoicesCreated: number;
}
