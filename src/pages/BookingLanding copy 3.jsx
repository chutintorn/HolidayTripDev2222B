import SiteHeader from "../components/SiteHeader";
import MainNav from "../components/MainNav";
import TripFormBasic from "../components/TripFormBasic";

export default function BookingLanding() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      {/* Keep menu on mobile, but make it tighter by reducing padding/spacing */}
      <div className="sm:block">
        <MainNav />
      </div>

      {/* Reduce top/bottom spacing so TripFormBasic moves up on mobile */}
      <section className="mx-auto max-w-6xl px-3 sm:px-4 pt-2 sm:pt-6 pb-3 sm:pb-8">
        <TripFormBasic />
      </section>

      <footer className="border-t mt-6 sm:mt-10 bg-white">
        <div className="mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-6 text-xs text-gray-500">
          © {new Date().getFullYear()} myiBE — Demo landing
        </div>
      </footer>
    </div>
  );
}