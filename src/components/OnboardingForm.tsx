"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle2,
  FileText,
  Headphones,
  LayoutGrid,
  Loader2,
  Lock,
  Mail,
  Palette,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  Gift,
  Quote,
  Star,
  User,
  X,
  Zap,
} from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";
import {
  OB_ADD_ONS,
  OB_BUSINESS_SIZES,
  OB_INDUSTRIES,
  OB_LOGO_STATUS,
  OB_MAIN_GOALS,
  OB_PACKAGES,
  OB_PAGE_OPTIONS,
  OB_STEP_LABELS,
  OB_STEP_TITLES,
  type ObTextField,
} from "@/lib/onboarding-form";

type Form = Record<ObTextField, string>;

const FEATURES = [
  { icon: Sparkles, title: "Custom Solutions", desc: "Tailored to your unique business needs" },
  { icon: Zap, title: "Fast & Reliable", desc: "On-time delivery with top quality" },
  { icon: Headphones, title: "Dedicated Support", desc: "We're here for you, always" },
  { icon: Rocket, title: "Results Driven", desc: "Focused on growth and success" },
];

const STEP_ICONS = [User, Target, LayoutGrid, Palette, FileText, ShieldCheck];

export function OnboardingForm({
  ticket,
  token,
  prefill,
  companyName,
  contactEmail,
  referral,
  reviews = [],
}: {
  /** Signed upload ticket from the server (lets visitors upload without logging in). */
  ticket: string;
  /** Client link token: tags the submission to that client. */
  token?: string;
  prefill?: Partial<Form>;
  companyName: string;
  contactEmail?: string;
  /** Opened from a client referral link. */
  referral?: { code: string; by: string };
  /** Approved client reviews, shown to build trust. */
  reviews?: { name: string; company?: string; rating: number; text: string }[];
}) {
  const [step, setStep] = useState(1);
  const [selectedPackage, setSelectedPackage] = useState("Premium");
  const [addOns, setAddOns] = useState<string[]>([]);
  const [pagesNeeded, setPagesNeeded] = useState<string[]>(["Home", "About", "Services", "Contact"]);
  const [form, setForm] = useState<Form>({
    contactPerson: "", email: "", phone: "",
    businessName: "", currentWebsite: "", industry: OB_INDUSTRIES[0]!, businessSize: OB_BUSINESS_SIZES[0]!, socialMedia: "",
    mainGoal: OB_MAIN_GOALS[0]!, targetAudience: "",
    logoStatus: OB_LOGO_STATUS[0]!, designStyle: "", brandColors: "", inspirationWebsites: "",
    homepageHeadline: "", businessDescription: "", servicesList: "", contactDetails: "",
    pricingDisplay: "", productPricingInfo: "", specialOffers: "", notes: "",
    ...prefill,
  });
  const [logo, setLogo] = useState<{ url: string; name: string } | null>(null);
  const [files, setFiles] = useState<{ url: string; name: string }[]>([]);
  const [uploading, setUploading] = useState<"" | "logo" | "files">("");
  const [uploadPct, setUploadPct] = useState(0);
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // ---------- Draft: keep progress so the client can close the page and continue later ----------
  const draftKey = `zx-onboarding-draft:${token || "general"}`;
  const [draftReady, setDraftReady] = useState(false);
  const [restored, setRestored] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const serverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  type Draft = {
    step: number;
    selectedPackage: string;
    addOns: string[];
    pagesNeeded: string[];
    form: Partial<Form>;
    logo: { url: string; name: string } | null;
    files: { url: string; name: string }[];
  };

  function applyDraft(d: Partial<Draft>) {
    if (typeof d.step === "number") setStep(Math.min(6, Math.max(1, d.step)));
    if (typeof d.selectedPackage === "string") setSelectedPackage(d.selectedPackage);
    if (Array.isArray(d.addOns)) setAddOns(d.addOns.map(String));
    if (Array.isArray(d.pagesNeeded)) setPagesNeeded(d.pagesNeeded.map(String));
    if (d.form && typeof d.form === "object") setForm((f) => ({ ...f, ...d.form }));
    if (d.logo && typeof d.logo.url === "string") setLogo(d.logo);
    if (Array.isArray(d.files)) setFiles(d.files.filter((x) => x && typeof x.url === "string"));
  }

  // Load: this device first, then the server copy (personal links) if it is newer.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let best: { data: Partial<Draft>; savedAt: number } | null = null;
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) best = JSON.parse(raw);
      } catch {}
      if (token) {
        try {
          const res = await fetch(`/api/public/onboarding/draft?token=${encodeURIComponent(token)}`, { cache: "no-store" });
          const j = await res.json();
          const t = j.draft?.savedAt ? new Date(j.draft.savedAt).getTime() : 0;
          if (j.draft?.data && t > (best?.savedAt || 0)) best = { data: j.draft.data, savedAt: t };
        } catch {}
      }
      if (cancelled) return;
      if (best?.data) {
        applyDraft(best.data);
        setRestored(true);
        setSavedAt(best.savedAt);
      }
      setDraftReady(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, token]);

  // Save: on this device right away, and to the server a moment after the client stops typing.
  useEffect(() => {
    if (!draftReady || submitted) return;
    const data: Draft = { step, selectedPackage, addOns, pagesNeeded, form, logo, files };
    if (localTimer.current) clearTimeout(localTimer.current);
    localTimer.current = setTimeout(() => {
      const now = Date.now();
      try {
        localStorage.setItem(draftKey, JSON.stringify({ data, savedAt: now }));
      } catch {}
      setSavedAt(now);
    }, 400);
    if (token) {
      if (serverTimer.current) clearTimeout(serverTimer.current);
      serverTimer.current = setTimeout(() => {
        fetch("/api/public/onboarding/draft", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, data }),
          keepalive: true,
        }).catch(() => {});
      }, 2500);
    }
  }, [draftReady, submitted, step, selectedPackage, addOns, pagesNeeded, form, logo, files, draftKey, token]);

  function clearDraft() {
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    if (serverTimer.current) clearTimeout(serverTimer.current);
    if (localTimer.current) clearTimeout(localTimer.current);
  }

  async function startOver() {
    clearDraft();
    if (token) await fetch(`/api/public/onboarding/draft?token=${encodeURIComponent(token)}`, { method: "DELETE" }).catch(() => {});
    window.location.reload();
  }

  const update = (key: ObTextField) => (v: string) => setForm((f) => ({ ...f, [key]: v }));
  const toggle = (list: string[], set: (v: string[]) => void, item: string) => set(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  async function uploadOne(file: File) {
    if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name} is larger than 15 MB`);
    const { upload } = await import("@vercel/blob/client");
    const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-100) || "file";
    const blob = await upload(`onboarding/${safe}`, file, {
      access: "public",
      handleUploadUrl: "/api/upload",
      clientPayload: JSON.stringify({ ticket }),
      contentType: file.type || undefined,
      multipart: file.size > 5 * 1024 * 1024,
      onUploadProgress: (p) => setUploadPct(Math.round(p.percentage)),
    });
    return { url: blob.url, name: file.name };
  }

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploading("logo");
    try {
      setLogo(await uploadOne(file));
    } catch (err) {
      setError((err as Error).message || "Upload failed. Please try again.");
    } finally {
      setUploading("");
    }
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    e.target.value = "";
    if (!list.length) return;
    setError("");
    setUploading("files");
    try {
      for (const f of list) {
        const up = await uploadOne(f);
        setFiles((prev) => [...prev, up]);
      }
    } catch (err) {
      setError((err as Error).message || "Upload failed. Please try again.");
    } finally {
      setUploading("");
    }
  }

  function validateStep() {
    if (step === 1 && (!form.contactPerson || !form.email || !form.businessName)) return "Please fill in your name, email and business name.";
    return "";
  }

  function goNext() {
    const err = validateStep();
    if (err) return setError(err);
    setError("");
    setStep((s) => Math.min(6, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setError("");
    setStep((s) => Math.max(1, s - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    setError("");
    if (!form.businessName || !form.email) return setError("Please fill in your business name and email before submitting.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          package: selectedPackage,
          addOns,
          pagesNeeded,
          logoUrl: logo?.url || null,
          attachmentUrls: files.map((f) => f.url),
          token,
          ref: referral?.code,
          company_site: honeypot,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      clearDraft();
      setSubmitted(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError((err as Error).message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-16">
        <div className="card w-full max-w-lg p-10 text-center shadow-xl shadow-brand/10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-gradient text-white shadow-lg shadow-brand/30">
            <Check className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-2xl font-extrabold text-heading">You&apos;re All Set!</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Thanks for sharing your project details. Our team will review everything and reach out within 24-48 hours to kick things off.
          </p>
        </div>
      </main>
    );
  }

  const pct = Math.round((step / 6) * 100);
  const StepIcon = STEP_ICONS[step - 1]!;

  return (
    <main className="min-h-screen bg-bg px-3 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl shadow-brand/10 lg:flex-row">
        {/* Brand panel */}
        <aside className="relative flex flex-col overflow-hidden bg-navy p-7 text-white sm:p-9 lg:w-[340px] lg:shrink-0">
          <svg className="pointer-events-none absolute -right-24 -top-10 h-72 w-96 opacity-60" viewBox="0 0 400 260" aria-hidden="true">
            <ellipse cx="200" cy="130" rx="190" ry="60" transform="rotate(-20 200 130)" fill="none" stroke="url(#obg)" strokeWidth="1.5" />
            <ellipse cx="200" cy="130" rx="140" ry="40" transform="rotate(-20 200 130)" fill="none" stroke="url(#obg)" strokeWidth="1" opacity="0.6" />
            <circle cx="350" cy="70" r="6" fill="#8b8ff5" />
            <defs>
              <linearGradient id="obg" x1="0" x2="1">
                <stop offset="0%" stopColor="#2639E8" />
                <stop offset="100%" stopColor="#6C3BF5" />
              </linearGradient>
            </defs>
          </svg>
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="paper rounded-xl bg-white px-3 py-2">
                <Logo />
              </div>
              <span className="lg:hidden">
                <ThemeToggle />
              </span>
            </div>
            <h1 className="mt-8 text-2xl font-extrabold leading-tight">
              Let&apos;s Build Something <span className="bg-gradient-to-r from-[#8f9bff] to-[#b79cff] bg-clip-text text-transparent">Amazing Together</span>
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              Please fill out the details below so we can understand your business and deliver the perfect solution.
            </p>
            {referral && (
              <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold">
                <Gift className="h-3.5 w-3.5 text-[#b79cff]" /> Referred by {referral.by}
              </p>
            )}

            <div className="mt-7">
              <div className="mb-2 flex justify-between text-[11px] font-bold tracking-wide">
                <span className="text-[#8f9bff]">ONBOARDING PROGRESS</span>
                <span className="text-white/50">Step {step} of 6</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-brand-gradient transition-[width] duration-300" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1 text-right text-[11px] text-white/40">{pct}%</div>
            </div>

            <ul className="mt-6 hidden space-y-4 lg:block">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#8f9bff]">
                    <f.icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{f.title}</span>
                    <span className="block text-xs text-white/50">{f.desc}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative mt-8 hidden rounded-2xl border border-white/10 bg-white/5 p-4 lg:mt-auto lg:block">
            <div className="text-sm font-bold">Need Help?</div>
            <div className="mb-3 text-xs text-white/50">Our team is here to assist you.</div>
            {contactEmail && (
              <a href={`mailto:${contactEmail}`} className="flex items-center gap-2 text-xs font-semibold text-[#8f9bff] hover:underline">
                <Mail className="h-3.5 w-3.5" /> {contactEmail}
              </a>
            )}
          </div>
        </aside>

        {/* Form */}
        <section className="min-w-0 flex-1 p-5 sm:p-9">
          <div className="mb-7 flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand dark:text-[#8f9bff]">
                <StepIcon className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-xl font-extrabold text-heading sm:text-2xl">Project Onboarding Form</h2>
                <p className="mt-0.5 text-sm">
                  <span className="font-bold text-brand dark:text-[#8f9bff]">Step {step} of 6</span>
                  <span className="text-muted"> — {OB_STEP_TITLES[step - 1]}</span>
                </p>
                {savedAt && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3" /> Progress saved automatically. You can close this page and continue later.
                  </p>
                )}
              </div>
            </div>
            <span className="hidden lg:block">
              <ThemeToggle />
            </span>
          </div>

          {/* Bots fill every field they find; people never see this one. */}
          <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} name="company_site" />

          {restored && (
            <div className="mb-6 flex flex-col gap-2 rounded-2xl border border-emerald-300/50 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200 sm:flex-row sm:items-center sm:justify-between">
              <span>
                <b>Welcome back!</b> We restored your saved answers, so you can continue from step {step}.
              </span>
              <span className="flex gap-2">
                <button type="button" onClick={() => setRestored(false)} className="btn btn-outline btn-sm">
                  Continue
                </button>
                <button type="button" onClick={startOver} className="btn btn-ghost btn-sm">
                  Start over
                </button>
              </span>
            </div>
          )}

          {step === 1 && (
            <>
              <Group icon={User} title="Your Information">
                <Row>
                  <TextField label="Full Name" required value={form.contactPerson} onChange={update("contactPerson")} placeholder="Enter your full name" autoComplete="name" />
                  <TextField label="Email Address" required type="email" value={form.email} onChange={update("email")} placeholder="Enter your email address" autoComplete="email" />
                </Row>
                <TextField label="Phone Number" required type="tel" value={form.phone} onChange={update("phone")} placeholder="(555) 123-4567" autoComplete="tel" />
              </Group>
              <Group icon={Briefcase} title="Business Information">
                <Row>
                  <TextField label="Business Name" required value={form.businessName} onChange={update("businessName")} placeholder="Enter your business name" autoComplete="organization" />
                  <TextField label="Website (if any)" value={form.currentWebsite} onChange={update("currentWebsite")} placeholder="https://yourwebsite.com" />
                </Row>
                <Row>
                  <SelectField label="Industry / Niche" required value={form.industry} onChange={update("industry")} options={OB_INDUSTRIES} />
                  <SelectField label="Business Size" value={form.businessSize} onChange={update("businessSize")} options={OB_BUSINESS_SIZES} />
                </Row>
                <TextField label="Social Media Links" value={form.socialMedia} onChange={update("socialMedia")} placeholder="Instagram, Facebook, etc." />
              </Group>
            </>
          )}

          {step === 2 && (
            <>
              <Group icon={Target} title="Confirm Your Package">
                <div className="grid gap-3 sm:grid-cols-3">
                  {OB_PACKAGES.map((p) => {
                    const on = selectedPackage === p.id;
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setSelectedPackage(p.id)}
                        className={cn(
                          "relative rounded-2xl border p-4 text-left transition",
                          on ? "border-brand bg-brand/5 ring-4 ring-brand/10" : "border-line hover:border-brand/40 hover:bg-surface-2"
                        )}
                      >
                        {p.popular && (
                          <span className="absolute -top-2.5 right-3 rounded-full bg-brand-gradient px-2.5 py-0.5 text-[10px] font-bold text-white">MOST POPULAR</span>
                        )}
                        <span className="flex items-center justify-between">
                          <span className="font-bold text-heading">{p.id}</span>
                          <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border-2", on ? "border-brand bg-brand text-white" : "border-line")}>
                            {on && <Check className="h-3 w-3" />}
                          </span>
                        </span>
                        <span className="mt-1 block text-xl font-extrabold text-brand dark:text-[#8f9bff]">{p.price}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted">{p.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </Group>
              <Group icon={Target} title="Project Goals">
                <SelectField label="What's your main goal?" value={form.mainGoal} onChange={update("mainGoal")} options={OB_MAIN_GOALS} />
                <TextArea label="Target Audience" value={form.targetAudience} onChange={update("targetAudience")} placeholder="Who are your ideal customers?" />
              </Group>
            </>
          )}

          {step === 3 && (
            <>
              <Group
                icon={LayoutGrid}
                title="Add-Ons (Optional)"
                note="Additional cost will be reviewed by your project manager and quoted separately before any work begins. You will not be charged without approval."
              >
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {OB_ADD_ONS.map((a) => (
                    <Pill key={a} label={a} on={addOns.includes(a)} onClick={() => toggle(addOns, setAddOns, a)} />
                  ))}
                </div>
              </Group>
              <Group icon={LayoutGrid} title="Pages You Need">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {OB_PAGE_OPTIONS.map((p) => (
                    <Pill key={p} label={p} on={pagesNeeded.includes(p)} onClick={() => toggle(pagesNeeded, setPagesNeeded, p)} />
                  ))}
                </div>
              </Group>
            </>
          )}

          {step === 4 && (
            <Group icon={Palette} title="Design Preferences">
              <Row>
                <SelectField label="Do you have a logo?" value={form.logoStatus} onChange={update("logoStatus")} options={OB_LOGO_STATUS} />
                <TextField label="Design Style" value={form.designStyle} onChange={update("designStyle")} placeholder="Modern, minimal, bold, elegant..." />
              </Row>
              <Row>
                <TextField label="Brand Colors" value={form.brandColors} onChange={update("brandColors")} placeholder="e.g. Purple & white" />
                <TextField label="Inspiration Websites" value={form.inspirationWebsites} onChange={update("inspirationWebsites")} placeholder="Links to sites you like" />
              </Row>
              <span className="label">Upload Your Logo</span>
              {logo ? (
                <div className="flex items-center gap-3 rounded-xl border border-line p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo.url} alt="Uploaded logo" className="h-12 w-auto rounded-lg bg-white p-1" />
                  <span className="flex-1 truncate text-sm text-fg">{logo.name}</span>
                  <span className="text-xs font-semibold text-emerald-600">Uploaded</span>
                  <button type="button" onClick={() => setLogo(null)} className="text-muted hover:text-red-500" aria-label="Remove logo">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <DropZone accept="image/*" onChange={handleLogo} busy={uploading === "logo"} pct={uploadPct} label="Click to upload your logo" hint="PNG, JPG or SVG, up to 15 MB" />
              )}
            </Group>
          )}

          {step === 5 && (
            <Group icon={FileText} title="Content Details">
              <TextField label="Homepage Headline" value={form.homepageHeadline} onChange={update("homepageHeadline")} placeholder="The first thing visitors should read" />
              <TextArea label="Business Description" value={form.businessDescription} onChange={update("businessDescription")} placeholder="Tell us what your business does" />
              <TextArea label="Services List" value={form.servicesList} onChange={update("servicesList")} placeholder="List each service with a short description" />
              <TextArea label="Contact Page Details" value={form.contactDetails} onChange={update("contactDetails")} placeholder="Address, hours, map link..." />
              <Row>
                <TextField label="Pricing Display Preference" value={form.pricingDisplay} onChange={update("pricingDisplay")} placeholder="Show prices / Contact for quote" />
                <TextField label="Product / Pricing Info" value={form.productPricingInfo} onChange={update("productPricingInfo")} placeholder="If applicable" />
              </Row>
              <TextArea label="Special Offers or Packages" value={form.specialOffers} onChange={update("specialOffers")} placeholder="Any promotions to feature" />
              <TextArea label="Additional Notes" value={form.notes} onChange={update("notes")} placeholder="Anything else we should know" />
              <span className="label">Additional Files (images, docs, etc.)</span>
              {files.length > 0 && (
                <ul className="mb-2 flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <li key={f.url} className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-xs">
                      <FileText className="h-3.5 w-3.5 text-muted" />
                      <span className="max-w-[180px] truncate">{f.name}</span>
                      <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-muted hover:text-red-500" aria-label="Remove">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <DropZone multiple onChange={handleFiles} busy={uploading === "files"} pct={uploadPct} label="Click to upload files" hint="Images, PDFs, Word or Excel files, up to 15 MB each" />
              {files.length > 0 && <p className="mt-2 text-xs font-semibold text-brand dark:text-[#8f9bff]">{files.length} file(s) uploaded</p>}
            </Group>
          )}

          {step === 6 && (
            <Group icon={ShieldCheck} title="Review Your Information">
              <div className="divide-y divide-line rounded-2xl border border-line px-4">
                <Review label="Full Name" value={form.contactPerson} />
                <Review label="Email" value={form.email} />
                <Review label="Phone" value={form.phone} />
                <Review label="Business Name" value={form.businessName} />
                <Review label="Industry" value={form.industry} />
                <Review label="Package" value={selectedPackage} />
                <Review label="Main Goal" value={form.mainGoal} />
                <Review label="Add-Ons" value={addOns.length ? addOns.join(", ") : "None selected"} />
                <Review label="Pages Needed" value={pagesNeeded.join(", ")} />
                <Review label="Design Style" value={form.designStyle} />
                <Review label="Homepage Headline" value={form.homepageHeadline} />
                <Review label="Logo Uploaded" value={logo ? "Yes" : "No"} />
                <Review label="Attachments" value={files.length ? `${files.length} file(s)` : "None"} />
              </div>
              <div className="mt-5 flex gap-3 rounded-2xl border border-brand/20 bg-brand/5 p-4 text-sm leading-relaxed text-fg">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand dark:text-[#8f9bff]" />
                <span>
                  <b className="text-heading">Timeline:</b> Most websites are completed within 10-15 business days after we receive all your content. Your information is secure.
                </span>
              </div>
            </Group>
          )}

          {error && <p className="mt-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{error}</p>}

          <div className="mt-7 flex justify-between gap-3">
            <button type="button" onClick={goBack} disabled={step === 1} className="btn btn-outline">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            {step < 6 ? (
              <button type="button" onClick={goNext} disabled={!!uploading} className="btn btn-primary">
                Next Step <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={submitting || !!uploading} className="btn btn-primary">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {submitting ? "Submitting..." : "Submit Form"}
              </button>
            )}
          </div>

          <ol className="mt-9 flex items-start">
            {OB_STEP_LABELS.map((label, i) => {
              const n = i + 1;
              const active = n === step;
              const done = n < step;
              return (
                <li key={label} className="relative flex flex-1 flex-col items-center">
                  {i > 0 && <span className={cn("absolute right-1/2 top-4 h-0.5 w-full", done || active ? "bg-brand" : "bg-line")} />}
                  <span
                    className={cn(
                      "relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                      active && "bg-brand-gradient text-white shadow-lg shadow-brand/30",
                      done && "bg-brand/15 text-brand dark:text-[#8f9bff]",
                      !active && !done && "border border-line bg-surface text-muted"
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : n}
                  </span>
                  <span className={cn("mt-2 hidden text-[11px] font-semibold sm:block", active ? "text-heading" : "text-muted")}>{label}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-6 text-center text-xs text-muted">{companyName}</p>
        </section>
      </div>

      {reviews.length > 0 && (
        <section className="mx-auto mt-8 w-full max-w-[1180px]">
          <h2 className="mb-4 text-center text-lg font-extrabold text-heading">What our clients say</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r, i) => (
              <figure key={i} className="card flex flex-col p-5">
                <div className="flex items-center justify-between">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={cn("h-4 w-4", n <= r.rating ? "fill-amber-400 text-amber-400" : "text-line")} />
                    ))}
                  </div>
                  <Quote className="h-5 w-5 text-brand/30" />
                </div>
                <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-fg">&ldquo;{r.text}&rdquo;</blockquote>
                <figcaption className="mt-4 text-sm">
                  <span className="font-bold text-heading">{r.name}</span>
                  {r.company && <span className="text-muted"> · {r.company}</span>}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Group({ icon: Icon, title, note, children }: { icon: React.ComponentType<{ className?: string }>; title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <div className="mb-1 flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand dark:text-[#8f9bff]" />
        <h3 className="font-bold text-heading">{title}</h3>
      </div>
      <div className="mb-4 border-b border-line" />
      {note && <p className="mb-4 text-xs leading-relaxed text-muted">{note}</p>}
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-x-4 sm:grid-cols-2">{children}</div>;
}

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <span className="label">
      {text} {required && <span className="text-brand dark:text-[#8f9bff]">*</span>}
    </span>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="mb-4 block">
      <Label text={label} required={required} />
      <input className="input h-11" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="mb-4 block">
      <Label text={label} />
      <textarea className="input" rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

function SelectField({ label, value, onChange, options, required }: { label: string; value: string; onChange: (v: string) => void; options: string[]; required?: boolean }) {
  return (
    <label className="mb-4 block">
      <Label text={label} required={required} />
      <select className="input h-11" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function Pill({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition",
        on ? "border-brand bg-brand/5 font-semibold text-heading" : "border-line text-fg hover:bg-surface-2"
      )}
    >
      <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded", on ? "bg-brand text-white" : "border border-muted/50")}>{on && <Check className="h-3 w-3" />}</span>
      {label}
    </button>
  );
}

function DropZone({
  onChange,
  busy,
  pct,
  label,
  hint,
  accept,
  multiple,
}: {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  busy: boolean;
  pct: number;
  label: string;
  hint: string;
  accept?: string;
  multiple?: boolean;
}) {
  return (
    <label className={cn("flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line bg-surface-2/40 px-4 py-6 text-center transition hover:border-brand/50", busy && "pointer-events-none opacity-70")}>
      {busy ? <Loader2 className="h-6 w-6 animate-spin text-brand" /> : <Upload className="h-6 w-6 text-brand dark:text-[#8f9bff]" />}
      <span className="text-sm font-semibold text-heading">{busy ? `Uploading... ${pct}%` : label}</span>
      <span className="text-xs text-muted">{hint}</span>
      <input type="file" hidden accept={accept} multiple={multiple} onChange={onChange} />
    </label>
  );
}

function Review({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold text-heading">{value}</span>
    </div>
  );
}
