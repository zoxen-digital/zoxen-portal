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
}
