import Link from "next/link";
import { StoreHeader } from "@/components/store/StoreHeader";

const STEPS = [
  {
    n: 1,
    image: "/store/step-1.png",
    title: "Browse ingredients",
    body: "You can add as many items as you want, so long as they fit in your budget left",
  },
  {
    n: 2,
    image: "/store/step-2.png",
    title: "Send in your order",
    body: "We will deliver the ingredients to you. Just keep track of the clock!",
  },
  {
    n: 3,
    image: "/store/step-3.png",
    title: "Start cooking",
    body: "You can continue to order additional items with any money you have leftover.",
  },
];

export default function StoreAboutPage() {
  return (
    <div className="storePage">
      <StoreHeader />

      <main className="storeMain">
        <section className="storeIntro">
          <h1 className="storeHeading">How it works</h1>
          <p className="storeBody">
            The Socratica Store will deliver within 5 minutes, or your money back. Freshness is
            guaranteed ;)
          </p>
          <Link href="/store/market" className="storeButton">Get started</Link>
        </section>

        <ol className="storeSteps">
          {STEPS.map((step) => (
            <li key={step.n} className="storeStep">
              <span className="storeStepArt">
                <img src={step.image} alt="" aria-hidden />
              </span>
              <span className="storeStepHead">
                <span className="storeStepNumber">{step.n}</span>
                <span className="storeStepTitle">{step.title}</span>
              </span>
              <span className="storeStepBody">{step.body}</span>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
