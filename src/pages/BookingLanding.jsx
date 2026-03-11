import { useEffect, useMemo, useState } from "react";
import SiteHeader from "../components/SiteHeader";
import MainNav from "../components/MainNav";
import TripFormBasic from "../components/TripFormBasic";

function getViewportMode() {
  if (typeof window === "undefined") {
    return {
      isWideLandscape: false,
      width: 0,
      height: 0,
    };
  }

  const width = window.innerWidth || 0;
  const height = window.innerHeight || 0;

  return {
    width,
    height,
    isWideLandscape: width > height,
  };
}

export default function BookingLanding() {
  const [viewport, setViewport] = useState(getViewportMode);

  useEffect(() => {
    const onResize = () => setViewport(getViewportMode());
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { isWideLandscape } = viewport;

  const sectionClassName = useMemo(() => {
    if (isWideLandscape) {
      return "mx-auto px-3 sm:px-4 pt-2 sm:pt-3 pb-2 sm:pb-3";
    }

    return "mx-auto max-w-6xl px-3 sm:px-4 pt-2 sm:pt-6 pb-3 sm:pb-8";
  }, [isWideLandscape]);

  const sectionStyle = useMemo(() => {
    if (!isWideLandscape) return undefined;

    return {
      width: "min(90vw, 1600px)",
      marginLeft: "auto",
      marginRight: "auto",
    };
  }, [isWideLandscape]);

  return (
    <div className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="sm:block">
        <MainNav />
      </div>

      <section className={sectionClassName} style={sectionStyle}>
        <TripFormBasic />
      </section>

      <footer className="border-t mt-4 sm:mt-6 bg-white">
        <div className="mx-auto max-w-6xl px-3 sm:px-4 py-4 sm:py-5 text-xs text-gray-500">
          © {new Date().getFullYear()} myiBE — Demo landing
        </div>
      </footer>
    </div>
  );
}