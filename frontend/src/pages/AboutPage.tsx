"use client";

import * as React from "react";
import BikeflipHeaderPX from "@/components/layout/BikeflipHeaderPX";
import { SEOHead } from "@/components/SEO/SEOHead";
import WhoWeAreSection from "@/components/landing/WhoWeAreSection";
import BestDeliveryTimeSection from "@/components/landing/BestDeliveryTimeSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import { GuaranteesSection } from "@/components/landing/GuaranteesSection";
import { RecentDeliveriesSection } from "@/components/landing/RecentDeliveriesSection";
import { ReviewsSection } from "@/components/landing/ReviewsSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { ContactsSection } from "@/components/landing/ContactsSection";

export default function AboutPage() {
  React.useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash ? window.location.hash.slice(1) : "";
      if (!hash) return;
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  return (
    <>
      <SEOHead
        title="О нас - BikeWerk"
        description="Узнайте больше о BikeWerk - профессиональном сервисе доставки велосипедов из Европы. Наша история, процесс работы и гарантии."
        url="https://bikewerk.ru/about"
      />
      <BikeflipHeaderPX />
      <main className="min-h-screen pt-6 space-y-12 pb-20">
        <WhoWeAreSection />
        <BestDeliveryTimeSection />
        <div className="h-12" />
        <HowItWorksSection />
        <GuaranteesSection />
        <RecentDeliveriesSection />
        <ReviewsSection />
        <FAQSection />
        <ContactsSection />
      </main>
    </>
  );
}
