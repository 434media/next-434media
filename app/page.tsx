import { HeroSection } from "./components/HeroSection";
import { PortfolioGrid } from "./components/PortfolioGrid";
import ChatPopup from "./components/ai/ChatPopup";
import FAQAssistant from "./components/ai/FAQAssistant";

export default function Home() {
  return (
    <>
      <HeroSection />
      <PortfolioGrid />
      <section className="mt-24 mb-32 px-4">
        <div className="max-w-6xl mx-auto">
          <FAQAssistant />
        </div>
      </section>
      <ChatPopup />
    </>
  );
}
