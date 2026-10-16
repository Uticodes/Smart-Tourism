export default function Logo({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 2c-6 0-10.5 4.6-10.5 10.4C5.5 20.3 16 30 16 30s10.5-9.7 10.5-17.6C26.5 6.6 22 2 16 2z" fill="#0A7A4B" />
        <path d="M10 15.5l3.6-5.2 2.6 3.4 1.8-2.2 4 4z" fill="#F4F7F3" />
      </svg>
      <span className="whitespace-nowrap text-[17px] font-extrabold tracking-tight sm:text-[19px]">Discover Abuja</span>
    </span>
  );
}
