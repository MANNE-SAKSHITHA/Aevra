import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#F7FAFC] px-4 py-16 text-[#44576A]">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[760px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[#B7CDE3]/25 blur-[140px]"
      />
      <div className="relative w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 inline-block font-display text-lg italic text-[#44576A]"
        >
          Aevra
        </Link>
        <h1 className="font-display text-2xl italic text-[#44576A]">{title}</h1>
        <p className="mt-2 text-sm text-[#6E8499]">{subtitle}</p>

        <div className="mt-8">{children}</div>

        <p className="mt-8 text-center text-sm text-[#6E8499]">{footer}</p>
      </div>
    </main>
  );
}

export function FormField({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[#6E8499]">
        {label}
      </span>
      <input
        {...props}
        className="w-full rounded-xl border border-[#E6EDF5] bg-[#FFFFFF] px-4 py-2.5 text-sm text-[#44576A] placeholder:text-[#6E8499]/70 outline-none transition focus:border-[#AFC8DE] focus:bg-[#EEF5FA] focus:ring-2 focus:ring-[#B7CDE3]/25"
      />
    </label>
  );
}
