import BrandLogo from "../components/brand-logo";

export default function Loading() {
  return (
    <main className="system-page">
      <div className="system-loading" aria-label="Loading AVENZO">
        <span className="system-mark"><BrandLogo size={52} priority /></span>
        <b>AVENZO</b>
        <i />
      </div>
    </main>
  );
}
