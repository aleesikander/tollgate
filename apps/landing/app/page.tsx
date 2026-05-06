import { Nav } from "../components/Nav";
import { Hero } from "../components/Hero";
import { HowItWorks } from "../components/HowItWorks";
import { LiveEval } from "../components/LiveEval";
import { UseCases } from "../components/UseCases";
import { PricingTeaser } from "../components/PricingTeaser";
import { FinalCTA } from "../components/FinalCTA";
import { Footer } from "../components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="pt-[60px]">
        <Hero />
        <HowItWorks />
        <LiveEval />
        <UseCases />
        <PricingTeaser />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
