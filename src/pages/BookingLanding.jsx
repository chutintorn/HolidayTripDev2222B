import SiteHeader from "../components/SiteHeader";
import MainNav from "../components/MainNav";
import TripFormBasic from "../components/TripFormBasic";

export default function BookingLanding() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />
      <MainNav />

      <section className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <TripFormBasic />
      </section>

      <footer className="border-t mt-10 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-gray-500">
          © {new Date().getFullYear()} myiBE — Demo landing
        </div>
      </footer>
    </div>
  );
}
