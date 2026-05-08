import { Nav } from "../components/Nav";
import { Hero } from "../components/Hero";
import { PainPoints } from "../components/PainPoints";
import { JourneyDemo } from "../components/JourneyDemo";
import { FinalCTA } from "../components/FinalCTA";
import { Footer } from "../components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="pt-[60px]">
        <Hero />
        <PainPoints />
        <JourneyDemo />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
